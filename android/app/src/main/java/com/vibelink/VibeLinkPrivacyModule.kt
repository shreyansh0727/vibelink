package com.vibelink

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = VibeLinkPrivacyModule.NAME)
class VibeLinkPrivacyModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private val pauseReceiver =
      object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
          if (reactContext.hasActiveReactInstance()) {
            reactContext.emitDeviceEvent(EVENT_PAUSED_CHANGED, snapshot())
          }
        }
      }

  init {
    val filter = IntentFilter(ACTION_PAUSED_CHANGED)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      reactContext.registerReceiver(pauseReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      reactContext.registerReceiver(pauseReceiver, filter)
    }
  }

  override fun getName(): String = NAME

  override fun invalidate() {
    try {
      reactContext.unregisterReceiver(pauseReceiver)
    } catch (_: IllegalArgumentException) {
      // Receiver was never registered; nothing to clean up.
    }
    super.invalidate()
  }

  @ReactMethod fun addListener(eventName: String) {}

  @ReactMethod fun removeListeners(count: Int) {}

  private fun prefs() =
      reactContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun snapshot(): WritableMap =
      Arguments.createMap().apply {
        putBoolean("privacyMode", prefs().getBoolean(KEY_PRIVACY, false))
        putBoolean("disguised", LauncherVisibility.isDisguised(reactContext))
        putBoolean("paused", prefs().getBoolean(KEY_PAUSED, false))
      }

  @ReactMethod
  fun getState(promise: Promise) {
    promise.resolve(snapshot())
  }

  @ReactMethod
  fun isPaused(promise: Promise) {
    promise.resolve(prefs().getBoolean(KEY_PAUSED, false))
  }

  @ReactMethod
  fun setPrivacyMode(enabled: Boolean, promise: Promise) {
    prefs().edit().putBoolean(KEY_PRIVACY, enabled).apply()
    try {
      LauncherVisibility.setDisguised(reactContext, enabled)
    } catch (_: Exception) {
      // The pref stays saved; the next app start retries the launcher swap.
    }
    promise.resolve(snapshot())
  }

  @ReactMethod
  fun setPaused(paused: Boolean, promise: Promise) {
    prefs().edit().putBoolean(KEY_PAUSED, paused).apply()
    promise.resolve(snapshot())
  }

  companion object {
    const val NAME = "VibeLinkPrivacy"
    const val PREFS = "vibelink_privacy"
    const val KEY_PRIVACY = "privacy_mode"
    const val KEY_PAUSED = "delivery_paused"
    const val EVENT_PAUSED_CHANGED = "vibeLinkPrivacyChanged"
    const val ACTION_PAUSED_CHANGED = "com.vibelink.action.PAUSED_CHANGED"
  }
}
