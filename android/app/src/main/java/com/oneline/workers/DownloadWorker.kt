package com.oneline.workers

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.oneline.plugins.filedownload.DownloadState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.RandomAccessFile
import java.net.HttpURLConnection
import java.net.URL

class DownloadWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {
    
    private val downloadState = DownloadState(context)
    
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val url = inputData.getString("url") ?: return@withContext Result.failure()
        val fileName = inputData.getString("fileName") ?: "update.apk"
        
        var connection: HttpURLConnection? = null
        var output: RandomAccessFile? = null
        
        try {
            val downloadsDir = applicationContext.getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS)
                ?: return@withContext Result.failure()
            
            val file = File(downloadsDir, fileName)
            val existingBytes = if (file.exists()) file.length() else 0L
            
            // Open connection with Range header
            val urlConnection = URL(url).openConnection() as HttpURLConnection
            connection = urlConnection
            connection.requestMethod = "GET"
            connection.connectTimeout = 15000
            connection.readTimeout = 30000 // 30-second timeout per read
            
            if (existingBytes > 0) {
                connection.setRequestProperty("Range", "bytes=$existingBytes-")
            }
            
            connection.connect()
            
            val responseCode = connection.responseCode
            val isResumable = responseCode == HttpURLConnection.HTTP_PARTIAL
            
            if (!isResumable && existingBytes > 0) {
                file.delete()
            }
            
            if (responseCode != HttpURLConnection.HTTP_OK && 
                responseCode != HttpURLConnection.HTTP_PARTIAL) {
                return@withContext Result.failure()
            }
            
            val totalBytes = if (isResumable) {
                existingBytes + connection.contentLength
            } else {
                connection.contentLength.toLong()
            }
            
            val input = connection.inputStream
            output = RandomAccessFile(file, "rw")
            
            if (isResumable && existingBytes > 0) {
                output.seek(existingBytes)
            }
            
            val buffer = ByteArray(8192)
            var downloaded = existingBytes
            var lastSavedBytes = downloaded
            var count: Int
            
            while (input.read(buffer).also { count = it } != -1) {
                if (isStopped) {
                    downloadState.save(url, file.absolutePath, downloaded, totalBytes)
                    return@withContext Result.failure()
                }
                
                output.write(buffer, 0, count)
                downloaded += count
                
                // Save state every 1MB
                if (downloaded - lastSavedBytes >= 1024 * 1024) {
                    downloadState.save(url, file.absolutePath, downloaded, totalBytes)
                    lastSavedBytes = downloaded
                }
                
                // Report progress
                if (totalBytes > 0) {
                    val progress = ((downloaded * 100) / totalBytes).toInt()
                    setProgress(workDataOf("progress" to progress))
                }
            }
            
            downloadState.clear()
            
            Result.success(workDataOf("filePath" to file.absolutePath))
            
        } catch (e: Exception) {
            Result.failure(workDataOf("error" to (e.message ?: "Download failed")))
        } finally {
            output?.close()
            connection?.disconnect()
        }
    }
}
