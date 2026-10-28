package com.vibelink

import android.app.ActivityManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = VibeLinkBatteryModule.NAME)
class VibeLinkBatteryModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun getStatus(promise: Promise) {
    try {
      val context = reactApplicationContext
      val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
      val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
      val usageStatsManager =
          context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager

      val status =
          Arguments.createMap().apply {
            putBoolean(
                "ignoringOptimizations",
                powerManager?.isIgnoringBatteryOptimizations(context.packageName) ?: false,
            )
            putInt(
                "standbyBucket",
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                  usageStatsManager?.appStandbyBucket ?: -1
                } else {
                  -1
                },
            )
            putBoolean(
                "backgroundRestricted",
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                  activityManager?.isBackgroundRestricted ?: false
                } else {
                  false
                },
            )
            putString("manufacturer", Build.MANUFACTURER ?: "")
            putString("model", Build.MODEL ?: "")
          }
      promise.resolve(status)
    } catch (error: Exception) {
      promise.reject("battery_status_failed", error)
    }
  }

  @ReactMethod
  fun requestUnrestricted(promise: Promise) {
    openSettings(
        Intent(
                Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                Uri.parse("package:${reactApplicationContext.packageName}"),
            ),
        Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS),
        promise,
    )
  }

  @ReactMethod
  fun openAppSettings(promise: Promise) {
    openSettings(
        Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:${reactApplicationContext.packageName}"),
        ),
        Intent(Settings.ACTION_SETTINGS),
        promise,
    )
  }

  private fun openSettings(primary: Intent, fallback: Intent, promise: Promise) {
    primary.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      reactApplicationContext.startActivity(primary)
      promise.resolve(true)
    } catch (primaryError: Exception) {
      try {
        reactApplicationContext.startActivity(fallback)
        promise.resolve(true)
      } catch (fallbackError: Exception) {
        promise.reject("settings_unavailable", fallbackError)
      }
    }
  }

  companion object {
    const val NAME = "VibeLinkBattery"
  }
}
