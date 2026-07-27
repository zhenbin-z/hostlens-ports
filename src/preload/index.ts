import { contextBridge, ipcRenderer } from "electron";
import type { HostLensApi } from "../shared/ports";

const api: HostLensApi = {
  listPorts: () => ipcRenderer.invoke("ports:list"),
};

contextBridge.exposeInMainWorld("hostLens", api);

