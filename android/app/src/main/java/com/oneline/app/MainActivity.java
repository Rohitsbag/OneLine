package com.oneline.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.oneline.plugins.packageinfo.PackageInfoPlugin;
import com.oneline.plugins.filedownload.FileDownloadPlugin;
import com.oneline.plugins.apkinstaller.APKInstallerPlugin;
import com.oneline.plugins.sha256.SHA256VerifierPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        registerPlugin(PackageInfoPlugin.class);
        registerPlugin(FileDownloadPlugin.class);
        registerPlugin(APKInstallerPlugin.class);
        registerPlugin(SHA256VerifierPlugin.class);
    }
}
