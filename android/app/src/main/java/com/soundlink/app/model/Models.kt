package com.soundlink.app.model

enum class PayloadType {
    TEXT, IMAGE, VIDEO, AUDIO
}

data class DecodedPayload(
    val id: String,
    val type: PayloadType,
    val text: String? = null,
    val imageDataUrl: String? = null,
    val videoDataUrl: String? = null,
    val audioDataUrl: String? = null,
    val time: String,
    val source: String,
    val token: String? = null,
    val senderName: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)

data class AudioAnalysis(
    val overall: Float = 0f,
    val bass: Float = 0f,
    val mid: Float = 0f,
    val treble: Float = 0f
)

data class UserProfile(
    val uid: String,
    val name: String,
    val email: String,
    val picture: String? = null,
    val status: String = "Online via SoundLink",
    val lastActive: Long = System.currentTimeMillis()
)

data class ChatMessage(
    val id: String = "",
    val senderId: String = "",
    val senderName: String = "",
    val text: String = "",
    val mediaUrl: String? = null,
    val mediaType: String? = null,
    val timestamp: Long = System.currentTimeMillis()
)
