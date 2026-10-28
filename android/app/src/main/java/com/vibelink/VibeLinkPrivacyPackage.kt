package com.vibelink

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager

class VibeLinkPrivacyPackage : BaseReactPackage() {
  override fun getModule(
      name: String,
      reactContext: ReactApplicationContext,
  ): NativeModule? =
      if (name == VibeLinkPrivacyModule.NAME) {
        VibeLinkPrivacyModule(reactContext)
      } else {
        null
      }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
      ReactModuleInfoProvider {
        mapOf(
            VibeLinkPrivacyModule.NAME to
                ReactModuleInfo(
                    VibeLinkPrivacyModule.NAME,
                    VibeLinkPrivacyModule.NAME,
                    false,
                    false,
                    false,
                    false,
                )
        )
      }

  override fun createViewManagers(
      reactContext: ReactApplicationContext,
  ): List<ViewManager<*, *>> = emptyList()
}
