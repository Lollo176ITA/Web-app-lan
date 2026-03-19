package com.routy.sync

import android.content.Context
import android.net.Uri
import androidx.documentfile.provider.DocumentFile
import com.routy.sync.data.DocumentTreePlanner
import com.routy.sync.data.LocalSyncEntry
import com.routy.sync.data.SecureTokenStore
import com.routy.sync.data.SyncDatabase
import com.routy.sync.data.SyncMappingEntity
import com.routy.sync.data.SyncPreferencesState
import com.routy.sync.data.SyncPreferences
import com.routy.sync.net.ApiSyncDevice
import com.routy.sync.net.SyncApiClient
import com.routy.sync.net.SyncUploadProgressSnapshot
import com.routy.sync.net.UploadableEntry
import java.io.IOException
import java.util.UUID
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.launch

data class LocalRuntimeConfig(
  val isConfigured: Boolean,
  val backgroundSyncEnabled: Boolean
)

data class SyncDashboardState(
  val hostUrl: String = "",
  val deviceId: String = "",
  val deviceName: String = "",
  val mappings: List<SyncMappingEntity> = emptyList(),
  val isConfigured: Boolean = false
)

data class SyncTransferProgress(
  val mappingName: String,
  val uploadedBytes: Long,
  val totalBytes: Long,
  val uploadedFiles: Int,
  val totalFiles: Int
) {
  val percentage: Int
    get() = if (totalBytes <= 0L) 0 else ((uploadedBytes * 100) / totalBytes).coerceIn(0L, 100L).toInt()
}

