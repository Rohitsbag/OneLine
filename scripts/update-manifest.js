import fs from 'fs';
import path from 'path';

const manifestPath = path.resolve('public/version.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const [version, versionCode, sha256, downloadUrl] = process.argv.slice(2);

if (!version || !versionCode || !sha256 || !downloadUrl) {
    console.error('Usage: node update-manifest.js <version> <versionCode> <sha256> <downloadUrl>');
    process.exit(1);
}

manifest.version = version;
manifest.versionCode = parseInt(versionCode);
manifest.sha256 = sha256;
manifest.downloadUrl = downloadUrl;
manifest.minimumVersion = version; // Default to current version for safety

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4));
console.log('✅ version.json updated successfully');
