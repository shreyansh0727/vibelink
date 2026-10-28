package com.vibelink

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager

class VibeLinkBatteryPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      when (name) {
        VibeLinkBatteryModule.NAME -> VibeLinkBatteryModule(reactContext)
        else -> null
      }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
      ReactModuleInfoProvider {
        mapOf(
            VibeLinkBatteryModule.NAME to
                ReactModuleInfo(
                    VibeLinkBatteryModule.NAME,
                    VibeLinkBatteryModule::class.java.name,
                    false,
                    false,
                    false,
                    false,
                ),
        )
      }

  override fun createViewManagers(
      reactContext: ReactApplicationContext,
  ): List<ViewManager<in Nothing, in Nothing>> = emptyList()
}
