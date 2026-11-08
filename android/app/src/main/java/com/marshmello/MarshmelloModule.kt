package com.marshmello

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.marshmello.service.MarshmelloForegroundService

class MarshmelloModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    MarshmelloForegroundService.ServiceEventListener {

    companion object {
        const val NAME = "MarshmelloNative"
        private const val TAG = "MarshmelloModule"
    }

    override fun getName(): String = NAME

    private var foregroundService: MarshmelloForegroundService? = null
    private var isBound = false
    private val mainHandler = Handler(Looper.getMainLooper())

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as MarshmelloForegroundService.LocalBinder
            foregroundService = binder.getService()
            foregroundService?.serviceListener = this@MarshmelloModule
            isBound = true
            Log.d(TAG, "Connected to MarshmelloForegroundService.")
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            foregroundService?.serviceListener = null
            foregroundService = null
            isBound = false
            Log.d(TAG, "Disconnected from MarshmelloForegroundService.")
        }
    }

    init {
        bindService()
    }

    private fun bindService() {
        val intent = Intent(reactContext, MarshmelloForegroundService::class.java)
        reactContext.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
    }

    // ======================== REACT METHODS ===================================
    @ReactMethod
    fun startService(promise: Promise) {
        try {
            val intent = Intent(reactContext, MarshmelloForegroundService::class.java).apply {
                action = MarshmelloForegroundService.ACTION_START
            }
            ContextCompat.startForegroundService(reactContext, intent)
            bindService()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_START_SERVICE", e.message)
        }
    }

    @ReactMethod
    fun stopService(promise: Promise) {
        try {
            if (isBound) {
                reactContext.unbindService(serviceConnection)
                isBound = false
            }
            val intent = Intent(reactContext, MarshmelloForegroundService::class.java).apply {
                action = MarshmelloForegroundService.ACTION_STOP
            }
            reactContext.stopService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_STOP_SERVICE", e.message)
        }
    }

    @ReactMethod
    fun arm(promise: Promise) {
        foregroundService?.let {
            it.arm()
            promise.resolve(true)
        } ?: run {
            promise.reject("ERR_NOT_BOUND", "Service is not bound yet.")
        }
    }

    @ReactMethod
    fun disarmWithBiometrics(promise: Promise) {
        mainHandler.post {
            val currentActivity = currentActivity as? FragmentActivity
            if (currentActivity == null) {
                promise.reject("ERR_NO_ACTIVITY", "Current activity is null or not a FragmentActivity.")
                return@post
            }

            val executor = ContextCompat.getMainExecutor(currentActivity)
            val biometricPrompt = BiometricPrompt(
                currentActivity,
                executor,
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        super.onAuthenticationSucceeded(result)
                        foregroundService?.disarm("BIOMETRIC")
                        promise.resolve(true)
                    }

                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        super.onAuthenticationError(errorCode, errString)
                        promise.reject("ERR_BIOMETRIC_FAILED", errString.toString())
                    }

                    override fun onAuthenticationFailed() {
                        super.onAuthenticationFailed()
                        // Keep trying or handle failure
                    }
                }
            )

            val promptInfo = BiometricPrompt.PromptInfo.Builder()
                .setTitle("Disarm Marshmello")
                .setSubtitle("Confirm your fingerprint or device credential to silence alarm")
                .setAllowedAuthenticators(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG or
                    BiometricManager.Authenticators.DEVICE_CREDENTIAL
                )
                .build()

            biometricPrompt.authenticate(promptInfo)
        }
    }

    @ReactMethod
    fun disarmWithPin(pin: String, correctPin: String, promise: Promise) {
        if (pin == correctPin) {
            foregroundService?.disarm("PIN")
            promise.resolve(true)
        } else {
            promise.reject("ERR_INVALID_PIN", "Incorrect PIN entered.")
        }
    }

    @ReactMethod
    fun startBleScan(promise: Promise) {
        foregroundService?.bleManager?.startScan()
        promise.resolve(true)
    }

    @ReactMethod
    fun stopBleScan(promise: Promise) {
        foregroundService?.bleManager?.stopScan()
        promise.resolve(true)
    }

    @ReactMethod
    fun connectTag(macAddress: String, promise: Promise) {
        foregroundService?.connectTag(macAddress)
        promise.resolve(true)
    }

    @ReactMethod
    fun disconnectTag(promise: Promise) {
        foregroundService?.bleManager?.disconnect()
        promise.resolve(true)
    }

    @ReactMethod
    fun triggerTestAlarm(promise: Promise) {
        foregroundService?.triggerTestAlarm()
        promise.resolve(true)
    }

    @ReactMethod
    fun stopAlarm(promise: Promise) {
        foregroundService?.disarm("MANUAL_STOP")
        promise.resolve(true)
    }

    @ReactMethod
    fun updateSettings(settings: ReadableMap, promise: Promise) {
        val rssiThreshold = if (settings.hasKey("rssiThreshold")) settings.getDouble("rssiThreshold").toFloat() else -85.0f
        val gracePeriodMs = if (settings.hasKey("gracePeriodMs")) settings.getInt("gracePeriodMs").toLong() else 3000L
        val jerkThreshold = if (settings.hasKey("jerkThreshold")) settings.getDouble("jerkThreshold").toFloat() else 28.0f
        val gyroThreshold = if (settings.hasKey("gyroThreshold")) settings.getDouble("gyroThreshold").toFloat() else 4.2f
        val autoDisarm = if (settings.hasKey("autoDisarmOnReturn")) settings.getBoolean("autoDisarmOnReturn") else true

        foregroundService?.updateConfig(
            rssiThreshold,
            gracePeriodMs,
            jerkThreshold,
            gyroThreshold,
            autoDisarm
        )
        promise.resolve(true)
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        val map = Arguments.createMap().apply {
            putBoolean("isArmed", foregroundService?.isArmed ?: false)
            putBoolean("isConnected", foregroundService?.isConnected ?: false)
            putDouble("rssi", (foregroundService?.lastRssi ?: -100.0f).toDouble())
            putInt("battery", foregroundService?.currentBatteryPct ?: 100)
            putBoolean("isAlarmActive", foregroundService?.isAlarmActive ?: false)
            putString("targetMacAddress", foregroundService?.targetMacAddress)
        }
        promise.resolve(map)
    }

    // ======================== SERVICE EVENT LISTENER ==========================
    override fun onTagDiscovered(name: String, address: String, rssi: Int) {
        val params = Arguments.createMap().apply {
            putString("name", name)
            putString("address", address)
            putInt("rssi", rssi)
        }
        sendEvent("onTagDiscovered", params)
    }

    override fun onStatusChanged(isArmed: Boolean, isConnected: Boolean, rssi: Float, battery: Int) {
        val params = Arguments.createMap().apply {
            putBoolean("isArmed", isArmed)
            putBoolean("isConnected", isConnected)
            putDouble("rssi", rssi.toDouble())
            putInt("battery", battery)
        }
        sendEvent("onStatusChanged", params)
    }

    override fun onAlarmTriggered(reason: String, stateCode: Int) {
        val params = Arguments.createMap().apply {
            putString("reason", reason)
            putInt("stateCode", stateCode)
        }
        sendEvent("onAlarmTriggered", params)
    }

    override fun onAlarmDisarmed(reason: String) {
        val params = Arguments.createMap().apply {
            putString("reason", reason)
        }
        sendEvent("onAlarmDisarmed", params)
    }

    override fun onError(message: String) {
        val params = Arguments.createMap().apply {
            putString("message", message)
        }
        sendEvent("onError", params)
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(eventName, params)
        } catch (e: Exception) {
            Log.e(TAG, "Error emitting event $eventName: ${e.message}")
        }
    }

    // Required for React Native event emitter
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}

