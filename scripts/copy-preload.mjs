import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(path.join(root, 'dist', 'main'), { recursive: true });
copyFileSync(path.join(root, 'src', 'main', 'preload.cjs'), path.join(root, 'dist', 'main', 'preload.cjs'));
