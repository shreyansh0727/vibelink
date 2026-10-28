package com.vibelink

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager

class VibeLinkUpdaterPackage : BaseReactPackage() {
  override fun getModule(
      name: String,
      reactContext: ReactApplicationContext,
  ): NativeModule? =
      if (name == VibeLinkUpdaterModule.NAME) {
        VibeLinkUpdaterModule(reactContext)
      } else {
        null
      }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
      ReactModuleInfoProvider {
        mapOf(
            VibeLinkUpdaterModule.NAME to
                ReactModuleInfo(
                    VibeLinkUpdaterModule.NAME,
                    VibeLinkUpdaterModule.NAME,
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
