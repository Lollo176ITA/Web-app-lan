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
    val repository = (applicationContext as RoutySyncApp).container.repository

    return try {
      repository.syncAll()
      Result.success()
    } catch (error: IOException) {
      Result.retry()
    } catch (_: IllegalStateException) {
      Result.success()
    }
  }
}
