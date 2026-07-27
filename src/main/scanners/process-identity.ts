import { basename } from "node:path";
import type {
  PortListener,
  PortType,
  ProcessOwnerType,
} from "../../shared/ports";

export interface ProcessIdentity {
  displayName: string;
  ownerType: ProcessOwnerType;
  projectName?: string;
}

const FRIENDLY_TOOLS: Record<string, string> = {
  adb: "Android Debug Bridge",
  appium: "Appium",
  "com.docker.backend": "Docker Desktop Service",
  httpd: "Apache HTTP Server",
  mysqld: "MySQL",
  nginx: "Nginx",
  node: "Node.js",
  postgres: "PostgreSQL",
  "redis-server": "Redis",
  sshd: "SSH Server",
  vite: "Vite",
};

const SYSTEM_PROCESSES: Record<string, string> = {
  ControlCenter: "macOS Control Center",
  mDNSResponder: "Bonjour / mDNS",
  rapportd: "AirDrop & Handoff",
  sharingd: "macOS Sharing",
};

function humanize(value: string): string {
  const known = FRIENDLY_TOOLS[value];
  if (known) return known;

  const tail = value.includes(".") ? value.split(".").at(-1) ?? value : value;
  return tail
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function extractAppName(command: string): string | undefined {
  return [...command.matchAll(/\/([^/]+)\.app\/Contents\//g)][0]?.[1];
}

function extractNodeProject(
  command: string,
): { projectName: string; toolName: string } | undefined {
  const match = command.match(
    /(?:^|\s)(\/\S+?)\/node_modules\/(?:\.bin\/)?([^/\s]+)/,
  );
  if (!match?.[1] || !match[2]) return undefined;

  return {
    projectName: basename(match[1]),
    toolName: humanize(match[2]),
  };
}

export function classifyPortType(port: number): PortType {
  if (port <= 1_023) return "system";
  if (port <= 49_151) return "service";
  return "dynamic";
}

export function identifyProcess(listener: PortListener): ProcessIdentity {
  const processName = listener.processName;
  const command = listener.command ?? "";

  if (
    command.startsWith("/System/") ||
    command.startsWith("/usr/libexec/") ||
    SYSTEM_PROCESSES[processName]
  ) {
    return {
      displayName:
        SYSTEM_PROCESSES[processName] ??
        extractAppName(command) ??
        humanize(processName),
      ownerType: "system",
    };
  }

  const project = extractNodeProject(command);
  if (project) {
    return {
      displayName: `${project.toolName} · ${project.projectName}`,
      ownerType: "development",
      projectName: project.projectName,
    };
  }

  if (
    processName === "node" ||
    processName === "adb" ||
    /\b(vite|appium|webpack|next|nuxt)\b/i.test(command)
  ) {
    return {
      displayName: FRIENDLY_TOOLS[processName] ?? humanize(processName),
      ownerType: "development",
    };
  }

  if (
    ["postgres", "mysqld", "redis-server", "nginx", "httpd", "sshd"].includes(
      processName,
    ) ||
    processName === "com.docker.backend"
  ) {
    return {
      displayName: FRIENDLY_TOOLS[processName] ?? humanize(processName),
      ownerType: "service",
    };
  }

  const appName = extractAppName(command);
  if (appName) {
    return {
      displayName: appName,
      ownerType: "application",
    };
  }

  return {
    displayName: humanize(processName),
    ownerType: command ? "service" : "unknown",
  };
}

