#!/usr/bin/env node
import {
  addFile,
  addRoot,
  doctor,
  exportMigration,
  exportAgentTranslationTask,
  getStatus,
  importAgentTranslationResult,
  importMigration,
  listPendingTranslations,
  runScan,
  searchAssets,
  setTranslatorConfig,
  showAsset,
  translateAssetById,
  translatePending
} from '../core/app-service.js';
import type { ScanRootKind } from '../shared/types.js';

const args = process.argv.slice(2);
const command = args[0] ?? 'help';

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

function option(name: string, fallback?: string): string | undefined {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  return fallback;
}

function print(data: unknown): void {
  if (hasFlag('--json')) {
    console.log(JSON.stringify(data, null, 2));
  } else if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function main(): Promise<void> {
  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'status') {
    print(await getStatus());
    return;
  }

  if (command === 'scan') {
    print(await runScan());
    return;
  }

  if (command === 'doctor') {
    print(await doctor());
    return;
  }

  if (command === 'config' && args[1] === 'list-roots') {
    print((await getStatus()).data);
    return;
  }

  if (command === 'config' && args[1] === 'add-root') {
    const target = args[2];
    const kind = (option('--kind', 'custom') ?? 'custom') as ScanRootKind;
    if (!target) throw new Error('缺少扫描目录路径');
    print(await addRoot(target, kind));
    return;
  }

  if (command === 'config' && args[1] === 'set-translator') {
    const provider = option('--provider', 'noop') as 'noop' | 'openai' | 'openai-compatible';
    print(
      await setTranslatorConfig({
        provider,
        model: option('--model'),
        baseUrl: option('--base-url'),
        targetLang: 'zh-CN',
        apiKeySource: option('--api-key-source')
      })
    );
    return;
  }

  if (command === 'assets' && args[1] === 'search') {
    const query = args.slice(2).filter((item) => !item.startsWith('--')).join(' ');
    print(await searchAssets(query));
    return;
  }

  if (command === 'assets' && args[1] === 'show') {
    const id = args[2];
    if (!id) throw new Error('缺少 asset id');
    print(await showAsset(id));
    return;
  }

  if (command === 'translate' && args[1] === 'list') {
    print(await listPendingTranslations());
    return;
  }

  if (command === 'translate' && args[1] === 'run') {
    const assetId = option('--asset');
    if (assetId) {
      print(await translateAssetById(assetId));
    } else {
      print(await translatePending(Number(option('--limit', '10'))));
    }
    return;
  }

  if (command === 'translate' && args[1] === 'export-task') {
    const output = args[2] ?? option('--output');
    if (!output) throw new Error('缺少翻译任务导出文件路径');
    print(await exportAgentTranslationTask(output, Number(option('--limit', '10'))));
    return;
  }

  if (command === 'translate' && args[1] === 'import-result') {
    const input = args[2] ?? option('--input');
    if (!input) throw new Error('缺少翻译结果文件路径');
    print(await importAgentTranslationResult(input));
    return;
  }

  if (command === 'files' && args[1] === 'add') {
    const target = args[2];
    if (!target) throw new Error('缺少文件路径');
    print(await addFile(target, option('--category', '其他文件')));
    return;
  }

  if (command === 'files' && args[1] === 'translate') {
    const fileId = args[2];
    if (!fileId) throw new Error('缺少 file/asset id');
    print(await translateAssetById(fileId));
    return;
  }

  if (command === 'migrate' && args[1] === 'export') {
    const output = args[2];
    if (!output) throw new Error('缺少导出文件路径');
    print(await exportMigration(output));
    return;
  }

  if (command === 'migrate' && args[1] === 'import') {
    const input = args[2];
    if (!input) throw new Error('缺少导入文件路径');
    print(await importMigration(input));
    return;
  }

  throw new Error(`未知命令: ${args.join(' ')}`);
}

function printHelp(): void {
  console.log(`LuminaLink CLI

Usage:
  luminalink status
  luminalink scan
  luminalink doctor
  luminalink config list-roots
  luminalink config add-root "<path>" --kind project_root
  luminalink config set-translator --provider openai --model gpt-4.1-mini --api-key-source env:OPENAI_API_KEY
  luminalink assets search "<keyword>"
  luminalink assets show "<asset-id>"
  luminalink translate list
  luminalink translate run --pending
  luminalink translate run --asset "<asset-id>"
  luminalink translate export-task "<output-json>" --limit 10
  luminalink translate import-result "<output-json>"
  luminalink files add "<path>" --category "其他文件"
  luminalink files translate "<asset-id>"
  luminalink migrate export "<output-file>"
  luminalink migrate import "<input-file>"

Flags:
  --json  Print machine-readable JSON.
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
