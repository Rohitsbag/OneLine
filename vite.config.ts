import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Force Vite Clean
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        hmr: {
            overlay: false // Suppress HMR error overlay
        }
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'three-bundle': ['three'],
                    'vendor': ['react', 'react-dom', 'react-router-dom'],
                }
            }
        },
        chunkSizeWarningLimit: 1000,
        cssCodeSplit: true,
        minify: 'esbuild',
        target: 'esnext'
    }
})
