package com.vibelink

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.Process
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

@ReactModule(name = VibeLinkOtaModule.NAME)
class VibeLinkOtaModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod fun addListener(eventName: String) {}

  @ReactMethod fun removeListeners(count: Int) {}

  @ReactMethod
  fun confirmLoaded(promise: Promise) {
    try {
      OtaBundleStore.confirmRunning(reactApplicationContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("ota_confirm_failed", error.message, error)
    }
  }

  @ReactMethod
  fun getState(promise: Promise) {
    try {
      val context = reactApplicationContext
      promise.resolve(
          Arguments.createMap().apply {
            putString("runningId", OtaBundleStore.runningId(context))
            putString("runningVersion", OtaBundleStore.runningVersion(context))
            putString("pendingId", OtaBundleStore.pendingId(context))
            putString("pendingVersion", OtaBundleStore.pendingVersion(context))
            putString("rejectedId", OtaBundleStore.rejectedId(context))
            putString("rejectedVersion", OtaBundleStore.rejectedVersion(context))
          }
      )
    } catch (error: Exception) {
      promise.reject("ota_state_failed", error.message, error)
    }
  }

  @ReactMethod
  fun download(
      url: String,
      sha256: String,
      id: String,
      versionName: String,
      sizeBytes: Double,
      promise: Promise,
  ) {
    if (!url.startsWith("https://")) {
      promise.reject("ota_bad_url", "Bundle downloads must use HTTPS.")
      return
    }
    if (!SHA256_PATTERN.matches(sha256)) {
      promise.reject("ota_bad_checksum", "The published checksum is not valid.")
      return
    }
    if (!OtaBundleStore.isSafeId(id)) {
      promise.reject("ota_bad_id", "The published bundle id is not valid.")
      return
    }

    val context = reactApplicationContext
    val expected = sha256.lowercase()
    val advertised =
        if (sizeBytes.isFinite() && sizeBytes > 0) sizeBytes.toLong() else 0L

    Thread {
          val staging = OtaBundleStore.stagingFile(context, id)
          try {
            OtaBundleStore.otaDir(context).mkdirs()
            OtaBundleStore.deleteRecursively(staging)

            val connection = (URL(url).openConnection() as HttpURLConnection).apply {
              connectTimeout = CONNECT_TIMEOUT_MS
              readTimeout = READ_TIMEOUT_MS
              instanceFollowRedirects = true
              requestMethod = "GET"
              useCaches = false
            }
            try {
              val status = connection.responseCode
              if (status != HttpURLConnection.HTTP_OK) {
                throw IOException("The bundle server answered with HTTP $status.")
              }
              val total =
                  if (connection.contentLengthLong > 0) connection.contentLengthLong
                  else advertised
              if (total > MAX_BUNDLE_BYTES) {
                throw IOException("The published bundle is larger than VibeLink accepts.")
              }

              val digest = MessageDigest.getInstance("SHA-256")
              var downloaded = 0L
              var lastEmit = 0L
              emitProgress(id, 0, total, "running")
              connection.inputStream.use { input ->
                FileOutputStream(staging).use { output ->
                  val buffer = ByteArray(BUFFER_SIZE)
                  while (true) {
                    val read = input.read(buffer)
                    if (read == -1) {
                      break
                    }
                    output.write(buffer, 0, read)
                    digest.update(buffer, 0, read)
                    downloaded += read
                    if (downloaded > MAX_BUNDLE_BYTES) {
                      throw IOException("The published bundle is larger than VibeLink accepts.")
                    }
                    if (downloaded - lastEmit >= PROGRESS_STEP_BYTES) {
                      lastEmit = downloaded
                      emitProgress(id, downloaded, total, "running")
                    }
                  }
                }
              }

              emitProgress(id, downloaded, total, "verifying")
              val actual = digest.digest().joinToString("") { byte ->
                "%02x".format(byte.toInt() and 0xff)
              }
              if (actual != expected) {
                OtaBundleStore.deleteRecursively(staging)
                promise.reject(
                    "ota_checksum_failed",
                    "The downloaded bundle did not pass its integrity check.",
                )
                return@Thread
              }

              val target = OtaBundleStore.bundleDir(context, id)
              OtaBundleStore.deleteRecursively(target)
              target.mkdirs()
              val bundle = File(target, OtaBundleStore.BUNDLE_NAME)
              if (!staging.renameTo(bundle)) {
                staging.copyTo(bundle, overwrite = true)
                OtaBundleStore.deleteRecursively(staging)
              }
              File(target, "manifest.json")
                  .writeText(
                      org.json.JSONObject()
                          .put("id", id)
                          .put("versionName", versionName)
                          .put("sha256", actual)
                          .put("sizeBytes", downloaded)
                          .put("savedAt", System.currentTimeMillis())
                          .toString(),
                  )

              emitProgress(id, downloaded, downloaded, "completed")
              promise.resolve(
                  Arguments.createMap().apply {
                    putString("id", id)
                    putString("versionName", versionName)
                    putDouble("sizeBytes", downloaded.toDouble())
                  }
              )
            } finally {
              connection.disconnect()
            }
          } catch (error: Exception) {
            OtaBundleStore.deleteRecursively(staging)
            promise.reject("ota_download_failed", describeFailure(error), error)
          }
        }
        .start()
  }

  @ReactMethod
  fun activate(id: String, versionName: String, promise: Promise) {
    if (!OtaBundleStore.isSafeId(id)) {
      promise.reject("ota_bad_id", "The published bundle id is not valid.")
      return
    }
    if (!OtaBundleStore.bundleFile(reactApplicationContext, id).isFile) {
      promise.reject("ota_missing_bundle", "The downloaded bundle is no longer on this phone.")
      return
    }
    try {
      OtaBundleStore.activate(reactApplicationContext, id, versionName)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("ota_activate_failed", error.message, error)
    }
  }

  @ReactMethod
  fun cancelPending(promise: Promise) {
    try {
      OtaBundleStore.cancelPending(reactApplicationContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("ota_cancel_failed", error.message, error)
    }
  }

  @ReactMethod
  fun reset(promise: Promise) {
    try {
      val context = reactApplicationContext
      OtaBundleStore.reset(context)
      OtaBundleStore.prune(context, null)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("ota_reset_failed", error.message, error)
    }
  }

  @ReactMethod
  fun dismissRejected(promise: Promise) {
    try {
      OtaBundleStore.dismissRejected(reactApplicationContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("ota_dismiss_failed", error.message, error)
    }
  }

  /**
   * Relaunches the activity in a fresh process so a pending bundle is picked up
   * by [OtaBundleStore.prepareLaunch] on the next start.
   */
  @ReactMethod
  fun restart(promise: Promise) {
    val context = reactApplicationContext
    try {
      val intent =
          Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK)
          }
      context.startActivity(intent)
      promise.resolve(true)
      Handler(Looper.getMainLooper())
          .postDelayed({ Process.killProcess(Process.myPid()) }, RESTART_GRACE_MS)
    } catch (error: Exception) {
      promise.reject("ota_restart_failed", error.message, error)
    }
  }

  private fun emitProgress(id: String, downloaded: Long, total: Long, status: String) {
    if (!reactApplicationContext.hasActiveReactInstance()) {
      return
    }
    val payload: WritableMap =
        Arguments.createMap().apply {
          putString("id", id)
          putDouble("downloadedBytes", downloaded.toDouble())
          putDouble("totalBytes", total.toDouble())
          putString("status", status)
        }
    reactApplicationContext.emitDeviceEvent(EVENT_PROGRESS, payload)
  }

  private fun describeFailure(error: Exception): String =
      when {
        error is java.net.UnknownHostException -> "The bundle server could not be reached."
        error is java.net.SocketTimeoutException -> "The bundle download timed out."
        error.message.isNullOrBlank() -> "The bundle download failed."
        else -> error.message ?: "The bundle download failed."
      }

  companion object {
    const val NAME = "VibeLinkOta"
    const val EVENT_PROGRESS = "vibeLinkOtaProgress"
    private val SHA256_PATTERN = Regex("^[a-f0-9]{64}$", RegexOption.IGNORE_CASE)
    private const val CONNECT_TIMEOUT_MS = 15_000
    private const val READ_TIMEOUT_MS = 30_000
    private const val RESTART_GRACE_MS = 350L
    private const val BUFFER_SIZE = 64 * 1024
    private const val PROGRESS_STEP_BYTES = 512L * 1024L
    private const val MAX_BUNDLE_BYTES = 32L * 1024L * 1024L
  }
}
