package com.oneline.plugins.sha256

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.JSObject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

@CapacitorPlugin(name = "SHA256Verifier")
class SHA256VerifierPlugin : Plugin() {
    
    private val scope = CoroutineScope(Dispatchers.Main)
    
    @PluginMethod
    fun verify(call: PluginCall) {
        val filePath = call.getString("filePath")
        val expectedHash = call.getString("expectedHash")
        
        if (filePath == null || expectedHash == null) {
            call.reject("File path and expected hash required")
            return
        }
        
        scope.launch {
            try {
                val isValid = withContext(Dispatchers.IO) {
                    computeAndVerify(filePath, expectedHash)
                }
                
                call.resolve(JSObject().put("isValid", isValid))
                
            } catch (e: Exception) {
                call.reject("Verification failed: ${e.message}")
            }
        }
    }
    
    private suspend fun computeAndVerify(filePath: String, expectedHash: String): Boolean {
        val file = File(filePath)
        
        if (!file.exists()) {
            throw Exception("File not found")
        }
        
        val fileSize = file.length()
        val digest = MessageDigest.getInstance("SHA-256")
        val fis = FileInputStream(file)
        val buffer = ByteArray(8192)
        var bytesRead: Int
        var totalRead: Long = 0
        var lastReportedProgress = 0
        
        try {
            while (fis.read(buffer).also { bytesRead = it } != -1) {
                if (!kotlinx.coroutines.isActive) {
                    throw Exception("SHA-256 computation cancelled")
                }
                
                digest.update(buffer, 0, bytesRead)
                totalRead += bytesRead
                
                // Report progress every 10%
                if (fileSize > 0) {
                    val progress = ((totalRead * 100) / fileSize).toInt()
                    if (progress >= lastReportedProgress + 10) {
                        lastReportedProgress = progress
                    }
                }
            }
            
            val hashBytes = digest.digest()
            val actualHash = hashBytes.joinToString("") { "%02x".format(it) }
            
            return actualHash.equals(expectedHash, ignoreCase = true)
            
        } finally {
            fis.close()
        }
    }
}
