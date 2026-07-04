import path from 'node:path';
import matter from 'gray-matter';
import type { AssetType, RiskLevel, ScanRootKind } from '../shared/types.js';
import { readUtf8 } from './fs-utils.js';
import { detectLanguage } from './language.js';

export interface ParsedFile {
  name: string;
  displayName: string;
  description: string;
  body: string;
  tags: string[];
  type: AssetType;
  riskLevel: RiskLevel;
  detectedLang: string;
}

const agentNames = new Set(['AGENTS.md', 'AGENT.md', 'Agent.md', 'CLAUDE.md', '.cursorrules']);

export async function parseAssetFile(filePath: string, rootKind: ScanRootKind): Promise<ParsedFile> {
  const raw = await readUtf8(filePath);
  const fileName = path.basename(filePath);
  if (fileName.endsWith('.json')) {
    return parseJsonAsset(fileName, raw, rootKind);
  }
  const parsed = matter(raw);
  const body = parsed.content.trim();
  const firstHeading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const firstParagraph = body
    .split(/\r?\n\r?\n/)
    .map((part) => part.trim())
    .find((part) => part && !part.startsWith('#') && !part.startsWith('```'));

  const name = String(parsed.data.name ?? parsed.data.title ?? firstHeading ?? stripExtension(fileName));
  const description = String(parsed.data.description ?? firstParagraph ?? '').slice(0, 1200);
  const tags = normalizeTags(parsed.data.tags);
  const type = inferAssetType(fileName, rootKind, raw);
  const riskLevel = detectRisk(raw);

  return {
    name,
    displayName: name,
    description,
    body: raw,
    tags,
    type,
    riskLevel,
    detectedLang: detectLanguage(`${name}\n${description}\n${body}`)
  };
}

function parseJsonAsset(fileName: string, raw: string, rootKind: ScanRootKind): ParsedFile {
  try {
    const json = JSON.parse(raw) as {
      name?: string;
      version?: string;
      description?: string;
      interface?: {
        displayName?: string;
        shortDescription?: string;
        longDescription?: string;
      };
      keywords?: string[];
    };
    const name = json.interface?.displayName ?? json.name ?? stripExtension(fileName);
    const description = json.interface?.longDescription ?? json.interface?.shortDescription ?? json.description ?? raw;
    return {
      name,
      displayName: name,
      description: description.slice(0, 1200),
      body: raw,
      tags: json.keywords ?? [],
      type: inferAssetType(fileName, rootKind, raw),
      riskLevel: detectRisk(raw),
      detectedLang: detectLanguage(`${name}\n${description}`)
    };
  } catch {
    return {
      name: stripExtension(fileName),
      displayName: stripExtension(fileName),
      description: raw.slice(0, 1200),
      body: raw,
      tags: [],
      type: inferAssetType(fileName, rootKind, raw),
      riskLevel: detectRisk(raw),
      detectedLang: detectLanguage(raw)
    };
  }
}

function stripExtension(fileName: string): string {
  const ext = path.extname(fileName);
  return ext ? fileName.slice(0, -ext.length) : fileName;
}

function inferAssetType(fileName: string, rootKind: ScanRootKind, raw: string): AssetType {
  if (fileName === 'SKILL.md') return 'skill';
  if (agentNames.has(fileName)) return 'agent_file';
  if (rootKind === 'codex_plugins') return 'plugin';
  if (rootKind === 'docs_root') return 'project_doc';
  if (fileName.toLowerCase().endsWith('.md')) return 'markdown_doc';
  if (raw.includes('plugin') && rootKind === 'custom') return 'plugin';
  return 'generic_file';
}

function normalizeTags(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map(String).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

function detectRisk(raw: string): RiskLevel {
  const patterns = [
    /sk-[A-Za-z0-9_-]{20,}/,
    /ghp_[A-Za-z0-9_]{20,}/,
    /xox[baprs]-[A-Za-z0-9-]{20,}/,
    /-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----/,
    /(password|passwd|api[_-]?key|token|secret)\s*[:=]\s*["']?[^"'\s]{8,}/i
  ];
  return patterns.some((pattern) => pattern.test(raw)) ? 'medium' : 'none';
}
