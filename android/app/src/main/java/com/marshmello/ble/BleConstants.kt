package com.marshmello.ble

import java.util.UUID

object BleConstants {
    const val DEVICE_NAME = "Marshmello-Tag"

    // Custom Service UUID
    val SERVICE_UUID: UUID = UUID.fromString("19B10000-E8F2-537E-4F6C-D104768A1214")

    // Characteristic UUIDs
    val CHAR_BATTERY_UUID: UUID = UUID.fromString("19B10001-E8F2-537E-4F6C-D104768A1214")
    val CHAR_STATUS_UUID: UUID = UUID.fromString("19B10002-E8F2-537E-4F6C-D104768A1214")
    val CHAR_CMD_UUID: UUID = UUID.fromString("19B10003-E8F2-537E-4F6C-D104768A1214")

    // Client Characteristic Configuration Descriptor (for notifications)
    val CCCD_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

    // Tag Commands
    const val CMD_ARM: Byte = 0x01
    const val CMD_DISARM: Byte = 0x02
    const val CMD_SOUND_BUZZER: Byte = 0x03
    const val CMD_SILENCE_BUZZER: Byte = 0x04

    // Polling intervals
    const val RSSI_POLL_INTERVAL_MS = 1000L // 1.0 second
    const val RECONNECT_DELAY_MS = 2500L
}

