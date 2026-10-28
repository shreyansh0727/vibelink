package com.vibelink

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import java.io.File
import java.io.IOException
import java.security.MessageDigest

@ReactModule(name = VibeLinkUpdaterModule.NAME)
class VibeLinkUpdaterModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod fun addListener(eventName: String) {}

  @ReactMethod fun removeListeners(count: Int) {}

  @ReactMethod
  fun getVersion(promise: Promise) {
    try {
      val info =
          reactApplicationContext.packageManager.getPackageInfo(
              reactApplicationContext.packageName,
              0,
          )
      @Suppress("DEPRECATION")
      val versionCode =
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode
          else info.versionCode.toLong()
      promise.resolve(
          Arguments.createMap().apply {
            putString("versionName", info.versionName ?: "")
            putDouble("versionCode", versionCode.toDouble())
          }
      )
    } catch (error: Exception) {
      promise.reject("update_version_failed", error.message, error)
    }
  }

  @ReactMethod
  fun canInstallPackages(promise: Promise) {
    promise.resolve(installPermissionGranted())
  }

  @ReactMethod
  fun openInstallPermission(promise: Promise) {
    try {
      val context = reactApplicationContext
      val intent =
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${context.packageName}"),
            )
          } else {
            Intent(Settings.ACTION_SECURITY_SETTINGS)
          }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("update_permission_settings_unavailable", error.message, error)
    }
  }

  @ReactMethod
  fun download(url: String, sha256: String, versionCode: Double, versionName: String, promise: Promise) {
    val context = reactApplicationContext
    val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager
    if (manager == null) {
      promise.reject("update_download_failed", "DownloadManager is unavailable.")
      return
    }
    val fileName = "vibelink-${versionCode.toLong()}.apk"
    val target =
        File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), fileName)

    Thread {
          var downloadId: Long? = null
          try {
            target.parentFile?.mkdirs()
            if (target.exists() && !target.delete()) {
              throw IOException("The previous download could not be replaced.")
            }
            val request =
                DownloadManager.Request(Uri.parse(url))
                    .setTitle("VibeLink $versionName")
                    .setDescription("Downloading the update")
                    .setNotificationVisibility(
                        DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                    )
                    .setDestinationInExternalFilesDir(
                        context,
                        Environment.DIRECTORY_DOWNLOADS,
                        fileName,
                    )
                    .setAllowedOverMetered(true)
                    .setAllowedOverRoaming(false)
            val id: Long = manager.enqueue(request)
            downloadId = id
            emitProgress(id, 0, 0, "running")

            while (true) {
              Thread.sleep(POLL_INTERVAL_MS)
              val query = DownloadManager.Query().setFilterById(id)
              val snapshot =
                  manager.query(query).use { cursor ->
                    if (!cursor.moveToFirst()) {
                      null
                    } else {
                      DownloadSnapshot(
                          status =
                              cursor.getInt(
                                  cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)
                              ),
                          reason =
                              cursor.getInt(
                                  cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)
                              ),
                          downloaded =
                              cursor.getLong(
                                  cursor.getColumnIndexOrThrow(
                                      DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR
                                  )
                              ),
                          total =
                              cursor.getLong(
                                  cursor.getColumnIndexOrThrow(
                                      DownloadManager.COLUMN_TOTAL_SIZE_BYTES
                                  )
                              ),
                      )
                    }
                  }
              if (snapshot == null) {
                promise.reject("update_download_failed", "The download disappeared.")
                return@Thread
              }
              when (snapshot.status) {
                DownloadManager.STATUS_SUCCESSFUL -> {
                  emitProgress(id, snapshot.downloaded, snapshot.total, "verifying")
                  if (!target.isFile ||
                      !sha256Of(target).equals(sha256.trim(), ignoreCase = true)) {
                    target.delete()
                    promise.reject(
                        "update_checksum_failed",
                        "The downloaded update did not pass its integrity check.",
                    )
                    return@Thread
                  }
                  emitProgress(id, target.length(), target.length(), "completed")
                  promise.resolve(
                      Arguments.createMap().apply {
                        putString("path", target.absolutePath)
                        putDouble("sizeBytes", target.length().toDouble())
                      }
                  )
                  return@Thread
                }
                DownloadManager.STATUS_FAILED -> {
                  promise.reject(
                      "update_download_failed",
                      describeFailure(snapshot.reason),
                  )
                  return@Thread
                }
                else -> emitProgress(id, snapshot.downloaded, snapshot.total, "running")
              }
            }
          } catch (error: Exception) {
            downloadId?.let {
              try {
                manager.remove(it)
              } catch (_: Exception) {
                // The download already ended; nothing to cancel.
              }
            }
            target.delete()
            promise.reject("update_download_failed", error.message, error)
          }
        }
        .start()
  }

  @ReactMethod
  fun install(path: String, promise: Promise) {
    val context = reactApplicationContext
    val file = File(path)
    if (!file.isFile) {
      promise.reject("update_missing_file", "The downloaded update is no longer on this phone.")
      return
    }
    if (!installPermissionGranted()) {
      promise.reject(
          "update_permission_required",
          "Allow VibeLink to install unknown apps first.",
      )
      return
    }
    try {
      val uri = FileProvider.getUriForFile(context, "${context.packageName}.updates", file)
      val intent =
          Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
      context.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("update_install_failed", error.message, error)
    }
  }

  private fun installPermissionGranted(): Boolean =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        reactApplicationContext.packageManager.canRequestPackageInstalls()
      } else {
        true
      }

  private fun emitProgress(downloadId: Long, downloaded: Long, total: Long, status: String) {
    if (!reactApplicationContext.hasActiveReactInstance()) {
      return
    }
    val payload: WritableMap =
        Arguments.createMap().apply {
          putDouble("downloadId", downloadId.toDouble())
          putDouble("downloadedBytes", downloaded.toDouble())
          putDouble("totalBytes", total.toDouble())
          putString("status", status)
        }
    reactApplicationContext.emitDeviceEvent(EVENT_PROGRESS, payload)
  }

  private fun describeFailure(reason: Int): String =
      when (reason) {
        DownloadManager.ERROR_INSUFFICIENT_SPACE ->
            "There is not enough free space to download the update."
        DownloadManager.ERROR_HTTP_DATA_ERROR,
        DownloadManager.ERROR_UNHANDLED_HTTP_CODE ->
            "The update server could not deliver the file."
        DownloadManager.ERROR_CANNOT_RESUME -> "The download could not be resumed."
        DownloadManager.ERROR_DEVICE_NOT_FOUND -> "The storage for the update is unavailable."
        DownloadManager.ERROR_TOO_MANY_REDIRECTS -> "The update link redirected too often."
        else -> "The update download failed (reason $reason)."
      }

  private fun sha256Of(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
      val buffer = ByteArray(8192)
      while (true) {
        val read = input.read(buffer)
        if (read == -1) {
          break
        }
        digest.update(buffer, 0, read)
      }
    }
    return digest.digest().joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
  }

  private data class DownloadSnapshot(
      val status: Int,
      val reason: Int,
      val downloaded: Long,
      val total: Long,
  )

  companion object {
    const val NAME = "VibeLinkUpdater"
    const val EVENT_PROGRESS = "vibeLinkUpdateProgress"
    private const val POLL_INTERVAL_MS = 400L
  }
}
