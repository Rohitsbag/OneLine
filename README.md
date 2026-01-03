<div align="center">

# ✨ OneLine

**Minimalist journaling for a clearer mind**

*Capture your life, one day at a time.*

[![Made with React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)](https://reactjs.org)
[![Powered by Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat&logo=supabase)](https://supabase.com)
[![AI by Groq](https://img.shields.io/badge/Groq-AI-F55036?style=flat)](https://groq.com)

</div>

---

## 🌟 Features

| Feature | Description |
|---------|-------------|
| 📝 **Daily Journaling** | One entry per day, beautifully minimal |
| 🎤 **Voice Input** | Tap to dictate, hold to record voice notes |
| 📷 **Image Attachments** | Tap to attach, hold to scan (OCR) |
| 🤖 **AI Reflections** | Weekly insights powered by Llama 3.3 |
| 🌓 **Dark/Light Mode** | Automatic theme with manual toggle |
| 🎨 **Accent Colors** | Personalize your experience |
| 🔒 **Secure** | All data encrypted, API keys protected |

---

## 🛠️ Tech Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Supabase (Auth, Database, Storage, Edge Functions)
- **AI:** Groq (Llama 3.3, Whisper STT)
- **OCR:** Tesseract.js (in-browser)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Supabase account
- Groq API key

### Local Development

```bash
# Clone the repository
git clone https://github.com/Rohitsbag/OneLine.git
cd OneLine

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start development server
npm run dev
```

### Environment Variables

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 📦 Deployment

### 1. Deploy Edge Function (Supabase)

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set GROQ_API_KEY=your_groq_api_key
supabase functions deploy ai-proxy
```

### 2. Deploy Frontend (Vercel)

1. Import your GitHub repo at [vercel.com](https://vercel.com)
2. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy!

---

## 📱 Usage

| Action | Mic Button | Camera Button |
|--------|------------|---------------|
| **Tap** | Voice-to-text dictation | Attach image |
| **Hold** | Record voice note | OCR scan |

---

## 🗂️ Project Structure

```
OneLine/
├── src/
│   ├── components/     # React components
│   ├── pages/          # Page components
│   ├── utils/          # Utilities (AI, OCR, STT)
│   └── constants/      # App constants
├── supabase/
│   └── functions/      # Edge functions
│       └── ai-proxy/   # Secure AI proxy
└── public/             # Static assets
```

---

## 📄 License

MIT © [Rohitsbag](https://github.com/Rohitsbag)

---

<div align="center">

**Built with ❤️ for mindful journaling**

</div>
