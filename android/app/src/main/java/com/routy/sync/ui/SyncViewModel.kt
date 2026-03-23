package com.routy.sync.ui

import android.net.Uri
import android.os.Build
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.routy.sync.AppContainer
import com.routy.sync.BuildConfig
import com.routy.sync.SyncDashboardState
import com.routy.sync.SyncRepository
import com.routy.sync.SyncTransferProgress
import com.routy.sync.data.SyncPreferences
import com.routy.sync.runtime.SetupNotificationManager
import com.routy.sync.update.AndroidAppUpdateInfo
import com.routy.sync.update.AndroidAppUpdater
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SyncUiState(
  val dashboard: SyncDashboardState = SyncDashboardState(),
  val hostReachable: Boolean? = null,
  val darkModeEnabled: Boolean = false,
  val backgroundSyncEnabled: Boolean = true,
  val notificationsEnabled: Boolean = true,
  val syncProgress: SyncTransferProgress? = null,
  val checkingForAppUpdate: Boolean = false,
  val appUpdate: AndroidAppUpdateInfo? = null,
  val appUpdateDownloadId: Long? = null,
  val busy: Boolean = false,
  val message: String? = null
)

class SyncViewModel(
  private val repository: SyncRepository,
  private val preferences: SyncPreferences,
  private val notificationManager: SetupNotificationManager,
  private val appUpdater: AndroidAppUpdater
) : ViewModel() {
  private val _uiState = MutableStateFlow(SyncUiState())
  val uiState: StateFlow<SyncUiState> = _uiState.asStateFlow()

  init {
    viewModelScope.launch {
      repository.observeDashboardState().collect { dashboard ->
        _uiState.update { current ->
          current.copy(
            dashboard = dashboard
          )
        }
      }
    }

    viewModelScope.launch {
      preferences.state.collect { settings ->
        _uiState.update { current ->
          current.copy(
            darkModeEnabled = settings.darkModeEnabled,
            backgroundSyncEnabled = settings.backgroundSyncEnabled,
            notificationsEnabled = settings.notificationsEnabled
          )
        }
      }
    }

    viewModelScope.launch {
      repository.observeSyncProgress().collect { progress ->
        _uiState.update { it.copy(syncProgress = progress) }
      }
    }

    viewModelScope.launch {
      runCatching {
        repository.refreshRemoteState()
        refreshHostStatusSilently()
      }
    }

    checkForAppUpdate()
  }

  fun pairFromQrPayload(rawValue: String) {
    val payload = rawValue.trim()

    if (payload.isBlank()) {
      _uiState.update { it.copy(message = "QR pairing vuoto o non valido.") }
      return
    }

    val uri = Uri.parse(payload)
    val hostUrl = uri.getQueryParameter("host")?.trim().orEmpty()
    val pairingCode = uri.getQueryParameter("code")?.trim().orEmpty()

    if (uri.scheme != "routy-sync" || uri.host != "pair" || hostUrl.isBlank() || pairingCode.isBlank()) {
      _uiState.update { it.copy(message = "QR pairing non riconosciuto.") }
      return
    }

    if (_uiState.value.dashboard.isConfigured) {
      _uiState.update { it.copy(message = "Host già collegato.") }
      return
    }

    pairWithCredentials(hostUrl = hostUrl, pairingCode = pairingCode)
  }

  fun pairManually(hostUrl: String, pairingCode: String) {
    if (_uiState.value.dashboard.isConfigured) {
      _uiState.update { it.copy(message = "Host già collegato.") }
      return
    }

    pairWithCredentials(hostUrl = hostUrl.trim(), pairingCode = pairingCode.trim())
  }

  fun refreshConnectionStatus() {
    viewModelScope.launch {
      _uiState.update { it.copy(busy = true, message = null) }

      try {
        repository.refreshRemoteState()
        refreshHostStatusSilently()
        _uiState.update { it.copy(busy = false, message = "Stato aggiornato.") }
      } catch (error: Exception) {
        _uiState.update {
          it.copy(
            busy = false,
            message = error.message ?: "Aggiornamento non riuscito."
          )
        }
      }
    }
  }

  fun disconnect() {
    viewModelScope.launch {
      _uiState.update { it.copy(busy = true, message = null) }

      try {
        repository.disconnect()
        _uiState.update {
          it.copy(
            busy = false,
            hostReachable = null,
            message = "Dispositivo scollegato."
          )
        }
      } catch (error: Exception) {
        _uiState.update {
          it.copy(
            busy = false,
            message = error.message ?: "Disconnessione non riuscita."
          )
        }
      }
    }
  }

  fun setDarkModeEnabled(enabled: Boolean) {
    viewModelScope.launch {
      repository.setDarkModeEnabled(enabled)
    }
  }

  fun setBackgroundSyncEnabled(enabled: Boolean) {
    viewModelScope.launch {
      repository.setBackgroundSyncEnabled(enabled)
      _uiState.update {
        it.copy(
          message = if (enabled) "Sync in background attivata." else "Sync in background disattivata."
        )
      }
    }
  }

  fun setNotificationsEnabled(enabled: Boolean) {
    viewModelScope.launch {
      repository.setNotificationsEnabled(enabled)
      if (!enabled) {
        notificationManager.cancelSetupNeeded()
      }
      _uiState.update {
        it.copy(
          message = if (enabled) "Notifiche attivate." else "Notifiche disattivate."
        )
      }
    }
  }

  fun syncNow() {
    runTask("Sync completata.") {
      repository.syncAll()
      repository.refreshRemoteState()
      refreshHostStatusSilently()
    }
  }

  private fun pairWithCredentials(hostUrl: String, pairingCode: String) {
    runTask("Pairing completato.") {
      repository.registerDevice(
        hostUrl = hostUrl,
        pairingCode = pairingCode,
        deviceName = Build.MODEL ?: "Android"
      )
      repository.refreshRemoteState()
      refreshHostStatusSilently()
    }
  }

  fun dismissMessage() {
    _uiState.update { it.copy(message = null) }
  }

  fun attachFolder(treeUri: Uri) {
    runTask("Cartella aggiunta alla sync.") {
      repository.attachFolder(treeUri)
      if (repository.isHostReachable()) {
        repository.trySyncAll()
        repository.refreshRemoteState()
      }
      refreshHostStatusSilently()
    }
  }

  fun removeMapping(localId: String) {
    runTask("Cartella rimossa dalla configurazione.") {
      repository.removeMapping(localId)
      refreshHostStatusSilently()
    }
  }

  fun checkForAppUpdate(showUpToDateMessage: Boolean = false) {
    viewModelScope.launch {
      _uiState.update { it.copy(checkingForAppUpdate = true) }

      try {
        val update = appUpdater.checkForUpdate(BuildConfig.VERSION_NAME)
        _uiState.update { current ->
          current.copy(
            checkingForAppUpdate = false,
            appUpdate = update,
            message = when {
              update != null -> "È disponibile Routy Sync ${update.versionName}."
              showUpToDateMessage -> "App già aggiornata."
              else -> current.message
            }
          )
        }
      } catch (error: Exception) {
        _uiState.update {
          it.copy(
            checkingForAppUpdate = false,
            message = error.message ?: "Controllo aggiornamenti non riuscito."
          )
        }
      }
    }
  }

  fun startAppUpdateDownload() {
    val update = _uiState.value.appUpdate ?: return

    if (!appUpdater.canRequestPackageInstalls()) {
      appUpdater.openInstallPermissionSettings()
      _uiState.update {
        it.copy(message = "Abilita l'installazione da questa app e riprova.")
      }
      return
    }

    try {
      val downloadId = appUpdater.enqueueUpdateDownload(update)
      _uiState.update {
        it.copy(
          appUpdateDownloadId = downloadId,
          message = "Download aggiornamento avviato."
        )
      }
    } catch (error: Exception) {
      _uiState.update {
        it.copy(message = error.message ?: "Download aggiornamento non riuscito.")
      }
    }
  }

  fun onAppUpdateDownloadCompleted(downloadId: Long) {
    if (_uiState.value.appUpdateDownloadId != downloadId) {
      return
    }

    val installed = runCatching { appUpdater.installDownloadedUpdate(downloadId) }.getOrElse { error ->
      _uiState.update {
        it.copy(
          appUpdateDownloadId = null,
          message = error.message ?: "Installazione aggiornamento non riuscita."
        )
      }
      return
    }

    _uiState.update {
      it.copy(
        appUpdateDownloadId = null,
        message = if (installed) "Installer APK aperto." else "Download completato ma installer non disponibile."
      )
    }
  }

  private suspend fun refreshHostStatusSilently() {
    val isConfigured = repository.getLocalRuntimeConfig().isConfigured

    _uiState.update {
      it.copy(
        hostReachable = if (isConfigured) repository.isHostReachable() else null
      )
    }
  }

  private fun runTask(successMessage: String, action: suspend () -> Unit) {
    viewModelScope.launch {
      _uiState.update { it.copy(busy = true, message = null) }

      try {
        action()
        _uiState.update { it.copy(busy = false, message = successMessage) }
      } catch (error: Exception) {
        _uiState.update {
          it.copy(
            busy = false,
            message = error.message ?: "Operazione non riuscita."
          )
        }
      }
    }
  }

  companion object {
    fun factory(container: AppContainer) = object : ViewModelProvider.Factory {
      @Suppress("UNCHECKED_CAST")
      override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return SyncViewModel(
          container.repository,
          container.preferences,
          container.notificationManager,
          container.appUpdater
        ) as T
      }
    }
  }
}
