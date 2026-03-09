# AI Visibility Checker

A lead magnet tool for [Astral](https://astral3.io) — Web3 founders enter their project name and category, the tool runs a live AI query via the Anthropic API, and displays a detailed visibility report showing how invisible they are to AI assistants.

## How It Works

1. User enters their project name, description, and category
2. The Next.js API route calls Claude with a real "recommend me the best X projects" query
3. If the project doesn't appear → the founder sees competitors and a bad score
4. They book a strategy call via the Calendly CTA

## Local Development

```bash
# 1. Clone and install
npm install

# 2. Set up environment
cp .env.example .env.local
# Add your Anthropic API key to .env.local

# 3. Run locally
npm run dev

# 4. Open
open http://localhost:3000
```

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Import Project** → select the repo
3. In **Settings → Environment Variables**, add:
   - `ANTHROPIC_API_KEY` = your Anthropic API key (from [console.anthropic.com](https://console.anthropic.com))
4. Click **Deploy**

That's it. No other config needed — Vercel auto-detects Next.js.

## Project Structure

```
ai-visibility-checker/
├── app/
│   ├── layout.jsx              # Root layout, fonts, metadata
│   ├── page.jsx                # Entry point
│   ├── globals.css             # Global styles + animations
│   └── api/check-visibility/
│       └── route.js            # Server-side Anthropic API call
├── components/
│   ├── AIVisibilityChecker.jsx # Main orchestrator + state
│   ├── LandingScreen.jsx       # Input form
│   ├── LoadingScreen.jsx       # Loading animation
│   ├── ResultsDashboard.jsx    # Full results (6 sections)
│   └── HeuristicCard.jsx       # Individual heuristic check
├── .env.example
└── package.json
```

## Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key — never exposed to the browser |

## Tech Stack

- **Next.js 14** (App Router)
- **React 18**
- **Tailwind CSS**
- **Anthropic API** (server-side only)
- **Google Fonts** via `next/font` (Plus Jakarta Sans + DM Sans)
