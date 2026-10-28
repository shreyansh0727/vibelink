package com.vibelink

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager

/**
 * Privacy mode never removes the app from the launcher. It swaps which
 * MAIN/LAUNCHER activity-alias is enabled: the real VibeLink icon or a
 * system-app disguise that still opens the app when tapped.
 */
object LauncherVisibility {
  private const val NORMAL_ALIAS = ".LauncherAlias"
  private const val SYSTEM_ALIAS = ".SystemAlias"
  private const val LEGACY_HIDDEN_KEY = "launcher_hidden"

  private fun component(context: Context, suffix: String): ComponentName =
      ComponentName(context.packageName, context.packageName + suffix)

  private fun setEnabled(context: Context, suffix: String, enabled: Boolean) {
    context.packageManager.setComponentEnabledSetting(
        component(context, suffix),
        if (enabled) {
          PackageManager.COMPONENT_ENABLED_STATE_ENABLED
        } else {
          PackageManager.COMPONENT_ENABLED_STATE_DISABLED
        },
        PackageManager.DONT_KILL_APP,
    )
  }

  fun isDisguised(context: Context): Boolean {
    val state =
        context.packageManager.getComponentEnabledSetting(component(context, SYSTEM_ALIAS))
    return state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
  }

  /** Keeps exactly one launcher alias enabled, so the drawer shows one icon. */
  fun setDisguised(context: Context, disguised: Boolean): Boolean {
    setEnabled(context, NORMAL_ALIAS, !disguised)
    setEnabled(context, SYSTEM_ALIAS, disguised)
    return isDisguised(context)
  }

  /**
   * Privacy mode owns the launcher state: applied on every process start so an
   * update, a reinstall or a build that shipped "hide" can never leave the app
   * without a working icon.
   */
  fun applyPrivacyState(context: Context) {
    val prefs =
        context.getSharedPreferences(VibeLinkPrivacyModule.PREFS, Context.MODE_PRIVATE)
    if (prefs.contains(LEGACY_HIDDEN_KEY)) {
      prefs.edit().remove(LEGACY_HIDDEN_KEY).apply()
    }
    val desired = prefs.getBoolean(VibeLinkPrivacyModule.KEY_PRIVACY, false)
    val aligned =
        if (desired) {
          isDisguised(context)
        } else {
          isEnabled(context, NORMAL_ALIAS) && !isDisguised(context)
        }
    if (!aligned) {
      setDisguised(context, desired)
    }
  }

  private fun isEnabled(context: Context, suffix: String): Boolean =
      context.packageManager.getComponentEnabledSetting(component(context, suffix)) ==
          PackageManager.COMPONENT_ENABLED_STATE_ENABLED
}
