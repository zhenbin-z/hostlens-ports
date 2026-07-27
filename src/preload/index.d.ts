import type { HostLensApi } from "../shared/ports";

declare global {
  interface Window {
    hostLens: HostLensApi;
  }
}

export {};

