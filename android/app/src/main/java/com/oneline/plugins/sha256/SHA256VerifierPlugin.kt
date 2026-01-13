package com.oneline.plugins.sha256

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.JSObject
import kotlinx.coroutines.*
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

@CapacitorPlugin(name = "SHA256Verifier")
class SHA256VerifierPlugin : Plugin() {
    
    private val pluginScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    
    @PluginMethod
    fun verify(call: PluginCall) {
        val filePath = call.getString("filePath")
        val expectedHash = call.getString("expectedHash")
        
        if (filePath == null || expectedHash == null) {
            call.reject("File path and expected hash required")
            return
        }
        
        pluginScope.launch {
            try {
                val isValid = computeAndVerify(filePath, expectedHash)
                call.resolve(JSObject().put("isValid", isValid))
            } catch (e: CancellationException) {
                // Handled by coroutine system
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
        
        val digest = MessageDigest.getInstance("SHA-256")
        val fis = FileInputStream(file)
        val buffer = ByteArray(8192)
        var bytesRead: Int
        
        try {
            while (fis.read(buffer).also { bytesRead = it } != -1) {
                // Idiomatic cancellation check - works in any environment
                yield()
                
                digest.update(buffer, 0, bytesRead)
            }
            
            val hashBytes = digest.digest()
            val actualHash = hashBytes.joinToString("") { "%02x".format(it) }
            
            return actualHash.equals(expectedHash, ignoreCase = true)
            
        } finally {
            fis.close()
        }
    }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        pluginScope.cancel()
    }
}
