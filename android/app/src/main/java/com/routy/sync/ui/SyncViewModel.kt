package com.routy.sync.ui

import android.net.Uri
import android.os.Build
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.routy.sync.AppContainer
import com.routy.sync.SyncDashboardState
import com.routy.sync.SyncRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SyncUiState(
  val hostUrl: String = "",
  val pairingCode: String = "",
  val deviceName: String = Build.MODEL ?: "Android",
  val manualSsid: String = "",
  val dashboard: SyncDashboardState = SyncDashboardState(),
  val busy: Boolean = false,
  val message: String? = null
)

class SyncViewModel(private val repository: SyncRepository) : ViewModel() {
  private val _uiState = MutableStateFlow(SyncUiState())
  val uiState: StateFlow<SyncUiState> = _uiState.asStateFlow()

  init {
    viewModelScope.launch {
      repository.observeDashboardState().collect { dashboard ->
        _uiState.update { current ->
          current.copy(
            hostUrl = current.hostUrl.ifBlank { dashboard.hostUrl },
            deviceName = current.deviceName.ifBlank { dashboard.deviceName.ifBlank { Build.MODEL ?: "Android" } },
            dashboard = dashboard
          )
        }
      }
    }

    refresh()
  }

  fun updateHostUrl(value: String) {
    _uiState.update { it.copy(hostUrl = value) }
  }

  fun updatePairingCode(value: String) {
    _uiState.update { it.copy(pairingCode = value) }
  }

  fun updateDeviceName(value: String) {
    _uiState.update { it.copy(deviceName = value) }
  }

  fun updateManualSsid(value: String) {
    _uiState.update { it.copy(manualSsid = value) }
  }

  fun dismissMessage() {
    _uiState.update { it.copy(message = null) }
  }

  fun refresh() {
    runTask("Configurazione aggiornata.") {
      repository.refreshRemoteState()
    }
  }

  fun registerDevice() {
    val snapshot = _uiState.value

    runTask("Pairing completato.") {
      repository.registerDevice(
        hostUrl = snapshot.hostUrl,
        pairingCode = snapshot.pairingCode,
        deviceName = snapshot.deviceName
      )
      repository.refreshRemoteState()
      _uiState.update { current -> current.copy(pairingCode = "") }
    }
  }

  fun addCurrentWifi() {
    val currentSsid = _uiState.value.dashboard.currentSsid

    if (currentSsid.isNullOrBlank()) {
      _uiState.update { it.copy(message = "SSID corrente non disponibile. Inseriscilo manualmente.") }
      return
    }

    runTask("Wi-Fi approvato aggiunto.") {
      repository.addApprovedSsid(currentSsid)
    }
  }

  fun addManualWifi() {
    val manualSsid = _uiState.value.manualSsid.trim()

    if (manualSsid.isBlank()) {
      return
    }

    runTask("Wi-Fi approvato aggiunto.") {
      repository.addApprovedSsid(manualSsid)
      _uiState.update { current -> current.copy(manualSsid = "") }
    }
  }

  fun attachFolder(treeUri: Uri) {
    runTask("Cartella aggiunta alla sync.") {
      repository.attachFolder(treeUri)
    }
  }

  fun removeMapping(localId: String) {
    runTask("Cartella rimossa dalla configurazione.") {
      repository.removeMapping(localId)
    }
  }

  fun syncNow() {
    runTask("Sync completata.") {
      repository.syncAll()
      repository.refreshRemoteState()
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
        return SyncViewModel(container.repository) as T
      }
    }
  }
}
