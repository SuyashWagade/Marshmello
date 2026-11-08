package com.marshmello.core

import android.util.Log

/**
 * JNI wrapper for the C++ Marshmello signal processing core.
 * Provides high-speed Kalman filtering for RSSI and multi-sensor
 * snatch detection fusing jerk, variance, and RF link state.
 */
class NativeDetectorCore(
    rssiThreshold: Float = -85.0f,
    gracePeriodMs: Long = 3000L,
    jerkThreshold: Float = 28.0f,
    gyroThreshold: Float = 4.2f,
    autoDisarmOnReturn: Boolean = true
) {
    companion object {
        private const val TAG = "NativeDetectorCore"

        init {
            try {
                System.loadLibrary("marshmello_core")
                Log.d(TAG, "Successfully loaded libmarshmello_core.so")
            } catch (e: UnsatisfiedLinkError) {
                Log.e(TAG, "Failed to load libmarshmello_core.so: ${e.message}")
            }
        }

        const val STATE_DISARMED = 0
        const val STATE_IDLE_ARMED = 1
        const val STATE_MOTION_SUSPICIOUS = 2
        const val STATE_RANGE_WARNING = 3
        const val STATE_ALARM_SNATCH = 4
        const val STATE_ALARM_RANGE = 5
    }

    private var nativeHandle: Long = 0

    init {
        nativeHandle = nativeInit(
            rssiThreshold,
            gracePeriodMs,
            jerkThreshold,
            gyroThreshold,
            autoDisarmOnReturn
        )
    }

    fun destroy() {
        if (nativeHandle != 0L) {
            nativeDestroy(nativeHandle)
            nativeHandle = 0L
        }
    }

    fun setArmed(armed: Boolean) {
        if (nativeHandle != 0L) {
            nativeSetArmed(nativeHandle, armed)
        }
    }

    fun updateConfig(
        rssiThreshold: Float,
        gracePeriodMs: Long,
        jerkThreshold: Float,
        gyroThreshold: Float,
        autoDisarmOnReturn: Boolean
    ) {
        if (nativeHandle != 0L) {
            nativeUpdateConfig(
                nativeHandle,
                rssiThreshold,
                gracePeriodMs,
                jerkThreshold,
                gyroThreshold,
                autoDisarmOnReturn
            )
        }
    }

    fun processRssi(rawRssi: Float, timestampMs: Long = System.currentTimeMillis()): Int {
        return if (nativeHandle != 0L) {
            nativeProcessRssi(nativeHandle, rawRssi, timestampMs)
        } else STATE_DISARMED
    }

    fun processImu(
        ax: Float, ay: Float, az: Float,
        gx: Float, gy: Float, gz: Float,
        timestampMs: Long = System.currentTimeMillis()
    ): Int {
        return if (nativeHandle != 0L) {
            nativeProcessImu(nativeHandle, ax, ay, az, gx, gy, gz, timestampMs)
        } else STATE_DISARMED
    }

    fun notifyBleDisconnected(timestampMs: Long = System.currentTimeMillis()): Int {
        return if (nativeHandle != 0L) {
            nativeNotifyBleDisconnected(nativeHandle, timestampMs)
        } else STATE_DISARMED
    }

    fun notifyBleConnected(timestampMs: Long = System.currentTimeMillis()): Int {
        return if (nativeHandle != 0L) {
            nativeNotifyBleConnected(nativeHandle, timestampMs)
        } else STATE_DISARMED
    }

    fun disarm() {
        if (nativeHandle != 0L) {
            nativeDisarm(nativeHandle)
        }
    }

    fun reset() {
        if (nativeHandle != 0L) {
            nativeReset(nativeHandle)
        }
    }

    fun getState(): Int {
        return if (nativeHandle != 0L) nativeGetState(nativeHandle) else STATE_DISARMED
    }

    fun getFilteredRssi(): Float {
        return if (nativeHandle != 0L) nativeGetFilteredRssi(nativeHandle) else -100.0f
    }

    fun getLastJerk(): Float {
        return if (nativeHandle != 0L) nativeGetLastJerk(nativeHandle) else 0.0f
    }

    fun getRecentVariance(): Float {
        return if (nativeHandle != 0L) nativeGetRecentVariance(nativeHandle) else 0.0f
    }

    // Native JNI functions
    private external fun nativeInit(
        rssiThreshold: Float,
        gracePeriodMs: Long,
        jerkThreshold: Float,
        gyroThreshold: Float,
        autoDisarmOnReturn: Boolean
    ): Long

    private external fun nativeDestroy(handle: Long)
    private external fun nativeSetArmed(handle: Long, armed: Boolean)
    private external fun nativeUpdateConfig(
        handle: Long,
        rssiThreshold: Float,
        gracePeriodMs: Long,
        jerkThreshold: Float,
        gyroThreshold: Float,
        autoDisarmOnReturn: Boolean
    )
    private external fun nativeProcessRssi(handle: Long, rawRssi: Float, timestampMs: Long): Int
    private external fun nativeProcessImu(
        handle: Long,
        ax: Float, ay: Float, az: Float,
        gx: Float, gy: Float, gz: Float,
        timestampMs: Long
    ): Int
    private external fun nativeNotifyBleDisconnected(handle: Long, timestampMs: Long): Int
    private external fun nativeNotifyBleConnected(handle: Long, timestampMs: Long): Int
    private external fun nativeDisarm(handle: Long)
    private external fun nativeReset(handle: Long)
    private external fun nativeGetState(handle: Long): Int
    private external fun nativeGetFilteredRssi(handle: Long): Float
    private external fun nativeGetLastJerk(handle: Long): Float
    private external fun nativeGetRecentVariance(handle: Long): Float
}

