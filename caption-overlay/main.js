const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

// Optional: open overlay directly if URL passed via env or CLI
const urlFromEnv = process.env.CAPTION_VIEWER_URL;
const urlFromArg = process.argv.find((a) => a.startsWith("--url="))?.slice(6);

function createLauncherWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 200,
    title: "Caption Overlay – Launcher",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });
  win.loadFile(path.join(__dirname, "launcher.html"));
  return win;
}

function createOverlayWindow(viewerUrl) {
  const win = new BrowserWindow({
    width: 420,
    height: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  win.loadURL(viewerUrl);
  win.setAlwaysOnTop(true, "screen-saver");
  return win;
}

let launcherWindow = null;
let overlayWindow = null;

app.whenReady().then(() => {
  const directUrl = urlFromEnv || urlFromArg;
  if (directUrl) {
    overlayWindow = createOverlayWindow(directUrl);
    overlayWindow.on("closed", () => {
      overlayWindow = null;
      if (!launcherWindow) app.quit();
    });
    return;
  }

  launcherWindow = createLauncherWindow();
  launcherWindow.on("closed", () => {
    launcherWindow = null;
    if (!overlayWindow) app.quit();
  });
});

ipcMain.handle("open-overlay", (event, viewerUrl) => {
  if (!viewerUrl || typeof viewerUrl !== "string") return;
  const url = viewerUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) return;

  overlayWindow = createOverlayWindow(url);
  overlayWindow.on("closed", () => {
    overlayWindow = null;
    if (!launcherWindow) app.quit();
  });

  if (launcherWindow) launcherWindow.close();
  launcherWindow = null;
});

ipcMain.handle("get-embed-url", () => {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${base}`;
});

app.on("window-all-closed", () => app.quit());
