import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function readUtf8(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf8');
}

export async function getFileHash(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function hashText(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function normalizeSlashes(input: string): string {
  return input.replaceAll(path.sep, '/');
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function makeId(prefix: string, seed?: string): string {
  if (seed) {
    return `${prefix}_${crypto.createHash('sha1').update(seed).digest('hex').slice(0, 16)}`;
  }
  return `${prefix}_${crypto.randomUUID()}`;
}
