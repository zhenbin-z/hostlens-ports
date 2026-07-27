import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  nativeImage,
  screen,
  Tray,
} from "electron";
import { join } from "node:path";
import { createPortScanner } from "./scanners";

const PANEL_WIDTH = 540;
const PANEL_HEIGHT = 720;

let mainWindow: BrowserWindow | null = null;
let panelWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const scanner = createPortScanner();

function createTrayIcon(): Electron.NativeImage {
  if (process.platform === "darwin") {
    const systemIcon = nativeImage
      .createFromNamedImage("server.rack", {
        pointSize: 16,
      })
      .resize({ width: 18, height: 18, quality: "best" });

    if (!systemIcon.isEmpty()) {
      systemIcon.setTemplateImage(true);
      return systemIcon;
    }
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <g fill="none" stroke="#000" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18" cy="18" r="12"/>
        <path d="M13 14h10M13 18h6M13 22h8"/>
      </g>
    </svg>
  `;
  const icon = nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
  );

  if (icon.isEmpty()) {
    throw new Error("HostLens could not create its menu bar icon.");
  }

  icon.setTemplateImage(true);
  return icon.resize({ width: 18, height: 18 });
}

function createPanelWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    hasShadow: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (process.platform === "darwin") {
    window.setVibrancy("under-window");
  }

  window.on("blur", () => window.hide());
  window.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      window.hide();
    }
  });

  loadRenderer(window, "panel");

  return window;
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1_120,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    show: false,
    title: "HostLens Ports",
    backgroundColor: "#f4f7f3",
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => {
    window.show();
    window.focus();
    console.info("[HostLens] Main window shown.");
  });
  window.on("close", (event) => {
    if (!isQuitting && process.platform === "darwin") {
      event.preventDefault();
      window.hide();
    }
  });
  window.on("closed", () => {
    mainWindow = null;
  });

  loadRenderer(window, "app");
  return window;
}

function loadRenderer(
  window: BrowserWindow,
  mode: "app" | "panel",
): void {
  if (process.env.ELECTRON_RENDERER_URL) {
    const rendererUrl = new URL(process.env.ELECTRON_RENDERER_URL);
    rendererUrl.searchParams.set("mode", mode);
    void window.loadURL(rendererUrl.toString());
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"), {
      query: { mode },
    });
  }
}

function positionPanel(): void {
  if (!panelWindow || !tray) return;

  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: Math.round(trayBounds.x),
    y: Math.round(trayBounds.y),
  });
  const workArea = display.workArea;

  const centeredX = Math.round(
    trayBounds.x + trayBounds.width / 2 - PANEL_WIDTH / 2,
  );
  const x = Math.max(
    workArea.x + 8,
    Math.min(centeredX, workArea.x + workArea.width - PANEL_WIDTH - 8),
  );

  const trayIsAboveWorkArea = trayBounds.y < workArea.y;
  const y = trayIsAboveWorkArea
    ? Math.round(trayBounds.y + trayBounds.height + 6)
    : Math.round(trayBounds.y - PANEL_HEIGHT - 6);

  panelWindow.setPosition(x, y, false);
}

function showPanel(): void {
  if (!panelWindow) return;

  positionPanel();
  panelWindow.show();
  panelWindow.focus();
}

function togglePanel(): void {
  if (panelWindow?.isVisible()) {
    panelWindow.hide();
  } else {
    showPanel();
  }
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow();
    return;
  }

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function registerIpc(): void {
  ipcMain.handle("ports:list", () => scanner.scan());
  ipcMain.handle("clipboard:write", (_event, text: unknown) => {
    if (typeof text !== "string") {
      throw new TypeError("Clipboard content must be text.");
    }

    clipboard.writeText(text);
  });
  ipcMain.handle("app:open-main-window", () => {
    panelWindow?.hide();
    showMainWindow();
  });
  ipcMain.handle("app:quit", () => app.quit());
}

app.whenReady().then(() => {
  app.setName("HostLens Ports");

  if (process.platform === "darwin") {
    app.setActivationPolicy("regular");
    void app.dock?.show();
  }

  registerIpc();
  tray = new Tray(createTrayIcon());
  tray.setToolTip("HostLens Ports");
  tray.on("click", togglePanel);
  panelWindow = createPanelWindow();
  mainWindow = createMainWindow();
});

app.on("window-all-closed", () => {});

app.on("activate", showMainWindow);

app.on("before-quit", () => {
  isQuitting = true;
});
