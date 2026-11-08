package com.marshmello.ble

import android.annotation.SuppressLint
import android.bluetooth.*
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import android.util.Log

@SuppressLint("MissingPermission")
class BleManager(
    private val context: Context,
    private val callback: BleEventListener
) {
    interface BleEventListener {
        fun onDeviceDiscovered(device: BluetoothDevice, rssi: Int)
        fun onConnectionStateChanged(connected: Boolean, autoReconnecting: Boolean)
        fun onRssiRead(rssi: Int)
        fun onBatteryLevelReceived(batteryPct: Int)
        fun onTagButtonPressed(pressed: Boolean)
        fun onError(message: String)
    }

    companion object {
        private const val TAG = "MarshmelloBleManager"
    }

    private val bluetoothManager: BluetoothManager? =
        context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    private val bluetoothAdapter: BluetoothAdapter? = bluetoothManager?.adapter

    private var bluetoothGatt: BluetoothGatt? = null
    private var isScanning = false
    private var isConnected = false
    private var targetMacAddress: String? = null
    private var shouldAutoReconnect = true

    private val mainHandler = Handler(Looper.getMainLooper())
    private var rssiPollingRunnable: Runnable? = null
    private var reconnectRunnable: Runnable? = null

    // ======================== SCANNING ========================================
    fun startScan() {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled) {
            callback.onError("Bluetooth is disabled or not supported.")
            return
        }

        val scanner = bluetoothAdapter.bluetoothLeScanner
        if (scanner == null) {
            callback.onError("BLE Scanner not available.")
            return
        }

        if (isScanning) return

        val filters = listOf(
            ScanFilter.Builder()
                .setServiceUuid(ParcelUuid(BleConstants.SERVICE_UUID))
                .build()
        )

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        try {
            isScanning = true
            scanner.startScan(filters, settings, scanCallback)
            Log.d(TAG, "BLE Scan started for Marshmello Service UUID.")
        } catch (e: Exception) {
            isScanning = false
            callback.onError("Failed to start scan: ${e.message}")
        }
    }

    fun stopScan() {
        if (!isScanning) return
        try {
            bluetoothAdapter?.bluetoothLeScanner?.stopScan(scanCallback)
            isScanning = false
            Log.d(TAG, "BLE Scan stopped.")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping scan: ${e.message}")
        }
    }

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult?) {
            result?.let {
                val device = it.device
                val rssi = it.rssi
                val name = it.scanRecord?.deviceName ?: device.name ?: "Unknown"
                if (name.contains("Marshmello", ignoreCase = true) ||
                    it.scanRecord?.serviceUuids?.contains(ParcelUuid(BleConstants.SERVICE_UUID)) == true
                ) {
                    mainHandler.post {
                        callback.onDeviceDiscovered(device, rssi)
                    }
                }
            }
        }

        override fun onScanFailed(errorCode: Int) {
            isScanning = false
            mainHandler.post {
                callback.onError("Scan failed with code: $errorCode")
            }
        }
    }

    // ======================== CONNECTION ======================================
    fun connect(macAddress: String) {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled) {
            callback.onError("Bluetooth is not enabled")
            return
        }

        stopScan()
        targetMacAddress = macAddress
        shouldAutoReconnect = true

        val device = bluetoothAdapter.getRemoteDevice(macAddress)
        Log.d(TAG, "Connecting to GATT device: $macAddress")

        bluetoothGatt?.close()
        bluetoothGatt = device.connectGatt(
            context,
            false,
            gattCallback,
            BluetoothDevice.TRANSPORT_LE
        )
    }

    fun disconnect() {
        shouldAutoReconnect = false
        stopRssiPolling()
        reconnectRunnable?.let { mainHandler.removeCallbacks(it) }

        bluetoothGatt?.let {
            it.disconnect()
            it.close()
        }
        bluetoothGatt = null
        isConnected = false
        callback.onConnectionStateChanged(connected = false, autoReconnecting = false)
    }

    private fun scheduleReconnect() {
        if (!shouldAutoReconnect || targetMacAddress == null) return

        reconnectRunnable?.let { mainHandler.removeCallbacks(it) }
        reconnectRunnable = Runnable {
            if (!isConnected && shouldAutoReconnect && targetMacAddress != null) {
                Log.d(TAG, "Attempting auto-reconnect to $targetMacAddress...")
                connect(targetMacAddress!!)
            }
        }
        mainHandler.postDelayed(reconnectRunnable!!, BleConstants.RECONNECT_DELAY_MS)
    }

    // ======================== RSSI POLLING ====================================
    private fun startRssiPolling() {
        stopRssiPolling()
        rssiPollingRunnable = object : Runnable {
            override fun run() {
                if (isConnected && bluetoothGatt != null) {
                    bluetoothGatt?.readRemoteRssi()
                    mainHandler.postDelayed(this, BleConstants.RSSI_POLL_INTERVAL_MS)
                }
            }
        }
        mainHandler.post(rssiPollingRunnable!!)
    }

    private fun stopRssiPolling() {
        rssiPollingRunnable?.let {
            mainHandler.removeCallbacks(it)
            rssiPollingRunnable = null
        }
    }

    // ======================== GATT CALLBACK ===================================
    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
            Log.d(TAG, "onConnectionStateChange status: $status, newState: $newState")
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                isConnected = true
                mainHandler.post {
                    callback.onConnectionStateChanged(connected = true, autoReconnecting = false)
                }
                // Discover GATT Services
                gatt?.discoverServices()
                startRssiPolling()
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                isConnected = false
                stopRssiPolling()
                mainHandler.post {
                    callback.onConnectionStateChanged(connected = false, autoReconnecting = shouldAutoReconnect)
                }
                gatt?.close()
                bluetoothGatt = null
                scheduleReconnect()
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt?, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS && gatt != null) {
                Log.d(TAG, "Services discovered successfully.")
                enableNotifications(gatt)
            } else {
                Log.w(TAG, "Services discovery failed with status: $status")
            }
        }

        override fun onReadRemoteRssi(gatt: BluetoothGatt?, rssi: Int, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                mainHandler.post {
                    callback.onRssiRead(rssi)
                }
            }
        }

        @Deprecated("Deprecated in Java for API 33+")
        override fun onCharacteristicChanged(
            gatt: BluetoothGatt?,
            characteristic: BluetoothGattCharacteristic?
        ) {
            characteristic?.let { handleCharacteristicUpdate(it) }
        }

        override fun onCharacteristicChanged(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray
        ) {
            handleCharacteristicBytes(characteristic.uuid.toString(), value)
        }

        override fun onCharacteristicRead(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray,
            status: Int
        ) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                handleCharacteristicBytes(characteristic.uuid.toString(), value)
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun handleCharacteristicUpdate(characteristic: BluetoothGattCharacteristic) {
        val value = characteristic.value ?: return
        handleCharacteristicBytes(characteristic.uuid.toString(), value)
    }

    private fun handleCharacteristicBytes(uuidStr: String, value: ByteArray) {
        if (value.isEmpty()) return

        when (uuidStr.uppercase()) {
            BleConstants.CHAR_BATTERY_UUID.toString().uppercase() -> {
                val batteryPct = value[0].toInt() and 0xFF
                mainHandler.post {
                    callback.onBatteryLevelReceived(batteryPct)
                }
            }
            BleConstants.CHAR_STATUS_UUID.toString().uppercase() -> {
                val statusByte = value[0].toInt()
                val buttonPressed = (statusByte and 0x01) != 0
                mainHandler.post {
                    callback.onTagButtonPressed(buttonPressed)
                }
            }
        }
    }

    private fun enableNotifications(gatt: BluetoothGatt) {
        val service = gatt.getService(BleConstants.SERVICE_UUID) ?: return

        // 1. Subscribe to Battery notifications
        val battChar = service.getCharacteristic(BleConstants.CHAR_BATTERY_UUID)
        if (battChar != null) {
            gatt.setCharacteristicNotification(battChar, true)
            val desc = battChar.getDescriptor(BleConstants.CCCD_UUID)
            if (desc != null) {
                @Suppress("DEPRECATION")
                desc.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                gatt.writeDescriptor(desc)
            }
            // Read initial battery
            gatt.readCharacteristic(battChar)
        }

        // 2. Subscribe to Status/Button notifications
        mainHandler.postDelayed({
            val statusChar = service.getCharacteristic(BleConstants.CHAR_STATUS_UUID)
            if (statusChar != null) {
                gatt.setCharacteristicNotification(statusChar, true)
                val desc = statusChar.getDescriptor(BleConstants.CCCD_UUID)
                if (desc != null) {
                    @Suppress("DEPRECATION")
                    desc.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                    gatt.writeDescriptor(desc)
                }
            }
        }, 300)
    }

    // ======================== TAG COMMANDS ====================================
    fun sendArmedStateToTag(armed: Boolean) {
        sendCommand(if (armed) BleConstants.CMD_ARM else BleConstants.CMD_DISARM)
    }

    fun sendBuzzerTriggerToTag(activate: Boolean) {
        sendCommand(if (activate) BleConstants.CMD_SOUND_BUZZER else BleConstants.CMD_SILENCE_BUZZER)
    }

    private fun sendCommand(cmdByte: Byte) {
        val gatt = bluetoothGatt ?: return
        val service = gatt.getService(BleConstants.SERVICE_UUID) ?: return
        val cmdChar = service.getCharacteristic(BleConstants.CHAR_CMD_UUID) ?: return

        @Suppress("DEPRECATION")
        cmdChar.value = byteArrayOf(cmdByte)
        gatt.writeCharacteristic(cmdChar)
        Log.d(TAG, "Sent command to tag: 0x%02X".format(cmdByte))
    }

    fun isConnected(): Boolean = isConnected
    fun getTargetMacAddress(): String? = targetMacAddress
}

