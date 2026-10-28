package com.vibelink

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(VibeLinkVibratorPackage())
          add(VibeLinkBatteryPackage())
          add(VibeLinkPrivacyPackage())
          add(VibeLinkUpdaterPackage())
          add(VibeLinkTorchPackage())
          add(VibeLinkOtaPackage())
        },
      // Null loads the bundle embedded in the APK; a verified download is
      // chosen here before React starts so the new JS can take over.
      jsBundleFilePath = OtaBundleStore.prepareLaunch(applicationContext),
    )
  }

  override fun onCreate() {
    super.onCreate()
    LauncherVisibility.applyPrivacyState(this)
    loadReactNative(this)
  }
}
