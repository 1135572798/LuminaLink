export type AssetType =
  | 'skill'
  | 'plugin'
  | 'agent_file'
  | 'project_doc'
  | 'generic_file'
  | 'markdown_doc'
  | 'text_doc';

export type TranslationStatus = 'none' | 'translated' | 'stale' | 'failed';

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

export type ScanRootKind =
  | 'codex_skills'
  | 'codex_plugins'
  | 'agents_skills'
  | 'project_root'
  | 'docs_root'
  | 'custom';

export interface ScanRoot {
  id: string;
  label: string;
  pathExpression: string;
  expandedPath: string;
  kind: ScanRootKind;
  enabled: boolean;
}

export interface Asset {
  id: string;
  sourceFileId: string;
  type: AssetType;
  name: string;
  displayName: string;
  sourcePath: string;
  sourceRoot: string;
  originalDescription: string;
  chineseDescription: string;
  contentHash: string;
  tags: string[];
  categories: string[];
  projectName?: string;
  version?: string;
  lastModifiedAt: string;
  discoveredAt: string;
  updatedAt: string;
  translationStatus: TranslationStatus;
  favorite: boolean;
  riskLevel: RiskLevel;
}

export interface TranslationRecord {
  id: string;
  sourceHash: string;
  sourceLang: string;
  targetLang: string;
  scope: string;
  sourceText: string;
  translatedText: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScanSummary {
  runId: string;
  startedAt: string;
  finishedAt: string;
  scannedRoots: number;
  created: number;
  updated: number;
  unchanged: number;
  removed: number;
  failed: number;
}

export interface DashboardSummary {
  assetsTotal: number;
  translatedTotal: number;
  pendingTranslationTotal: number;
  staleTranslationTotal: number;
  failedTotal: number;
  riskTotal: number;
  recentAssets: Asset[];
}

export interface AppConfig {
  version: number;
  language: 'zh-CN' | 'en-US';
  theme: 'system' | 'light' | 'dark';
  autoTranslate: boolean;
  scanRoots: Array<Omit<ScanRoot, 'expandedPath'>>;
  translator: TranslatorConfig;
}

export interface TranslatorConfig {
  provider: 'noop' | 'openai' | 'openai-compatible';
  model?: string;
  baseUrl?: string;
  targetLang: 'zh-CN';
  apiKeySource?: string;
}

export interface DoctorCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface DoctorReport {
  checks: DoctorCheck[];
  configPath: string;
  indexDbPath: string;
  translationDbPath: string;
}

export interface OperationResult<T = unknown> {
  ok: boolean;
  message: string;
  data?: T;
}
