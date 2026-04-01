package com.routy.sync.ui

import android.Manifest
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Devices
import androidx.compose.material.icons.rounded.DarkMode
import androidx.compose.material.icons.rounded.FolderOpen
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Link
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PowerSettingsNew
import androidx.compose.material.icons.rounded.QrCodeScanner
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.Sync
import androidx.compose.material.icons.rounded.Wifi
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.routy.sync.AppContainer
import com.routy.sync.BuildConfig
import com.routy.sync.R
import com.routy.sync.data.SyncMappingEntity
import com.routy.sync.runtime.SyncForegroundService
import kotlinx.coroutines.launch

private enum class SyncTab(
  val label: String,
  val icon: ImageVector,
  val activeIcon: ImageVector
) {
  Qr("Scansione", Icons.Rounded.QrCodeScanner, Icons.Filled.QrCodeScanner),
  Folders("Cartelle", Icons.Rounded.FolderOpen, Icons.Filled.FolderOpen),
  Activity("Attività", Icons.Rounded.History, Icons.Filled.History),
  Settings("Impostazioni", Icons.Rounded.Settings, Icons.Filled.Settings)
}

private enum class ActivityStatus {
  Completed,
  Syncing,
  Pending
}

private data class ActivityFeedItem(
  val title: String,
  val subtitle: String,
  val status: ActivityStatus
)

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun SyncScreen(container: AppContainer) {
  val viewModel = viewModel<SyncViewModel>(factory = SyncViewModel.factory(container))
  val state by viewModel.uiState.collectAsState()
  val snackbarHostState = remember { SnackbarHostState() }
  val context = LocalContext.current
  val lifecycleOwner = LocalLifecycleOwner.current
  var manualPairingVisible by rememberSaveable { mutableStateOf(false) }
  var systemNotificationsEnabled by remember { mutableStateOf(container.notificationManager.areNotificationsEnabled()) }
  val pagerState = rememberPagerState(
    initialPage = SyncTab.Qr.ordinal,
    pageCount = { SyncTab.entries.size }
  )
  val coroutineScope = rememberCoroutineScope()
  val selectedTab = SyncTab.entries[pagerState.currentPage]
  val keepAliveInBackground = state.backgroundSyncEnabled && state.dashboard.isConfigured && state.dashboard.mappings.isNotEmpty()
  val refreshNotificationStatus = remember(container) {
    { systemNotificationsEnabled = container.notificationManager.areNotificationsEnabled() }
  }
  val navigateToTab: (SyncTab) -> Unit = { tab ->
    if (pagerState.currentPage != tab.ordinal) {
      coroutineScope.launch {
        pagerState.animateScrollToPage(tab.ordinal)
      }
    }
  }

  val folderPicker = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.OpenDocumentTree()
  ) { treeUri ->
    if (treeUri != null) {
      context.contentResolver.takePersistableUriPermission(
        treeUri,
        Intent.FLAG_GRANT_READ_URI_PERMISSION
      )
      viewModel.attachFolder(treeUri)
      navigateToTab(SyncTab.Folders)
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
    } else {
      viewModel.dismissMessage()
    }
  }

  val notificationPermissionLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestPermission()
  ) { granted ->
    refreshNotificationStatus()
    if (granted) {
      viewModel.setNotificationsEnabled(true)
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

  DisposableEffect(lifecycleOwner, container) {
    val observer = LifecycleEventObserver { _, event ->
      if (event == Lifecycle.Event.ON_RESUME) {
        refreshNotificationStatus()
      }
    }
    lifecycleOwner.lifecycle.addObserver(observer)
    onDispose {
      lifecycleOwner.lifecycle.removeObserver(observer)
    }
  }

  DisposableEffect(context, state.appUpdateDownloadId) {
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(receiverContext: Context, intent: Intent) {
        if (intent.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE) {
          return
        }

        val downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L)

        if (downloadId > 0L) {
          viewModel.onAppUpdateDownloadCompleted(downloadId)
        }
      }
    }

    val filter = IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      context.registerReceiver(receiver, filter)
    }

    onDispose {
      runCatching { context.unregisterReceiver(receiver) }
    }
  }

  Box(modifier = Modifier.fillMaxSize()) {
    SyncBackdrop()

    Scaffold(
      containerColor = Color.Transparent,
      contentWindowInsets = WindowInsets(0, 0, 0, 0),
      snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
      bottomBar = {
        FloatingBottomBar(
          selectedTab = selectedTab,
          onSelectTab = navigateToTab
        )
      }
    ) { innerPadding ->
      Column(
        modifier = Modifier
          .fillMaxSize()
          .padding(innerPadding)
      ) {
        SyncTopBar(
          notificationsEnabled = state.notificationsEnabled && systemNotificationsEnabled,
          onToggleNotifications = {
            val notificationPermissionGranted =
              Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                ContextCompat.checkSelfPermission(
                  context,
                  Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED

            when {
              state.notificationsEnabled && systemNotificationsEnabled -> {
                viewModel.setNotificationsEnabled(false)
                refreshNotificationStatus()
              }

              !notificationPermissionGranted -> {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
              }

              !systemNotificationsEnabled -> {
                container.notificationManager.openNotificationSettings()
              }

              else -> {
                viewModel.setNotificationsEnabled(true)
                refreshNotificationStatus()
              }
            }
          }
        )

        // Evita smart-cast su proprieta' potenzialmente instabile/complessa.
        val syncProgress = state.syncProgress
        if (syncProgress != null) {
          UploadProgressBanner(progress = syncProgress)
        }

        if (state.busy) {
          LinearProgressIndicator(
            modifier = Modifier.fillMaxWidth(),
            color = MaterialTheme.colorScheme.primary,
            trackColor = MaterialTheme.colorScheme.surfaceContainerHigh
          )
        }

        HorizontalPager(
          state = pagerState,
          modifier = Modifier
            .fillMaxWidth()
            .weight(1f)
        ) { page ->
          when (SyncTab.entries[page]) {
            SyncTab.Qr -> QrTab(
              state = state,
              onScanQr = { cameraPermissionLauncher.launch(Manifest.permission.CAMERA) },
              onOpenManualPairing = { manualPairingVisible = true },
              onOpenFolders = { navigateToTab(SyncTab.Folders) }
            )

            SyncTab.Folders -> FoldersTab(
              state = state,
              onPickFolder = { folderPicker.launch(null) },
              onRemoveMapping = viewModel::removeMapping,
              onOpenQr = { navigateToTab(SyncTab.Qr) }
            )

            SyncTab.Activity -> ActivityTab(state = state)

            SyncTab.Settings -> SettingsTab(
              state = state,
              onToggleDarkMode = viewModel::setDarkModeEnabled,
              onToggleBackgroundSync = viewModel::setBackgroundSyncEnabled,
              onCheckForAppUpdate = { viewModel.checkForAppUpdate(showUpToDateMessage = true) },
              onStartAppUpdate = viewModel::startAppUpdateDownload,
              onSyncNow = viewModel::syncNow,
              onRefreshStatus = viewModel::refreshConnectionStatus,
              onDisconnect = viewModel::disconnect
            )
          }
        }
      }
    }
  }

  if (manualPairingVisible) {
    ManualPairingDialog(
      onDismiss = { manualPairingVisible = false },
      onSubmit = { hostUrl, code ->
        manualPairingVisible = false
        viewModel.pairManually(hostUrl = hostUrl, pairingCode = code)
      }
    )
  }
}

