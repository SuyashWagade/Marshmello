package com.marshmello.alarm

import android.content.Context
import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.os.Handler
import android.os.HandlerThread
import android.util.Log

class TorchController(private val context: Context) {

    companion object {
        private const val TAG = "TorchController"
        private const val STROBE_INTERVAL_MS = 90L // ~11Hz emergency strobe
    }

    private val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
    private var cameraId: String? = null
    private var isStrobing = false
    private var torchState = false

    private var workerThread: HandlerThread? = null
    private var workerHandler: Handler? = null

    init {
        try {
            cameraManager?.cameraIdList?.forEach { id ->
                val characteristics = cameraManager.getCameraCharacteristics(id)
                val hasFlash = characteristics.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
                val facing = characteristics.get(CameraCharacteristics.LENS_FACING)
                if (hasFlash && facing == CameraCharacteristics.LENS_FACING_BACK) {
                    cameraId = id
                    return@forEach
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error discovering camera torch: ${e.message}")
        }
    }

    private val strobeRunnable = object : Runnable {
        override fun run() {
            if (!isStrobing || cameraId == null) return

            torchState = !torchState
            try {
                cameraManager?.setTorchMode(cameraId!!, torchState)
            } catch (e: CameraAccessException) {
                Log.e(TAG, "Torch toggle failed: ${e.message}")
            }

            workerHandler?.postDelayed(this, STROBE_INTERVAL_MS)
        }
    }

    fun startStrobe() {
        if (isStrobing || cameraId == null) return

        isStrobing = true
        workerThread = HandlerThread("MarshmelloTorchThread").apply { start() }
        workerHandler = Handler(workerThread!!.looper)
        workerHandler?.post(strobeRunnable)
        Log.d(TAG, "Camera flashlight strobe started.")
    }

    fun stopStrobe() {
        if (!isStrobing) return

        isStrobing = false
        workerHandler?.removeCallbacks(strobeRunnable)
        workerThread?.quitSafely()
        workerThread = null
        workerHandler = null

        // Ensure torch is turned off
        try {
            cameraId?.let { cameraManager?.setTorchMode(it, false) }
        } catch (e: Exception) {
            Log.e(TAG, "Error ensuring torch turned off: ${e.message}")
        }
        Log.d(TAG, "Camera flashlight strobe stopped.")
    }
}

