export type Locale = "en" | "ja" | "zh-CN";

const english = {
  language: "Language",
  refresh: "Refresh",
  portSummary: "Port summary",
  listening: "Listening",
  localOnly: "Local only",
  networkFacing: "Network-facing",
  unknownScope: "Unknown scope",
  searchPlaceholder: "Search port, process, or command",
  searchPorts: "Search ports",
  filtersAndSorting: "Port filters and sorting",
  portType: "Port type",
  allTypes: "All types",
  systemRange: "System · 0–1023",
  serviceRange: "Service · 1024–49151",
  dynamicRange: "Dynamic · 49152–65535",
  owner: "Owner",
  allOwners: "All owners",
  system: "System",
  service: "Service",
  application: "Application",
  development: "Development",
  unknown: "Unknown",
  dynamic: "Dynamic",
  scope: "Scope",
  allScopes: "All scopes",
  sort: "Sort",
  portLowHigh: "Port · low to high",
  portHighLow: "Port · high to low",
  processName: "Process name",
  ownerType: "Owner type",
  resultCount: "{count} results",
  unableToScan: "Unable to scan ports.",
  scanFailed: "Scan failed",
  noMatchingPorts: "No matching ports",
  noTcpListeners: "No TCP listeners detected",
  trySearchOrFilters: "Try another search or clear a filter.",
  checkAgain: "HostLens will check again while this window is open.",
  selectedPortDetails: "Selected port details",
  closeDetails: "Close details",
  process: "Process",
  command: "Command",
  copied: "Copied",
  copy: "Copy",
  commandUnavailable: "Command details are unavailable.",
  unavailable: "Unavailable",
  parentPid: "Parent PID",
  executable: "Executable",
  workingDirectory: "Working directory",
  parentChain: "Parent chain",
  noParentChain: "No parent process details available.",
  observation: "Observation",
  completeObservation: "Complete",
  partialObservation: "Partial · {count} fields unavailable",
  evidence: "Evidence",
  evidenceFields: "{count} observed fields",
  user: "User",
  selectPort: "Select a port to inspect its process and full command.",
  hostLensActions: "HostLens actions",
  openApp: "Open App",
  quit: "Quit",
  scanning: "Scanning…",
  updated: "Updated {time}",
  notScanned: "Not scanned",
  sampleData: "Sample data",
  live: "Live",
  partialDetails:
    "Some process details are unavailable because the process exited or macOS restricted access.",
  sampleDataWarning:
    "Live scanning is not implemented for {platform}; showing sample data.",
} as const;

type MessageKey = keyof typeof english;
type Messages = Record<MessageKey, string>;

const japanese: Messages = {
  language: "言語",
  refresh: "更新",
  portSummary: "ポートの概要",
  listening: "待受中",
  localOnly: "ローカルのみ",
  networkFacing: "ネットワーク公開",
  unknownScope: "公開範囲不明",
  searchPlaceholder: "ポート、プロセス、コマンドを検索",
  searchPorts: "ポートを検索",
  filtersAndSorting: "ポートの絞り込みと並べ替え",
  portType: "ポート種別",
  allTypes: "すべての種別",
  systemRange: "システム · 0–1023",
  serviceRange: "サービス · 1024–49151",
  dynamicRange: "動的 · 49152–65535",
  owner: "所有元",
  allOwners: "すべての所有元",
  system: "システム",
  service: "サービス",
  application: "アプリ",
  development: "開発",
  unknown: "不明",
  dynamic: "動的",
  scope: "公開範囲",
  allScopes: "すべての範囲",
  sort: "並べ替え",
  portLowHigh: "ポート · 昇順",
  portHighLow: "ポート · 降順",
  processName: "プロセス名",
  ownerType: "所有元の種別",
  resultCount: "{count}件",
  unableToScan: "ポートをスキャンできませんでした。",
  scanFailed: "スキャンに失敗しました",
  noMatchingPorts: "一致するポートはありません",
  noTcpListeners: "待受中のTCPポートはありません",
  trySearchOrFilters: "検索条件またはフィルターを変更してください。",
  checkAgain: "このウィンドウを開いている間、HostLensが再確認します。",
  selectedPortDetails: "選択したポートの詳細",
  closeDetails: "詳細を閉じる",
  process: "プロセス",
  command: "コマンド",
  copied: "コピー済み",
  copy: "コピー",
  commandUnavailable: "コマンド情報を取得できません。",
  unavailable: "取得不可",
  parentPid: "親PID",
  executable: "実行ファイル",
  workingDirectory: "作業ディレクトリ",
  parentChain: "親プロセスチェーン",
  noParentChain: "親プロセスの詳細を取得できません。",
  observation: "観測状態",
  completeObservation: "完全",
  partialObservation: "一部取得 · {count}項目を取得不可",
  evidence: "根拠",
  evidenceFields: "{count}項目を観測",
  user: "ユーザー",
  selectPort: "ポートを選択すると、プロセスと完全なコマンドを確認できます。",
  hostLensActions: "HostLensの操作",
  openApp: "アプリを開く",
  quit: "終了",
  scanning: "スキャン中…",
  updated: "更新 {time}",
  notScanned: "未スキャン",
  sampleData: "サンプルデータ",
  live: "ライブ",
  partialDetails:
    "プロセスの終了またはmacOSのアクセス制限により、一部の詳細を取得できません。",
  sampleDataWarning:
    "{platform}のライブスキャンは未実装のため、サンプルデータを表示しています。",
};

