import { registerPlugin } from '@capacitor/core';

export interface FileDownloadPlugin {
    download(options: { url: string }): Promise<{ workId: string }>;
    cancel(): Promise<void>;
    hasActiveDownload(): Promise<{ hasActive: boolean }>;
    getDownloadState(): Promise<{
        url?: string;
        filePath?: string;
        downloaded?: number;
        total?: number;
    }>;
    addListener(
        eventName: 'downloadProgress',
        listenerFunc: (info: { progress: number }) => void
    ): Promise<any>;
    removeAllListeners(): Promise<void>;
}

const FileDownload = registerPlugin<FileDownloadPlugin>('FileDownload');

export default FileDownload;
