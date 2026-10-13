package com.soundlink.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF10B981), // Emerald 500
    onPrimary = Color(0xFF09090B),
    primaryContainer = Color(0xFF065F46),
    onPrimaryContainer = Color(0xFFA7F3D0),
    secondary = Color(0xFF3B82F6), // Blue 500
    onSecondary = Color(0xFF09090B),
    secondaryContainer = Color(0xFF1E40AF),
    onSecondaryContainer = Color(0xFFBFDBFE),
    background = Color(0xFF09090B), // Zinc 950
    onBackground = Color(0xFFF4F4F5),
    surface = Color(0xFF18181B), // Zinc 900
    onSurface = Color(0xFFF4F4F5),
    surfaceVariant = Color(0xFF27272A),
    onSurfaceVariant = Color(0xFFA1A1AA),
    error = Color(0xFFEF4444),
    onError = Color(0xFFFFFFFF)
)

@Composable
fun SoundLinkTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