@Composable
private fun SyncTopBar(
  notificationsEnabled: Boolean,
  onToggleNotifications: () -> Unit
) {
  val isDarkSurface = MaterialTheme.colorScheme.surface.luminance() < 0.5f
  val logoRes = if (isDarkSurface) R.drawable.logo_nero else R.drawable.logo_bianco

  Row(
    modifier = Modifier
      .fillMaxWidth()
      .statusBarsPadding()
      .padding(horizontal = 20.dp, vertical = 14.dp),
    horizontalArrangement = Arrangement.SpaceBetween,
    verticalAlignment = Alignment.CenterVertically
  ) {
    Row(
      horizontalArrangement = Arrangement.spacedBy(12.dp),
      verticalAlignment = Alignment.CenterVertically
    ) {
      Image(
        painter = painterResource(id = logoRes),
        contentDescription = "Logo Routy Sync",
        modifier = Modifier
          .size(44.dp)
          .clip(RoundedCornerShape(14.dp))
      )

      Column {
        Text(
          text = "Routy Sync",
          style = MaterialTheme.typography.titleLarge,
          color = Color(0xFF9D7BFF)
        )
        Text(
          text = "LAN sync companion",
          style = MaterialTheme.typography.labelMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }
    }

    IconButton(
      onClick = onToggleNotifications,
      colors = IconButtonDefaults.iconButtonColors(
        containerColor = if (notificationsEnabled) {
          Color(0xFFEDE4FF)
        } else {
          MaterialTheme.colorScheme.surfaceContainerLow
        },
        contentColor = if (notificationsEnabled) {
          Color(0xFF7C4DFF)
        } else {
          MaterialTheme.colorScheme.onSurfaceVariant
        }
      )
    ) {
      Icon(
        Icons.Rounded.Notifications,
        contentDescription = if (notificationsEnabled) "Disattiva notifiche" else "Attiva notifiche"
      )
    }
  }
}

@Composable
private fun QrTab(
  state: SyncUiState,
  onScanQr: () -> Unit,
  onOpenManualPairing: () -> Unit,
  onOpenFolders: () -> Unit
) {
  LazyColumn(
    modifier = Modifier.fillMaxSize(),
    contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 140.dp),
    verticalArrangement = Arrangement.spacedBy(18.dp)
  ) {
    if (state.dashboard.isConfigured) {
      item {
        ScreenHeading(
          title = "Connessione riuscita",
          subtitle = "Host collegato e sincronizzazione pronta."
        )
      }

      item {
        SuccessHero(
          hostUrl = state.dashboard.hostUrl,
          hostReachable = state.hostReachable,
          mappingCount = state.dashboard.mappings.size
        )
      }

      item {
        PrimaryGradientButton(
          text = "Gestisci cartelle",
          onClick = onOpenFolders
        )
      }
    } else {
      item {
        ScreenHeading(
          title = "Scansiona QR",
          subtitle = "Collega il dispositivo host alla stessa rete locale."
        )
      }

      item {
        ScannerCard(
          isBusy = state.busy,
          onScanQr = onScanQr
        )
      }

      item {
        InfoCard(
          icon = Icons.Rounded.Devices,
          title = "Come connettersi",
          text = "Apri Routy sull'host, genera il QR di pairing e inquadrarlo da qui."
        )
      }

      item {
        Surface(
          color = MaterialTheme.colorScheme.surfaceContainerLow,
          shape = MaterialTheme.shapes.medium
        ) {
          Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
          ) {
            InlineFact(Icons.Rounded.Wifi, "Entrambi i dispositivi devono stare sulla stessa rete Wi-Fi.")
            InlineFact(Icons.Rounded.Link, "Puoi anche inserire host e codice di pairing manualmente.")
          }
        }
      }

      item {
        TextButton(
          onClick = onOpenManualPairing,
          modifier = Modifier.fillMaxWidth()
        ) {
          Text("Inserimento manuale")
        }
      }
    }
  }
}

