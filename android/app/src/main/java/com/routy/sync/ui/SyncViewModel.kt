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
            dashboard = dashboard
          )
        }
      }
    }

    viewModelScope.launch {
      runCatching {
        repository.refreshRemoteState()
      }
    }
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

    runTask("Pairing completato.") {
      repository.registerDevice(
        hostUrl = hostUrl,
        pairingCode = pairingCode,
        deviceName = Build.MODEL ?: "Android"
      )
      repository.refreshRemoteState()
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
    }
  }

  fun removeMapping(localId: String) {
    runTask("Cartella rimossa dalla configurazione.") {
      repository.removeMapping(localId)
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
