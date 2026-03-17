package com.routy.sync.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.routy.sync.RoutySyncApp
import java.io.IOException

class SyncWorker(
  appContext: Context,
  workerParameters: WorkerParameters
) : CoroutineWorker(appContext, workerParameters) {
  override suspend fun doWork(): Result {
    val container = (applicationContext as RoutySyncApp).container
    val repository = container.repository
    val wifiProvider = container.wifiProvider

    return try {
      val runtimeConfig = repository.getLocalRuntimeConfig()

      if (!runtimeConfig.isConfigured) {
        return Result.success()
      }

      if (!wifiProvider.isWifiConnected()) {
        return Result.success()
      }

      if (!repository.isHostReachable()) {
        return Result.success()
      }

      repository.syncAll()
      Result.success()
    } catch (error: IOException) {
      Result.retry()
    } catch (_: IllegalStateException) {
      Result.success()
    }
  }
}