@Composable
private fun FoldersTab(
  state: SyncUiState,
  onPickFolder: () -> Unit,
  onRemoveMapping: (String) -> Unit,
  onOpenQr: () -> Unit
) {
  LazyColumn(
    modifier = Modifier.fillMaxSize(),
    contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 140.dp),
    verticalArrangement = Arrangement.spacedBy(18.dp)
  ) {
    item {
      ScreenHeading(
        title = "Cartelle sincronizzate",
        subtitle = "Organizza le sorgenti locali che Routy deve osservare."
      )
    }

    item {
      Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        PrimaryGradientButton(
          text = "Aggiungi cartella",
          enabled = state.dashboard.isConfigured && !state.busy,
          onClick = onPickFolder,
          modifier = Modifier.weight(1f)
        )

        Surface(
          modifier = Modifier
            .height(56.dp)
            .weight(0.44f),
          color = MaterialTheme.colorScheme.surfaceContainerLow,
          shape = RoundedCornerShape(28.dp)
        ) {
          Box(contentAlignment = Alignment.Center) {
            Text(
              text = "${state.dashboard.mappings.size}",
              style = MaterialTheme.typography.titleMedium,
              fontWeight = FontWeight.Bold
            )
          }
        }
      }
    }

    if (!state.dashboard.isConfigured) {
      item {
        EmptyStateCard(
          title = "Serve prima il pairing",
          subtitle = "Collega l'host dalla tab QR prima di aggiungere cartelle.",
          actionLabel = "Apri QR",
          onAction = onOpenQr
        )
      }
    } else if (state.dashboard.mappings.isEmpty()) {
      item {
        EmptyStateCard(
          title = "Nessuna cartella collegata",
          subtitle = "Scegli una directory Android e Routy la assocerà alla configurazione remota.",
          actionLabel = "Scegli cartella",
          onAction = onPickFolder
        )
      }
    } else {
      itemsIndexed(state.dashboard.mappings, key = { _, mapping -> mapping.localId }) { index, mapping ->
        FolderCard(
          mapping = mapping,
          isBusy = state.busy,
          onRemove = { onRemoveMapping(mapping.localId) }
        )

        if (index == state.dashboard.mappings.lastIndex) {
          Spacer(modifier = Modifier.height(8.dp))
        }
      }
    }
  }
}

@Composable
private fun ActivityTab(state: SyncUiState) {
  val activityItems = remember(state.dashboard.mappings, state.busy) {
    state.dashboard.mappings
      .sortedByDescending { it.lastSyncedAt ?: it.lastPlannedAt ?: 0L }
      .mapIndexed { index, mapping ->
        ActivityFeedItem(
          title = mapping.sourceName,
          subtitle = when {
            state.busy && index == 0 -> "Sincronizzazione in corso"
            mapping.lastSyncedAt != null -> "Ultima sync ${formatEpoch(mapping.lastSyncedAt)}"
            else -> "In attesa del primo push"
          },
          status = when {
            state.busy && index == 0 -> ActivityStatus.Syncing
            mapping.lastSyncedAt != null -> ActivityStatus.Completed
            else -> ActivityStatus.Pending
          }
        )
      }
  }

  LazyColumn(
    modifier = Modifier.fillMaxSize(),
    contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 140.dp),
    verticalArrangement = Arrangement.spacedBy(14.dp)
  ) {
    item {
      ScreenHeading(
        title = "Attività",
        subtitle = "Cronologia rapida dei trasferimenti e dello stato delle cartelle."
      )
    }

    if (activityItems.isEmpty()) {
      item {
        EmptyStateCard(
          title = "Nessuna attività",
          subtitle = "Dopo pairing e prima sincronizzazione qui compariranno gli eventi recenti.",
          actionLabel = null,
          onAction = null
        )
      }
    } else {
      itemsIndexed(activityItems, key = { index, item -> "${item.title}-$index" }) { _, item ->
        ActivityCard(item = item)
      }
    }
  }
}

