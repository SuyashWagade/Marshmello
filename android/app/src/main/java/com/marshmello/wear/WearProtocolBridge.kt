package com.marshmello.wear

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.util.Log

/**
 * Standard protocol bridge for future Wear OS smartwatch companion integration.
 * The Wear OS app (standalone or companion module) communicates via these
 * intent actions, or through Google Play Services Wearable DataClient/MessageClient
 * mapping directly to these protocol constants.
 */
class WearProtocolBridge(
    private val context: Context,
    private val listener: WearEventListener
) {
    interface WearEventListener {
        fun onWearDisarmRequested()
        fun onWearArmToggleRequested(arm: Boolean)
    }

    companion object {
        private const val TAG = "WearProtocolBridge"

        // Broadcast actions sent TO Wear OS companion
        const val ACTION_ALARM_TRIGGERED = "com.marshmello.wear.ALARM_TRIGGERED"
        const val ACTION_ALARM_DISARMED = "com.marshmello.wear.ALARM_DISARMED"
        const val ACTION_STATUS_UPDATE = "com.marshmello.wear.STATUS_UPDATE"

        // Broadcast actions received FROM Wear OS companion
        const val ACTION_REQUEST_DISARM = "com.marshmello.wear.REQUEST_DISARM"
        const val ACTION_REQUEST_ARM_TOGGLE = "com.marshmello.wear.REQUEST_ARM_TOGGLE"

        // Intent Extras
        const val EXTRA_ALARM_REASON = "extra_alarm_reason"
        const val EXTRA_IS_ARMED = "extra_is_armed"
        const val EXTRA_TAG_CONNECTED = "extra_tag_connected"
        const val EXTRA_TAG_BATTERY = "extra_tag_battery"
        const val EXTRA_RSSI = "extra_rssi"
    }

    private var isReceiverRegistered = false

    private val wearReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                ACTION_REQUEST_DISARM -> {
                    Log.d(TAG, "Received disarm command from Wear OS companion.")
                    listener.onWearDisarmRequested()
                }
                ACTION_REQUEST_ARM_TOGGLE -> {
                    val arm = intent.getBooleanExtra(EXTRA_IS_ARMED, false)
                    Log.d(TAG, "Received arm toggle ($arm) from Wear OS companion.")
                    listener.onWearArmToggleRequested(arm)
                }
            }
        }
    }

    fun register() {
        if (isReceiverRegistered) return
        val filter = IntentFilter().apply {
            addAction(ACTION_REQUEST_DISARM)
            addAction(ACTION_REQUEST_ARM_TOGGLE)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(wearReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            context.registerReceiver(wearReceiver, filter)
        }
        isReceiverRegistered = true
    }

    fun unregister() {
        if (!isReceiverRegistered) return
        try {
            context.unregisterReceiver(wearReceiver)
        } catch (e: Exception) {
            Log.e(TAG, "Error unregistering receiver: ${e.message}")
        }
        isReceiverRegistered = false
    }

    // ======================== BROADCAST TO WEAR OS =========================
    fun notifyAlarmTriggered(reason: String, rssi: Float) {
        val intent = Intent(ACTION_ALARM_TRIGGERED).apply {
            putExtra(EXTRA_ALARM_REASON, reason)
            putExtra(EXTRA_RSSI, rssi)
            setPackage(context.packageName)
        }
        context.sendBroadcast(intent)
        Log.d(TAG, "Dispatched ALARM_TRIGGERED to Wear OS companion: $reason")
    }

    fun notifyAlarmDisarmed() {
        val intent = Intent(ACTION_ALARM_DISARMED).apply {
            setPackage(context.packageName)
        }
        context.sendBroadcast(intent)
        Log.d(TAG, "Dispatched ALARM_DISARMED to Wear OS companion.")
    }

    fun notifyStatusUpdate(isArmed: Boolean, isConnected: Boolean, batteryPct: Int, rssi: Float) {
        val intent = Intent(ACTION_STATUS_UPDATE).apply {
            putExtra(EXTRA_IS_ARMED, isArmed)
            putExtra(EXTRA_TAG_CONNECTED, isConnected)
            putExtra(EXTRA_TAG_BATTERY, batteryPct)
            putExtra(EXTRA_RSSI, rssi)
            setPackage(context.packageName)
        }
        context.sendBroadcast(intent)
    }
}