class SyncRepository(
  private val context: Context,
  private val database: SyncDatabase,
  private val preferences: SyncPreferences,
  private val tokenStore: SecureTokenStore,
  private val apiClient: SyncApiClient,
  private val documentTreePlanner: DocumentTreePlanner
) {
  private val syncMutex = Mutex()
  private val syncProgress = MutableStateFlow<SyncTransferProgress?>(null)

  fun observeDashboardState(): Flow<SyncDashboardState> =
    combine(preferences.state, database.mappingDao().observeAll()) { prefs, mappings ->
      SyncDashboardState(
        hostUrl = prefs.hostUrl,
        deviceId = prefs.deviceId,
        deviceName = prefs.deviceName,
        mappings = mappings,
        isConfigured = prefs.isConfigured && tokenStore.readToken().isNotBlank()
      )
    }

  fun observePreferencesState(): Flow<SyncPreferencesState> = preferences.state

  fun observeSyncProgress(): StateFlow<SyncTransferProgress?> = syncProgress.asStateFlow()

  suspend fun getLocalRuntimeConfig(): LocalRuntimeConfig {
    val state = preferences.getState()
    return LocalRuntimeConfig(
      isConfigured = state.isConfigured && tokenStore.readToken().isNotBlank(),
      backgroundSyncEnabled = state.backgroundSyncEnabled
    )
  }

  suspend fun registerDevice(hostUrl: String, pairingCode: String, deviceName: String) {
    val normalizedHostUrl = normalizeHostUrl(hostUrl)
    val normalizedDeviceName = deviceName.trim().ifBlank { android.os.Build.MODEL ?: "Android" }
    val result = apiClient.registerDevice(normalizedHostUrl, pairingCode.trim(), normalizedDeviceName)

    tokenStore.saveToken(result.authToken)
    preferences.saveRegistration(
      hostUrl = normalizedHostUrl,
      deviceId = result.device.id,
      deviceName = result.device.deviceName
    )
    pushConfig()
  }

  suspend fun attachFolder(treeUri: Uri) {
    val document = DocumentFile.fromTreeUri(context, treeUri) ?: return
    val sourceName = document.name?.trim().orEmpty().ifBlank { "Cartella" }
    val currentMappings = database.mappingDao().getAll()
    val existing = currentMappings.find { it.sourceName.equals(sourceName, ignoreCase = true) }

    database.mappingDao().upsert(
      (existing ?: SyncMappingEntity(
        localId = UUID.randomUUID().toString(),
        sourceName = sourceName,
        treeUri = treeUri.toString(),
        serverMappingId = null,
        lastPlannedAt = null,
        lastSyncedAt = null
      )).copy(
        sourceName = sourceName,
        treeUri = treeUri.toString()
      )
    )
    pushConfig()
  }

  suspend fun removeMapping(localId: String) {
    database.mappingDao().deleteById(localId)
    pushConfig()
  }

  suspend fun disconnect() {
    database.mappingDao().deleteAll()
    tokenStore.clear()
    preferences.clearAll()
    syncProgress.value = null
  }

  suspend fun setDarkModeEnabled(enabled: Boolean) {
    preferences.setDarkModeEnabled(enabled)
  }

  suspend fun setBackgroundSyncEnabled(enabled: Boolean) {
    preferences.setBackgroundSyncEnabled(enabled)
  }

  suspend fun refreshRemoteState() {
    val prefs = preferences.getState()
    val authToken = tokenStore.readToken()

    if (!prefs.isConfigured || authToken.isBlank()) {
      return
    }

    val remoteDevice = apiClient.fetchDeviceConfig(prefs.hostUrl, authToken)
    reconcileRemoteDevice(remoteDevice)
  }

  suspend fun isHostReachable(): Boolean {
    val hostUrl = preferences.getState().hostUrl.trim()

    if (hostUrl.isBlank()) {
      return false
    }

    return apiClient.isHostReachable(hostUrl)
  }

  suspend fun syncAll() {
    syncMutex.withLock {
      performSyncAll()
    }
  }

  suspend fun trySyncAll(): Boolean {
    if (!syncMutex.tryLock()) {
      return false
    }

    return try {
      performSyncAll()
      true
    } finally {
      syncMutex.unlock()
    }
  }

  private suspend fun performSyncAll() {
    val prefs = preferences.getState()
    val authToken = tokenStore.readToken()

    if (!prefs.isConfigured || authToken.isBlank()) {
      throw IllegalStateException("Sync app is not configured")
    }

    try {
      val mappings = ensureRemoteMappings()

      mappings.forEach { mapping ->
        val mappingId = mapping.serverMappingId ?: return@forEach
        val localEntries = documentTreePlanner.buildEntries(Uri.parse(mapping.treeUri))
        val uploadableEntries = localEntries.map { entry -> entry.toUploadableEntry() }
        val uploadableEntriesByPath = uploadableEntries.associateBy { it.relativePath }
        val plan = apiClient.planMapping(prefs.hostUrl, authToken, mappingId, uploadableEntries)
        val selectedUploads = plan.decisions
          .filter { decision -> decision.action == "upload" }
          .mapNotNull { decision -> uploadableEntriesByPath[decision.relativePath] }

        if (selectedUploads.isNotEmpty()) {
          val totalBytes = selectedUploads.sumOf { entry -> maxOf(entry.sizeBytes, 1L) }
          val totalFiles = selectedUploads.size
          val progressEvents = Channel<SyncUploadProgressSnapshot>(Channel.CONFLATED)

          coroutineScope {
            val reporter = launch {
              for (snapshot in progressEvents) {
                syncProgress.value = SyncTransferProgress(
                  mappingName = mapping.sourceName,
                  uploadedBytes = snapshot.uploadedBytes,
                  totalBytes = snapshot.totalBytes,
                  uploadedFiles = snapshot.uploadedFiles,
                  totalFiles = snapshot.totalFiles
                )
                runCatching {
                  apiClient.reportUploadProgress(
                    hostUrl = prefs.hostUrl,
                    authToken = authToken,
                    mappingId = mappingId,
                    snapshot = snapshot
                  )
                }
              }
            }

            progressEvents.trySend(
              SyncUploadProgressSnapshot(
                uploadedBytes = 0L,
                totalBytes = totalBytes,
                uploadedFiles = 0,
                totalFiles = totalFiles
              )
            )

            try {
              apiClient.uploadMapping(
                hostUrl = prefs.hostUrl,
                authToken = authToken,
                mappingId = mappingId,
                entries = selectedUploads,
                onProgress = { snapshot ->
                  progressEvents.trySend(snapshot)
                }
              )
            } finally {
              progressEvents.close()
              reporter.join()
              runCatching {
                apiClient.clearUploadProgress(
                  hostUrl = prefs.hostUrl,
                  authToken = authToken,
                  mappingId = mappingId
                )
              }
            }
          }
        }

        val syncedAt = System.currentTimeMillis()
        database.mappingDao().upsert(
          mapping.copy(
            lastPlannedAt = syncedAt,
            lastSyncedAt = syncedAt
          )
        )
      }
    } finally {
      syncProgress.value = null
    }
  }

  private suspend fun pushConfig(): ApiSyncDevice {
    val prefs = preferences.getState()
    val authToken = tokenStore.readToken()

    if (!prefs.isConfigured || authToken.isBlank()) {
      throw IllegalStateException("Sync app is not configured")
    }

    val localMappings = database.mappingDao().getAll()
    val remoteDevice = apiClient.updateDeviceConfig(
      hostUrl = prefs.hostUrl,
      authToken = authToken,
      mappings = localMappings.map { mapping -> mapping.serverMappingId to mapping.sourceName }
    )

    reconcileRemoteDevice(remoteDevice)
    return remoteDevice
  }

  private suspend fun reconcileRemoteDevice(remoteDevice: ApiSyncDevice) {
    val localMappings = database.mappingDao().getAll()
    val nextMappings = localMappings.map { localMapping ->
      val remoteMapping = remoteDevice.mappings.find { mapping -> mapping.sourceName == localMapping.sourceName }
      localMapping.copy(serverMappingId = remoteMapping?.id)
    }

    if (nextMappings.isNotEmpty()) {
      database.mappingDao().upsertAll(nextMappings)
    }
  }

  private suspend fun ensureRemoteMappings(): List<SyncMappingEntity> {
    var mappings = database.mappingDao().getAll()

    if (mappings.any { it.serverMappingId.isNullOrBlank() }) {
      pushConfig()
      mappings = database.mappingDao().getAll()
    }

    return mappings
  }

  companion object {
    fun normalizeHostUrl(value: String): String {
      val trimmed = value.trim()

      if (trimmed.isBlank()) {
        throw IOException("Host URL is required")
      }

      return if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        trimmed.trimEnd('/')
      } else {
        "http://${trimmed.trimEnd('/')}"
      }
    }
  }
}

private fun LocalSyncEntry.toUploadableEntry() = UploadableEntry(
  relativePath = relativePath,
  modifiedAtMs = modifiedAtMs,
  sizeBytes = sizeBytes,
  mimeType = mimeType,
  documentUri = documentUri
)