@Composable
private fun SettingsTab(
  state: SyncUiState,
  onToggleDarkMode: (Boolean) -> Unit,
  onToggleBackgroundSync: (Boolean) -> Unit,
  onCheckForAppUpdate: () -> Unit,
  onStartAppUpdate: () -> Unit,
  onSyncNow: () -> Unit,
  onRefreshStatus: () -> Unit,
  onDisconnect: () -> Unit
) {
  val hostStatusLabel = when (state.hostReachable) {
    true -> "Online"
    false -> "Offline"
    null -> "Non configurato"
  }
  val hostStatusColor = when (state.hostReachable) {
    true -> Color(0xFF1E8E3E)
    false -> MaterialTheme.colorScheme.error
    null -> MaterialTheme.colorScheme.onSurfaceVariant
  }
  val hostSubtitle = state.dashboard.hostUrl.ifBlank { "Nessun host collegato" }
  val deviceTitle = state.dashboard.deviceName.ifBlank { "Android device" }
  val deviceSubtitle = state.dashboard.deviceId.ifBlank { "Dispositivo non ancora registrato" }
  val updateTitle = state.appUpdate?.let { "Aggiornamento disponibile" } ?: "App aggiornata"
  val updateSubtitle = state.appUpdate?.let { availableUpdate ->
    "Routy Sync ${availableUpdate.versionName} pronta da scaricare."
  } ?: "Controlla nuove build GitHub senza uscire dall'app."

  LazyColumn(
    modifier = Modifier.fillMaxSize(),
    contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 140.dp),
    verticalArrangement = Arrangement.spacedBy(18.dp)
  ) {
    item {
      ScreenHeading(
        title = "Impostazioni app",
        subtitle = "Preferenze, stato della connessione e gestione dell'app."
      )
    }

    item {
      SettingsSectionTitle("Panoramica")
    }

    item {
      SettingsCard {
        SettingsRow(
          icon = Icons.Rounded.Devices,
          title = deviceTitle,
          subtitle = deviceSubtitle,
          trailingText = "v${BuildConfig.VERSION_NAME}"
        )
        SettingsDivider()
        SettingsRow(
          icon = Icons.Rounded.Link,
          title = "Host LAN",
          subtitle = hostSubtitle,
          trailingText = hostStatusLabel,
          trailingColor = hostStatusColor
        )
        SettingsDivider()
        SettingsRow(
          icon = Icons.Rounded.FolderOpen,
          title = "Cartelle collegate",
          subtitle = if (state.dashboard.mappings.isEmpty()) {
            "Nessuna cartella configurata su questo dispositivo."
          } else {
            "${state.dashboard.mappings.size} cartelle pronte per la sincronizzazione."
          },
          trailingText = state.dashboard.mappings.size.toString()
        )
      }
    }

    item {
      SettingsSectionTitle("Preferenze")
    }

    item {
      SettingsCard {
        ToggleRow(
          icon = Icons.Rounded.DarkMode,
          title = "Tema scuro",
          subtitle = "Usa sempre la modalità scura nell'app.",
          checked = state.darkModeEnabled,
          onCheckedChange = onToggleDarkMode
        )
        SettingsDivider()
        ToggleRow(
          icon = Icons.Rounded.Wifi,
          title = "Sync in background",
          subtitle = "Continua a sincronizzare anche quando l'app non è aperta.",
          checked = state.backgroundSyncEnabled,
          onCheckedChange = onToggleBackgroundSync
        )
      }
    }

    item {
      SettingsSectionTitle("Aggiornamenti")
    }

    item {
      SettingsCard {
        SettingsRow(
          icon = Icons.Rounded.Notifications,
          title = updateTitle,
          subtitle = updateSubtitle
        )
        SettingsDivider()
        Column(
          modifier = Modifier.padding(20.dp),
          verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
          val availableUpdate = state.appUpdate

          Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
          ) {
            Button(
              onClick = onCheckForAppUpdate,
              enabled = !state.checkingForAppUpdate
            ) {
              Text(if (state.checkingForAppUpdate) "Controllo..." else "Controlla ora")
            }
            if (availableUpdate != null) {
              TextButton(onClick = onStartAppUpdate) {
                Text("Scarica APK")
              }
            }
          }
        }
      }
    }

    item {
      SettingsSectionTitle("Azioni")
    }

    item {
      SettingsCard {
        ActionRow(
          icon = Icons.Rounded.Sync,
          title = "Sincronizza ora",
          subtitle = "Forza subito un ciclo di upload verso l'host.",
          onClick = onSyncNow,
          enabled = !state.busy && state.dashboard.isConfigured
        )
        SettingsDivider()
        ActionRow(
          icon = Icons.Rounded.Link,
          title = "Aggiorna stato host",
          subtitle = "Ricarica configurazione e raggiungibilità dell'host.",
          onClick = onRefreshStatus,
          enabled = !state.busy && state.dashboard.isConfigured
        )
        SettingsDivider()
        ActionRow(
          icon = Icons.Rounded.PowerSettingsNew,
          title = "Disconnetti",
          subtitle = "Rimuove host, token e cartelle registrate da questo dispositivo.",
          onClick = onDisconnect,
          enabled = !state.busy && state.dashboard.isConfigured,
          destructive = true
        )
      }
    }
  }
}

@Composable
private fun UploadProgressBanner(progress: com.routy.sync.SyncTransferProgress) {
  Surface(
    modifier = Modifier
      .fillMaxWidth()
      .padding(horizontal = 20.dp, vertical = 4.dp),
    color = MaterialTheme.colorScheme.surfaceContainerLow,
    shape = MaterialTheme.shapes.medium
  ) {
    Column(
      modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = "Caricamento ${progress.mappingName}",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
          )
          Text(
            text = "${progress.uploadedFiles}/${progress.totalFiles} file • ${formatBytes(progress.uploadedBytes)} / ${formatBytes(progress.totalBytes)}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
        Text(
          text = "${progress.percentage}%",
          style = MaterialTheme.typography.titleMedium,
          fontWeight = FontWeight.Bold,
          color = MaterialTheme.colorScheme.primary
        )
      }

      LinearProgressIndicator(
        modifier = Modifier
          .fillMaxWidth()
          .height(10.dp)
          .clip(RoundedCornerShape(999.dp)),
        progress = { progress.percentage / 100f },
        color = MaterialTheme.colorScheme.primary,
        trackColor = MaterialTheme.colorScheme.surfaceContainerHigh
      )
    }
  }
}

@Composable
private fun ScreenHeading(title: String, subtitle: String) {
  Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
    Text(
      text = title,
      style = MaterialTheme.typography.headlineMedium,
      fontWeight = FontWeight.ExtraBold
    )
    Text(
      text = subtitle,
      style = MaterialTheme.typography.bodyLarge,
      color = MaterialTheme.colorScheme.onSurfaceVariant
    )
  }
}

