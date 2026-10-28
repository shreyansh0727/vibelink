package com.vibelink

import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

class RevealTileService : TileService() {
  override fun onStartListening() {
    super.onStartListening()
    qsTile?.apply {
      state = Tile.STATE_INACTIVE
      label = "VibeLink app"
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        subtitle = "Open VibeLink"
      }
      updateTile()
    }
  }

  override fun onClick() {
    super.onClick()
    // Opens the app without touching the launcher decoy.
    val intent =
        Intent(this, MainActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        val pending =
            PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        startActivityAndCollapse(pending)
      } else {
        @Suppress("DEPRECATION")
        startActivityAndCollapse(intent)
      }
    } catch (_: Exception) {
      // The launcher icon still exists, so the user can open it another way.
    }
  }
}
