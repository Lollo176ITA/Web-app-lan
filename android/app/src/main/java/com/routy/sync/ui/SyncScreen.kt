package com.routy.sync.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.FolderOpen
import androidx.compose.material.icons.rounded.Sync
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.routy.sync.AppContainer
import com.routy.sync.runtime.SyncScheduler

@Composable
fun SyncScreen(container: AppContainer) {
  val viewModel = viewModel<SyncViewModel>(factory = SyncViewModel.factory(container))
  val state by viewModel.uiState.collectAsState()
  val snackbarHostState = remember { SnackbarHostState() }
  val context = LocalContext.current
  var hasWifiPermission by remember {
    mutableStateOf(
      ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    )
  }
  val currentSsid = if (hasWifiPermission) container.wifiProvider.currentSsidOrNull() else null
  val folderPicker = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.OpenDocumentTree()
  ) { treeUri ->
    if (treeUri != null) {
      context.contentResolver.takePersistableUriPermission(
        treeUri,
        Intent.FLAG_GRANT_READ_URI_PERMISSION
      )
      viewModel.attachFolder(treeUri)
    }
  }
  val wifiPermissionLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestPermission()
  ) { granted ->
    hasWifiPermission = granted
    if (granted) {
      SyncScheduler.enqueueImmediate(context, "permission-granted")
    }
  }

  LaunchedEffect(state.message) {
    val message = state.message ?: return@LaunchedEffect
    snackbarHostState.showSnackbar(message)
    viewModel.dismissMessage()
  }

  Scaffold(
    snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
  ) { innerPadding ->
    LazyColumn(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding),
      contentPadding = PaddingValues(16.dp),
      verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
      item {
        HeadlineSection(state = state)
      }

      item {
        PairingSection(state = state, viewModel = viewModel)
      }

      item {
        WifiSection(
          state = state,
          viewModel = viewModel,
          hasWifiPermission = hasWifiPermission,
          currentSsid = currentSsid,
          onRequestWifiPermission = {
            wifiPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
          }
        )
      }

      item {
        FolderSection(
          state = state,
          onPickFolder = { folderPicker.launch(null) },
          onRemoveMapping = viewModel::removeMapping
        )
      }

      item {
        SyncActionsSection(
          state = state,
          onRefresh = viewModel::refresh,
          onSyncNow = viewModel::syncNow
        )
      }
    }
  }
}

@Composable
private fun HeadlineSection(state: SyncUiState) {
  Card(
    colors = CardDefaults.cardColors(
      containerColor = MaterialTheme.colorScheme.primaryContainer
    )
  ) {
    Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Text("Routy Sync", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
      Text(
        "Onboarding host URL -> pairing code -> cartelle Android. Dopo il pairing, il worker si attiva sui Wi-Fi approvati.",
        style = MaterialTheme.typography.bodyLarge
      )
      if (state.dashboard.isConfigured) {
        Text(
          "Host attuale: ${state.dashboard.hostUrl}",
          style = MaterialTheme.typography.bodyMedium
        )
      }
    }
  }
}

@Composable
private fun PairingSection(state: SyncUiState, viewModel: SyncViewModel) {
  Card {
    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Text("1. Pairing", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)

      OutlinedTextField(
        value = state.hostUrl,
        onValueChange = viewModel::updateHostUrl,
        modifier = Modifier.fillMaxWidth(),
        label = { Text("Host URL") },
        supportingText = { Text("Esempio: http://192.168.1.20:8787") }
      )

      OutlinedTextField(
        value = state.deviceName,
        onValueChange = viewModel::updateDeviceName,
        modifier = Modifier.fillMaxWidth(),
        label = { Text("Nome device") }
      )

      OutlinedTextField(
        value = state.pairingCode,
        onValueChange = viewModel::updatePairingCode,
        modifier = Modifier.fillMaxWidth(),
        label = { Text("Pairing code") }
      )

      Button(
        onClick = viewModel::registerDevice,
        enabled = !state.busy && state.hostUrl.isNotBlank() && state.pairingCode.isNotBlank()
      ) {
        if (state.busy) {
          CircularProgressIndicator(modifier = Modifier.height(18.dp), strokeWidth = 2.dp)
        } else {
          Text("Esegui pairing")
        }
      }
    }
  }
}

