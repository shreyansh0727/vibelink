package com.vibelink

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Secret dial code *#*#4263#*#* opens VibeLink when privacy mode has disguised
 * the launcher icon.
 */
class SecretCodeReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION_SECRET_CODE) {
      return
    }

    val launch =
        Intent(context, MainActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
    try {
      context.startActivity(launch)
    } catch (_: Exception) {
      // The launcher icon still exists; the user can open VibeLink another way.
    }
  }

  companion object {
    private const val ACTION_SECRET_CODE = "android.provider.Telephony.SECRET_CODE"
  }
}
