package com.vibelink

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableType
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = VibeLinkTorchModule.NAME)
class VibeLinkTorchModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private val handler = Handler(Looper.getMainLooper())
  private val scheduled = mutableListOf<Runnable>()
  private var generation = 0
  private var remoteOn = false

  // A remote "on" is a loan, not a new default: the light returns to off even
  // if the other phone loses connectivity before sending "off".
  private val autoOff =
      Runnable {
        remoteOn = false
        applyTorch(false)
      }

  override fun getName(): String = NAME

  @ReactMethod fun addListener(eventName: String) {}

  @ReactMethod fun removeListeners(count: Int) {}

  override fun invalidate() {
    cancelPending()
    applyTorch(false)
    super.invalidate()
  }

  private fun prefs() =
      reactContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun hasCameraPermission(): Boolean =
      ContextCompat.checkSelfPermission(
          reactContext,
          Manifest.permission.CAMERA,
      ) == PackageManager.PERMISSION_GRANTED

  private fun cameraManager(): CameraManager? =
      reactContext.getSystemService(Context.CAMERA_SERVICE) as? CameraManager

  private fun torchId(): String? {
    return try {
      val manager = cameraManager() ?: return null
      manager.cameraIdList.firstOrNull { id ->
        manager.getCameraCharacteristics(id)
            .get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun applyTorch(enabled: Boolean): Boolean {
    val manager = cameraManager() ?: return false
    val id = torchId() ?: return false
    return try {
      manager.setTorchMode(id, enabled)
      true
    } catch (_: Exception) {
      false
    }
  }

  private fun cancelPending() {
    generation += 1
    scheduled.forEach { handler.removeCallbacks(it) }
    scheduled.clear()
  }

  private fun snapshot() =
      Arguments.createMap().apply {
        putBoolean("available", torchId() != null)
        putBoolean("permission", hasCameraPermission())
        putBoolean("flashEnabled", prefs().getBoolean(KEY_FLASH, false))
      }

  @ReactMethod
  fun getState(promise: Promise) {
    promise.resolve(snapshot())
  }

  @ReactMethod
  fun setFlashEnabled(enabled: Boolean, promise: Promise) {
    prefs().edit().putBoolean(KEY_FLASH, enabled).apply()
    if (!enabled) {
      cancelPending()
      applyTorch(remoteOn)
    }
    promise.resolve(snapshot())
  }

  @ReactMethod
  fun setTorch(enabled: Boolean, promise: Promise) {
    if (torchId() == null) {
      promise.reject("torch_unavailable", "This phone has no flashlight.")
      return
    }
    if (!hasCameraPermission()) {
      promise.reject(
          "torch_permission_required",
          "Camera access is needed to control the flashlight.",
      )
      return
    }

    handler.removeCallbacks(autoOff)
    if (!enabled) {
      remoteOn = false
      applyTorch(false)
      promise.resolve(true)
      return
    }

    if (!applyTorch(true)) {
      remoteOn = false
      promise.reject("torch_busy", "The flashlight could not be switched on.")
      return
    }
    remoteOn = true
    handler.postDelayed(autoOff, AUTO_OFF_MS)
    promise.resolve(true)
  }

  @ReactMethod
  fun flashPattern(
      timings: ReadableArray,
      amplitudes: ReadableArray?,
      promise: Promise,
  ) {
    if (
        timings.size() < 2 ||
            timings.size() > MAX_TIMINGS ||
            !hasCameraPermission() ||
            torchId() == null ||
            !prefs().getBoolean(KEY_FLASH, false)
    ) {
      promise.resolve(false)
      return
    }

    val hasLevels = amplitudes != null && amplitudes.size() == timings.size()
    val schedule = ArrayList<Pair<Long, Boolean>>()
    var offset = 0L

    for (index in 0 until timings.size()) {
      val duration = readMs(timings, index).coerceIn(0, MAX_SEGMENT_MS).toLong()
      if (index > 0) {
        val level = if (hasLevels) readMs(amplitudes!!, index) else 255
        if (level > 0) {
          schedule.add(offset to true)
          schedule.add((offset + duration) to false)
        }
      }
      offset += duration
      if (offset >= MAX_PATTERN_MS) {
        break
      }
    }

    if (schedule.isEmpty()) {
      promise.resolve(false)
      return
    }

    cancelPending()
    val token = generation

    for ((delay, on) in schedule) {
      val runnable = Runnable {
        if (token == generation) {
          applyTorch(on)
        }
      }
      scheduled.add(runnable)
      handler.postDelayed(runnable, delay)
    }

    val restore = Runnable {
      if (token == generation) {
        scheduled.clear()
        applyTorch(remoteOn)
      }
    }
    scheduled.add(restore)
    handler.postDelayed(restore, offset + RESTORE_DELAY_MS)

    promise.resolve(true)
  }

  @ReactMethod
  fun cancelFlash(promise: Promise) {
    cancelPending()
    applyTorch(remoteOn)
    promise.resolve(true)
  }

  private fun readMs(array: ReadableArray, index: Int): Int =
      if (array.getType(index) == ReadableType.Number) {
        array.getDouble(index).toInt()
      } else {
        0
      }

  companion object {
    const val NAME = "VibeLinkTorch"
    const val PREFS = "vibelink_torch"
    const val KEY_FLASH = "flash_with_pulses"
    private const val AUTO_OFF_MS = 5 * 60 * 1000L
    private const val MAX_TIMINGS = 64
    private const val MAX_SEGMENT_MS = 10_000
    private const val MAX_PATTERN_MS = 30_000L
    private const val RESTORE_DELAY_MS = 80L
  }
}
