package com.routy.sync

import android.content.Context
import com.routy.sync.data.DocumentTreePlanner
import com.routy.sync.data.SecureTokenStore
import com.routy.sync.data.SyncDatabase
import com.routy.sync.data.SyncPreferences
import com.routy.sync.net.SyncApiClient
import com.routy.sync.runtime.CurrentWifiProvider
import com.routy.sync.runtime.SetupNotificationManager

class AppContainer(context: Context) {
  private val appContext = context.applicationContext

  val database: SyncDatabase by lazy { SyncDatabase.create(appContext) }
  val preferences: SyncPreferences by lazy { SyncPreferences(appContext) }
  val tokenStore: SecureTokenStore by lazy { SecureTokenStore(appContext) }
  val wifiProvider: CurrentWifiProvider by lazy { CurrentWifiProvider(appContext) }
  val notificationManager: SetupNotificationManager by lazy { SetupNotificationManager(appContext) }
  val apiClient: SyncApiClient by lazy { SyncApiClient(appContext.contentResolver) }
  val documentTreePlanner: DocumentTreePlanner by lazy { DocumentTreePlanner(appContext) }
  val repository: SyncRepository by lazy {
    SyncRepository(
      appContext,
      database,
      preferences,
      tokenStore,
      apiClient,
      documentTreePlanner
    )
  }
}