@Composable
private fun ScannerCard(
  isBusy: Boolean,
  onScanQr: () -> Unit
) {
  val primaryGradient = remember {
    Brush.linearGradient(
      listOf(Color(0xFF6D3CD7), Color(0xFF8152EC))
    )
  }

  Box(
    modifier = Modifier
      .fillMaxWidth()
      .aspectRatio(1f)
      .clip(RoundedCornerShape(32.dp))
      .background(MaterialTheme.colorScheme.surfaceContainer)
      .clickable(
        enabled = !isBusy,
        interactionSource = remember { MutableInteractionSource() },
        indication = null,
        onClick = onScanQr
      )
      .padding(22.dp)
  ) {
    Canvas(modifier = Modifier.fillMaxSize()) {
      drawRect(
        brush = Brush.radialGradient(
          colors = listOf(Color(0x228152EC), Color.Transparent),
          radius = size.minDimension
        )
      )
    }

    Box(
      modifier = Modifier
        .fillMaxSize()
        .clip(RoundedCornerShape(26.dp))
        .background(MaterialTheme.colorScheme.surfaceContainerLow.copy(alpha = 0.9f))
    )

    Column(
      modifier = Modifier
        .fillMaxSize()
        .padding(18.dp),
      verticalArrangement = Arrangement.SpaceBetween,
      horizontalAlignment = Alignment.CenterHorizontally
    ) {
      StatusPill(
        text = if (isBusy) "Connessione in corso" else "Waiting for peer",
        background = MaterialTheme.colorScheme.surfaceContainerLowest.copy(alpha = 0.85f),
        contentColor = MaterialTheme.colorScheme.onSurfaceVariant
      )

      Box(
        modifier = Modifier
          .fillMaxWidth()
          .weight(1f)
          .padding(vertical = 18.dp)
      ) {
        CornerBracket(Modifier.align(Alignment.TopStart), primaryGradient)
        CornerBracket(Modifier.align(Alignment.TopEnd), primaryGradient, mirrored = true)
        CornerBracket(Modifier.align(Alignment.BottomStart), primaryGradient, inverted = true)
        CornerBracket(Modifier.align(Alignment.BottomEnd), primaryGradient, mirrored = true, inverted = true)

        Box(
          modifier = Modifier
            .align(Alignment.Center)
            .fillMaxWidth()
            .height(3.dp)
            .background(
              Brush.horizontalGradient(
                colors = listOf(Color.Transparent, Color(0xAA6D3CD7), Color.Transparent)
              ),
              shape = RoundedCornerShape(999.dp)
            )
        )

        if (isBusy) {
          CircularProgressIndicator(
            modifier = Modifier
              .size(42.dp)
              .align(Alignment.Center),
            color = MaterialTheme.colorScheme.primary,
            strokeWidth = 3.dp
          )
        } else {
          Icon(
            imageVector = Icons.Rounded.QrCodeScanner,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier
              .size(56.dp)
              .align(Alignment.Center)
          )
        }
      }

      Surface(
        shape = RoundedCornerShape(999.dp),
        color = MaterialTheme.colorScheme.surfaceContainerLowest.copy(alpha = 0.85f)
      ) {
        Row(
          modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
          horizontalArrangement = Arrangement.spacedBy(8.dp),
          verticalAlignment = Alignment.CenterVertically
        ) {
          Icon(
            imageVector = Icons.Rounded.QrCodeScanner,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(16.dp)
          )
          Text(
            text = if (isBusy) "Sto leggendo il pairing" else "Tocca per aprire lo scanner",
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
          )
        }
      }
    }
  }
}

@Composable
private fun SuccessHero(
  hostUrl: String,
  hostReachable: Boolean?,
  mappingCount: Int
) {
  val gradient = remember {
    Brush.linearGradient(listOf(Color(0xFF6D3CD7), Color(0xFF8152EC)))
  }

  Surface(
    color = Color.Transparent,
    shape = MaterialTheme.shapes.large
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .background(
          brush = Brush.verticalGradient(
            colors = listOf(
              MaterialTheme.colorScheme.surface.copy(alpha = 0.9f),
              MaterialTheme.colorScheme.surfaceContainerLow.copy(alpha = 0.95f)
            )
          ),
          shape = MaterialTheme.shapes.large
        )
        .padding(24.dp),
      horizontalAlignment = Alignment.CenterHorizontally
    ) {
      Box(contentAlignment = Alignment.Center) {
        Box(
          modifier = Modifier
            .size(164.dp)
            .clip(CircleShape)
            .background(Color(0x196D3CD7))
        )
        Box(
          modifier = Modifier
            .size(118.dp)
            .clip(RoundedCornerShape(32.dp))
            .background(gradient)
            .shadow(18.dp, RoundedCornerShape(32.dp), clip = false),
          contentAlignment = Alignment.Center
        ) {
          Icon(
            imageVector = Icons.Rounded.CheckCircle,
            contentDescription = null,
            tint = Color.White,
            modifier = Modifier.size(54.dp)
          )
        }
      }

      Spacer(Modifier.height(22.dp))

      Text(
        text = prettyHostLabel(hostUrl),
        style = MaterialTheme.typography.titleLarge,
        fontWeight = FontWeight.Bold,
        textAlign = TextAlign.Center
      )
      Text(
        text = hostUrl,
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center
      )

      Spacer(Modifier.height(18.dp))

      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        StatusPill(
          text = when (hostReachable) {
            true -> "Host online"
            false -> "Host offline"
            null -> "Host non verificato"
          },
          background = when (hostReachable) {
            true -> Color(0xFFE7F6EC)
            false -> MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.18f)
            null -> MaterialTheme.colorScheme.surfaceContainerHighest
          },
          contentColor = when (hostReachable) {
            true -> Color(0xFF1E8E3E)
            false -> MaterialTheme.colorScheme.error
            null -> MaterialTheme.colorScheme.onSurfaceVariant
          }
        )

        StatusPill(
          text = "$mappingCount cartelle",
          background = MaterialTheme.colorScheme.secondaryContainer,
          contentColor = MaterialTheme.colorScheme.onSecondaryContainer
        )
      }
    }
  }
}

