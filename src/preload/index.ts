import { contextBridge, ipcRenderer } from "electron";
import type { HostLensApi } from "../shared/ports";

const api: HostLensApi = {
  listPorts: () => ipcRenderer.invoke("ports:list"),
  updateHistory: (update) => ipcRenderer.invoke("history:update", update),
  clearHistory: () => ipcRenderer.invoke("history:clear"),
  copyText: (text) => ipcRenderer.invoke("clipboard:write", text),
  exportText: (suggestedName, text) =>
    ipcRenderer.invoke("file:export-text", suggestedName, text),
  openMainWindow: () => ipcRenderer.invoke("app:open-main-window"),
  quitApp: () => ipcRenderer.invoke("app:quit"),
};

contextBridge.exposeInMainWorld("hostLens", api);
