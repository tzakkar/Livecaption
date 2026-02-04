# Caption Overlay (Electron)

A **frameless, transparent, always-on-top** window for live captions. No minimize/maximize/close buttons. You see your video or desktop **behind** the window.

## Why use this?

- **Browser windows** cannot hide the OS title bar (minimize/maximize/close) or show true transparency to other windows.
- This **Electron app** creates a window with:
  - **No frame** – no OS window buttons
  - **Transparent** – you see whatever is behind the window (video, desktop)
  - **Always on top** – stays above other apps

## Setup

1. Install dependencies in this folder:

   ```bash
   cd caption-overlay
   pnpm install
   ```

2. Run your Next.js viewer (e.g. `pnpm dev` in the project root) so the viewer URL is available.

## Run

**Option A – Launcher (recommended)**  
Start the app; a small launcher window opens. Paste your viewer URL (with `?popup=1`) and click **Open overlay**.

- Example: `http://localhost:3000/view/YOUR_EVENT_UID?popup=1`

**Option B – Direct URL**

```bash
# From caption-overlay folder
CAPTION_VIEWER_URL="http://localhost:3000/view/YOUR_EVENT_UID?popup=1" pnpm start
```

Or:

```bash
pnpm start -- --url=http://localhost:3000/view/YOUR_EVENT_UID?popup=1
```

## From the project root

```bash
pnpm run overlay
```

(Make sure `caption-overlay` has its dependencies installed first.)

## Usage

1. Open the overlay (launcher or direct URL).
2. Move the overlay window over your video or any app.
3. Use **See-through** in the overlay to control how much you see behind the bar.
4. Close the overlay with the **X** in the caption bar (or close the window from the taskbar if needed).