const simplifiedChinese: Messages = {
  language: "语言",
  refresh: "刷新",
  portSummary: "端口概览",
  listening: "正在监听",
  localOnly: "仅本机",
  networkFacing: "网络可访问",
  unknownScope: "范围未知",
  searchPlaceholder: "搜索端口、进程或命令",
  searchPorts: "搜索端口",
  filtersAndSorting: "端口筛选与排序",
  portType: "端口类型",
  allTypes: "全部类型",
  systemRange: "系统 · 0–1023",
  serviceRange: "服务 · 1024–49151",
  dynamicRange: "动态 · 49152–65535",
  owner: "进程类别",
  allOwners: "全部类别",
  system: "系统",
  service: "服务",
  application: "应用",
  development: "开发",
  unknown: "未知",
  dynamic: "动态",
  scope: "监听范围",
  allScopes: "全部范围",
  sort: "排序",
  portLowHigh: "端口 · 从低到高",
  portHighLow: "端口 · 从高到低",
  processName: "进程名称",
  ownerType: "进程类别",
  resultCount: "{count} 项",
  unableToScan: "无法扫描端口。",
  scanFailed: "扫描失败",
  noMatchingPorts: "没有匹配的端口",
  noTcpListeners: "未检测到TCP监听端口",
  trySearchOrFilters: "请尝试其他搜索内容或清除筛选条件。",
  checkAgain: "窗口打开期间，HostLens会继续检查。",
  selectedPortDetails: "所选端口详情",
  closeDetails: "关闭详情",
  process: "进程",
  command: "命令",
  copied: "已复制",
  copy: "复制",
  commandUnavailable: "无法获取命令详情。",
  unavailable: "无法获取",
  parentPid: "父进程PID",
  executable: "可执行文件",
  workingDirectory: "工作目录",
  parentChain: "父进程链",
  noParentChain: "无法获取父进程详情。",
  observation: "观测状态",
  completeObservation: "完整",
  partialObservation: "部分信息 · {count}项无法获取",
  evidence: "证据",
  evidenceFields: "已观测{count}个字段",
  user: "用户",
  selectPort: "选择一个端口以查看对应进程和完整命令。",
  hostLensActions: "HostLens操作",
  openApp: "打开应用",
  quit: "退出",
  scanning: "正在扫描…",
  updated: "更新于 {time}",
  notScanned: "尚未扫描",
  sampleData: "示例数据",
  live: "实时",
  partialDetails: "部分进程已退出或受到macOS权限限制，因此无法获取完整信息。",
  sampleDataWarning: "尚未实现{platform}的实时扫描，当前显示示例数据。",
};

const messages: Record<Locale, Messages> = {
  en: english,
  ja: japanese,
  "zh-CN": simplifiedChinese,
};

export function detectLocale(languages = navigator.languages): Locale {
  for (const language of languages) {
    const normalized = language.toLowerCase();
    if (normalized.startsWith("ja")) return "ja";
    if (normalized.startsWith("zh")) return "zh-CN";
    if (normalized.startsWith("en")) return "en";
  }
  return "en";
}

export function loadLocale(): Locale {
  const stored = window.localStorage.getItem("hostlens.locale");
  if (stored === "en" || stored === "ja" || stored === "zh-CN") return stored;
  return detectLocale();
}

export function translate(
  locale: Locale,
  key: MessageKey,
  values: Record<string, string | number> = {},
): string {
  return Object.entries(values).reduce(
    (message, [name, value]) =>
      message.replaceAll(`{${name}}`, String(value)),
    messages[locale][key],
  );
}

export function localizeWarning(locale: Locale, warning: string): string {
  if (
    warning ===
    "Some process details are unavailable because the process exited or macOS restricted access."
  ) {
    return translate(locale, "partialDetails");
  }

  const sampleMatch = warning.match(
    /^Live scanning is not implemented for (.+); showing sample data\.$/,
  );
  if (sampleMatch) {
    return translate(locale, "sampleDataWarning", {
      platform: sampleMatch[1]!,
    });
  }

  return warning;
}

export type { MessageKey };
