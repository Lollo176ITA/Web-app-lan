package com.routy.sync

import android.app.Application
import com.routy.sync.runtime.WifiConnectivityMonitor

class RoutySyncApp : Application() {
  lateinit var container: AppContainer
    private set

  private var wifiConnectivityMonitor: WifiConnectivityMonitor? = null

  override fun onCreate() {
    super.onCreate()
    container = AppContainer(this)
    wifiConnectivityMonitor = WifiConnectivityMonitor(
      context = this,
      repository = container.repository,
      wifiProvider = container.wifiProvider,
      notificationManager = container.notificationManager
    ).also { monitor ->
      monitor.start()
    }
  }
}
