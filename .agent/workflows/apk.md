---
description: Synchronize the latest Android build to the public download folder.
---

1. Ensure you have generated a new build in `One Line App/android/app-release.apk`.
// turbo
2. Run the sync command to update the live download link:
```powershell
npm run apk:sync
```

This will copy and rename the latest APK to `public/oneline.apk`, making it immediately available for download on your landing page.
