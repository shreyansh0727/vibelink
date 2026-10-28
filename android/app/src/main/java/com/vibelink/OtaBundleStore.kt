package com.vibelink

import android.content.Context
import android.content.SharedPreferences
import java.io.File

/**
 * Keeps downloaded JS bundles and the small amount of boot bookkeeping needed
 * to safe-load them. This runs before React starts, so it must not depend on
 * the bridge.
 */
object OtaBundleStore {
  const val BUNDLE_NAME = "index.android.bundle"
  const val MAX_BOOT_ATTEMPTS = 2

  private const val PREFS_NAME = "vibelink_ota"
  private const val KEY_ACTIVE_ID = "active_id"
  private const val KEY_ACTIVE_VERSION = "active_version"
  private const val KEY_PENDING_ID = "pending_id"
  private const val KEY_PENDING_VERSION = "pending_version"
  private const val KEY_RUNNING_ID = "running_id"
  private const val KEY_REJECTED_ID = "rejected_id"
  private const val KEY_REJECTED_VERSION = "rejected_version"

  private val SAFE_ID = Regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")

  fun isSafeId(id: String): Boolean = SAFE_ID.matches(id)

  fun prefs(context: Context): SharedPreferences =
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun otaDir(context: Context): File = File(context.filesDir, "ota")

  fun bundleDir(context: Context, id: String): File = File(otaDir(context), id)

  fun bundleFile(context: Context, id: String): File =
      File(bundleDir(context, id), BUNDLE_NAME)

  fun stagingFile(context: Context, id: String): File =
      File(otaDir(context), ".staging-$id")

  /**
   * Chooses the bundle React should load for this process. Returns null for the
   * embedded bundle. Each launch of a downloaded bundle is counted; bundles
   * that never report a successful start are rejected after [MAX_BOOT_ATTEMPTS].
   */
  fun prepareLaunch(context: Context): String? {
    val prefs = prefs(context)

    val pendingId = prefs.getString(KEY_PENDING_ID, null)
    if (pendingId != null) {
      val pendingVersion = prefs.getString(KEY_PENDING_VERSION, null)
      val file = bundleFile(context, pendingId)
      if (isSafeId(pendingId) && file.isFile) {
        prefs
            .edit()
            .putString(KEY_ACTIVE_ID, pendingId)
            .putString(KEY_ACTIVE_VERSION, pendingVersion)
            .putString(KEY_RUNNING_ID, pendingId)
            .remove(KEY_PENDING_ID)
            .remove(KEY_PENDING_VERSION)
            .putInt(attemptsKey(pendingId), 1)
            .apply()
        prune(context, pendingId)
        return file.absolutePath
      }
      prefs.edit().remove(KEY_PENDING_ID).remove(KEY_PENDING_VERSION).apply()
    }

    val activeId = prefs.getString(KEY_ACTIVE_ID, null)
    if (activeId == null) {
      prefs.edit().remove(KEY_RUNNING_ID).apply()
      prune(context, null)
      return null
    }
    val activeVersion = prefs.getString(KEY_ACTIVE_VERSION, null)
    val file = bundleFile(context, activeId)
    if (!isSafeId(activeId) || !file.isFile) {
      prefs
          .edit()
          .remove(KEY_ACTIVE_ID)
          .remove(KEY_ACTIVE_VERSION)
          .remove(KEY_RUNNING_ID)
          .apply()
      prune(context, null)
      return null
    }

    val attempts = prefs.getInt(attemptsKey(activeId), 0)
    if (attempts >= MAX_BOOT_ATTEMPTS) {
      prefs
          .edit()
          .putString(KEY_REJECTED_ID, activeId)
          .putString(KEY_REJECTED_VERSION, activeVersion)
          .remove(KEY_ACTIVE_ID)
          .remove(KEY_ACTIVE_VERSION)
          .remove(KEY_RUNNING_ID)
          .apply()
      prune(context, null)
      return null
    }

    prefs
        .edit()
        .putInt(attemptsKey(activeId), attempts + 1)
        .putString(KEY_RUNNING_ID, activeId)
        .apply()
    prune(context, activeId)
    return file.absolutePath
  }

  /** Called from JS once the bundle has started, which clears the boot guard. */
  fun confirmRunning(context: Context) {
    val prefs = prefs(context)
    val running = prefs.getString(KEY_RUNNING_ID, null) ?: return
    prefs.edit().putInt(attemptsKey(running), 0).apply()
  }

  fun activate(context: Context, id: String, versionName: String) {
    prefs(context)
        .edit()
        .putString(KEY_PENDING_ID, id)
        .putString(KEY_PENDING_VERSION, versionName)
        .remove(KEY_REJECTED_ID)
        .remove(KEY_REJECTED_VERSION)
        .apply()
  }

  /** Drops a downloaded bundle that has not been applied yet. */
  fun cancelPending(context: Context) {
    prefs(context).edit().remove(KEY_PENDING_ID).remove(KEY_PENDING_VERSION).apply()
  }

  /** Returns VibeLink to the embedded bundle on the next launch. */
  fun reset(context: Context) {
    prefs(context)
        .edit()
        .remove(KEY_ACTIVE_ID)
        .remove(KEY_ACTIVE_VERSION)
        .remove(KEY_PENDING_ID)
        .remove(KEY_PENDING_VERSION)
        .remove(KEY_RUNNING_ID)
        .remove(KEY_REJECTED_ID)
        .remove(KEY_REJECTED_VERSION)
        .apply()
  }

  fun dismissRejected(context: Context) {
    prefs(context).edit().remove(KEY_REJECTED_ID).remove(KEY_REJECTED_VERSION).apply()
  }

  fun runningId(context: Context): String? =
      prefs(context).getString(KEY_RUNNING_ID, null)

  fun runningVersion(context: Context): String? =
      prefs(context).getString(KEY_ACTIVE_VERSION, null)

  fun pendingId(context: Context): String? =
      prefs(context).getString(KEY_PENDING_ID, null)

  fun pendingVersion(context: Context): String? =
      prefs(context).getString(KEY_PENDING_VERSION, null)

  fun rejectedId(context: Context): String? =
      prefs(context).getString(KEY_REJECTED_ID, null)

  fun rejectedVersion(context: Context): String? =
      prefs(context).getString(KEY_REJECTED_VERSION, null)

  /** Removes bundle folders that can never be used again. */
  fun prune(context: Context, keepId: String?) {
    val dir = otaDir(context)
    val children = dir.listFiles() ?: return
    for (child in children) {
      if (keepId != null && child.name == keepId) {
        continue
      }
      deleteRecursively(child)
    }
  }

  fun deleteRecursively(file: File) {
    try {
      if (file.isDirectory) {
        file.listFiles()?.forEach(::deleteRecursively)
      }
      file.delete()
    } catch (_: Exception) {
      // Leftover files only waste a little space; never fail a launch over them.
    }
  }

  private fun attemptsKey(id: String): String = "attempts_$id"
}
