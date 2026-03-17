package com.routy.sync.runtime

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.routy.sync.MainActivity
import com.routy.sync.SyncRepository
import com.routy.sync.worker.SyncWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class CurrentWifiProvider(private val context: Context) {
  private val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
  private val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager

  fun isWifiConnected(): Boolean {
    val capabilities = connectivityManager.getNetworkCapabilities(connectivityManager.activeNetwork) ?: return false
    return capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
  }

  @SuppressLint("MissingPermission")
  fun currentSsidOrNull(): String? {
    val hasPermission =
      ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    if (!hasPermission) {
      return null
    }

    val ssid = wifiManager.connectionInfo?.ssid?.trim()?.removePrefix("\"")?.removeSuffix("\"")
    return ssid?.takeUnless { it.isBlank() || it == WifiManager.UNKNOWN_SSID }
  }
}

object SyncScheduler {
  private const val UNIQUE_WORK_NAME = "routy-sync-auto"

  fun enqueueImmediate(context: Context, reason: String) {
    val request = OneTimeWorkRequestBuilder<SyncWorker>()
      .setInputData(workDataOf("reason" to reason))
      .setConstraints(
        Constraints.Builder()
          .setRequiredNetworkType(NetworkType.UNMETERED)
          .build()
      )
      .build()

    WorkManager.getInstance(context).enqueueUniqueWork(
      UNIQUE_WORK_NAME,
      androidx.work.ExistingWorkPolicy.REPLACE,
      request
    )
  }
}

class SetupNotificationManager(private val context: Context) {
  private val manager = NotificationManagerCompat.from(context)

  fun showSetupNeeded() {
    ensureChannel()

    val intent = Intent(context, MainActivity::class.java)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    val pendingIntent = PendingIntent.getActivity(
      context,
      1001,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_sys_upload_done)
      .setContentTitle("Configura Routy Sync")
      .setContentText("Collegati all'host LAN e scegli le cartelle da sincronizzare.")
      .setContentIntent(pendingIntent)
      .setAutoCancel(true)
      .build()

    try {
      manager.notify(SETUP_NOTIFICATION_ID, notification)
    } catch (_: SecurityException) {
      // Ignore when notification permission is not granted yet.
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Routy Sync",
      NotificationManager.IMPORTANCE_DEFAULT
    )
    notificationManager.createNotificationChannel(channel)
  }

  companion object {
    private const val CHANNEL_ID = "routy-sync-setup"
    private const val SETUP_NOTIFICATION_ID = 5011
  }
}

class WifiConnectivityMonitor(
  context: Context,
  private val repository: SyncRepository,
  private val wifiProvider: CurrentWifiProvider,
  private val notificationManager: SetupNotificationManager
) {
  private val appContext = context.applicationContext
  private val connectivityManager = appContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  fun start() {
    connectivityManager.registerDefaultNetworkCallback(
      object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
          handleNetworkChange()
        }

        override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) {
          handleNetworkChange()
        }
      }
    )
  }

  private fun handleNetworkChange() {
    scope.launch {
      if (!wifiProvider.isWifiConnected()) {
        return@launch
      }

      val runtimeConfig = repository.getLocalRuntimeConfig()

      if (!runtimeConfig.isConfigured) {
        notificationManager.showSetupNeeded()
        return@launch
      }

      val currentSsid = wifiProvider.currentSsidOrNull() ?: return@launch

      if (runtimeConfig.approvedSsids.contains(currentSsid)) {
        SyncScheduler.enqueueImmediate(appContext, "wifi:$currentSsid")
      }
    }
  }
}
