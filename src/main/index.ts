import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  Tray,
} from "electron";
import { join } from "node:path";
import { createPortScanner } from "./scanners";

const PANEL_WIDTH = 440;
const PANEL_HEIGHT = 640;

let panelWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const scanner = createPortScanner();

function createTrayIcon(): Electron.NativeImage {
  if (process.platform === "darwin") {
    const systemIcon = nativeImage.createFromNamedImage("network", {
      pointSize: 18,
    });

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
      preload: join(__dirname, "../preload/index.mjs"),
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
  window.once("ready-to-show", () => {
    // In development there is no Dock icon, so reveal the panel once to make
    // a successful launch immediately visible. Packaged builds stay tray-only.
    if (process.env.ELECTRON_RENDERER_URL) {
      showPanel();
      console.info("[HostLens] Development panel shown.");
    }
  });
  window.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      window.hide();
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return window;
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

function openTrayMenu(): void {
  if (!tray) return;

  tray.popUpContextMenu(
    Menu.buildFromTemplate([
      {
        label: panelWindow?.isVisible() ? "Hide HostLens Ports" : "Open HostLens Ports",
        click: togglePanel,
      },
      { type: "separator" },
      {
        label: "Quit HostLens Ports",
        accelerator: "CommandOrControl+Q",
        click: () => app.quit(),
      },
    ]),
  );
}

function registerIpc(): void {
  ipcMain.handle("ports:list", () => scanner.scan());
}

app.whenReady().then(() => {
  app.setName("HostLens Ports");

  if (process.platform === "darwin") {
    app.dock?.hide();
  }

  registerIpc();
  panelWindow = createPanelWindow();
  tray = new Tray(createTrayIcon());
  tray.setToolTip("HostLens Ports");
  tray.on("click", togglePanel);
  tray.on("right-click", openTrayMenu);
});

app.on("window-all-closed", () => {});

app.on("before-quit", () => {
  isQuitting = true;
});
