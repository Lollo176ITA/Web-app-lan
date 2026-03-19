package com.routy.sync.net

import android.content.ContentResolver
import android.net.Uri
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okio.BufferedSink
import okio.ForwardingSink
import okio.buffer
import okio.source
import org.json.JSONArray
import org.json.JSONObject

private const val UPLOAD_TARGET_BATCH_BYTES = 24L * 1024L * 1024L
private const val UPLOAD_LARGE_FILE_THRESHOLD_BYTES = 16L * 1024L * 1024L
private const val UPLOAD_MAX_BATCH_SIZE = 60

data class ApiSyncMapping(
  val id: String,
  val sourceName: String,
  val trackedFileCount: Int,
  val lastSyncedAt: String?
)

data class ApiSyncDevice(
  val id: String,
  val deviceName: String,
  val mappings: List<ApiSyncMapping>
)

data class RegisterDeviceResult(
  val authToken: String,
  val device: ApiSyncDevice
)

data class PlanDecision(
  val relativePath: String,
  val action: String,
  val reason: String
)

data class PlanMappingResult(
  val decisions: List<PlanDecision>,
  val uploadCount: Int,
  val skippedCount: Int
)

data class UploadMappingResult(
  val uploadedCount: Int,
  val skippedCount: Int,
  val failedCount: Int,
  val lastSyncedAt: String
)

data class SyncUploadProgressSnapshot(
  val uploadedBytes: Long,
  val totalBytes: Long,
  val uploadedFiles: Int,
  val totalFiles: Int
) {
  val percentage: Int
    get() = if (totalBytes <= 0L) 0 else ((uploadedBytes * 100) / totalBytes).coerceIn(0L, 100L).toInt()
}

data class UploadableEntry(
  val relativePath: String,
  val modifiedAtMs: Long,
  val sizeBytes: Long,
  val mimeType: String,
  val documentUri: Uri
)

private data class UploadBatch(
  val indexedEntries: List<IndexedValue<UploadableEntry>>
)

private fun uploadEntrySize(entry: UploadableEntry) = maxOf(entry.sizeBytes, 1L)

private fun buildUploadBatches(entries: List<UploadableEntry>): List<UploadBatch> {
  val batches = mutableListOf<UploadBatch>()
  var startIndex = 0

  while (startIndex < entries.size) {
    val indexedEntries = mutableListOf<IndexedValue<UploadableEntry>>()
    var batchBytes = 0L
    var index = startIndex

    while (index < entries.size) {
      val entry = entries[index]
      val entryBytes = uploadEntrySize(entry)

      if (indexedEntries.isEmpty()) {
        indexedEntries += IndexedValue(index, entry)
        batchBytes += entryBytes
        index += 1

        if (entryBytes >= UPLOAD_LARGE_FILE_THRESHOLD_BYTES) {
          break
        }

        continue
      }

      if (
        entryBytes >= UPLOAD_LARGE_FILE_THRESHOLD_BYTES ||
        indexedEntries.size >= UPLOAD_MAX_BATCH_SIZE ||
        batchBytes + entryBytes > UPLOAD_TARGET_BATCH_BYTES
      ) {
        break
      }

      indexedEntries += IndexedValue(index, entry)
      batchBytes += entryBytes
      index += 1
    }

    batches += UploadBatch(indexedEntries = indexedEntries)
    startIndex = index
  }

  return batches
}

class SyncApiClient(private val contentResolver: ContentResolver) {
  private val client = OkHttpClient.Builder().build()
  private val probeClient = client.newBuilder()
    .callTimeout(5, TimeUnit.SECONDS)
    .build()