@Composable
private fun FolderCard(
  mapping: SyncMappingEntity,
  isBusy: Boolean,
  onRemove: () -> Unit
) {
  Surface(
    color = MaterialTheme.colorScheme.surfaceContainerLowest,
    shape = MaterialTheme.shapes.medium,
    shadowElevation = 2.dp
  ) {
    Column(
      modifier = Modifier.padding(18.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top
      ) {
        Row(
          modifier = Modifier.weight(1f),
          horizontalArrangement = Arrangement.spacedBy(14.dp),
          verticalAlignment = Alignment.CenterVertically
        ) {
          Surface(
            modifier = Modifier.size(46.dp),
            color = MaterialTheme.colorScheme.secondaryContainer,
            shape = RoundedCornerShape(18.dp)
          ) {
            Box(contentAlignment = Alignment.Center) {
              Icon(
                imageVector = Icons.Rounded.FolderOpen,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSecondaryContainer
              )
            }
          }

          Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
              text = mapping.sourceName,
              style = MaterialTheme.typography.titleMedium,
              fontWeight = FontWeight.Bold
            )
            Text(
              text = when {
                mapping.lastSyncedAt != null -> "Ultima sync ${formatEpoch(mapping.lastSyncedAt)}"
                mapping.lastPlannedAt != null -> "Configurata ${formatEpoch(mapping.lastPlannedAt)}"
                else -> "In attesa della prima sincronizzazione"
              },
              style = MaterialTheme.typography.bodyMedium,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }

        IconButton(
          onClick = onRemove,
          enabled = !isBusy,
          colors = IconButtonDefaults.iconButtonColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow,
            contentColor = MaterialTheme.colorScheme.error
          )
        ) {
          Icon(Icons.Rounded.DeleteOutline, contentDescription = "Rimuovi cartella")
        }
      }

      if (isBusy) {
        LinearProgressIndicator(
          modifier = Modifier.fillMaxWidth(),
          color = MaterialTheme.colorScheme.primary,
          trackColor = MaterialTheme.colorScheme.surfaceContainerHigh
        )
      }

      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        StatusPill(
          text = if (mapping.serverMappingId.isNullOrBlank()) "In attesa host" else "Host associato",
          background = MaterialTheme.colorScheme.surfaceContainerLow,
          contentColor = MaterialTheme.colorScheme.onSurfaceVariant
        )

        if (mapping.lastSyncedAt != null) {
          StatusPill(
            text = "Attiva",
            background = Color(0xFFE7F6EC),
            contentColor = Color(0xFF1E8E3E)
          )
        }
      }
    }
  }
}

@Composable
private fun ActivityCard(item: ActivityFeedItem) {
  val (background, content, label, icon) = when (item.status) {
    ActivityStatus.Completed -> ActivityBadgeSpec(
      background = Color(0xFFE7F6EC),
      content = Color(0xFF1E8E3E),
      label = "Completato",
      icon = Icons.Rounded.CheckCircle
    )

    ActivityStatus.Syncing -> ActivityBadgeSpec(
      background = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
      content = MaterialTheme.colorScheme.primary,
      label = "Sincronizzazione",
      icon = Icons.Rounded.Sync
    )

    ActivityStatus.Pending -> ActivityBadgeSpec(
      background = MaterialTheme.colorScheme.surfaceContainerHigh,
      content = MaterialTheme.colorScheme.onSurfaceVariant,
      label = "In attesa",
      icon = Icons.Rounded.History
    )
  }

  Surface(
    color = MaterialTheme.colorScheme.surfaceContainerLowest,
    shape = MaterialTheme.shapes.medium
  ) {
    Row(
      modifier = Modifier.padding(18.dp),
      horizontalArrangement = Arrangement.spacedBy(14.dp),
      verticalAlignment = Alignment.CenterVertically
    ) {
      Surface(
        modifier = Modifier.size(48.dp),
        color = MaterialTheme.colorScheme.secondaryContainer,
        shape = RoundedCornerShape(18.dp)
      ) {
        Box(contentAlignment = Alignment.Center) {
          Icon(
            imageVector = Icons.Rounded.Sync,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSecondaryContainer
          )
        }
      }

      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
          text = item.title,
          style = MaterialTheme.typography.titleMedium,
          fontWeight = FontWeight.Bold,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis
        )
        Text(
          text = item.subtitle,
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }

      StatusPill(
        text = label,
        background = background,
        contentColor = content,
        icon = icon
      )
    }
  }
}

private data class ActivityBadgeSpec(
  val background: Color,
  val content: Color,
  val label: String,
  val icon: ImageVector
)

@Composable
private fun SettingsRow(
  icon: ImageVector,
  title: String,
  subtitle: String,
  trailingText: String? = null,
  trailingColor: Color? = null,
  onClick: (() -> Unit)? = null,
  enabled: Boolean = true,
  destructive: Boolean = false
) {
  val headlineColor = when {
    !enabled -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.45f)
    destructive -> MaterialTheme.colorScheme.error
    else -> MaterialTheme.colorScheme.onSurface
  }
  val supportingColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = if (enabled) 1f else 0.55f)
  val iconColor = if (destructive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
  val resolvedTrailingColor = trailingColor ?: supportingColor

  Row(
    modifier = Modifier
      .fillMaxWidth()
      .clip(MaterialTheme.shapes.medium)
      .clickable(enabled = enabled && onClick != null) { onClick?.invoke() }
      .padding(horizontal = 16.dp, vertical = 14.dp),
    horizontalArrangement = Arrangement.spacedBy(14.dp),
    verticalAlignment = Alignment.Top
  ) {
    Box(
      modifier = Modifier
        .padding(top = 2.dp)
        .size(22.dp),
      contentAlignment = Alignment.Center
    ) {
      Icon(
        imageVector = icon,
        contentDescription = null,
        tint = iconColor.copy(alpha = if (enabled) 1f else 0.45f)
      )
    }

    Column(
      modifier = Modifier.weight(1f),
      verticalArrangement = Arrangement.spacedBy(3.dp)
    ) {
      Text(
        text = title,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold,
        color = headlineColor
      )
      Text(
        text = subtitle,
        style = MaterialTheme.typography.bodyMedium,
        color = supportingColor
      )
    }

    if (trailingText != null) {
      Box(
        modifier = Modifier.padding(top = 2.dp),
        contentAlignment = Alignment.TopEnd
      ) {
        Text(
          text = trailingText,
          style = MaterialTheme.typography.labelLarge,
          fontWeight = FontWeight.Medium,
          color = resolvedTrailingColor,
          textAlign = TextAlign.End
        )
      }
    }
  }
}

@Composable
private fun SettingsCard(content: @Composable ColumnScope.() -> Unit) {
  Surface(
    color = MaterialTheme.colorScheme.surfaceContainerLow,
    shape = MaterialTheme.shapes.large
  ) {
    Column(modifier = Modifier.fillMaxWidth(), content = content)
  }
}

