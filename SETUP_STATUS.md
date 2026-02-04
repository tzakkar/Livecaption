# Setup Status & How to Resume

Quick reference for where you are in the setup and what’s left.

---

## ✅ Completed Steps

| Step | Status | Notes |
|------|--------|--------|
| 1. Prerequisites | ✅ Done | Node.js, pnpm installed |
| 2. Project Installation | ✅ Done | `pnpm install` completed |
| 3. Supabase Setup | ✅ Done | Cloud project created, URL + anon key in `.env.local` |
| 4. GitHub OAuth | ✅ Done | Credentials added in Supabase Dashboard |
| 5. Environment Variables | ✅ Done | `.env.local` has Supabase URL, anon key, SITE_URL |
| 6. Database Migrations | ✅ Done | `events` and `captions` tables exist, Realtime enabled |
| 7. Running the App | ✅ Done | `pnpm dev` runs successfully |

---

## ⏳ Remaining (to resume)

### 1. ElevenLabs API Key (required for broadcasting/transcription)

- **Status:** Not set — `ELEVENLABS_API_KEY` is empty in `.env.local`.
- **Needed for:** “Start Recording” and real-time transcription on the broadcast page.

**Resume:**

1. Go to [elevenlabs.io](https://elevenlabs.io) → sign in → Profile / API Key.
2. Copy your API key.
3. In the project root, edit `.env.local` and set:
   ```env
   ELEVENLABS_API_KEY=your_api_key_here
   ```
4. Restart the dev server: stop with `Ctrl+C`, then run `pnpm dev` again.

---

### 2. Verification & Testing (optional but recommended)

- **Status:** Not fully verified.
- **What to do:** Manually run through the app once.

**Resume:**

1. Start the app (if not running):
   ```bash
   pnpm dev
   ```
2. Open [http://localhost:3000](http://localhost:3000).
3. **Sign in:** Click Sign In → “Continue with GitHub” → authorize.
4. **Dashboard:** You should land on the dashboard.
5. **Create event:** Create an event (title + description).
6. **Broadcast (needs ElevenLabs key):** Open the event’s broadcast page → “Start Recording” → speak; captions should appear.
7. **View:** In another tab, open `/view/[event-uid]` and confirm captions update in real time.

---

### 3. Production Deployment (when ready)

- **Status:** Not started.
- **Resume:** See **Production Deployment** in [SETUP.md](./SETUP.md) (Vercel, env vars, GitHub OAuth callback URL for production).

---

## Quick commands

```bash
# Install dependencies (if you pull or reset)
pnpm install

# Start development server
pnpm dev

# Test database connection
node test-db-connection.js

# Build for production
pnpm build
```

---

## Where you are in SETUP.md

You’re past **sections 1–7** (Prerequisites through Running the Application).

**Resume from:** [SETUP.md – ElevenLabs API Setup](./SETUP.md#elevenlabs-api-setup) (get API key and add to `.env.local`), then run through [Verification & Testing](./SETUP.md#verification--testing).

---

## One-line summary

**Done:** Prerequisites, install, Supabase, GitHub OAuth, env vars, migrations, app runs.  
**Next:** Add `ELEVENLABS_API_KEY` to `.env.local`, restart `pnpm dev`, then test sign-in → create event → broadcast → view.
