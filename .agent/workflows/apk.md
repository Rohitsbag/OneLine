---
description: Synchronize the latest Android build to the public download folder.
---

1. Generate a new build in Android Studio (either Debug or Signed Release).
2. Run the version bump command:
```powershell
npm run version:bump
```
3. Run the sync command to copy the latest APK to the public folder:
```powershell
npm run apk:sync
```
4. Commit and push the changes to Vercel:
```powershell
git add .
git commit -m "feat: release new version with PIN lock"
git push origin main
```

This ensures `public/oneline.apk` and `public/version.json` are always in sync on your landing page.
