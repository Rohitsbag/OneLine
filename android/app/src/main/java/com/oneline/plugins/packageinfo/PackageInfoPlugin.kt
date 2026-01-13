package com.oneline.plugins.packageinfo

import android.content.pm.PackageManager
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.JSObject

@CapacitorPlugin(name = "PackageInfo")
class PackageInfoPlugin : Plugin() {
    
    @PluginMethod
    fun getVersion(call: PluginCall) {
        val result = JSObject()
        
        try {
            val packageInfo = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                context.packageManager.getPackageInfo(
                    context.packageName,
                    PackageManager.PackageInfoFlags.of(0)
                )
            } else {
                @Suppress("DEPRECATION")
                context.packageManager.getPackageInfo(context.packageName, 0)
            }
            
            result.put("version", packageInfo.versionName)
            result.put("versionCode", if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                packageInfo.longVersionCode.toInt()
            } else {
                @Suppress("DEPRECATION")
                packageInfo.versionCode
            })
            
            call.resolve(result)
            
        } catch (e: PackageManager.NameNotFoundException) {
            call.reject("Package not found")
        }
    }
}
