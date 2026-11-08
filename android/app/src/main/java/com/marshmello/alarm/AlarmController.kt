package com.marshmello.alarm

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import com.marshmello.R

class AlarmController(private val context: Context) {

    companion object {
        private const val TAG = "AlarmController"
    }

    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    private val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager

    private val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        vm?.defaultVibrator
    } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }

    private val torchController = TorchController(context)
    private var mediaPlayer: MediaPlayer? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var isAlarming = false
    private var savedVolume = -1

    fun startAlarm() {
        if (isAlarming) return
        isAlarming = true
        Log.w(TAG, "EMERGENCY ALARM ACTIVATED!")

        // 1. Acquire WakeLock to keep CPU and screen alive
        try {
            if (wakeLock == null) {
                wakeLock = powerManager?.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
                    "marshmello:AlarmWakeLock"
                )
            }
            wakeLock?.acquire(10 * 60 * 1000L) // max 10 mins safeguard
        } catch (e: Exception) {
            Log.e(TAG, "WakeLock acquire error: ${e.message}")
        }

        // 2. Set Audio to Maximum Volume on Alarm Stream
        try {
            audioManager?.let { am ->
                savedVolume = am.getStreamVolume(AudioManager.STREAM_ALARM)
                val maxVol = am.getStreamMaxVolume(AudioManager.STREAM_ALARM)
                am.setStreamVolume(AudioManager.STREAM_ALARM, maxVol, AudioManager.FLAG_PLAY_SOUND)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed setting max volume: ${e.message}")
        }

        // 3. Play Looping Siren
        try {
            mediaPlayer?.release()
            mediaPlayer = MediaPlayer.create(context, R.raw.siren).apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
                        .build()
                )
                isLooping = true
                setVolume(1.0f, 1.0f)
                start()
            }
        } catch (e: Exception) {
            Log.e(TAG, "MediaPlayer creation error: ${e.message}")
        }

        // 4. Start Vibrator
        try {
            val pattern = longArrayOf(0, 500, 200, 500, 200, 500, 400)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val effect = VibrationEffect.createWaveform(pattern, 0)
                vibrator?.vibrate(effect)
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Vibrator error: ${e.message}")
        }

        // 5. Start Strobe Light
        torchController.startStrobe()
    }

    fun stopAlarm() {
        if (!isAlarming) return
        isAlarming = false
        Log.i(TAG, "Alarm silenced.")

        // Stop Siren
        try {
            mediaPlayer?.let {
                if (it.isPlaying) {
                    it.stop()
                }
                it.release()
            }
            mediaPlayer = null
        } catch (e: Exception) {
            Log.e(TAG, "MediaPlayer release error: ${e.message}")
        }

        // Stop Vibrator
        try {
            vibrator?.cancel()
        } catch (e: Exception) {
            Log.e(TAG, "Vibrator cancel error: ${e.message}")
        }

        // Stop Strobe
        torchController.stopStrobe()

        // Release WakeLock
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        } catch (e: Exception) {
            Log.e(TAG, "WakeLock release error: ${e.message}")
        }

        // Restore Volume
        if (savedVolume >= 0) {
            try {
                audioManager?.setStreamVolume(AudioManager.STREAM_ALARM, savedVolume, 0)
            } catch (e: Exception) {
                Log.e(TAG, "Restore volume error: ${e.message}")
            }
        }
    }

    fun isAlarmActive(): Boolean = isAlarming
}

