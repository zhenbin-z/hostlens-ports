import { contextBridge, ipcRenderer } from "electron";
import type { HostLensApi } from "../shared/ports";

const api: HostLensApi = {
  listPorts: () => ipcRenderer.invoke("ports:list"),
  copyText: (text) => ipcRenderer.invoke("clipboard:write", text),
};

contextBridge.exposeInMainWorld("hostLens", api);
