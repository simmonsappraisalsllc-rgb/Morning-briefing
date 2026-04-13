# Morning Briefing v2 — Simmons Appraisals LLC
Full Google OAuth integration — Gmail + Calendar read directly via Google APIs.

## How it works
1. You sign in with your Google account (one time)
2. Click "Run Morning Briefing"
3. The server calls Gmail + Calendar APIs directly with your OAuth token
4. Claude analyzes the data and generates the briefing
5. All 6 sections populate with your live data

## Deploy Instructions

### Step 1 — Google Cloud Project

1. Go to https://console.cloud.google.com
2. Click "New Project" → name it "Morning Briefing" → Create
3. In the left menu → "APIs & Services" → "Library"
4. Search and ENABLE both:
   - **Gmail API**
   - **Google Calendar API**
5. Go to "APIs & Services" → "OAuth consent screen"
   - User Type: External
   - App name: Morning Briefing
   - User support email: your Gmail
   - Developer contact: your Gmail
   - Click Save and Continue through all screens
   - On "Test users" screen → Add Users → add your Gmail address
   - Save
6. Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: **Web application**
   - Name: Morning Briefing
   - Authorized redirect URIs — add BOTH:
     - `http://localhost:3000/api/auth/callback/google` (for local dev)
     - `https://YOUR-VERCEL-URL.vercel.app/api/auth/callback/google` (add after deploy)
   - Click Create
   - Copy your **Client ID** and **Client Secret**

### Step 2 — GitHub

1. Create new repo at github.com named `morning-briefing`
2. Upload all files maintaining folder structure
3. Push/commit

### Step 3 — Vercel

1. Go to vercel.com → New Project → Import `morning-briefing`
2. Framework: Next.js (auto-detected)
3. Add these Environment Variables:

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `GOOGLE_CLIENT_ID` | From Google Cloud step 6 |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud step 6 |
| `NEXTAUTH_SECRET` | Any random 32+ char string (generate at https://generate-secret.vercel.app/32) |
| `NEXTAUTH_URL` | Your Vercel URL e.g. `https://morning-briefing-abc.vercel.app` |

4. Click Deploy
5. Once deployed, go back to Google Cloud → Credentials → your OAuth client
6. Add your actual Vercel URL to "Authorized redirect URIs":
   `https://morning-briefing-abc.vercel.app/api/auth/callback/google`
7. Save

### Step 4 — Bookmark

Navigate to your Vercel URL, sign in with Google, bookmark it. Done.

## Local Development

```bash
npm install

# Create .env.local:
ANTHROPIC_API_KEY=your_key
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
NEXTAUTH_SECRET=any-random-string-32-chars
NEXTAUTH_URL=http://localhost:3000

npm run dev
# Open http://localhost:3000
```

## Notes
- Gmail and Calendar access is read-only — the app cannot send emails or modify events
- The Corrections folder (Label_8 / INBOX/Corrections) is excluded from revision searches
- Your tokens are stored server-side only — never exposed to the browser
- Session persists so you don't have to sign in every day
