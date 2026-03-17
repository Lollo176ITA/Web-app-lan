package com.routy.sync

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.routy.sync.ui.SyncScreen

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val container = (application as RoutySyncApp).container

    setContent {
      MaterialTheme {
        Surface(modifier = Modifier) {
          SyncScreen(container = container)
        }
      }
    }
  }
}
