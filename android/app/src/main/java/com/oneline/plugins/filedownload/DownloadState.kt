package com.oneline.plugins.filedownload

import android.content.Context
import android.content.SharedPreferences

class DownloadState(context: Context) {
    
    private val prefs: SharedPreferences = context.getSharedPreferences(
        "download_state",
        Context.MODE_PRIVATE
    )
    
    fun save(url: String, filePath: String, downloaded: Long, total: Long) {
        prefs.edit().apply {
            putString("url", url)
            putString("filePath", filePath)
            putLong("downloaded", downloaded)
            putLong("total", total)
            putLong("lastUpdate", System.currentTimeMillis())
            apply()
        }
    }
    
    fun get(): SavedDownload? {
        val url = prefs.getString("url", null) ?: return null
        val filePath = prefs.getString("filePath", null) ?: return null
        val downloaded = prefs.getLong("downloaded", 0)
        val total = prefs.getLong("total", 0)
        
        return SavedDownload(url, filePath, downloaded, total)
    }
    
    fun clear() {
        prefs.edit().clear().apply()
    }
    
    fun hasActiveDownload(): Boolean = prefs.contains("url")
    
    data class SavedDownload(
        val url: String,
        val filePath: String,
        val downloaded: Long,
        val total: Long
    )
}