@Composable
private fun WifiSection(
  state: SyncUiState,
  viewModel: SyncViewModel,
  hasWifiPermission: Boolean,
  currentSsid: String?,
  onRequestWifiPermission: () -> Unit
) {
  Card {
    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Text("2. Wi-Fi approvati", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
      Text(
        "L’autosync parte solo sugli SSID salvati. Per leggere il nome del Wi-Fi serve anche il permesso posizione.",
        style = MaterialTheme.typography.bodyMedium
      )

      if (!hasWifiPermission) {
        FilledTonalButton(onClick = onRequestWifiPermission, enabled = !state.busy) {
          Text("Consenti accesso al Wi-Fi")
        }
        Text(
          "Senza questo permesso l’SSID resta invisibile e l’autosync non riesce a capire se sei su una rete approvata.",
          style = MaterialTheme.typography.bodySmall
        )
      } else {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          FilledTonalButton(onClick = { viewModel.addCurrentWifi(currentSsid) }, enabled = !state.busy && currentSsid != null) {
            Text(currentSsid?.let { "Aggiungi $it" } ?: "Wi-Fi corrente non rilevato")
          }
        }
        if (currentSsid == null) {
          Text(
            "SSID non disponibile. Verifica che la localizzazione Android sia attiva e che tu sia davvero su Wi-Fi.",
            style = MaterialTheme.typography.bodySmall
          )
        }
      }

      OutlinedTextField(
        value = state.manualSsid,
        onValueChange = viewModel::updateManualSsid,
        modifier = Modifier.fillMaxWidth(),
        label = { Text("SSID manuale") }
      )

      OutlinedButton(onClick = viewModel::addManualWifi, enabled = !state.busy && state.manualSsid.isNotBlank()) {
        Icon(Icons.Rounded.Add, contentDescription = null)
        Spacer(Modifier.width(4.dp))
        Text("Aggiungi SSID")
      }

      if (state.dashboard.approvedSsids.isEmpty()) {
        Text("Nessun Wi-Fi approvato.", style = MaterialTheme.typography.bodyMedium)
      } else {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          state.dashboard.approvedSsids.sorted().forEach { ssid ->
            AssistChip(onClick = {}, label = { Text(ssid) })
          }
        }
      }
    }
  }
}

@Composable
private fun FolderSection(
  state: SyncUiState,
  onPickFolder: () -> Unit,
  onRemoveMapping: (String) -> Unit
) {
  Card {
    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Text("3. Cartelle da sincronizzare", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
      OutlinedButton(onClick = onPickFolder, enabled = !state.busy && state.dashboard.isConfigured) {
        Icon(Icons.Rounded.FolderOpen, contentDescription = null)
        Spacer(Modifier.width(4.dp))
        Text("Scegli cartella")
      }

      if (!state.dashboard.isConfigured) {
        Text("Completa prima il pairing con l’host.", style = MaterialTheme.typography.bodyMedium)
      }

      if (state.dashboard.mappings.isEmpty()) {
        Text("Nessuna cartella registrata.", style = MaterialTheme.typography.bodyMedium)
      } else {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
          state.dashboard.mappings.forEach { mapping ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
              Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(mapping.sourceName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(
                  "Ultima sync locale: ${mapping.lastSyncedAt?.let(::formatEpoch) ?: "mai"}",
                  style = MaterialTheme.typography.bodyMedium
                )
                TextButton(onClick = { onRemoveMapping(mapping.localId) }, enabled = !state.busy) {
                  Icon(Icons.Rounded.DeleteOutline, contentDescription = null)
                  Spacer(Modifier.width(4.dp))
                  Text("Rimuovi")
                }
              }
            }
          }
        }
      }
    }
  }
}

@Composable
private fun SyncActionsSection(
  state: SyncUiState,
  onRefresh: () -> Unit,
  onSyncNow: () -> Unit
) {
  Card {
    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Text("4. Sync", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
      Text(
        "Il worker automatico parte sui Wi-Fi approvati. Qui puoi comunque forzare refresh config e sync manuale.",
        style = MaterialTheme.typography.bodyMedium
      )

      Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedButton(onClick = onRefresh, enabled = !state.busy && state.dashboard.isConfigured) {
          Text("Aggiorna config")
        }
        Button(onClick = onSyncNow, enabled = !state.busy && state.dashboard.isConfigured) {
          Icon(Icons.Rounded.Sync, contentDescription = null)
          Spacer(Modifier.width(4.dp))
          Text("Sync now")
        }
      }

      if (state.busy) {
        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterStart) {
          CircularProgressIndicator(strokeWidth = 2.dp)
        }
      }
    }
  }
}

private fun formatEpoch(value: Long): String =
  java.text.SimpleDateFormat("dd/MM HH:mm", java.util.Locale.ITALY).format(java.util.Date(value))