@Composable
private fun ToggleRow(
  icon: ImageVector,
  title: String,
  subtitle: String,
  checked: Boolean,
  onCheckedChange: (Boolean) -> Unit
) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .clip(MaterialTheme.shapes.medium)
      .clickable { onCheckedChange(!checked) }
      .padding(horizontal = 16.dp, vertical = 14.dp),
    horizontalArrangement = Arrangement.spacedBy(14.dp),
    verticalAlignment = Alignment.Top
  ) {
    Box(
      modifier = Modifier
        .padding(top = 2.dp)
        .size(22.dp),
      contentAlignment = Alignment.Center
    ) {
      Icon(
        imageVector = icon,
        contentDescription = null,
        tint = MaterialTheme.colorScheme.primary
      )
    }

    Column(
      modifier = Modifier.weight(1f),
      verticalArrangement = Arrangement.spacedBy(3.dp)
    ) {
      Text(
        text = title,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold
      )
      Text(
        text = subtitle,
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )
    }

    Box(
      modifier = Modifier.padding(top = 2.dp),
      contentAlignment = Alignment.TopEnd
    ) {
      Switch(
        checked = checked,
        onCheckedChange = onCheckedChange
      )
    }
  }
}

@Composable
private fun ActionRow(
  icon: ImageVector,
  title: String,
  subtitle: String,
  onClick: () -> Unit,
  enabled: Boolean,
  destructive: Boolean = false
) {
  SettingsRow(
    icon = icon,
    title = title,
    subtitle = subtitle,
    onClick = onClick,
    enabled = enabled,
    destructive = destructive
  )
}

@Composable
private fun SettingsDivider() {
  HorizontalDivider(
    modifier = Modifier.padding(horizontal = 16.dp),
    color = MaterialTheme.colorScheme.surfaceContainerHighest.copy(alpha = 0.65f)
  )
}

@Composable
private fun SettingsSectionTitle(text: String) {
  Text(
    text = text,
    style = MaterialTheme.typography.titleSmall,
    fontWeight = FontWeight.SemiBold,
    color = MaterialTheme.colorScheme.onSurfaceVariant,
    modifier = Modifier.padding(horizontal = 4.dp)
  )
}

@Composable
private fun PrimaryGradientButton(
  text: String,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  enabled: Boolean = true
) {
  val gradient = remember {
    Brush.linearGradient(
      listOf(Color(0xFF6D3CD7), Color(0xFF8152EC))
    )
  }

  Button(
    onClick = onClick,
    enabled = enabled,
    modifier = modifier.heightIn(min = 56.dp),
    colors = ButtonDefaults.buttonColors(
      containerColor = Color.Transparent,
      disabledContainerColor = Color.Transparent
    ),
    contentPadding = PaddingValues(0.dp),
    shape = RoundedCornerShape(28.dp),
    elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
  ) {
    Box(
      modifier = Modifier
        .fillMaxWidth()
        .background(
          if (enabled) gradient else Brush.linearGradient(listOf(Color(0xFFCBC7D6), Color(0xFFCBC7D6))),
          RoundedCornerShape(28.dp)
        )
        .padding(horizontal = 20.dp, vertical = 16.dp),
      contentAlignment = Alignment.Center
    ) {
      Text(
        text = text,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold,
        color = Color.White
      )
    }
  }
}

@Composable
private fun EmptyStateCard(
  title: String,
  subtitle: String,
  actionLabel: String?,
  onAction: (() -> Unit)?
) {
  Surface(
    color = MaterialTheme.colorScheme.surfaceContainerLow,
    shape = MaterialTheme.shapes.medium
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(24.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
      Surface(
        modifier = Modifier.size(58.dp),
        color = MaterialTheme.colorScheme.surfaceContainerLowest,
        shape = RoundedCornerShape(22.dp)
      ) {
        Box(contentAlignment = Alignment.Center) {
          Icon(
            imageVector = Icons.Rounded.Info,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary
          )
        }
      }

      Text(text = title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
      Text(
        text = subtitle,
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center
      )

      if (actionLabel != null && onAction != null) {
        PrimaryGradientButton(
          text = actionLabel,
          onClick = onAction
        )
      }
    }
  }
}

@Composable
private fun InfoCard(
  icon: ImageVector,
  title: String,
  text: String
) {
  Surface(
    color = MaterialTheme.colorScheme.surfaceContainerLow,
    shape = MaterialTheme.shapes.medium
  ) {
    Row(
      modifier = Modifier.padding(20.dp),
      horizontalArrangement = Arrangement.spacedBy(14.dp),
      verticalAlignment = Alignment.Top
    ) {
      Surface(
        modifier = Modifier.size(42.dp),
        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
        shape = CircleShape
      ) {
        Box(contentAlignment = Alignment.Center) {
          Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
        }
      }

      Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(text = title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Text(text = text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
    }
  }
}

@Composable
private fun InlineFact(icon: ImageVector, text: String) {
  Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
    Icon(
      imageVector = icon,
      contentDescription = null,
      tint = MaterialTheme.colorScheme.primary,
      modifier = Modifier.size(18.dp)
    )
    Text(text = text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
  }
}

@Composable
private fun FloatingBottomBar(
  selectedTab: SyncTab,
  onSelectTab: (SyncTab) -> Unit
) {
  val bottomPadding = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()

  Row(
    modifier = Modifier
      .fillMaxWidth()
      .padding(start = 18.dp, end = 18.dp, bottom = bottomPadding + 18.dp, top = 10.dp),
    horizontalArrangement = Arrangement.Center
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 8.dp, vertical = 8.dp),
      horizontalArrangement = Arrangement.spacedBy(6.dp),
      verticalAlignment = Alignment.CenterVertically
    ) {
      SyncTab.entries.forEach { tab ->
        val active = tab == selectedTab
        Box(
          modifier = Modifier
            .weight(1f)
            .clickable { onSelectTab(tab) }
            .padding(horizontal = 8.dp, vertical = 10.dp)
        ) {
          Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp)
          ) {
            Box(
              modifier = Modifier
                .clip(RoundedCornerShape(18.dp))
                .background(
                  if (active) {
                    Brush.linearGradient(listOf(Color(0xFF6D3CD7), Color(0xFF8152EC)))
                  } else {
                    Brush.linearGradient(listOf(Color.Transparent, Color.Transparent))
                  }
                )
                .padding(horizontal = 12.dp, vertical = 8.dp),
              contentAlignment = Alignment.Center
            ) {
              Icon(
                imageVector = if (active) tab.activeIcon else tab.icon,
                contentDescription = tab.label,
                tint = if (active) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp)
              )
            }
            Text(
              text = tab.label,
              style = MaterialTheme.typography.labelSmall,
              color = if (active) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
              fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
              textAlign = TextAlign.Center,
              maxLines = 1,
              overflow = TextOverflow.Ellipsis
            )
          }
        }
      }
    }
  }
}

