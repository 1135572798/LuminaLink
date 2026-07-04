import fs from 'node:fs/promises';
import path from 'node:path';
import type { AppConfig, ScanRoot } from '../shared/types.js';
import { ensureDir, pathExists } from './fs-utils.js';
import { expandPathExpression, getLuminaPaths } from './paths.js';

export const defaultConfig: AppConfig = {
  version: 1,
  language: 'zh-CN',
  theme: 'system',
  autoTranslate: false,
  scanRoots: [
    {
      id: 'codex-skills',
      label: 'Codex Skills',
      pathExpression: '%USERPROFILE%/.codex/skills',
      kind: 'codex_skills',
      enabled: true
    },
    {
      id: 'codex-plugins',
      label: 'Codex Plugins',
      pathExpression: '%USERPROFILE%/.codex/plugins/cache',
      kind: 'codex_plugins',
      enabled: true
    },
    {
      id: 'agent-skills',
      label: 'User Agent Skills',
      pathExpression: '%USERPROFILE%/.agents/skills',
      kind: 'agents_skills',
      enabled: true
    }
  ],
  translator: {
    provider: 'noop',
    targetLang: 'zh-CN'
  }
};

export async function loadConfig(): Promise<AppConfig> {
  const paths = getLuminaPaths();
  await ensureDir(paths.appDataDir);
  if (!(await pathExists(paths.configPath))) {
    await saveConfig(defaultConfig);
    return structuredClone(defaultConfig);
  }
  const raw = await fs.readFile(paths.configPath, 'utf8');
  const parsed = JSON.parse(raw) as AppConfig;
  return {
    ...defaultConfig,
    ...parsed,
    translator: {
      ...defaultConfig.translator,
      ...parsed.translator
    },
    scanRoots: parsed.scanRoots?.length ? parsed.scanRoots : defaultConfig.scanRoots
  };
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const paths = getLuminaPaths();
  await ensureDir(path.dirname(paths.configPath));
  await fs.writeFile(paths.configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

export function expandScanRoots(config: AppConfig): ScanRoot[] {
  return config.scanRoots.map((root) => ({
    ...root,
    expandedPath: expandPathExpression(root.pathExpression)
  }));
}

export async function addScanRoot(root: Omit<ScanRoot, 'expandedPath'>): Promise<AppConfig> {
  const config = await loadConfig();
  const existingIndex = config.scanRoots.findIndex((item) => item.id === root.id);
  if (existingIndex >= 0) {
    config.scanRoots[existingIndex] = root;
  } else {
    config.scanRoots.push(root);
  }
  await saveConfig(config);
  return config;
}
