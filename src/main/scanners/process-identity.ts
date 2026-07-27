import { basename } from "node:path";
import type {
  IdentityEvidence,
  LaunchSource,
  ObservationConfidence,
  PortListener,
  PortType,
  ProcessIdentity,
  ProjectIdentity,
} from "../../shared/ports";

export interface LaunchdJob {
  pid?: number;
  label: string;
}

export interface DockerPortBinding {
  containerId: string;
  containerName: string;
  image: string;
  hostAddress: string;
  hostPort: number;
  containerPort: number;
  protocol: "tcp" | "udp";
}

export interface AttributionContext {
  launchdJobs?: readonly LaunchdJob[];
  dockerBindings?: readonly DockerPortBinding[];
}

export interface ResolvedProcess {
  identity: ProcessIdentity;
  launchSource: LaunchSource;
}

const FRIENDLY_TOOLS: Record<string, string> = {
  adb: "Android Debug Bridge",
  appium: "Appium",
  "@babel/node": "Babel Node",
  "com.docker.backend": "Docker Desktop Service",
  electron: "Electron",
  "electron-vite": "Electron Vite",
  expo: "Expo",
  httpd: "Apache HTTP Server",
  "local-ssl-proxy": "Local SSL Proxy",
  mysqld: "MySQL",
  next: "Next.js",
  nginx: "Nginx",
  node: "Node.js",
  nuxt: "Nuxt",
  postgres: "PostgreSQL",
  "react-scripts": "React Scripts",
  "redis-server": "Redis",
  sshd: "SSH Server",
  vite: "Vite",
  webpack: "webpack",
  "webpack-dev-server": "webpack Dev Server",
};

const SYSTEM_PROCESSES: Record<string, string> = {
  ControlCenter: "macOS Control Center",
  mDNSResponder: "Bonjour / mDNS",
  rapportd: "AirDrop & Handoff",
  sharingd: "macOS Sharing",
};

const SERVICE_PROCESSES = new Set([
  "postgres",
  "mysqld",
  "redis-server",
  "nginx",
  "httpd",
  "sshd",
  "com.docker.backend",
]);

const DEVELOPMENT_TOOLS = new Set([
  "appium",
  "@babel/node",
  "electron",
  "electron-vite",
  "expo",
  "local-ssl-proxy",
  "next",
  "nuxt",
  "react-scripts",
  "vite",
  "webpack",
  "webpack-dev-server",
]);

function evidence(
  kind: IdentityEvidence["kind"],
  source: string,
  detail: string,
  confidence: ObservationConfidence,
): IdentityEvidence {
  return { kind, source, detail, confidence };
}

