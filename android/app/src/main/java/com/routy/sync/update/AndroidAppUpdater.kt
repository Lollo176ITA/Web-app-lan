package com.routy.sync.update

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import com.routy.sync.BuildConfig
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

data class AndroidAppUpdateInfo(
  val versionName: String,
  val assetName: String,
  val downloadUrl: String,
  val workflowRunUrl: String?
)

private fun normalizeVersion(value: String) = value.trim().replace(Regex("^[^\\d]*"), "")

private fun compareVersions(left: String, right: String): Int {
  val leftParts = normalizeVersion(left).split(".").map { it.toIntOrNull() ?: 0 }
  val rightParts = normalizeVersion(right).split(".").map { it.toIntOrNull() ?: 0 }
  val maxLength = maxOf(leftParts.size, rightParts.size)

  for (index in 0 until maxLength) {
    val leftValue = leftParts.getOrElse(index) { 0 }
    val rightValue = rightParts.getOrElse(index) { 0 }

    if (leftValue == rightValue) {
      continue
    }

    return if (leftValue > rightValue) 1 else -1
  }

  return 0
}

class AndroidAppUpdater(private val context: Context) {
  private val appContext = context.applicationContext
  private val client = OkHttpClient.Builder()
    .callTimeout(10, TimeUnit.SECONDS)
    .build()

  private val rawGithubBaseUrl =
    "https://raw.githubusercontent.com/${BuildConfig.GITHUB_REPO_OWNER}/${BuildConfig.GITHUB_REPO_NAME}"

  suspend fun checkForUpdate(currentVersionName: String): AndroidAppUpdateInfo? = withContext(Dispatchers.IO) {
    try {
      val request = Request.Builder()
        .url("$rawGithubBaseUrl/${BuildConfig.ANDROID_UPDATE_BRANCH}/latest/build-info.json")
        .header("Accept", "application/json")
        .header("User-Agent", "RoutySync/$currentVersionName")
        .build()

      client.newCall(request).execute().use { response ->
        val body = response.body?.string().orEmpty()

        if (!response.isSuccessful || body.isBlank()) {
          return@withContext null
        }

        val metadata = JSONObject(body)
        val availableVersion = metadata.optString("version").trim()

        if (availableVersion.isBlank() || compareVersions(availableVersion, currentVersionName) <= 0) {
          return@withContext null
        }

        val files = metadata.optJSONArray("files") ?: return@withContext null
        var apkName: String? = null

        for (index in 0 until files.length()) {
          val candidate = files.optJSONObject(index) ?: continue
          val name = candidate.optString("name").trim()

          if (name.endsWith(".apk", ignoreCase = true)) {
            apkName = name
            break
          }
        }

        if (apkName.isNullOrBlank()) {
          return@withContext null
        }

        AndroidAppUpdateInfo(
          versionName = availableVersion,
          assetName = apkName,
          downloadUrl = "$rawGithubBaseUrl/${BuildConfig.ANDROID_UPDATE_BRANCH}/latest/$apkName",
          workflowRunUrl = metadata.optString("workflowRunUrl").takeIf { it.isNotBlank() }
        )
      }
    } catch (_: Exception) {
      null
    }
  }

  fun canRequestPackageInstalls(): Boolean {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || appContext.packageManager.canRequestPackageInstalls()
  }

  fun openInstallPermissionSettings() {
    val intent = Intent(
      Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
      Uri.parse("package:${appContext.packageName}")
    ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    appContext.startActivity(intent)
  }

  fun enqueueUpdateDownload(update: AndroidAppUpdateInfo): Long {
    val downloadManager = appContext.getSystemService(DownloadManager::class.java)
      ?: throw IOException("Download manager non disponibile.")
    val fileName = "routy-sync-${update.versionName}.apk"
    val request = DownloadManager.Request(Uri.parse(update.downloadUrl))
      .setTitle("Aggiornamento Routy Sync ${update.versionName}")
      .setDescription("Scarico l'APK dell'ultima build pubblicata su GitHub.")
      .setMimeType("application/vnd.android.package-archive")
      .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
      .setAllowedOverMetered(true)
      .setAllowedOverRoaming(true)
      .setDestinationInExternalFilesDir(appContext, Environment.DIRECTORY_DOWNLOADS, fileName)

    return downloadManager.enqueue(request)
  }

  fun installDownloadedUpdate(downloadId: Long): Boolean {
    val downloadManager = appContext.getSystemService(DownloadManager::class.java) ?: return false
    val contentUri = downloadManager.getUriForDownloadedFile(downloadId) ?: return false
    val intent = Intent(Intent.ACTION_VIEW)
      .setDataAndType(contentUri, "application/vnd.android.package-archive")
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)

    appContext.startActivity(intent)
    return true
  }
}
