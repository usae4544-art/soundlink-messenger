package com.soundlink.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.soundlink.app.model.DecodedPayload
import com.soundlink.app.ui.screens.ReceiveScreen
import com.soundlink.app.ui.screens.SendScreen
import com.soundlink.app.ui.screens.SocialScreen
import com.soundlink.app.ui.theme.SoundLinkTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            SoundLinkTheme {
                SoundLinkApp()
            }
        }
    }
}

@Composable
fun SoundLinkApp() {
    var selectedTab by remember { mutableStateOf(0) }
    var sentHistory = remember { mutableStateListOf<DecodedPayload>() }
    var receivedPayloads = remember { mutableStateListOf<DecodedPayload>() }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.Send, contentDescription = "Send") },
                    label = { Text("Send") }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.Mic, contentDescription = "Receive") },
                    label = { Text("Receive") }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.People, contentDescription = "Social") },
                    label = { Text("Social") }
                )
            }
        }
    ) { innerPadding ->
        Surface(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            color = MaterialTheme.colorScheme.background
        ) {
            when (selectedTab) {
                0 -> SendScreen(
                    onPayloadSent = { item -> sentHistory.add(0, item) },
                    sentHistory = sentHistory
                )
                1 -> ReceiveScreen(
                    receivedPayloads = receivedPayloads,
                    onReceiveNewPayload = { item -> receivedPayloads.add(0, item) }
                )
                2 -> SocialScreen()
            }
        }
    }
}
