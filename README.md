<div align="center">

# ✨ OneLine

**Minimalist journaling for a clearer mind.**

*Capture your life, one day at a time.*

[![Made with React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)](https://reactjs.org)
[![Powered by Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat&logo=supabase)](https://supabase.com)
[![AI by Groq](https://img.shields.io/badge/Groq-Llama_3.3-F55036?style=flat)](https://groq.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Production Ready](https://img.shields.io/badge/Status-Production_Ready-success?style=flat)](https://github.com/Rohitsbag/OneLine)


**🚀 New**: Dual STT recording, offline-first UX, production-grade reliability

[Features](#-features) • [The Philosophy](#-the-philosophy) • [Tech Stack](#-tech-stack) • [Deployment](#-deployment)

</div>

---

## 🔮 The Problem: "The Journaling Paradox"

**The Aspiration vs. Reality Gap**
80% of people *want* to journal. Less than 5% stick with it. Why?
Because we treat journaling as a *performance* rather than a *practice*. We feel we need to write profound essays every night. When we're tired, we skip it. When we skip it, we feel guilt. The habit dies.

**The "Data Rot"**
We capture thousands of photos and texts, but they are scattered. Our digital memories are rotting in data silosunorganized, unsearchable, and disconnected from our emotional state.

---

## 💎 The Solution: "Atomic Journaling"

OneLine isn't just an app; it's a philosophy.

- **Make it obvious:** The app opens directly to the input field.
- **Make it easy:** It takes 5 seconds (typing) or 2 seconds (voice).
- **Make it satisfying:** The UI gives immediate, subtle feedback.

> "The best journal entry is the one you actually write."

---

## ✨ Features

### 📝 The Journal Editor
*The "Paper" of the Future*
- **"Thought-Speed" Input:** No bold, no italic, no distractions. Just you and your words.
- **The "Today" Anchor:** Smart navigation always snaps you back to the present moment.

### 🎤 Voice Features (The "Star Trek" Factor)
- **Tap to Speak:** Instant transcription for when you're walking or driving.
- **Hold to Record:** Capture the raw emotion of your voice. Imagine listening to your own voice from 10 years agotired, happy, real.

### 📷 Vision Features (The "Digital Scanner")
- **Tap to Attach:** One visual anchor per day to prevent "time blur".
- **Hold to Scan (OCR):** Snap a book quote, a receipt, or a handwritten note. OneLine extracts the text and makes it searchable forever.

### 🤖 AI Reflections: "Therapy Lite"
*A mirror for your mind, powered by Llama 3.3.*
- **Pattern Recognition:** "You often mention 'anxiety' on Sunday nights."
- **Positive Reinforcement:** "You've exercised 3 times this week, and your mood was notably higher."
- **Weekly Wisdom:** Gentle, non-judgmental insights delivered every Sunday.

---

## 🎯 Recent Improvements (Production-Ready)

### 🔒 **Production-Grade Reliability**
- **Dual STT Recording:** Browser Speech API runs in parallel as pre-computed backup (zero transcription loss)
- **OCR Never Fails:** 3-tier fallback (Maverick → Scout → Tesseract.js)
- **Smart Autosave:** 7-second debounce prevents API spam while ensuring data safety
- **History Isolation:** Cross-date undo prevention (data corruption impossible)

### 📡 **Offline-First Experience**
- **Sync Status Indicators:** WhatsApp-like feedback (○ Saved, ✓ Synced, ⚠ Pending, ✗ Failed)
- **Offline Banner:** Non-blocking visual feedback when disconnected
- **Smart Queue:** Automatic sync with conflict resolution when online

### 🔔 **Native Notifications**
- **Daily Reminders:** Schedule journal prompts at your preferred time
- **Cross-Platform:** Native Android/iOS notifications via Capacitor

---

## 🚫 The "Anti-Features"

*We are proud of what OneLine DOESN'T do.*

| Feature | Status | Why? |
| :--- | :---: | :--- |
| **Social Feed** | ❌ | No comparison. No performing for an audience. |
| **Streaks** | ❌ | We don't punish you for living your life. |
| **Rich Text** | ❌ | No formatting decisions. Just write. |
| **Ads** | ❌ | Your thoughts are not for sale. |

---

## 🛠️ Tech Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **AI:** Groq (Llama 3.3-70b, Whisper)
- **OCR:** Tesseract.js (In-browser, privacy-first)
- **Security:** RLS (Row Level Security), Edge Functions for API protection

---

## 🚀 Deployment Guide

### 1. Prerequisites
- Node.js 18+
- Supabase Project
- Groq API Key

### 2. Configure Supabase Edge Function
Run the following in your terminal to deploy the secure AI proxy:

```bash
# Login & Link
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Set Secrets
supabase secrets set GROQ_API_KEY=your_groq_api_key

# Deploy
supabase functions deploy ai-proxy
```

### 3. Deploy Frontend (Vercel)
1. Import repository to Vercel.
2. Add Environment Variables:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key
3. Deploy!

---

## 📱 Mobile & Update System (Android)

OneLine features a **10/10 production-grade** custom in-app update system designed for sideloaded/enterprise distribution.

### 🛠️ Technical Specifications
- **Background Downloads**: Powered by Android `WorkManager`. Downloads survive app restarts, process death, and device reboots.
- **Resumable Transfers**: Uses `HTTP Range` headers and `RandomAccessFile` to resume interrupted downloads exactly where they left off.
- **Security**: Mandatory **SHA-256** cryptographic integrity check before installation.
- **Lifecycle-Safe**: Re-verifies update success on app resume via `appStateChange` listeners.
- **Auto-Cleanup**: Automatically deletes the APK from storage after successful verification.

### 🚀 Release Workflow

To release a new update to your users:

1. **Build & Hash**: Run the automated release script:
   ```bash
   npm run release:apk
   ```
   *This will build the web project, sync Capacitor, compile the Android release APK, and output the SHA-256 hash.*

2. **Update Manifest**: Open `public/version.json` and:
   - Increment `versionCode` (must be greater than the current one).
   - Update `version` string.
   - Paste the `sha256` hash output from the previous step.
   - Update `downloadUrl` to point to the hosted APK (e.g., GitHub Release link).

3. **Deploy**: Push the changes to GitHub and upload the APK to your release/hosting location.

### 🧪 Development Tips
- **Native Plugins**: Native logic is located in `android/app/src/main/java/com/oneline/plugins/`.
- **Background Workers**: Download logic exists in `android/app/src/main/java/com/oneline/workers/DownloadWorker.kt`.
- **Testing Updates**: To test the update flow locally, point `downloadUrl` in `version.json` to a local server or a test GitHub release.

---

## 🗺️ Future Roadmap

- [ ] **"Mood Weather Map"**: Visualize your year in colored pixels based on sentiment.
- [ ] **"Time Travel" Mode**: "What were you doing exactly 1 year ago today?"
- [ ] **Physical Book Export**: Print your year into a beautiful hardbound book.

---

<div align="center">

**Built with ❤️ for mindful journaling.**

[Report Bug](https://github.com/Rohitsbag/OneLine/issues) • [Request Feature](https://github.com/Rohitsbag/OneLine/issues)

</div>
