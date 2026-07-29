import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  screen,
  Tray,
} from "electron";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createPortScanner } from "./scanners";
import { createServiceScanner } from "./services/index.ts";
import { createNetworkScanner } from "./network/index.ts";
import { createRuntimeScanner } from "./runtimes/index.ts";
import { SessionMonitor } from "./session-monitor.ts";
import { HistoryStore } from "./history/history-store.ts";

const PANEL_WIDTH = 540;
const PANEL_HEIGHT = 720;

let mainWindow: BrowserWindow | null = null;
let panelWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let sessionMonitor: SessionMonitor | null = null;
let historyStore: HistoryStore | null = null;

app.setName("HostLens Ports");

const scanner = createPortScanner();
const serviceScanner = createServiceScanner();
const networkScanner = createNetworkScanner();
const runtimeScanner = createRuntimeScanner();
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

function getApplicationMenuText(): {
  about: string;
  edit: string;
  hide: string;
  hideOthers: string;
  quit: string;
  view: string;
  window: string;
} {
  const locale = app.getLocale().toLowerCase();

  if (locale.startsWith("ja")) {
    return {
      about: "HostLens Portsについて",
      edit: "編集",
      hide: "HostLens Portsを隠す",
      hideOthers: "ほかを隠す",
      quit: "HostLens Portsを終了",
      view: "表示",
      window: "ウィンドウ",
    };
  }

  if (locale.startsWith("zh")) {
    return {
      about: "关于HostLens Ports",
      edit: "编辑",
      hide: "隐藏HostLens Ports",
      hideOthers: "隐藏其他应用",
      quit: "退出HostLens Ports",
      view: "显示",
      window: "窗口",
    };
  }

  return {
    about: "About HostLens Ports",
    edit: "Edit",
    hide: "Hide HostLens Ports",
    hideOthers: "Hide Others",
    quit: "Quit HostLens Ports",
    view: "View",
    window: "Window",
  };
}

function configureApplicationMenu(): void {
  if (process.platform !== "darwin") return;
  const text = getApplicationMenuText();

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "HostLens Ports",
      submenu: [
        {
          label: text.about,
          role: "about",
        },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        {
          label: text.hide,
          accelerator: "Command+H",
          role: "hide",
        },
        {
          label: text.hideOthers,
          accelerator: "Command+Option+H",
          role: "hideOthers",
        },
        { role: "unhide" },
        { type: "separator" },
        {
          label: text.quit,
          accelerator: "Command+Q",
          click: () => app.quit(),
        },
      ],
    },
    {
      label: text.edit,
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: text.view,
      submenu: [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: text.window,
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { role: "close" },
        { type: "separator" },
        { role: "front" },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerIpc(): void {
  ipcMain.handle("ports:list", async () => {
    if (!sessionMonitor) throw new Error("HostLens is still starting.");
    const state = await sessionMonitor.scan();
    showPendingAlerts(state);
    return state;
  });
  ipcMain.handle("history:update", (_event, update: unknown) => {
    if (!sessionMonitor) throw new Error("HostLens is still starting.");
    if (!update || typeof update !== "object") {
      throw new TypeError("History update must be an object.");
    }
    return sessionMonitor.updateHistory(
      update as Parameters<SessionMonitor["updateHistory"]>[0],
    );
  });
  ipcMain.handle("history:clear", () => {
    if (!sessionMonitor) throw new Error("HostLens is still starting.");
    return sessionMonitor.clearHistory();
  });
  ipcMain.handle("clipboard:write", (_event, text: unknown) => {
    if (typeof text !== "string") {
      throw new TypeError("Clipboard content must be text.");
    }

    clipboard.writeText(text);
  });
  ipcMain.handle(
    "file:export-text",
    async (_event, suggestedName: unknown, text: unknown) => {
      if (typeof suggestedName !== "string" || typeof text !== "string") {
        throw new TypeError("Export requires a file name and text content.");
      }
      const result = await dialog.showSaveDialog({
        title: "Export HostLens observation",
        defaultPath: suggestedName,
        filters: [
          { name: "Text", extensions: ["txt"] },
          { name: "All files", extensions: ["*"] },
        ],
      });
      if (result.canceled || !result.filePath) return false;
      await writeFile(result.filePath, text, "utf8");
      return true;
    },
  );
  ipcMain.handle("app:open-main-window", () => {
    panelWindow?.hide();
    showMainWindow();
  });
  ipcMain.handle("app:quit", () => app.quit());
}

function showPendingAlerts(
  state: Awaited<ReturnType<SessionMonitor["scan"]>>,
): void {
  if (!Notification.isSupported()) return;
  const locale = app.getLocale().toLowerCase();
  const notificationText =
    locale.startsWith("ja")
      ? {
          newPort: "ネットワーク向けポートを検出",
          watched: "監視中のリソースが変更されました",
          added: "追加",
          removed: "終了",
          changed: "変更",
        }
      : locale.startsWith("zh")
        ? {
            newPort: "发现面向网络的新端口",
            watched: "监视中的资源发生变化",
            added: "新增",
            removed: "关闭",
            changed: "变化",
          }
        : {
            newPort: "New network-facing port",
            watched: "Watched resource changed",
            added: "Added",
            removed: "Closed",
            changed: "Changed",
          };
  const events = new Map(
    state.history.events.map((event) => [event.id, event]),
  );
  for (const candidate of state.history.pendingAlerts) {
    const event = events.get(candidate.eventId);
    if (!event) continue;
    const notification = new Notification({
      title:
        candidate.ruleId === "new-network-port"
          ? notificationText.newPort
          : notificationText.watched,
      body: `${event.label} · ${notificationText[event.kind]}`,
      silent: false,
    });
    notification.on("click", showMainWindow);
    notification.show();
  }
}

app.whenReady().then(() => {
  if (process.platform === "darwin") {
    app.setActivationPolicy("regular");
    const dock = app.dock;
    if (dock) {
      void dock.show();
      if (!app.isPackaged) {
        dock.setIcon(join(app.getAppPath(), "build/icon.png"));
      }
    }

    app.setAboutPanelOptions({
      applicationName: "HostLens Ports",
      applicationVersion: app.getVersion(),
      copyright: "Copyright © 2026 Zhenbin Zhang",
    });
  }

  configureApplicationMenu();
  historyStore = new HistoryStore(
    join(app.getPath("userData"), "history-v1.sqlite"),
  );
  sessionMonitor = new SessionMonitor(
    scanner,
    serviceScanner,
    networkScanner,
    runtimeScanner,
    undefined,
    historyStore,
  );
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
  historyStore?.close();
  historyStore = null;
});
