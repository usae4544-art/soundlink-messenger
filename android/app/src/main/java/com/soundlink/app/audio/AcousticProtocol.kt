package com.soundlink.app.audio

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.AudioAttributes
import android.media.AudioFormat.Builder
import android.media.MediaRecorder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.nio.charset.StandardCharsets
import kotlin.math.sin

object AcousticProtocol {
    private const val SAMPLE_RATE = 44100
    private val FREQS = DoubleArray(16) { i -> 1000.0 + i * 100.0 } // 1000Hz to 2500Hz
    private const val START_FREQ = 2700.0
    private const val STOP_FREQ = 2900.0
    private const val TONE_DURATION_SEC = 0.15
    private const val PAUSE_DURATION_SEC = 0.05

    suspend fun playAcousticData(payloadText: String) = withContext(Dispatchers.IO) {
        try {
            val bytes = payloadText.toByteArray(StandardCharsets.UTF_8)
            val nibbles = mutableListOf<Int>()
            for (b in bytes) {
                nibbles.add((b.toInt() shr 4) and 0x0f)
                nibbles.add(b.toInt() and 0x0f)
            }

            val tones = mutableListOf<Double>()
            // Start tone
            tones.add(START_FREQ)
            // Magic header
            tones.add(1000.0); tones.add(1500.0); tones.add(2000.0); tones.add(2500.0)
            
            for (n in nibbles) {
                tones.add(FREQS[n % FREQS.size])
            }
            // Stop tone
            tones.add(STOP_FREQ)

            val sampleRate = SAMPLE_RATE
            val numSamplesPerTone = (sampleRate * TONE_DURATION_SEC).toInt()
            val numSamplesPerPause = (sampleRate * PAUSE_DURATION_SEC).toInt()
            val totalSamples = tones.size * (numSamplesPerTone + numSamplesPerPause)
            val audioData = ShortArray(totalSamples)

            var sampleIndex = 0
            for (freq in tones) {
                // Tone
                for (i in 0 until numSamplesPerTone) {
                    val angle = 2.0 * Math.PI * freq * i / sampleRate
                    audioData[sampleIndex++] = (sin(angle) * Short.MAX_VALUE * 0.7).toShort()
                }
                // Pause (silence)
                for (i in 0 until numSamplesPerPause) {
                    audioData[sampleIndex++] = 0
                }
            }

            val bufferSize = android.media.AudioTrack.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            )

            val audioTrack = AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build()
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(sampleRate)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build()
                )
                .setBufferSizeInBytes(maxOf(bufferSize, audioData.size * 2))
                .setTransferMode(AudioTrack.MODE_STATIC)
                .build()

            audioTrack.write(audioData, 0, audioData.size)
            audioTrack.play()

            // Wait until playback finishes
            val durationMs = (totalSamples * 1000L) / sampleRate
            Thread.sleep(durationMs + 200)
            audioTrack.stop()
            audioTrack.release()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
