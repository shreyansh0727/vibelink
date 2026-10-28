package com.vibelink

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.provider.Settings

/**
 * Launcher decoy: while privacy mode is on, the disguised "System services"
 * icon opens the phone's own Settings app instead of VibeLink.
 */
class DecoyActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    try {
      startActivity(
          Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (_: Exception) {
      finish()
    }
  }

  override fun onStop() {
    super.onStop()
    // Settings covers the decoy; drop this entry so Back returns to the launcher.
    finish()
  }
}
