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
import okio.source
import org.json.JSONArray
import org.json.JSONObject

data class ApiSyncMapping(
  val id: String,
  val sourceName: String,
  val trackedFileCount: Int,
  val lastSyncedAt: String?
)

data class ApiSyncDevice(
  val id: String,
  val deviceName: String,
  val approvedSsids: List<String>,
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

data class UploadableEntry(
  val relativePath: String,
  val modifiedAtMs: Long,
  val sizeBytes: Long,
  val mimeType: String,
  val documentUri: Uri
)

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
    approvedSsids: List<String>,
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

    val payload = JSONObject()
      .put("approvedSsids", JSONArray(approvedSsids))
      .put("mappings", mappingArray)

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
    entries: List<UploadableEntry>
  ) = withContext(Dispatchers.IO) {
    val multipartBody = MultipartBody.Builder().setType(MultipartBody.FORM).apply {
      entries.forEach { entry ->
        addFormDataPart("relativePaths", entry.relativePath)
        addFormDataPart("modifiedAtMs", entry.modifiedAtMs.toString())
        addFormDataPart(
          "files",
          entry.relativePath.substringAfterLast("/"),
          ContentUriRequestBody(contentResolver, entry.documentUri, entry.mimeType)
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

    UploadMappingResult(
      uploadedCount = response.getInt("uploadedCount"),
      skippedCount = response.getInt("skippedCount"),
      failedCount = response.getInt("failedCount"),
      lastSyncedAt = response.getString("lastSyncedAt")
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
      approvedSsids = payload.getJSONArray("approvedSsids").mapStrings(),
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

  private fun JSONArray.mapStrings() = buildList(length()) {
    for (index in 0 until length()) {
      add(getString(index))
    }
  }

  private fun <T> JSONArray.mapObjects(transform: (JSONObject) -> T) = buildList(length()) {
    for (index in 0 until length()) {
      add(transform(getJSONObject(index)))
    }
  }

  private class ContentUriRequestBody(
    private val contentResolver: ContentResolver,
    private val uri: Uri,
    private val mimeType: String
  ) : RequestBody() {
    override fun contentType() = mimeType.toMediaTypeOrNull()

    override fun writeTo(sink: BufferedSink) {
      contentResolver.openInputStream(uri)?.use { input ->
        sink.writeAll(input.source())
      } ?: throw IOException("Unable to read $uri")
    }
  }

  companion object {
    private val JSON_MEDIA_TYPE = "application/json".toMediaTypeOrNull()
  }
}
