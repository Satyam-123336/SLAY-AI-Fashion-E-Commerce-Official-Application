<h1 align="center">
  <img src="public/logo.svg" alt="SLAY AI Logo" width="60" />
  <br />
  SLAY AI — Fashion Outfit Curator
</h1>

<p align="center">
  <strong>AI-powered personalized fashion curation for the modern Indian shopper</strong>
</p>

<p align="center">
  <a href="https://slayai.online" target="_blank"><img src="https://img.shields.io/badge/Live%20App-slayai.online-blueviolet?style=for-the-badge&logo=google-chrome" /></a>
  <img src="https://img.shields.io/badge/Backend-Supabase%20Edge%20Functions-3ECF8E?style=for-the-badge&logo=supabase" />
  <img src="https://img.shields.io/badge/Frontend-Firebase%20Hosting-FFCA28?style=for-the-badge&logo=firebase" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript" />
</p>

<p align="center">
  <img src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&h=350&fit=crop" alt="SLAY AI Banner" width="100%" style="border-radius:12px" />
</p>

---

## ✨ What is SLAY AI?

**SLAY AI** is a smart, real-time fashion outfit curator that takes your personal preferences — gender, age, occasion, accessories, and budget — and instantly generates curated outfit recommendations with actual shoppable products from top Indian e-commerce platforms like Myntra, Ajio, Amazon India, and Flipkart.

Every product link is automatically wrapped with **Cuelinks affiliate tracking**, generating revenue on every purchase your users make — turning your fashion app into a passive income machine.

---

## 🚀 Features

| Feature | Description |
|---|---|
| 🎨 **Personalized Curation** | Curates 3 complete looks based on your gender, age, occasion & budget |
| 🛍️ **Real Products** | Fetches live products via Google Serper Shopping API |
| ⭐ **Smart Filtering** | Surfaces only 4.0+ rated products, sorted by review count |
| 💰 **Budget Enforcement** | Strictly enforces your max budget across Top + Bottom + Accessory |
| 🔗 **Affiliate Links** | Every product URL is automatically converted to Cuelinks affiliate links |
| 📱 **Mobile-First UI** | Stunning, responsive design with Framer Motion animations |
| 🎵 **Ambient Music** | Background fashion vibe with mute/unmute control |
| 💾 **Save Outfits** | Bookmark your favourite looks for later |
| 📤 **Share Feature** | Share curated outfit links instantly |
| 📊 **Analytics** | Full in-app event tracking |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        User Browser                      │
│              slayai.online (Firebase Hosting)            │
│                 React 19 + Vite + TypeScript             │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS POST /functions/v1/curate
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Supabase Edge Function (Deno)               │
│         ojefookmcqdiqdugczfb.supabase.co                 │
│                                                          │
│  1. fetchSerperShopping()  → Google Serper API           │
│  2. filterAndSortProducts() → Rating ≥ 4.0, desc         │
│  3. Budget-aware combination picker                      │
│  4. resolveDirectLink()    → Google Organic Search       │
│  5. wrapWithCuelinks()     → Cuelinks Affiliate API      │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

**Frontend**
- ⚛️ React 19 + TypeScript
- ⚡ Vite 6 (Build Tool)
- 🎨 Vanilla CSS + Tailwind CSS 4
- 🎞️ Framer Motion (Animations)
- 🔷 Lucide React (Icons)

**Backend**
- 🦕 Deno (Supabase Edge Functions)
- 🔥 Express.js (Local Development)
- 🛒 Google Serper API (Shopping Search)
- 🔗 Cuelinks API (Affiliate Monetisation)

**Infrastructure**
- 🟢 Supabase Edge Functions (Backend hosting)
- 🔥 Firebase Hosting (Frontend hosting)
- 🌐 Hostinger (Custom domain: `slayai.online`)

---

## 📁 Project Structure

```
slay-ai/
├── src/
│   ├── App.tsx              # Main application + curation logic
│   ├── Onboarding.tsx       # User preferences onboarding flow
│   ├── analytics.ts         # Event tracking
│   └── types.ts             # TypeScript type definitions
├── supabase/
│   └── functions/
│       └── curate/
│           └── index.ts     # Deno Edge Function (Backend API)
├── functions/               # Firebase Functions (unused, Supabase preferred)
├── public/                  # Static assets
├── server.ts                # Local Express server (dev only)
├── firebase.json            # Firebase Hosting config
├── .firebaserc              # Firebase project config
├── .env                     # Local environment variables
├── .env.production          # Production environment (Supabase URL)
└── vite.config.ts           # Vite config
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory for local development:

```env
SERPER_API_KEY=your_google_serper_api_key
```

Create a `.env.production` file for the Firebase-hosted build:

```env
VITE_API_URL=https://your-project-ref.supabase.co/functions/v1/curate
```

For the Supabase backend, set secrets using the CLI:

```bash
npx supabase secrets set SERPER_API_KEY=your_google_serper_api_key
```

---

## 🏃 Running Locally

**Prerequisites:** Node.js 20+, npm

```bash
# 1. Clone the repository
git clone https://github.com/Satyam-123336/SLAY-AI-Fashion-E-Commerce-Official-Application.git
cd SLAY-AI-Fashion-E-Commerce-Official-Application

# 2. Install dependencies
npm install

# 3. Create your .env file
echo "SERPER_API_KEY=your_key_here" > .env

# 4. Start the dev server (frontend + backend together)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚀 Deployment

### Backend → Supabase Edge Functions

```bash
# Login to Supabase
npx supabase login

# Link to your project
npx supabase link --project-ref your-project-ref

# Set API key secret
npx supabase secrets set SERPER_API_KEY=your_key_here

# Deploy the function (no JWT required for public access)
npx supabase functions deploy curate --no-verify-jwt
```

### Frontend → Firebase Hosting

```bash
# Build the production bundle (points to Supabase URL)
npm run build

# Login to Firebase
npx firebase login

# Deploy to Firebase Hosting
npx firebase deploy --only hosting
```

---

## 💸 Monetisation — Cuelinks Affiliate Integration

Every time a user clicks **"Buy"** on any product card, the URL is automatically converted into a **Cuelinks affiliate tracking link**. This means you earn a commission from Myntra, Ajio, Amazon India, Flipkart, and hundreds of other Indian retailers on every completed purchase — with zero extra effort.

The affiliate conversion happens server-side in the Supabase Edge Function:

```typescript
async function wrapWithCuelinks(originalUrl: string): Promise<string> {
  const res = await fetch("https://cuelinks.com/api/v2/links.json", {
    method: "POST",
    headers: { "Authorization": `Token token="YOUR_CUELINKS_KEY"` },
    body: JSON.stringify({ url: originalUrl })
  });
  const data = await res.json();
  return data.affiliate_url || originalUrl;
}
```

---

## 🤝 API Integrations

| API | Purpose | Docs |
|---|---|---|
| **Google Serper** | Live product search from Google Shopping | [serper.dev](https://serper.dev) |
| **Cuelinks** | Affiliate link generation for Indian e-commerce | [cuelinks.com](https://cuelinks.com) |

---

## 📜 License

This project is proprietary software owned by **FlashFusion Labs Private Limited**.

© 2026 FlashFusion Labs Private Limited. All rights reserved.

---

<p align="center">
  Built with ❤️ by the SLAY AI team
</p>
