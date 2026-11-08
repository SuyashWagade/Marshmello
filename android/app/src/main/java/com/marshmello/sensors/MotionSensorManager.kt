package com.marshmello.sensors

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.util.Log

class MotionSensorManager(
    context: Context,
    private val listener: MotionSampleListener
) : SensorEventListener {

    interface MotionSampleListener {
        fun onMotionSample(
            ax: Float, ay: Float, az: Float,
            gx: Float, gy: Float, gz: Float,
            timestampMs: Long
        )
    }

    companion object {
        private const val TAG = "MotionSensorManager"
    }

    private val sensorManager: SensorManager? =
        context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager

    private val accelerometer: Sensor? = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private val gyroscope: Sensor? = sensorManager?.getDefaultSensor(Sensor.TYPE_GYROSCOPE)

    private var isRunning = false

    // Cached values
    private var lastAx = 0.0f
    private var lastAy = 0.0f
    private var lastAz = 9.81f
    private var lastGx = 0.0f
    private var lastGy = 0.0f
    private var lastGz = 0.0f

    fun start() {
        if (isRunning || sensorManager == null) return

        accelerometer?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }
        gyroscope?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }
        isRunning = true
        Log.d(TAG, "Motion sensor sampling started at SENSOR_DELAY_GAME (~50Hz).")
    }

    fun stop() {
        if (!isRunning || sensorManager == null) return
        sensorManager.unregisterListener(this)
        isRunning = false
        Log.d(TAG, "Motion sensor sampling stopped.")
    }

    override fun onSensorChanged(event: SensorEvent?) {
        event?.let {
            val nowMs = System.currentTimeMillis()
            when (it.sensor.type) {
                Sensor.TYPE_ACCELEROMETER -> {
                    lastAx = it.values[0]
                    lastAy = it.values[1]
                    lastAz = it.values[2]

                    // Feed IMU update to listener
                    listener.onMotionSample(
                        lastAx, lastAy, lastAz,
                        lastGx, lastGy, lastGz,
                        nowMs
                    )
                }
                Sensor.TYPE_GYROSCOPE -> {
                    lastGx = it.values[0]
                    lastGy = it.values[1]
                    lastGz = it.values[2]
                }
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
}

