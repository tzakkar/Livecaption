# Complete Setup Guide

This comprehensive guide will walk you through setting up the LiveCaptions application from scratch.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Installation](#project-installation)
3. [Supabase Setup](#supabase-setup)
4. [GitHub OAuth Configuration](#github-oauth-configuration)
5. [ElevenLabs API Setup](#elevenlabs-api-setup)
6. [Environment Variables](#environment-variables)
7. [Database Migrations](#database-migrations)
8. [Running the Application](#running-the-application)
9. [Verification & Testing](#verification--testing)
10. [Troubleshooting](#troubleshooting)
11. [Production Deployment](#production-deployment)

---

## Prerequisites

Before you begin, ensure you have the following installed and set up:

### Required Software

- **Node.js 18+** - [Download](https://nodejs.org/)
- **pnpm** - Install via: `npm install -g pnpm`
- **Git** - [Download](https://git-scm.com/)

### Required Accounts

- **Supabase Account** - [Sign up](https://supabase.com)
- **ElevenLabs Account** - [Sign up](https://elevenlabs.io)
- **GitHub Account** - [Sign up](https://github.com)

### Browser Requirements (for translation features)

- **Google Chrome 138+** (for on-device translation and language detection)
- Built-in AI features enabled (usually enabled by default in Chrome 138+)

---

## Project Installation

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd captions.events
```

### Step 2: Install Dependencies

```bash
pnpm install
```

This will install all required packages including:
- Next.js 16
- React 19
- Supabase client libraries
- ElevenLabs React SDK
- UI components (Radix UI, Tailwind CSS)
- And other dependencies

### Step 3: Verify Installation

```bash
pnpm --version
node --version
```

Ensure you have:
- pnpm 8.x or higher
- Node.js 18.x or higher

---

## Supabase Setup

You have two options for Supabase: **Cloud (Recommended)** or **Local Development**.

### Option A: Supabase Cloud (Recommended for Production)

#### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign in or create an account
3. Click **"New Project"**
4. Fill in the project details:
   - **Name**: Your project name (e.g., "LiveCaptions")
   - **Database Password**: Choose a strong password (save this!)LiveCaptions!!!!@
   - **Region**: Choose the closest region to your users
   - **Pricing Plan**: Free tier is sufficient for development
5. Click **"Create new project"**
6. Wait 2-3 minutes for the project to be provisioned

#### Step 2: Get Your Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)  https://msojbydbdesbcyhalyev.supabase.co
   - **anon/public key** (starts with `eyJ...`)   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zb2pieWRiZGVzYmN5aGFseWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyODMwOTUsImV4cCI6MjA4Mzg1OTA5NX0.2tol2-J8-EZIP5zhEpTBdErgnc0GKtlwK7wQq-E4SNQ

You'll need these for your `.env.local` file.

#### Step 3: Enable Realtime

1. In your Supabase dashboard, go to **Database** → **Replication**
2. Find the `captions` table (you'll create this in migrations)
3. Ensure **Realtime** is enabled (it should be by default)

### Option B: Local Supabase Development

#### Step 1: Install Supabase CLI

```bash
# Windows (using Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# macOS (using Homebrew)
brew install supabase/tap/supabase

# Or download from: https://github.com/supabase/cli/releases
```

#### Step 2: Initialize Supabase (if not already done)

```bash
supabase init
```

#### Step 3: Start Local Supabase

```bash
supabase start
```

This will start:
- PostgreSQL database (port 54322)
- Supabase API (port 54321)
- Supabase Studio (port 54323)
- Realtime server

#### Step 4: Get Local Credentials

After starting, you'll see output like:

```
API URL: http://127.0.0.1:54321
anon key: eyJ...
```

Use these for your `.env.local` file when developing locally.

---

## GitHub OAuth Configuration

### Step 1: Create a GitHub OAuth App

1. Go to [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in the application details:
   - **Application name**: `LiveCaptions` (or your preferred name)
   - **Homepage URL**: 
     - Development: `http://localhost:3000`
     - Production: `https://yourdomain.com`
   - **Authorization callback URL**: 
     - Development: `http://localhost:3000/auth/callback`
     - Production: `https://yourdomain.com/auth/callback`
4. Click **"Register application"**
5. **Important**: Copy your **Client ID** immediately
6. Click **"Generate a new client secret"**
7. **Important**: Copy your **Client Secret** immediately (you won't see it again!)

### Step 2: Configure GitHub OAuth in Supabase

#### For Supabase Cloud:

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **GitHub** in the list
5. Click to expand and enable it
6. Enter your credentials:
   - **Client ID**: Paste from Step 1
   - **Client Secret**: Paste from Step 1
7. Click **"Save"**

#### For Local Supabase:

1. Edit `supabase/config.toml`
2. Find the `[auth.external.github]` section
3. Update it:

```toml
[auth.external.github]
enabled = true
client_id = "your_github_client_id"
secret = "your_github_client_secret"
redirect_uri = "http://localhost:54321/auth/v1/callback"
```

4. Restart Supabase:

```bash
supabase stop
supabase start
```

---

## ElevenLabs API Setup

### Step 1: Create an ElevenLabs Account

1. Go to [elevenlabs.io](https://elevenlabs.io)
2. Sign up or sign in
3. Navigate to your profile/settings

### Step 2: Get Your API Key

1. In your ElevenLabs dashboard, go to your profile settings
2. Find the **API Key** section
3. Copy your API key (starts with something like `sk-...`)

**Important**: Keep this key secure. It's used server-side only and should never be exposed to the client.

### Step 3: Verify API Access

Ensure your account has access to the Scribe API. You may need to:
- Upgrade to a plan that includes Scribe API access
- Check API usage limits in your dashboard

---

## Environment Variables

### Step 1: Create `.env.local` File

In the project root, create a file named `.env.local`:

```bash
# Windows PowerShell
New-Item -Path .env.local -ItemType File

# macOS/Linux
touch .env.local
```

### Step 2: Add Environment Variables

Copy the contents from `example.env.local` and fill in your values:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Site URL (for development)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional: Development redirect URL (for local Supabase)
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback

# ElevenLabs API Key (server-side only - never exposed to client)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

### Step 3: Fill in Your Values

Replace the placeholders:

- **NEXT_PUBLIC_SUPABASE_URL**: Your Supabase project URL
- **NEXT_PUBLIC_SUPABASE_ANON_KEY**: Your Supabase anon key
- **NEXT_PUBLIC_SITE_URL**: `http://localhost:3000` for development
- **ELEVENLABS_API_KEY**: Your ElevenLabs API key

### Step 4: Verify `.env.local` is in `.gitignore`

Ensure `.env.local` is listed in `.gitignore` to prevent committing secrets:

```bash
# Check if it's ignored
git check-ignore .env.local
```

---

## Database Migrations

### Step 1: Apply Migrations

You need to run the database migrations in order. The migrations are located in `supabase/migrations/`:

1. `20251031162352_events.sql` - Creates the events table
2. `20251031162420_captions.sql` - Creates the captions table with realtime
3. `20251103000000_add_language_code.sql` - Adds language_code column

#### For Supabase Cloud:

**Option A: Using Supabase Dashboard (Easiest)**

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Open each migration file in order
4. Copy and paste the SQL into the editor
5. Click **"Run"** for each migration

**Option B: Using Supabase CLI**

```bash
# Link to your project (if not already linked)
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

#### For Local Supabase:

```bash
# Migrations are automatically applied when you run
supabase start

# Or manually apply:
supabase migration up
```

### Step 2: Verify Tables Created

1. Go to **Database** → **Tables** in Supabase Dashboard
2. You should see:
   - `events` table
   - `captions` table

### Step 3: Verify Realtime is Enabled

1. Go to **Database** → **Replication** in Supabase Dashboard
2. Ensure `captions` table has **Realtime** enabled (toggle should be ON)

### Step 4: Verify Row Level Security (RLS)

The migrations automatically set up RLS policies. Verify:

1. Go to **Authentication** → **Policies** in Supabase Dashboard
2. You should see policies for:
   - `events` table (viewable by all, editable by creator)
   - `captions` table (viewable by all, insertable by event creator)

---

## Running the Application

### Step 1: Start the Development Server

```bash
pnpm dev
```

The application will start on `http://localhost:3000`

### Step 2: Open in Browser

Navigate to: `http://localhost:3000`

### Step 3: Verify Everything Works

1. You should see the homepage
2. Click **"Sign In"** or navigate to `/auth/signin`
3. You should see the GitHub OAuth button
4. Click **"Continue with GitHub"**
5. Authorize the application
6. You should be redirected to the dashboard

---

## Verification & Testing

### Test 1: Authentication

1. ✅ Sign in with GitHub
2. ✅ Should redirect to `/dashboard`
3. ✅ Should see your events list (empty initially)

### Test 2: Create an Event

1. Click **"Create Event"** or navigate to `/dashboard/create`
2. Fill in:
   - **Title**: "Test Event"
   - **Description**: "Testing the setup"
3. Click **"Create"**
4. ✅ Should redirect to dashboard with your new event

### Test 3: Broadcasting

1. Click on your event or navigate to `/broadcast/[event-uid]`
2. Click **"Start Recording"**
3. Grant microphone permissions
4. Speak into your microphone
5. ✅ Should see partial transcripts appear (italic text)
6. ✅ Should see final transcripts appear (solid background)
7. ✅ Should see language detection badge (if Chrome 138+)

### Test 4: Viewing

1. Open a new tab/window
2. Navigate to `/view/[event-uid]` (same UID from your event)
3. ✅ Should see captions appear in real-time
4. ✅ Should see caption history below
5. ✅ Should see language selector (if Chrome 138+)

### Test 5: Translation (Chrome 138+)

1. On the viewer page, select a target language from dropdown
2. ✅ Should see download progress (first time)
3. ✅ Should see translated captions
4. ✅ Should see language badge on translated captions

---

## Troubleshooting

### Issue: "Cannot connect to Supabase"

**Solutions:**
- Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
- Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct
- Check if Supabase project is active (not paused)
- Check network connection
- For local: Ensure `supabase start` is running

### Issue: "GitHub OAuth not working"

**Solutions:**
- Verify callback URL matches exactly: `http://localhost:3000/auth/callback`
- Check GitHub OAuth app settings
- Verify Client ID and Secret in Supabase dashboard
- Check browser console for errors
- Ensure you're using the correct environment (dev vs prod)

### Issue: "Token generation fails" or "Unauthorized"

**Solutions:**
- Verify `ELEVENLABS_API_KEY` is set in `.env.local`
- Check ElevenLabs account has API access
- Verify API key is correct (no extra spaces)
- Check server logs: `pnpm dev` output
- Ensure you're signed in and own the event

### Issue: "Microphone not working"

**Solutions:**
- Grant microphone permissions in browser
- Use HTTPS (required for microphone access)
- For local dev, Chrome may require `localhost` (not `127.0.0.1`)
- Check browser security settings
- Try a different browser

### Issue: "Captions not appearing"

**Solutions:**
- Check Supabase connection
- Verify realtime is enabled on `captions` table
- Check RLS policies allow public reads
- Open browser console for errors
- Verify event_id matches between broadcaster and viewer

### Issue: "Translation not working"

**Solutions:**
- Ensure Chrome 138+ is installed
- Check Chrome flags: `chrome://flags`
  - Enable "Prompt API for Gemini Nano"
  - Enable "Optimization guide on device"
- Check browser console for errors
- Verify internet connection (for first-time model download)
- Try selecting "Original (No Translation)" then reselecting language

### Issue: "Database migration errors"

**Solutions:**
- Run migrations in order (check timestamps)
- Verify you have proper database permissions
- Check for existing tables that might conflict
- Review migration SQL for syntax errors
- For Supabase Cloud: Use SQL Editor to run migrations manually

### Issue: "Build errors" or "TypeScript errors"

**Solutions:**
- Run `pnpm install` again
- Clear `.next` folder: `rm -rf .next` (or `Remove-Item -Recurse -Force .next` on Windows)
- Check Node.js version: `node --version` (should be 18+)
- Check pnpm version: `pnpm --version`
- Review error messages for specific issues

---

## Production Deployment

### Step 1: Prepare for Production

1. **Update GitHub OAuth App**:
   - Create a new OAuth app or update existing one
   - Set callback URL to your production domain: `https://yourdomain.com/auth/callback`
   - Update Homepage URL: `https://yourdomain.com`

2. **Update Supabase**:
   - Add production callback URL in Supabase Dashboard
   - Update GitHub OAuth credentials if using a new app

3. **Environment Variables**:
   - Set all environment variables in your hosting platform
   - Update `NEXT_PUBLIC_SITE_URL` to production URL

### Step 2: Deploy to Vercel (Recommended)

1. **Import Project**:
   - Go to [vercel.com](https://vercel.com)
   - Click **"Import Project"**
   - Connect your Git repository

2. **Configure Environment Variables**:
   - Add all variables from `.env.local`
   - Set `NEXT_PUBLIC_SITE_URL` to your Vercel domain

3. **Deploy**:
   - Click **"Deploy"**
   - Wait for build to complete

4. **Update OAuth Callback**:
   - Copy your Vercel deployment URL
   - Update GitHub OAuth app callback URL
   - Update Supabase redirect URLs

### Step 3: Deploy to Other Platforms

For other platforms (Netlify, Railway, etc.):

1. Set environment variables
2. Configure build command: `pnpm build`
3. Configure start command: `pnpm start`
4. Update OAuth callback URLs
5. Deploy

### Step 4: Post-Deployment Checklist

- [ ] Application loads correctly
- [ ] GitHub OAuth works
- [ ] Can create events
- [ ] Broadcasting works
- [ ] Viewing works
- [ ] Translation works (Chrome 138+)
- [ ] HTTPS is enabled (required for microphone)
- [ ] Environment variables are set
- [ ] Database migrations are applied
- [ ] Realtime is enabled

---

## Additional Resources

### Documentation Files

- [README.md](./README.md) - Project overview
- [SCRIBE_SETUP.md](./SCRIBE_SETUP.md) - Detailed ElevenLabs setup
- [GITHUB_AUTH_SETUP.md](./GITHUB_AUTH_SETUP.md) - Detailed GitHub OAuth setup
- [TRANSLATION_FEATURE.md](./TRANSLATION_FEATURE.md) - Translation feature details
- [CHROME_LANGUAGE_DETECTOR.md](./CHROME_LANGUAGE_DETECTOR.md) - Language detection details
- [LANGUAGE_CODE_UPDATE.md](./LANGUAGE_CODE_UPDATE.md) - Language code implementation

### External Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [ElevenLabs Scribe API](https://elevenlabs.io/docs/api-reference/scribe)
- [Chrome Translator API](https://developer.chrome.com/docs/ai/translator-api)
- [Chrome Language Detector API](https://developer.chrome.com/docs/ai/language-detection)

---

## Quick Reference

### Common Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linter
pnpm lint

# Start local Supabase
supabase start

# Stop local Supabase
supabase stop

# Apply migrations (local)
supabase migration up

# Link to Supabase project
supabase link --project-ref your-ref
```

### Important URLs

- **Development**: `http://localhost:3000`
- **Supabase Dashboard**: `https://supabase.com/dashboard`
- **GitHub OAuth Apps**: `https://github.com/settings/developers`
- **ElevenLabs Dashboard**: `https://elevenlabs.io`

### Environment Variables Checklist

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `NEXT_PUBLIC_SITE_URL`
- [ ] `ELEVENLABS_API_KEY`
- [ ] `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` (optional, for local dev)

---

## Support

If you encounter issues not covered in this guide:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review the detailed documentation files
3. Check browser console for errors
4. Review server logs (`pnpm dev` output)
5. Verify all environment variables are set correctly
6. Ensure all prerequisites are met

---

**Happy Captioning! 🎙️📝**