function humanize(value: string): string {
  const known = FRIENDLY_TOOLS[value];
  if (known) return known;

  const tail = value.includes(".") ? value.split(".").at(-1) ?? value : value;
  return tail
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function extractAppName(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (!value) continue;
    const match = [...value.matchAll(/\/([^/]+)\.app\/Contents\//g)][0];
    if (match?.[1]) return match[1];
  }
  return undefined;
}

function normalizeToolName(value: string): string {
  if (value.startsWith("@")) {
    const parts = value.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : value;
  }
  return value.split("/")[0] ?? value;
}

function extractDevelopmentTool(command: string): {
  projectPath?: string;
  tool: string;
} | undefined {
  const nodeModules = command.match(
    /(?:^|\s)(\S+?)\/node_modules\/((?:@[^/\s]+\/)?[^/\s]+)/,
  );
  if (nodeModules?.[2]) {
    const packageName = normalizeToolName(nodeModules[2]);
    if (
      DEVELOPMENT_TOOLS.has(packageName) ||
      /\/\.bin\/(?:vite|next|nuxt|webpack|webpack-dev-server|react-scripts|expo|appium|electron-vite|local-ssl-proxy)(?:\s|$)/i.test(
        command,
      )
    ) {
      const binMatch = command.match(
        /\/node_modules\/\.bin\/([^/\s]+)(?:\s|$)/,
      );
      return {
        projectPath: nodeModules[1],
        tool: normalizeToolName(binMatch?.[1] ?? packageName),
      };
    }
  }

  const direct = command.match(
    /(?:^|\s)(vite|next|nuxt|webpack|webpack-dev-server|react-scripts|expo|appium|electron-vite|local-ssl-proxy)(?:\s|$)/i,
  );
  if (direct?.[1]) return { tool: direct[1].toLowerCase() };
  return undefined;
}

function extractNodeRuntime(executable: string | undefined): string | undefined {
  if (!executable || basename(executable) !== "node") return undefined;
  const version = executable.match(/\/node\/(v\d+(?:\.\d+){0,2})\//)?.[1];
  return version ? `Node.js ${version}` : "Node.js";
}

function packageScriptFromCommands(
  listener: PortListener,
): Pick<ProjectIdentity, "packageManager" | "script"> | undefined {
  const commands = [
    listener.command,
    ...listener.parentChain.map((ancestor) => ancestor.command),
  ].filter((value): value is string => Boolean(value));

  const candidates: Array<
    Pick<ProjectIdentity, "packageManager" | "script">
  > = [];
  for (const command of commands) {
    const npm = command.match(
      /(?:^|\s)(?:\S*\/)?npm(?:\s+run(?:-script)?)?\s+([a-zA-Z0-9:_-]+)/,
    );
    if (npm?.[1] && npm[1] !== "npm") {
      candidates.push({ packageManager: "npm", script: npm[1] });
      continue;
    }

    const yarn = command.match(
      /(?:^|\s)(?:\S*\/)?yarn(?:\s+run)?\s+([a-zA-Z0-9:_-]+)/,
    );
    if (yarn?.[1]) {
      candidates.push({ packageManager: "yarn", script: yarn[1] });
      continue;
    }

    const pnpm = command.match(
      /(?:^|\s)(?:\S*\/)?pnpm(?:\s+run)?\s+([a-zA-Z0-9:_-]+)/,
    );
    if (pnpm?.[1]) {
      candidates.push({ packageManager: "pnpm", script: pnpm[1] });
    }
  }

  return candidates.at(-1);
}

function findLaunchdJob(
  listener: PortListener,
  jobs: readonly LaunchdJob[],
): LaunchdJob | undefined {
  return jobs.find(
    (job) => job.pid !== undefined && job.pid === listener.pid,
  );
}

function findDockerBinding(
  listener: PortListener,
  bindings: readonly DockerPortBinding[],
): DockerPortBinding | undefined {
  if (listener.protocol !== "tcp") return undefined;
  return bindings.find(
    (binding) =>
      binding.protocol === listener.protocol && binding.hostPort === listener.port,
  );
}

function resolveLaunchSource(
  listener: PortListener,
  context: AttributionContext,
  project: ProjectIdentity | undefined,
): LaunchSource {
  const dockerBinding = findDockerBinding(
    listener,
    context.dockerBindings ?? [],
  );
  if (
    dockerBinding &&
    (listener.processName === "com.docker.backend" ||
      listener.command?.includes("Docker.app"))
  ) {
    return {
      kind: "docker",
      label: `Docker container · ${dockerBinding.containerName}`,
      detail: `${dockerBinding.image} · ${dockerBinding.hostPort}→${dockerBinding.containerPort}/${dockerBinding.protocol}`,
      automatic: "unknown",
      confidence: "high",
      evidence: [
        evidence(
          "observed",
          "Docker published ports",
          `${dockerBinding.containerId} publishes host port ${dockerBinding.hostPort}`,
          "high",
        ),
      ],
    };
  }

  if (
    listener.processName === "com.docker.backend" ||
    listener.command?.includes("/Applications/Docker.app/") ||
    listener.executable?.includes("/Applications/Docker.app/")
  ) {
    return {
      kind: "docker",
      label: "Docker Desktop",
      detail: "Docker Desktop networking process",
      automatic: "unknown",
      confidence: "high",
      evidence: [
        evidence(
          "observed",
          "Process path",
          "Executable belongs to Docker.app",
          "high",
        ),
      ],
    };
  }

  const packageScript = packageScriptFromCommands(listener);
  if (packageScript) {
    return {
      kind: "package-script",
      label: `${packageScript.packageManager} ${packageScript.script}`,
      detail: project?.path,
      automatic: "no",
      confidence: "high",
      evidence: [
        evidence(
          "observed",
          "Process command chain",
          `Matched ${packageScript.packageManager} package script "${packageScript.script}"`,
          "high",
        ),
      ],
    };
  }

  const appName = extractAppName(listener.executable, listener.command);
  if (appName) {
    return {
      kind: "native-app",
      label: appName,
      detail: "Native macOS application bundle",
      automatic: "unknown",
      confidence: "high",
      evidence: [
        evidence(
          "observed",
          "Application bundle path",
          `Matched ${appName}.app`,
          "high",
        ),
      ],
    };
  }

  const launchdJob = findLaunchdJob(listener, context.launchdJobs ?? []);
  if (launchdJob?.label.startsWith("homebrew.mxcl.")) {
    return {
      kind: "homebrew",
      label: launchdJob.label.replace(/^homebrew\.mxcl\./, "Homebrew · "),
      detail: launchdJob.label,
      automatic: "yes",
      confidence: "high",
      evidence: [
        evidence(
          "observed",
          "launchctl job",
          `Matched Homebrew service label ${launchdJob.label}`,
          "high",
        ),
      ],
    };
  }

  if (
    (listener.executable?.startsWith("/opt/homebrew/") ||
      listener.executable?.startsWith("/usr/local/Cellar/")) &&
    listener.parentChain.some((ancestor) => ancestor.pid === 1)
  ) {
    return {
      kind: "homebrew",
      label: `Homebrew · ${humanize(listener.processName)}`,
      detail: listener.executable,
      automatic: "yes",
      confidence: "medium",
      evidence: [
        evidence(
          "inferred",
          "Executable and parent chain",
          "Homebrew path with launchd ancestry",
          "medium",
        ),
      ],
    };
  }

  const manualAncestor = listener.parentChain.find((ancestor) =>
    /(?:^|\/)(?:zsh|bash|fish|Terminal|iTerm2?|Warp)(?:\s|$|\/)/i.test(
      `${ancestor.processName} ${ancestor.executable ?? ""} ${ancestor.command ?? ""}`,
    ),
  );
  if (manualAncestor) {
    return {
      kind: "manual",
      label: `Manual · ${manualAncestor.processName}`,
      detail: "Started from an interactive shell or terminal application",
      automatic: "no",
      confidence: "medium",
      evidence: [
        evidence(
          "inferred",
          "Parent process chain",
          `Matched interactive ancestor ${manualAncestor.processName}`,
          "medium",
        ),
      ],
    };
  }

  if (launchdJob) {
    return {
      kind: "launchd",
      label: launchdJob.label,
      detail: "Managed by the current user's launchd domain",
      automatic: "yes",
      confidence: "high",
      evidence: [
        evidence(
          "observed",
          "launchctl job",
          `PID matched launchd label ${launchdJob.label}`,
          "high",
        ),
      ],
    };
  }

  return {
    kind: "unknown",
    label: "Unknown launch source",
    automatic: "unknown",
    confidence: "low",
    evidence: [
      evidence(
        "inferred",
        "Source resolver",
        "No supported launch source matched the available observations",
        "low",
      ),
    ],
  };
}

function resolveIdentity(
  listener: PortListener,
  dockerBinding: DockerPortBinding | undefined,
): ProcessIdentity {
  const processName = listener.processName;
  const command = listener.command ?? "";
  const executable = listener.executable ?? "";
  const observedProcess = evidence(
    "observed",
    "Process observation",
    `Process name: ${processName}`,
    "high",
  );

  if (
    command.startsWith("/System/") ||
    executable.startsWith("/System/") ||
    command.startsWith("/usr/libexec/") ||
    executable.startsWith("/usr/libexec/") ||
    SYSTEM_PROCESSES[processName]
  ) {
    return {
      displayName:
        SYSTEM_PROCESSES[processName] ??
        extractAppName(executable, command) ??
        humanize(processName),
      kind: "system",
      confidence: "high",
      evidence: [
        observedProcess,
        evidence(
          "observed",
          "System path catalogue",
          "Matched a macOS-owned executable or known system process",
          "high",
        ),
      ],
    };
  }

  if (dockerBinding) {
    return {
      displayName: `Docker · ${dockerBinding.containerName}`,
      kind: "service",
      confidence: "high",
      evidence: [
        observedProcess,
        evidence(
          "observed",
          "Docker published ports",
          `${dockerBinding.containerName} publishes ${dockerBinding.hostPort}/${dockerBinding.protocol}`,
          "high",
        ),
      ],
    };
  }

  const developmentTool = extractDevelopmentTool(command);
  if (developmentTool) {
    const projectPath =
      developmentTool.projectPath ?? listener.workingDirectory;
    const packageScript = packageScriptFromCommands(listener);
    const project: ProjectIdentity | undefined = projectPath
      ? {
          name: basename(projectPath),
          path: projectPath,
          tool: humanize(developmentTool.tool),
          runtime: extractNodeRuntime(listener.executable),
          ...packageScript,
        }
      : undefined;
    return {
      displayName: project
        ? `${humanize(developmentTool.tool)} · ${project.name}`
        : humanize(developmentTool.tool),
      kind: "development",
      project,
      confidence: projectPath ? "high" : "medium",
      evidence: [
        observedProcess,
        evidence(
          "inferred",
          "Development tool resolver",
          `Matched ${developmentTool.tool}${projectPath ? ` under ${projectPath}` : ""}`,
          projectPath ? "high" : "medium",
        ),
      ],
    };
  }

  if (
    processName === "node" ||
    processName === "adb" ||
    /\b(vite|appium|webpack|next|nuxt|react-scripts)\b/i.test(command)
  ) {
    const projectPath = listener.workingDirectory;
    return {
      displayName: FRIENDLY_TOOLS[processName] ?? humanize(processName),
      kind: "development",
      project: projectPath
        ? {
            name: basename(projectPath),
            path: projectPath,
            runtime: extractNodeRuntime(listener.executable),
            ...packageScriptFromCommands(listener),
          }
        : undefined,
      confidence: "medium",
      evidence: [
        observedProcess,
        evidence(
          "inferred",
          "Development process catalogue",
          "Matched a development runtime or command",
          "medium",
        ),
      ],
    };
  }

  if (SERVICE_PROCESSES.has(processName)) {
    return {
      displayName: FRIENDLY_TOOLS[processName] ?? humanize(processName),
      kind: "service",
      confidence: "high",
      evidence: [
        observedProcess,
        evidence(
          "observed",
          "Service process catalogue",
          `Matched known service process ${processName}`,
          "high",
        ),
      ],
    };
  }

  const appName = extractAppName(executable, command);
  if (appName) {
    return {
      displayName: appName,
      kind: "application",
      confidence: "high",
      evidence: [
        observedProcess,
        evidence(
          "observed",
          "Application bundle path",
          `Matched ${appName}.app`,
          "high",
        ),
      ],
    };
  }

  return {
    displayName: humanize(processName),
    kind: command ? "service" : "unknown",
    confidence: command ? "low" : "low",
    evidence: [
      observedProcess,
      evidence(
        "inferred",
        "Fallback identity",
        command
          ? "Used the observed process name because no supported identity rule matched"
          : "Process detail was unavailable",
        "low",
      ),
    ],
  };
}

export function classifyPortType(port: number): PortType {
  if (port <= 1_023) return "system";
  if (port <= 49_151) return "service";
  return "dynamic";
}

export function createUnresolvedIdentity(processName: string): ProcessIdentity {
  return {
    displayName: humanize(processName),
    kind: "unknown",
    confidence: "low",
    evidence: [
      evidence(
        "observed",
        "Raw socket observation",
        `Process name: ${processName}`,
        "low",
      ),
    ],
  };
}

export function createUnknownLaunchSource(): LaunchSource {
  return {
    kind: "unknown",
    label: "Unknown launch source",
    automatic: "unknown",
    confidence: "low",
    evidence: [
      evidence(
        "inferred",
        "Source resolver",
        "Source attribution has not completed",
        "low",
      ),
    ],
  };
}

export function resolveProcess(
  listener: PortListener,
  context: AttributionContext = {},
): ResolvedProcess {
  const dockerBinding = findDockerBinding(
    listener,
    context.dockerBindings ?? [],
  );
  const identity = resolveIdentity(listener, dockerBinding);
  const launchSource = resolveLaunchSource(
    listener,
    context,
    identity.project,
  );

  if (identity.project && launchSource.kind === "package-script") {
    const packageScript = packageScriptFromCommands(listener);
    if (packageScript) Object.assign(identity.project, packageScript);
  }

  return { identity, launchSource };
}
