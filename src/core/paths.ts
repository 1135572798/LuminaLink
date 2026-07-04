import os from 'node:os';
import path from 'node:path';

export interface LuminaPaths {
  appDataDir: string;
  localDataDir: string;
  configPath: string;
  indexDbPath: string;
  translationDbPath: string;
  logsDir: string;
}

export function getLuminaPaths(): LuminaPaths {
  const home = os.homedir();
  const appData = process.env.APPDATA ?? path.join(home, '.config');
  const localAppData = process.env.LOCALAPPDATA ?? path.join(home, '.local', 'share');
  const appDataDir = path.join(appData, 'LuminaLink');
  const localDataDir = path.join(localAppData, 'LuminaLink');

  return {
    appDataDir,
    localDataDir,
    configPath: path.join(appDataDir, 'config.json'),
    indexDbPath: path.join(localDataDir, 'luminalink.sqlite'),
    translationDbPath: path.join(localDataDir, 'translation-cache.sqlite'),
    logsDir: path.join(localDataDir, 'logs')
  };
}

export function expandPathExpression(input: string): string {
  const home = os.homedir();
  const replacements: Record<string, string> = {
    USERPROFILE: process.env.USERPROFILE ?? home,
    HOME: process.env.HOME ?? home,
    APPDATA: process.env.APPDATA ?? path.join(home, '.config'),
    LOCALAPPDATA: process.env.LOCALAPPDATA ?? path.join(home, '.local', 'share')
  };

  let expanded = input;
  for (const [key, value] of Object.entries(replacements)) {
    expanded = expanded.replaceAll(`%${key}%`, value);
    expanded = expanded.replaceAll(`$${key}`, value);
  }
  return path.resolve(expanded);
}
