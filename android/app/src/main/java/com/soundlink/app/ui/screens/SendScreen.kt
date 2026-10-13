package com.soundlink.app.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ContextCompat
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.soundlink.app.audio.AcousticProtocol
import com.soundlink.app.model.PayloadType
import com.soundlink.app.model.DecodedPayload
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SendScreen(
    onPayloadSent: (DecodedPayload) -> Unit,
    sentHistory: List<DecodedPayload>
) {
    val context = LocalContext.instance
    val scope = rememberCoroutineScope()
    var selectedType by remember { mutableStateOf(PayloadType.TEXT) }
    var textInput by remember { mutableStateOf("") }
    var isBroadcasting by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(16.dp)
    ) {
        Text(
            text = "Broadcast & Send",
            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            text = "Transmit messages and media via acoustic audio tones or secure links.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Type Selector Row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            PayloadType.values().forEach { type ->
                val selected = selectedType == type
                FilterChip(
                    selected = selected,
                    onClick = { selectedType = type },
                    label = { Text(type.name) },
                    leadingIcon = {
                        val icon = when (type) {
                            PayloadType.TEXT -> Icons.Default.Keyboard
                            PayloadType.IMAGE -> Icons.Default.Image
                            PayloadType.VIDEO -> Icons.Default.VideoCall
                            PayloadType.AUDIO -> Icons.Default.MusicNote
                        }
                        Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
                    }
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Input Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                when (selectedType) {
                    PayloadType.TEXT -> {
                        OutlinedTextField(
                            value = textInput,
                            onValueChange = { textInput = it },
                            label = { Text("Enter secret message") },
                            modifier = Modifier.fillMaxWidth(),
                            maxLines = 4
                        )
                    }
                    PayloadType.IMAGE, PayloadType.VIDEO, PayloadType.AUDIO -> {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(120.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(
                                    imageVector = Icons.Default.CloudUpload,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(36.dp)
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Tap to select ${selectedType.name.lowercase()} file",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = textInput,
                            onValueChange = { textInput = it },
                            label = { Text("Caption or Title (optional)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Button(
                        onClick = {
                            val content = if (textInput.isBlank()) "SoundLink ${selectedType.name} Payload" else textInput
                            scope.launch {
                                isBroadcasting = true
                                Toast.instance(context, "Playing acoustic broadcast...", Toast.LENGTH_SHORT).show()
                                AcousticProtocol.playAcousticData(content)
                                isBroadcasting = false
                                Toast.instance(context, "Broadcast complete!", Toast.LENGTH_SHORT).show()

                                val item = DecodedPayload(
                                    id = UUID.randomUUID().toString(),
                                    type = selectedType,
                                    text = content,
                                    time = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date()),
                                    source = "broadcast",
                                    token = "SL-" + (1000..9999).random()
                                )
                                onPayloadSent(item)
                                textInput = ""
                            }
                        },
                        modifier = Modifier.weight(1.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                        enabled = !isBroadcasting
                    ) {
                        Icon(Icons.Default.VolumeUp, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(if (isBroadcasting) "Broadcasting..." else "Broadcast Sound")
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Sent History",
            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
            color = MaterialTheme.colorScheme.onBackground
        )

        Spacer(modifier = Modifier.height(8.dp))

        if (sentHistory.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "No sent broadcasts yet.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(sentHistory) { item ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = when (item.type) {
                                    PayloadType.TEXT -> Icons.Default.Keyboard
                                    PayloadType.IMAGE -> Icons.Default.Image
                                    PayloadType.VIDEO -> Icons.Default.VideoCall
                                    PayloadType.AUDIO -> Icons.Default.MusicNote
                                },
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = item.text ?: item.type.name,
                                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                                Text(
                                    text = "Token: ${item.token} • ${item.time}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            IconButton(onClick = {
                                scope.launch {
                                    AcousticProtocol.playAcousticData(item.text ?: "SoundLink")
                                    Toast.instance(context, "Replaying sound...", Toast.LENGTH_SHORT).show()
                                }
                            }) {
                                Icon(Icons.Default.PlayArrow, contentDescription = "Replay", tint = MaterialTheme.colorScheme.primary)
                            }
                        }
                    }
                }
            }
        }
    }
}
