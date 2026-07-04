import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const tempOut = path.join(tmpdir(), 'LuminaLinkBuilder', version);
const releaseOut = path.join(root, 'release', version);
const builderArgs = [
  'exec',
  'electron-builder',
  '--win',
  'nsis',
  'portable',
  '--x64',
  `--config.directories.output=${tempOut}`
];
const pnpmEntrypoint = process.env.npm_execpath;
const command = pnpmEntrypoint ? process.execPath : process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const args = pnpmEntrypoint ? [pnpmEntrypoint, ...builderArgs] : builderArgs;

rmSync(tempOut, { recursive: true, force: true });
rmSync(releaseOut, { recursive: true, force: true });
mkdirSync(tempOut, { recursive: true });
mkdirSync(releaseOut, { recursive: true });

const result = spawnSync(
  command,
  args,
  {
    cwd: root,
    stdio: 'inherit',
    shell: !pnpmEntrypoint && process.platform === 'win32'
  }
);

if (result.status !== 0) {
  if (result.error) {
    console.error(result.error);
  }
  process.exit(result.status ?? 1);
}

const artifactPattern = /^LuminaLink-.+\.(exe|blockmap)$/i;
for (const name of readdirSync(tempOut)) {
  if (artifactPattern.test(name) || name === 'latest.yml') {
    copyFileSync(path.join(tempOut, name), path.join(releaseOut, name));
  }
}

const setup = path.join(releaseOut, `LuminaLink-Setup-${version}-x64.exe`);
const portable = path.join(releaseOut, `LuminaLink-Portable-${version}-x64.exe`);

if (!existsSync(setup) || !existsSync(portable)) {
  throw new Error(`Expected installer and portable artifacts were not created in ${releaseOut}`);
}

console.log(`Windows artifacts copied to ${releaseOut}`);
