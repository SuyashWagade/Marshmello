package com.marshmello.service

import android.annotation.SuppressLint
import android.app.*
import android.bluetooth.BluetoothDevice
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.marshmello.MainActivity
import com.marshmello.R
import com.marshmello.alarm.AlarmController
import com.marshmello.ble.BleManager
import com.marshmello.core.NativeDetectorCore
import com.marshmello.sensors.MotionSensorManager
import com.marshmello.wear.WearProtocolBridge

class MarshmelloForegroundService : Service(),
    BleManager.BleEventListener,
    MotionSensorManager.MotionSampleListener,
    WearProtocolBridge.WearEventListener {

    companion object {
        private const val TAG = "MarshmelloService"
        const val CHANNEL_ID = "marshmello_security_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START = "com.marshmello.service.START"
        const val ACTION_STOP = "com.marshmello.service.STOP"
        const val ACTION_ARM = "com.marshmello.service.ARM"
        const val ACTION_DISARM = "com.marshmello.service.DISARM"
    }

    inner class LocalBinder : Binder() {
        fun getService(): MarshmelloForegroundService = this@MarshmelloForegroundService
    }

    private val binder = LocalBinder()

    // Core Components
    lateinit var nativeDetector: NativeDetectorCore
        private set
    lateinit var bleManager: BleManager
        private set
    lateinit var motionSensors: MotionSensorManager
        private set
    lateinit var alarmController: AlarmController
        private set
    lateinit var wearBridge: WearProtocolBridge
        private set

    // Service State
    var isArmed: Boolean = false
        private set
    var isConnected: Boolean = false
        private set
    var currentBatteryPct: Int = 100
        private set
    var lastRssi: Float = -65.0f
        private set
    var isAlarmActive: Boolean = false
        private set
    var targetMacAddress: String? = null
        private set

    // Callback to React Native Module
    var serviceListener: ServiceEventListener? = null

    interface ServiceEventListener {
        fun onTagDiscovered(name: String, address: String, rssi: Int)
        fun onStatusChanged(isArmed: Boolean, isConnected: Boolean, rssi: Float, battery: Int)
        fun onAlarmTriggered(reason: String, stateCode: Int)
        fun onAlarmDisarmed(reason: String)
        fun onError(message: String)
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Creating MarshmelloForegroundService...")

        createNotificationChannel()

        nativeDetector = NativeDetectorCore()
        bleManager = BleManager(this, this)
        motionSensors = MotionSensorManager(this, this)
        alarmController = AlarmController(this)
        wearBridge = WearProtocolBridge(this, this)
        wearBridge.register()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                startForegroundWithNotification("Marshmello Standing By", "Connecting to security tag...")
            }
            ACTION_ARM -> {
                arm()
            }
            ACTION_DISARM -> {
                disarm("USER_ACTION")
            }
            ACTION_STOP -> {
                stopSelf()
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder {
        return binder
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "Destroying MarshmelloForegroundService...")
        disarm("SERVICE_DESTROY")
        bleManager.disconnect()
        motionSensors.stop()
        wearBridge.unregister()
        nativeDetector.destroy()
    }

    // ======================== ARM / DISARM LOGIC ===============================
    fun arm() {
        isArmed = true
        nativeDetector.setArmed(true)
        bleManager.sendArmedStateToTag(true)
        motionSensors.start()
        updateNotification("Marshmello ARMED", "Monitoring tag range & sudden snatch motions.")
        notifyStatusChanged()
    }

    fun disarm(reason: String = "USER_AUTH") {
        isArmed = false
        isAlarmActive = false
        nativeDetector.disarm()
        alarmController.stopAlarm()
        bleManager.sendArmedStateToTag(false)
        bleManager.sendBuzzerTriggerToTag(false)
        motionSensors.stop()
        updateNotification("Marshmello Disarmed", "System is idle.")
        wearBridge.notifyAlarmDisarmed()
        serviceListener?.onAlarmDisarmed(reason)
        notifyStatusChanged()
    }

    fun triggerAlarm(reason: String, stateCode: Int) {
        if (isAlarmActive) return
        isAlarmActive = true

        Log.w(TAG, "ALARM TRIGGERED! Reason: $reason (State: $stateCode)")
        alarmController.startAlarm()
        bleManager.sendBuzzerTriggerToTag(true)
        wearBridge.notifyAlarmTriggered(reason, lastRssi)

        updateNotification("CRITICAL ALERT: $reason", "Tap to open and disarm system!")

        // Launch full-screen emergency UI
        val alarmIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("route", "Alarm")
            putExtra("reason", reason)
        }
        startActivity(alarmIntent)

        serviceListener?.onAlarmTriggered(reason, stateCode)
    }

    fun triggerTestAlarm() {
        triggerAlarm("TEST_ALARM", NativeDetectorCore.STATE_ALARM_SNATCH)
    }

    fun connectTag(macAddress: String) {
        targetMacAddress = macAddress
        bleManager.connect(macAddress)
    }

    fun updateConfig(
        rssiThreshold: Float,
        gracePeriodMs: Long,
        jerkThreshold: Float,
        gyroThreshold: Float,
        autoDisarmOnReturn: Boolean
    ) {
        nativeDetector.updateConfig(
            rssiThreshold,
            gracePeriodMs,
            jerkThreshold,
            gyroThreshold,
            autoDisarmOnReturn
        )
    }

    // ======================== BLE CALLBACKS ===================================
    override fun onDeviceDiscovered(device: BluetoothDevice, rssi: Int) {
        val name = device.name ?: "Marshmello-Tag"
        serviceListener?.onTagDiscovered(name, device.address, rssi)
    }

    override fun onConnectionStateChanged(connected: Boolean, autoReconnecting: Boolean) {
        isConnected = connected
        val now = System.currentTimeMillis()

        if (connected) {
            val state = nativeDetector.notifyBleConnected(now)
            checkDetectorState(state)
            updateNotification(
                if (isArmed) "Marshmello ARMED" else "Marshmello Connected",
                "Tag linked. Monitoring active."
            )
        } else {
            val state = nativeDetector.notifyBleDisconnected(now)
            checkDetectorState(state)
            if (isArmed) {
                updateNotification(
                    "Marshmello ARMED - Link Lost",
                    if (autoReconnecting) "Auto-reconnecting to tag..." else "Tag disconnected!"
                )
                // When tag link drops while armed, trigger alarm after 3-second grace period
                serviceScope.launch {
                    kotlinx.coroutines.delay(3000)
                    if (isArmed && !bleManager.isConnected() && !isAlarmActive) {
                        Log.w(TAG, "Tag out of range after grace period -> Triggering alarm!")
                        triggerAlarm("TAG OUT OF RANGE", NativeDetectorCore.STATE_ALARM_RANGE)
                    }
                }
            }
        }
        notifyStatusChanged()
    }

    override fun onRssiRead(rssi: Int) {
        val now = System.currentTimeMillis()
        val state = nativeDetector.processRssi(rssi.toFloat(), now)
        lastRssi = nativeDetector.getFilteredRssi()

        checkDetectorState(state)
        notifyStatusChanged()
    }

    override fun onBatteryLevelReceived(batteryPct: Int) {
        currentBatteryPct = batteryPct
        notifyStatusChanged()
    }

    override fun onTagButtonPressed(pressed: Boolean) {
        Log.d(TAG, "Tag button status: $pressed")
        if (pressed && isAlarmActive) {
            // Owner physically pressed tag button to confirm proximity / disarm
            disarm("TAG_BUTTON_PRESS")
        }
    }

    override fun onError(message: String) {
        serviceListener?.onError(message)
    }

    // ======================== IMU SENSOR CALLBACK =============================
    override fun onMotionSample(
        ax: Float, ay: Float, az: Float,
        gx: Float, gy: Float, gz: Float,
        timestampMs: Long
    ) {
        val state = nativeDetector.processImu(ax, ay, az, gx, gy, gz, timestampMs)
        checkDetectorState(state)
    }

    // ======================== WEAR OS EVENT CALLBACK ==========================
    override fun onWearDisarmRequested() {
        disarm("WEAR_OS_DISARM")
    }

    override fun onWearArmToggleRequested(arm: Boolean) {
        if (arm) arm() else disarm("WEAR_OS_TOGGLE")
    }

    // ======================== STATE MACHINE EVALUATION ========================
    private fun checkDetectorState(state: Int) {
        when (state) {
            NativeDetectorCore.STATE_ALARM_SNATCH -> {
                triggerAlarm("SNATCH MOTION DETECTED", state)
            }
            NativeDetectorCore.STATE_ALARM_RANGE -> {
                triggerAlarm("TAG OUT OF RANGE", state)
            }
            NativeDetectorCore.STATE_RANGE_WARNING -> {
                if (isArmed && !isAlarmActive) {
                    updateNotification("Marshmello Warning", "Tag range breached. Grace countdown active.")
                }
            }
            NativeDetectorCore.STATE_IDLE_ARMED -> {
                if (isAlarmActive) {
                    // Tag returned within safe range, auto-disarming
                    disarm("AUTO_DISARM_TAG_RETURN")
                }
            }
        }
    }

    private fun notifyStatusChanged() {
        serviceListener?.onStatusChanged(isArmed, isConnected, lastRssi, currentBatteryPct)
        wearBridge.notifyStatusUpdate(isArmed, isConnected, currentBatteryPct, lastRssi)
    }

    // ======================== FOREGROUND NOTIFICATION =========================
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Marshmello Anti-Theft Service",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Monitors BLE proximity and phone motion against snatch theft."
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    @SuppressLint("ForegroundServiceType")
    private fun startForegroundWithNotification(title: String, text: String) {
        val notification = buildNotification(title, text)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun updateNotification(title: String, text: String) {
        val notification = buildNotification(title, text)
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, notification)
    }

    private fun buildNotification(title: String, text: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
    }
}

