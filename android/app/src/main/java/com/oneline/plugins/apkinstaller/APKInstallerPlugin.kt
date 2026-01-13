package com.oneline.plugins.apkinstaller

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.JSObject
import java.io.File

@CapacitorPlugin(name = "APKInstaller")
class APKInstallerPlugin : Plugin() {
    
    @PluginMethod
    fun install(call: PluginCall) {
        val filePath = call.getString("filePath")
        
        if (filePath == null) {
            call.reject("File path is required")
            return
        }
        
        val file = File(filePath)
        if (!file.exists()) {
            call.reject("APK file not found")
            return
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!activity.packageManager.canRequestPackageInstalls()) {
                call.reject("Install permission not granted")
                return
            }
        }
        
        try {
            val intent = Intent(Intent.ACTION_VIEW)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            
            val apkUri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                FileProvider.getUriForFile(
                    activity,
                    "${activity.packageName}.fileprovider",
                    file
                )
            } else {
                Uri.fromFile(file)
            }
            
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive")
            activity.startActivity(intent)
            
            call.resolve(JSObject().put("success", true))
            
        } catch (e: Exception) {
            call.reject("Installation failed: ${e.message}")
        }
    }
    
    @PluginMethod
    fun canInstall(call: PluginCall) {
        val canInstall = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.packageManager.canRequestPackageInstalls()
        } else {
            true
        }
        call.resolve(JSObject().put("canInstall", canInstall))
    }
    
    @PluginMethod
    fun verifyInstall(call: PluginCall) {
        val expectedVersionCode = call.getInt("expectedVersionCode")
        
        if (expectedVersionCode == null) {
            call.reject("Expected version code required")
            return
        }
        
        try {
            val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.packageManager.getPackageInfo(
                    context.packageName,
                    PackageManager.PackageInfoFlags.of(0)
                )
            } else {
                @Suppress("DEPRECATION")
                context.packageManager.getPackageInfo(context.packageName, 0)
            }
            
            val currentVersionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageInfo.longVersionCode.toInt()
            } else {
                @Suppress("DEPRECATION")
                packageInfo.versionCode
            }
            
            val success = currentVersionCode >= expectedVersionCode
            call.resolve(JSObject().put("success", success))
            
        } catch (e: Exception) {
            call.reject("Verification failed: ${e.message}")
        }
    }
    
    @PluginMethod
    fun deleteFile(call: PluginCall) {
        val filePath = call.getString("filePath")
        if (filePath != null) {
            val file = File(filePath)
            if (file.exists()) {
                file.delete()
            }
        }
        call.resolve()
    }

    @PluginMethod
    fun openSettings(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
            intent.data = Uri.parse("package:${context.packageName}")
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            context.startActivity(intent)
        }
        call.resolve()
    }
}