@Composable
private fun ManualPairingDialog(
  onDismiss: () -> Unit,
  onSubmit: (hostUrl: String, code: String) -> Unit
) {
  var hostUrl by rememberSaveable { mutableStateOf("") }
  var code by rememberSaveable { mutableStateOf("") }

  AlertDialog(
    onDismissRequest = onDismiss,
    title = {
      Text("Pairing manuale", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
    },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedTextField(
          value = hostUrl,
          onValueChange = { hostUrl = it },
          modifier = Modifier.fillMaxWidth(),
          label = { Text("Host URL") },
          singleLine = true
        )
        OutlinedTextField(
          value = code,
          onValueChange = { code = it },
          modifier = Modifier.fillMaxWidth(),
          label = { Text("Pairing code") },
          singleLine = true
        )
      }
    },
    confirmButton = {
      TextButton(
        onClick = { onSubmit(hostUrl.trim(), code.trim()) },
        enabled = hostUrl.isNotBlank() && code.isNotBlank()
      ) {
        Text("Collega")
      }
    },
    dismissButton = {
      TextButton(onClick = onDismiss) {
        Text("Annulla")
      }
    }
  )
}

@Composable
private fun StatusPill(
  text: String,
  background: Color,
  contentColor: Color,
  icon: ImageVector? = null
) {
  Surface(
    color = background,
    shape = RoundedCornerShape(999.dp)
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
      horizontalArrangement = Arrangement.spacedBy(6.dp),
      verticalAlignment = Alignment.CenterVertically
    ) {
      if (icon != null) {
        Icon(
          imageVector = icon,
          contentDescription = null,
          tint = contentColor,
          modifier = Modifier.size(14.dp)
        )
      }
      Text(
        text = text,
        style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.Bold,
        color = contentColor
      )
    }
  }
}

@Composable
private fun CornerBracket(
  modifier: Modifier,
  brush: Brush,
  mirrored: Boolean = false,
  inverted: Boolean = false
) {
  Canvas(modifier = modifier.size(48.dp)) {
    val thickness = 6.dp.toPx()
    val length = size.minDimension * 0.72f

    val startX = if (mirrored) size.width else 0f
    val horizontalEndX = if (mirrored) size.width - length else length
    val verticalStartY = if (inverted) size.height else 0f
    val verticalEndY = if (inverted) size.height - length else length

    drawLine(
      brush = brush,
      start = androidx.compose.ui.geometry.Offset(startX, verticalStartY),
      end = androidx.compose.ui.geometry.Offset(horizontalEndX, verticalStartY),
      strokeWidth = thickness
    )
    drawLine(
      brush = brush,
      start = androidx.compose.ui.geometry.Offset(startX, verticalStartY),
      end = androidx.compose.ui.geometry.Offset(startX, verticalEndY),
      strokeWidth = thickness
    )
  }
}

@Composable
private fun SyncBackdrop() {
  val surfaceColor = MaterialTheme.colorScheme.surface
  Canvas(
    modifier = Modifier
      .fillMaxSize()
      .background(surfaceColor)
  ) {
    drawRect(surfaceColor)
    drawCircle(
      brush = Brush.radialGradient(
        colors = listOf(Color(0x146D3CD7), Color.Transparent),
        radius = size.minDimension * 0.55f,
        center = androidx.compose.ui.geometry.Offset(size.width * 0.1f, size.height * 0.1f)
      ),
      radius = size.minDimension * 0.6f,
      center = androidx.compose.ui.geometry.Offset(size.width * 0.1f, size.height * 0.1f)
    )
    drawCircle(
      brush = Brush.radialGradient(
        colors = listOf(Color(0x1A8152EC), Color.Transparent),
        radius = size.minDimension * 0.5f,
        center = androidx.compose.ui.geometry.Offset(size.width * 0.95f, size.height * 0.08f)
      ),
      radius = size.minDimension * 0.55f,
      center = androidx.compose.ui.geometry.Offset(size.width * 0.95f, size.height * 0.08f)
    )
  }
}

private fun buildPairingScanOptions() =
  ScanOptions().apply {
    setDesiredBarcodeFormats(ScanOptions.QR_CODE)
    setCaptureActivity(ScannerCaptureActivity::class.java)
    setPrompt("Scansiona il QR dalla pagina Sync host")
    setBeepEnabled(false)
    setOrientationLocked(true)
  }

private fun prettyHostLabel(hostUrl: String): String =
  Uri.parse(hostUrl).host?.substringBefore(".")?.replaceFirstChar { it.uppercase() } ?: hostUrl

private fun formatBytes(value: Long): String {
  val mb = value / (1024f * 1024f)
  return if (mb >= 1024f) {
    String.format(java.util.Locale.US, "%.2f GB", mb / 1024f)
  } else {
    String.format(java.util.Locale.US, "%.1f MB", mb)
  }
}

private fun formatEpoch(value: Long): String =
  java.text.SimpleDateFormat("dd/MM HH:mm", java.util.Locale.ITALY).format(java.util.Date(value))