  suspend fun registerDevice(hostUrl: String, pairingCode: String, deviceName: String) =
    withContext(Dispatchers.IO) {
      val payload = JSONObject()
        .put("pairingCode", pairingCode)
        .put("deviceName", deviceName)
        .put("platform", "android")

      val response = executeJson(
        Request.Builder()
          .url(buildUrl(hostUrl, "/api/sync/register"))
          .post(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
          .build()
      )

      RegisterDeviceResult(
        authToken = response.getString("authToken"),
        device = parseDevice(response.getJSONObject("device"))
      )
    }

  suspend fun fetchDeviceConfig(hostUrl: String, authToken: String) = withContext(Dispatchers.IO) {
    val response = executeJson(
      Request.Builder()
        .url(buildUrl(hostUrl, "/api/sync/device/config"))
        .header("Authorization", "Bearer $authToken")
        .get()
        .build()
    )

    parseDevice(response.getJSONObject("device"))
  }

  suspend fun updateDeviceConfig(
    hostUrl: String,
    authToken: String,
    mappings: List<Pair<String?, String>>
  ) = withContext(Dispatchers.IO) {
    val mappingArray = JSONArray()

    mappings.forEach { (mappingId, sourceName) ->
      mappingArray.put(
        JSONObject()
          .put("id", mappingId)
          .put("sourceName", sourceName)
      )
    }

    val payload = JSONObject().put("mappings", mappingArray)

    val response = executeJson(
      Request.Builder()
        .url(buildUrl(hostUrl, "/api/sync/device/config"))
        .header("Authorization", "Bearer $authToken")
        .put(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
        .build()
    )

    parseDevice(response.getJSONObject("device"))
  }

  suspend fun planMapping(
    hostUrl: String,
    authToken: String,
    mappingId: String,
    entries: List<UploadableEntry>
  ) = withContext(Dispatchers.IO) {
    val entryArray = JSONArray()

    entries.forEach { entry ->
      entryArray.put(
        JSONObject()
          .put("relativePath", entry.relativePath)
          .put("sizeBytes", entry.sizeBytes)
          .put("modifiedAtMs", entry.modifiedAtMs)
      )
    }

    val payload = JSONObject().put("entries", entryArray)
    val response = executeJson(
      Request.Builder()
        .url(buildUrl(hostUrl, "/api/sync/mappings/$mappingId/plan"))
        .header("Authorization", "Bearer $authToken")
        .post(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
        .build()
    )

    PlanMappingResult(
      decisions = response.getJSONArray("decisions").mapObjects { item ->
        PlanDecision(
          relativePath = item.getString("relativePath"),
          action = item.getString("action"),
          reason = item.getString("reason")
        )
      },
      uploadCount = response.getInt("uploadCount"),
      skippedCount = response.getInt("skippedCount")
    )
  }

  suspend fun uploadMapping(
    hostUrl: String,
    authToken: String,
    mappingId: String,
    entries: List<UploadableEntry>,
    onProgress: ((SyncUploadProgressSnapshot) -> Unit)? = null
  ) = withContext(Dispatchers.IO) {
    val totalBytes = entries.sumOf(::uploadEntrySize)
    val uploadedBytesByIndex = LongArray(entries.size)
    val batches = buildUploadBatches(entries)
    var lastPercentage = -1
    var uploadedCount = 0
    var skippedCount = 0
    var failedCount = 0
    var lastSyncedAt = ""

    fun emitProgress() {
      val uploadedBytes = uploadedBytesByIndex.sum()
      val uploadedFiles = entries.indices.count { index ->
        uploadedBytesByIndex[index] >= uploadEntrySize(entries[index])
      }
      val snapshot = SyncUploadProgressSnapshot(
        uploadedBytes = uploadedBytes,
        totalBytes = totalBytes,
        uploadedFiles = uploadedFiles,
        totalFiles = entries.size
      )

      if (snapshot.percentage != lastPercentage || snapshot.uploadedFiles == snapshot.totalFiles) {
        lastPercentage = snapshot.percentage
        onProgress?.invoke(snapshot)
      }
    }

    onProgress?.invoke(
      SyncUploadProgressSnapshot(
        uploadedBytes = 0L,
        totalBytes = totalBytes,
        uploadedFiles = 0,
        totalFiles = entries.size
      )
    )

    batches.forEach { batch ->
      val multipartBody = MultipartBody.Builder().setType(MultipartBody.FORM).apply {
        batch.indexedEntries.forEach { indexedEntry ->
          val index = indexedEntry.index
          val entry = indexedEntry.value
          addFormDataPart("relativePaths", entry.relativePath)
          addFormDataPart("modifiedAtMs", entry.modifiedAtMs.toString())
          addFormDataPart(
            "files",
            entry.relativePath.substringAfterLast("/"),
            ContentUriRequestBody(contentResolver, entry.documentUri, entry.mimeType) { writtenForFile ->
              uploadedBytesByIndex[index] = minOf(writtenForFile, uploadEntrySize(entry))
              emitProgress()
            }
          )
        }
      }.build()

      val response = executeJson(
        Request.Builder()
          .url(buildUrl(hostUrl, "/api/sync/mappings/$mappingId/upload"))
          .header("Authorization", "Bearer $authToken")
          .post(multipartBody)
          .build()
      )

      uploadedCount += response.getInt("uploadedCount")
      skippedCount += response.getInt("skippedCount")
      failedCount += response.getInt("failedCount")
      lastSyncedAt = response.getString("lastSyncedAt")
    }

    UploadMappingResult(
      uploadedCount = uploadedCount,
      skippedCount = skippedCount,
      failedCount = failedCount,
      lastSyncedAt = lastSyncedAt
    )
  }

  suspend fun reportUploadProgress(
    hostUrl: String,
    authToken: String,
    mappingId: String,
    snapshot: SyncUploadProgressSnapshot
  ) = withContext(Dispatchers.IO) {
    val payload = JSONObject()
      .put("uploadedBytes", snapshot.uploadedBytes)
      .put("totalBytes", snapshot.totalBytes)
      .put("uploadedFiles", snapshot.uploadedFiles)
      .put("totalFiles", snapshot.totalFiles)

    executeJson(
      Request.Builder()
        .url(buildUrl(hostUrl, "/api/sync/mappings/$mappingId/progress"))
        .header("Authorization", "Bearer $authToken")
        .put(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
        .build()
    )
  }

  suspend fun clearUploadProgress(
    hostUrl: String,
    authToken: String,
    mappingId: String
  ) = withContext(Dispatchers.IO) {
    // Report 100% before cleanup so the host page sees a completed state briefly.
    executeJson(
      Request.Builder()
        .url(buildUrl(hostUrl, "/api/sync/mappings/$mappingId/progress"))
        .header("Authorization", "Bearer $authToken")
        .put(
          JSONObject()
            .put("uploadedBytes", 0)
            .put("totalBytes", 0)
            .put("uploadedFiles", 0)
            .put("totalFiles", 0)
            .toString()
            .toRequestBody(JSON_MEDIA_TYPE)
        )
        .build()
    )
  }

  suspend fun isHostReachable(hostUrl: String) = withContext(Dispatchers.IO) {
    try {
      probeClient.newCall(
        Request.Builder()
          .url(buildUrl(hostUrl, "/api/health"))
          .get()
          .build()
      ).execute().use { response ->
        response.isSuccessful
      }
    } catch (_: IOException) {
      false
    }
  }

  private fun parseDevice(payload: JSONObject) =
    ApiSyncDevice(
      id = payload.getString("id"),
      deviceName = payload.getString("deviceName"),
      mappings = payload.getJSONArray("mappings").mapObjects { mapping ->
        ApiSyncMapping(
          id = mapping.getString("id"),
          sourceName = mapping.getString("sourceName"),
          trackedFileCount = mapping.optInt("trackedFileCount"),
          lastSyncedAt = mapping.optString("lastSyncedAt").takeIf { it.isNotBlank() }
        )
      }
    )

  private fun executeJson(request: Request): JSONObject {
    client.newCall(request).execute().use { response ->
      val body = response.body?.string().orEmpty()

      if (!response.isSuccessful) {
        throw IOException(body.ifBlank { "Sync request failed: ${response.code}" })
      }

      return if (body.isBlank()) JSONObject() else JSONObject(body)
    }
  }

  private fun buildUrl(hostUrl: String, path: String) =
    "${hostUrl.trim().trimEnd('/')}$path"

  private fun <T> JSONArray.mapObjects(transform: (JSONObject) -> T) = buildList(length()) {
    for (index in 0 until length()) {
      add(transform(getJSONObject(index)))
    }
  }

  private class ContentUriRequestBody(
    private val contentResolver: ContentResolver,
    private val uri: Uri,
    private val mimeType: String,
    private val onBytesWritten: ((Long) -> Unit)? = null
  ) : RequestBody() {
    override fun contentType() = mimeType.toMediaTypeOrNull()

    override fun writeTo(sink: BufferedSink) {
      contentResolver.openInputStream(uri)?.use { input ->
        var written = 0L
        val countingSink = object : ForwardingSink(sink) {
          override fun write(source: okio.Buffer, byteCount: Long) {
            super.write(source, byteCount)
            written += byteCount
            onBytesWritten?.invoke(written)
          }
        }.buffer()

        countingSink.writeAll(input.source())
        countingSink.flush()
      } ?: throw IOException("Unable to read $uri")
    }
  }

  companion object {
    private val JSON_MEDIA_TYPE = "application/json".toMediaTypeOrNull()
  }
}
