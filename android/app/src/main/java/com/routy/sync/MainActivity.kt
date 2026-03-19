package com.routy.sync

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.activity.compose.setContent
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.routy.sync.ui.SyncScreen
import com.routy.sync.ui.RoutySyncTheme

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()

    val container = (application as RoutySyncApp).container

    setContent {
      RoutySyncTheme {
        Surface(modifier = Modifier) {
          SyncScreen(container = container)
        }
      }
    }
  }
}
