package com.oneline.plugins.filedownload

import androidx.work.*
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.JSObject
import com.oneline.workers.DownloadWorker
import java.util.UUID
import java.util.concurrent.TimeUnit

@CapacitorPlugin(name = "FileDownload")
class FileDownloadPlugin : Plugin() {
    
    private val downloadState by lazy { DownloadState(context) }
    private var currentWorkId: UUID? = null
    
    @PluginMethod
    fun download(call: PluginCall) {
        val url = call.getString("url")
        
        if (url == null) {
            call.reject("URL is required")
            return
        }
        
        val workRequest = OneTimeWorkRequestBuilder<DownloadWorker>()
            .setInputData(workDataOf(
                "url" to url,
                "fileName" to "oneline-update.apk"
            ))
            .setConstraints(Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build())
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                30, TimeUnit.SECONDS
            )
            .build()
        
        currentWorkId = workRequest.id
        
        WorkManager.getInstance(context).enqueueUniqueWork(
            "app_update_download",
            ExistingWorkPolicy.KEEP,
            workRequest
        )
        
        // Observe progress
        val workManager = WorkManager.getInstance(context)
        val liveData = workManager.getWorkInfoByIdLiveData(workRequest.id)
        
        activity.runOnUiThread {
            liveData.observe(activity) { workInfo ->
                when (workInfo?.state) {
                    WorkInfo.State.RUNNING -> {
                        val progress = workInfo.progress.getInt("progress", 0)
                        val ret = JSObject()
                        ret.put("progress", progress)
                        notifyListeners("downloadProgress", ret)
                    }
                    WorkInfo.State.SUCCEEDED -> {
                        val filePath = workInfo.outputData.getString("filePath")
                        val ret = JSObject()
                        ret.put("path", filePath)
                        if (!call.isSaved) {
                            call.resolve(ret)
                        }
                    }
                    WorkInfo.State.FAILED -> {
                        val error = workInfo.outputData.getString("error")
                        if (!call.isSaved) {
                            call.reject(error ?: "Download failed")
                        }
                    }
                    else -> {}
                }
            }
        }
        
        // The promise will be resolved/rejected by the observer above
    }

    @PluginMethod
    fun getWorkStatus(call: PluginCall) {
        val workIdStr = call.getString("workId")
        if (workIdStr == null) {
            call.reject("workId is required")
            return
        }
        
        val workId = UUID.fromString(workIdStr)
        val workInfo = WorkManager.getInstance(context).getWorkInfoById(workId).get()
        
        val result = JSObject()
        result.put("state", workInfo?.state?.name)
        call.resolve(result)
    }
    
    @PluginMethod
    fun cancel(call: PluginCall) {
        currentWorkId?.let {
            WorkManager.getInstance(context).cancelWorkById(it)
        }
        call.resolve()
    }
    
    @PluginMethod
    fun hasActiveDownload(call: PluginCall) {
        val hasActive = downloadState.hasActiveDownload()
        val result = JSObject()
        result.put("hasActive", hasActive)
        call.resolve(result)
    }
    
    @PluginMethod
    fun getDownloadState(call: PluginCall) {
        val state = downloadState.get()
        if (state == null) {
            call.resolve(JSObject())
            return
        }
        
        val result = JSObject()
        result.put("url", state.url)
        result.put("filePath", state.filePath)
        result.put("downloaded", state.downloaded)
        result.put("total", state.total)
        call.resolve(result)
    }
}
