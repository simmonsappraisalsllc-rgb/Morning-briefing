# Morning Briefing — Simmons Appraisals LLC

A personal morning briefing dashboard for Chris Simmons, Certified Residential Real Property Appraiser.

## What it does

Runs a full morning briefing with one click:
- ⚡ Prioritized action items (synthesized from emails + calendar + revisions)
- ✏️ Outstanding revision requests (Gmail, excludes Corrections/Label_8)
- ✉ Unread AMC & client emails (last 48 hours)
- 📅 Schedule (today + tomorrow)
- 🏠 Pre-inspection property research (tomorrow's appointments auto-researched)
- 📰 Industry news (appraisal + mortgage, last 7 days)

## Deploy to Vercel

### 1. Create a GitHub repo

1. Go to github.com → New repository → name it `morning-briefing`
2. Upload all these files (maintain the folder structure)
3. Push to GitHub

### 2. Deploy on Vercel

1. Go to vercel.com → New Project
2. Import your `morning-briefing` GitHub repo
3. Framework: Next.js (auto-detected)
4. Add Environment Variable:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your Anthropic API key (same one used in the Appraiser Toolkit)
5. Click Deploy

### 3. Bookmark

Once deployed, Vercel gives you a URL like `https://morning-briefing-abc.vercel.app`.
Bookmark that URL in Chrome and open it every morning.

## Google / Gmail Auth

On first run, the app will prompt you to authorize Gmail and Google Calendar access.
Click Allow — this connects your accounts so the briefing can pull live data.

## Notes

- The Corrections folder (Label_8 / INBOX/Corrections) is excluded from revision searches — anything moved there is treated as resolved.
- Property research pulls tomorrow's appointments from your Google Calendar and auto-researches each address via web search.
- All API calls route through `/api/claude.js` server-side so your Anthropic API key is never exposed to the browser.

## Local Development

```bash
npm install
# Create .env.local with:
# ANTHROPIC_API_KEY=your_key_here
npm run dev
# Open http://localhost:3000
```
