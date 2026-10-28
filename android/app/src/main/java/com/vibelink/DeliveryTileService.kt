package com.vibelink

import android.content.Context
import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

class DeliveryTileService : TileService() {
  override fun onStartListening() {
    super.onStartListening()
    render()
  }

  override fun onClick() {
    super.onClick()
    val prefs =
        getSharedPreferences(VibeLinkPrivacyModule.PREFS, Context.MODE_PRIVATE)
    val next =
        !prefs.getBoolean(VibeLinkPrivacyModule.KEY_PAUSED, false)
    prefs.edit().putBoolean(VibeLinkPrivacyModule.KEY_PAUSED, next).apply()
    sendBroadcast(
        Intent(VibeLinkPrivacyModule.ACTION_PAUSED_CHANGED).setPackage(packageName)
    )
    render()
  }

  private fun render() {
    val tile = qsTile ?: return
    val paused =
        getSharedPreferences(VibeLinkPrivacyModule.PREFS, Context.MODE_PRIVATE)
            .getBoolean(VibeLinkPrivacyModule.KEY_PAUSED, false)
    tile.state = if (paused) Tile.STATE_INACTIVE else Tile.STATE_ACTIVE
    tile.label = "VibeLink delivery"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      tile.subtitle = if (paused) "Paused" else "On"
    }
    tile.updateTile()
  }
}
