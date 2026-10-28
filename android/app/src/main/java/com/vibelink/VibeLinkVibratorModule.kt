package com.vibelink

import android.content.Context
import android.media.AudioAttributes
import android.os.Build
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = VibeLinkVibratorModule.NAME)
class VibeLinkVibratorModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun vibrate(pattern: ReadableArray, amplitudes: ReadableArray?) {
    val vibrator = getVibrator() ?: return
    if (!vibrator.hasVibrator()) {
      return
    }

    val timings = LongArray(pattern.size())
    for (index in 0 until pattern.size()) {
      timings[index] = pattern.getInt(index).toLong()
    }
    if (timings.isEmpty()) {
      return
    }

    val levels =
        if (amplitudes != null && amplitudes.size() == pattern.size()) {
          IntArray(amplitudes.size()) { index ->
            amplitudes.getInt(index).coerceIn(0, 255)
          }
        } else {
          null
        }

    // React Native defaults to MEDIA usage, which Android ignores for background
    // processes. NOTIFICATION is one of the usages AOSP still permits there.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      vibrator.vibrate(
          buildEffect(timings, levels),
          VibrationAttributes.Builder()
              .setUsage(VibrationAttributes.USAGE_NOTIFICATION)
              .build(),
      )
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      vibrator.vibrate(buildEffect(timings, levels), notificationAudioAttributes())
    } else {
      @Suppress("DEPRECATION")
      vibrator.vibrate(timings, -1, notificationAudioAttributes())
    }
  }

  private fun buildEffect(timings: LongArray, amplitudes: IntArray?): VibrationEffect =
      if (amplitudes != null) {
        VibrationEffect.createWaveform(timings, amplitudes, -1)
      } else {
        VibrationEffect.createWaveform(timings, -1)
      }

  private fun notificationAudioAttributes(): AudioAttributes =
      AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()

  private fun getVibrator(): Vibrator? =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val manager =
            reactApplicationContext.getSystemService(Context.VIBRATOR_MANAGER_SERVICE)
                as? VibratorManager
        manager?.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        reactApplicationContext.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
      }

  companion object {
    const val NAME = "VibeLinkVibrator"
  }
}
