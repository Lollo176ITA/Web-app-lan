package com.routy.sync.ui

import android.Manifest
import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.FolderOpen
import androidx.compose.material.icons.rounded.QrCodeScanner
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.routy.sync.AppContainer
import com.routy.sync.runtime.SyncForegroundService

@Composable
fun SyncScreen(container: AppContainer) {
  val viewModel = viewModel<SyncViewModel>(factory = SyncViewModel.factory(container))
  val state by viewModel.uiState.collectAsState()
  val snackbarHostState = remember { SnackbarHostState() }
  val context = LocalContext.current
  val keepAliveInBackground = state.dashboard.isConfigured && state.dashboard.mappings.isNotEmpty()
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
  val qrScannerLauncher = rememberLauncherForActivityResult(
    contract = ScanContract()
  ) { result ->
    val contents = result.contents ?: return@rememberLauncherForActivityResult
    viewModel.pairFromQrPayload(contents)
  }
  val cameraPermissionLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestPermission()
  ) { granted ->
    if (granted) {
      qrScannerLauncher.launch(buildPairingScanOptions())
    }
  }

  LaunchedEffect(state.message) {
    val message = state.message ?: return@LaunchedEffect
    snackbarHostState.showSnackbar(message)
    viewModel.dismissMessage()
  }

  LaunchedEffect(keepAliveInBackground) {
    if (keepAliveInBackground) {
      SyncForegroundService.start(context)
    } else {
      SyncForegroundService.stop(context)
    }
  }

  Scaffold(
    topBar = {
      CenterAlignedTopAppBar(
        title = { Text("Routy Sync") },
        colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
          containerColor = MaterialTheme.colorScheme.surface
        )
      )
    },
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
        QrSection(
          state = state,
          onScanQr = {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
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

      if (state.busy) {
        item {
          LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        }
      }
    }
  }
}

@Composable
private fun QrSection(state: SyncUiState, onScanQr: () -> Unit) {
  ElevatedCard {
    if (state.dashboard.isConfigured) {
      ListItem(
        colors = ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
        leadingContent = {
          Icon(
            imageVector = Icons.Rounded.CheckCircle,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary
          )
        },
        headlineContent = {
          Text("Host collegato", fontWeight = FontWeight.SemiBold)
        },
        supportingContent = {
          Text(state.dashboard.hostUrl)
        }
      )
    } else {
      FilledTonalButton(
        onClick = onScanQr,
        enabled = !state.busy,
        modifier = Modifier
          .fillMaxWidth()
          .padding(16.dp)
          .heightIn(min = 180.dp)
      ) {
        Column(
          modifier = Modifier.fillMaxWidth(),
          horizontalAlignment = Alignment.CenterHorizontally,
          verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
          if (state.busy) {
            CircularProgressIndicator(strokeWidth = 2.dp)
          } else {
            Icon(
              imageVector = Icons.Rounded.QrCodeScanner,
              contentDescription = null,
              modifier = Modifier.size(44.dp)
            )
          }
          Text("Scansiona QR", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
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
  ElevatedCard {
    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Text("Cartelle", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
      OutlinedButton(onClick = onPickFolder, enabled = !state.busy && state.dashboard.isConfigured) {
        Icon(Icons.Rounded.FolderOpen, contentDescription = null)
        Spacer(Modifier.width(4.dp))
        Text("Scegli cartella")
      }

      if (!state.dashboard.isConfigured) {
        Text("Serve prima il QR.", style = MaterialTheme.typography.bodyMedium)
      }

      if (state.dashboard.mappings.isEmpty()) {
        Text("Nessuna cartella.", style = MaterialTheme.typography.bodyMedium)
      } else {
        Column {
          state.dashboard.mappings.forEachIndexed { index, mapping ->
            ListItem(
              colors = ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
              headlineContent = {
                Text(mapping.sourceName, fontWeight = FontWeight.SemiBold)
              },
              supportingContent = {
                Text("Ultima sync: ${mapping.lastSyncedAt?.let(::formatEpoch) ?: "mai"}")
              },
              trailingContent = {
                IconButton(onClick = { onRemoveMapping(mapping.localId) }, enabled = !state.busy) {
                  Icon(Icons.Rounded.DeleteOutline, contentDescription = "Rimuovi cartella")
                }
              }
            )

            if (index < state.dashboard.mappings.lastIndex) {
              HorizontalDivider()
            }
          }
        }
      }
    }
  }
}

private fun buildPairingScanOptions() =
  ScanOptions().apply {
    setDesiredBarcodeFormats(ScanOptions.QR_CODE)
    setPrompt("Scansiona il QR dalla pagina Sync host")
    setBeepEnabled(false)
    setOrientationLocked(false)
  }

private fun formatEpoch(value: Long): String =
  java.text.SimpleDateFormat("dd/MM HH:mm", java.util.Locale.ITALY).format(java.util.Date(value))
