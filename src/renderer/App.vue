<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark"><Link2 :size="26" /></div>
        <div>
          <h1>LuminaLink</h1>
          <p>AI 资产管理 · 开源版</p>
        </div>
      </div>

      <nav class="nav">
        <button
          v-for="item in navItems"
          :key="item.key"
          :class="['nav-item', { active: activeView === item.key }]"
          @click="activeView = item.key as ViewKey"
        >
          <component :is="item.icon" :size="18" />
          <span>{{ item.label }}</span>
          <strong v-if="item.count !== undefined">{{ item.count }}</strong>
        </button>
      </nav>

      <div class="sidebar-footer">
        <div class="provider-box">
          <span>Provider 状态</span>
          <p>
            <i :class="providerConfigured ? 'dot ok' : 'dot warn'"></i>
            {{ providerConfigured ? '已配置' : '未配置' }}
          </p>
        </div>
        <button class="secondary wide" @click="runDoctor">
          <ShieldCheck :size="17" /> 检查环境
        </button>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div class="search">
          <Search :size="18" />
          <input v-model="query" placeholder="搜索 skill、插件、Agent、文件或用途" @input="refreshAssets" />
        </div>
        <button class="secondary" @click="pickAndAddFile"><FilePlus2 :size="17" /> 添加文件</button>
        <button class="secondary" @click="pickAndAddRoot"><FolderPlus :size="17" /> 添加目录</button>
        <button class="primary" :disabled="busy" @click="scanNow">
          <RefreshCw :size="17" :class="{ spin: busy }" /> 扫描资产
        </button>
      </header>

      <div v-if="notice" :class="['notice', notice.kind]">
        <div>
          <strong>{{ notice.title }}</strong>
          <p>{{ notice.detail }}</p>
        </div>
        <button class="ghost" @click="notice = undefined">关闭</button>
      </div>

      <section v-if="activeView === 'overview'" class="content overview">
        <div class="section-title">
          <div>
            <h2>总览</h2>
            <p>当前电脑上的 AI skill、插件、Agent 指令和可翻译文档状态。</p>
          </div>
          <button class="secondary" @click="refreshAll"><RefreshCw :size="16" /> 刷新</button>
        </div>

        <div class="metric-grid">
          <article class="metric">
            <Database :size="26" />
            <span>已索引资产</span>
            <strong>{{ dashboard.assetsTotal }}</strong>
          </article>
          <article class="metric">
            <Languages :size="26" />
            <span>已翻译</span>
            <strong>{{ dashboard.translatedTotal }}</strong>
          </article>
          <article class="metric">
            <Clock3 :size="26" />
            <span>待翻译</span>
            <strong>{{ dashboard.pendingTranslationTotal }}</strong>
          </article>
          <article class="metric warn">
            <TriangleAlert :size="26" />
            <span>风险提示</span>
            <strong>{{ dashboard.riskTotal }}</strong>
          </article>
        </div>

        <div class="panel">
          <div class="panel-head">
            <h3>最近新增</h3>
            <button class="ghost" @click="activeView = 'library'">查看资产库</button>
          </div>
          <div class="recent-list">
            <button v-for="asset in dashboard.recentAssets" :key="asset.id" @click="selectAsset(asset.id)">
              <span>{{ asset.displayName }}</span>
              <em>{{ typeLabel(asset.type) }} · {{ statusLabel(asset.translationStatus) }}</em>
            </button>
            <p v-if="!dashboard.recentAssets?.length" class="empty">还没有资产，点击“扫描资产”开始。</p>
          </div>
        </div>
      </section>

      <section v-else-if="activeView === 'assistant'" class="content assistant-view">
        <div class="section-title">
          <div>
            <h2>Codex 协助</h2>
            <p>把 LuminaLink 的本机操作手册放到固定路径，Codex 新线程也能读取。</p>
          </div>
          <button class="secondary" @click="loadAgentGuide"><RefreshCw :size="16" /> 重新生成</button>
        </div>

        <div class="assistant-grid">
          <article class="panel">
            <div class="panel-head">
              <h3>给 Codex 的提示词</h3>
              <button class="primary" @click="copyAgentPrompt">
                <Copy :size="16" /> {{ promptCopied ? '已复制' : '复制提示词' }}
              </button>
            </div>
            <pre class="prompt-box">{{ agentGuide?.promptText || '正在生成 Agent 操作提示...' }}</pre>
          </article>

          <article class="panel">
            <h3>本机固定文件</h3>
            <div class="path-list">
              <label>Agent 操作手册</label>
              <code>{{ agentGuide?.runbookPath || '生成中...' }}</code>
              <label>配置 helper</label>
              <code>{{ agentGuide?.helperPath || '生成中...' }}</code>
              <label>配置文件</label>
              <code>{{ agentGuide?.configPath || '生成中...' }}</code>
            </div>
            <div class="assistant-actions">
              <button class="secondary" :disabled="!agentGuide" @click="showItem(agentGuide!.runbookPath)">
                <FolderOpen :size="16" /> 定位手册
              </button>
              <button class="secondary" :disabled="!agentGuide" @click="openPath(agentGuide!.runbookPath)">
                <FileText :size="16" /> 打开手册
              </button>
              <button class="secondary" :disabled="!agentGuide" @click="showItem(agentGuide!.helperPath)">
                <SquareTerminal :size="16" /> 定位 helper
              </button>
            </div>
          </article>

          <article class="panel">
            <h3>当前状态</h3>
            <div class="state-list">
              <span>扫描目录</span>
              <strong>{{ agentGuide?.scanRoots.length ?? 0 }} 个</strong>
              <span>Provider</span>
              <strong>{{ agentGuide?.translator.configured ? '已配置' : '未配置' }}</strong>
              <span>Provider 类型</span>
              <strong>{{ agentGuide?.translator.provider || 'unknown' }}</strong>
            </div>
            <p class="hint">扫描资产不需要 Provider；Provider 只影响“翻译此项”和“翻译队列”。</p>
            <div class="assistant-actions">
              <button class="primary" :disabled="busy" @click="scanNow">
                <RefreshCw :size="16" :class="{ spin: busy }" /> 扫描资产
              </button>
              <button class="secondary" @click="runDoctor"><ShieldCheck :size="16" /> 检查环境</button>
            </div>
          </article>
        </div>
      </section>

      <section v-else class="content workspace">
        <div class="asset-pane">
          <div class="tabs">
            <button
              v-for="filterItem in filters"
              :key="filterItem.key"
              :class="{ active: filter === filterItem.key }"
              @click="setFilter(filterItem.key)"
            >
              {{ filterItem.label }}
            </button>
          </div>

          <div v-if="activeView === 'translations'" class="queue-actions">
            <button class="secondary" @click="loadPending">刷新队列</button>
            <button class="primary" :disabled="busy" @click="translatePending">翻译前 10 个</button>
          </div>

          <div v-if="activeView === 'settings'" class="settings-panel">
            <h2>设置</h2>
            <p>扫描目录和 Provider 配置保存在本机 `%APPDATA%/LuminaLink/config.json`。</p>
            <div class="settings-grid">
              <label>
                Provider
                <select v-model="translatorForm.provider">
                  <option value="noop">不翻译</option>
                  <option value="openai">OpenAI</option>
                  <option value="openai-compatible">OpenAI-compatible / 本地模型</option>
                </select>
              </label>
              <label>
                模型
                <input v-model="translatorForm.model" placeholder="gpt-4.1-mini / qwen2.5:7b" />
              </label>
              <label>
                Base URL
                <input v-model="translatorForm.baseUrl" placeholder="http://localhost:11434/v1" />
              </label>
              <label>
                API Key 来源
                <input v-model="translatorForm.apiKeySource" placeholder="env:OPENAI_API_KEY" />
              </label>
              <button class="primary" @click="saveTranslator">保存翻译配置</button>
            </div>
            <div class="doctor-list">
              <div v-for="check in doctorChecks" :key="check.name" :class="['doctor-row', check.status]">
                <span>{{ check.name }}</span>
                <strong>{{ check.status }}</strong>
                <em>{{ check.detail }}</em>
              </div>
            </div>
          </div>

          <div v-else class="asset-list">
            <div v-if="lastScan" class="scan-summary">
              <strong>上次扫描</strong>
              <span>
                新增 {{ lastScan.created }} · 更新 {{ lastScan.updated }} · 未变 {{ lastScan.unchanged }} ·
                失败 {{ lastScan.failed }}
              </span>
            </div>
            <div class="table-head">
              <span>名称</span>
              <span>类型</span>
              <span>翻译</span>
              <span>路径</span>
            </div>
            <button
              v-for="asset in visibleAssets"
              :key="asset.id"
              :class="['asset-row', { selected: selectedAsset?.id === asset.id }]"
              @click="selectAsset(asset.id)"
            >
              <span class="asset-name">
                <component :is="iconForType(asset.type)" :size="18" />
                <span>
                  <strong>{{ asset.displayName }}</strong>
                  <em>{{ asset.originalDescription || asset.sourcePath }}</em>
                </span>
              </span>
              <span>{{ typeLabel(asset.type) }}</span>
              <span :class="['status', asset.translationStatus]">{{ statusLabel(asset.translationStatus) }}</span>
              <span class="path">{{ asset.sourcePath }}</span>
            </button>
            <div v-if="!visibleAssets.length" class="empty-state">
              <Sparkles :size="30" />
              <h3>暂无资产</h3>
              <p>点击“扫描资产”读取本机默认目录；如果你的项目不在默认目录，可以先添加目录。</p>
              <div>
                <button class="primary" :disabled="busy" @click="scanNow">
                  <RefreshCw :size="16" :class="{ spin: busy }" /> 扫描资产
                </button>
                <button class="secondary" @click="pickAndAddRoot"><FolderPlus :size="16" /> 添加目录</button>
              </div>
            </div>
          </div>
        </div>

        <aside class="detail-pane">
          <template v-if="selectedAsset">
            <div class="detail-head">
              <div class="asset-icon"><component :is="iconForType(selectedAsset.type)" :size="24" /></div>
              <div>
                <h2>{{ selectedAsset.displayName }}</h2>
                <p>{{ typeLabel(selectedAsset.type) }} · {{ statusLabel(selectedAsset.translationStatus) }}</p>
              </div>
            </div>

            <div class="detail-tabs">
              <button :class="{ active: detailTab === 'zh' }" @click="detailTab = 'zh'">中文说明</button>
              <button :class="{ active: detailTab === 'source' }" @click="detailTab = 'source'">原文</button>
              <button :class="{ active: detailTab === 'meta' }" @click="detailTab = 'meta'">元数据</button>
            </div>

            <div class="detail-body">
              <article v-if="detailTab === 'zh'" class="markdown">
                <p v-if="selectedAsset.translatedText || selectedAsset.chineseDescription">
                  {{ selectedAsset.translatedText || selectedAsset.chineseDescription }}
                </p>
                <p v-else class="empty">暂无中文译文。可以点击“翻译此项”。</p>
              </article>
              <article v-else-if="detailTab === 'source'" class="markdown source">
                <pre>{{ selectedAsset.sourceText || selectedAsset.originalDescription }}</pre>
              </article>
              <article v-else class="meta-list">
                <label>源路径</label>
                <code>{{ selectedAsset.sourcePath }}</code>
                <label>内容 Hash</label>
                <code>{{ selectedAsset.contentHash }}</code>
                <label>分类</label>
                <p>{{ selectedAsset.categories.join(' / ') || '未分类' }}</p>
                <label>标签</label>
                <p>{{ selectedAsset.tags.join(' / ') || '无' }}</p>
                <label>风险</label>
                <p>{{ selectedAsset.riskLevel }}</p>
              </article>
            </div>

            <div class="detail-actions">
              <button class="secondary" @click="showItem(selectedAsset.sourcePath)">
                <FolderOpen :size="16" /> 定位文件
              </button>
              <button class="secondary" @click="openPath(selectedAsset.sourcePath)">
                <FileText :size="16" /> 打开文件
              </button>
              <button class="primary" :disabled="busy" @click="translateSelected">
                <Languages :size="16" /> 翻译此项
              </button>
            </div>
          </template>
          <div v-else class="empty-detail">
            <Sparkles :size="32" />
            <h2>选择一个资产</h2>
            <p>右侧会显示中文说明、原文、路径、分类和翻译状态。</p>
          </div>
        </aside>
      </section>

      <footer class="logbar">
        <span>{{ statusMessage }}</span>
        <strong>{{ busy ? '运行中' : '就绪' }}</strong>
      </footer>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import {
  Bot,
  Clock3,
  Copy,
  Database,
  FilePlus2,
  FileText,
  FolderOpen,
  FolderPlus,
  Languages,
  LayoutDashboard,
  Library,
  Link2,
  Package,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SquareTerminal,
  Sparkles,
  Text,
  TriangleAlert
} from 'lucide-vue-next';
import type { Asset, DashboardSummary, DoctorCheck } from '../shared/types';
import type { AgentGuideInfo, ScanSummary } from '../shared/types';

type ViewKey = 'overview' | 'library' | 'translations' | 'agents' | 'files' | 'migration' | 'settings' | 'assistant';
type DetailedAsset = Asset & { sourceText?: string; translatedText?: string };
type NoticeKind = 'success' | 'warning' | 'error' | 'info';

const fallbackDashboard: DashboardSummary = {
  assetsTotal: 0,
  translatedTotal: 0,
  pendingTranslationTotal: 0,
  staleTranslationTotal: 0,
  failedTotal: 0,
  riskTotal: 0,
  recentAssets: []
};

const activeView = ref<ViewKey>('library');
const query = ref('');
const filter = ref('all');
const busy = ref(false);
const statusMessage = ref('正在初始化 LuminaLink...');
const providerConfigured = ref(false);
const assets = ref<Asset[]>([]);
const selectedAsset = ref<DetailedAsset | undefined>();
const notice = ref<{ kind: NoticeKind; title: string; detail: string } | undefined>();
const lastScan = ref<ScanSummary | undefined>();
const agentGuide = ref<AgentGuideInfo | undefined>();
const promptCopied = ref(false);
const detailTab = ref<'zh' | 'source' | 'meta'>('zh');
const doctorChecks = ref<DoctorCheck[]>([]);
const translatorForm = reactive({
  provider: 'noop',
  model: '',
  baseUrl: '',
  apiKeySource: ''
});
const dashboard = reactive<DashboardSummary>({ ...fallbackDashboard });

const filters = [
  { key: 'all', label: '全部' },
  { key: 'skill', label: 'Skill' },
  { key: 'plugin', label: 'Plugin' },
  { key: 'agent_file', label: 'Agent' },
  { key: 'generic_file', label: '其他文件' },
  { key: 'untranslated', label: '未翻译' }
];

const navItems = computed(() => [
  { key: 'overview', label: '总览', icon: LayoutDashboard },
  { key: 'library', label: '资产库', icon: Library, count: dashboard.assetsTotal },
  { key: 'translations', label: '翻译队列', icon: Languages, count: dashboard.pendingTranslationTotal },
  { key: 'agents', label: '项目 Agent', icon: Bot },
  { key: 'files', label: '其他文件', icon: FileText },
  { key: 'assistant', label: 'Codex 协助', icon: Bot },
  { key: 'migration', label: '迁移备份', icon: Package },
  { key: 'settings', label: '设置', icon: Settings }
]);

const visibleAssets = computed(() => {
  if (activeView.value === 'translations') {
    return assets.value.filter((asset) => ['none', 'stale', 'failed'].includes(asset.translationStatus));
  }
  if (activeView.value === 'agents') {
    return assets.value.filter((asset) => asset.type === 'agent_file');
  }
  if (activeView.value === 'files') {
    return assets.value.filter((asset) =>
      ['generic_file', 'markdown_doc', 'text_doc', 'project_doc'].includes(asset.type)
    );
  }
  return assets.value;
});

onMounted(async () => {
  await refreshAll();
  await loadAgentGuide();
});

async function refreshAll(): Promise<void> {
  try {
    await Promise.all([loadStatus(), refreshDashboard(), refreshAssets()]);
    statusMessage.value = 'LuminaLink 已就绪';
  } catch (error) {
    const message = messageFromError(error);
    statusMessage.value = `初始化失败：${message}`;
    showNotice('error', '初始化失败', message);
  }
}

async function loadStatus(): Promise<void> {
  const result = await window.lumina?.status();
  providerConfigured.value = Boolean(result?.data?.translator?.configured);
  translatorForm.provider = result?.data?.translator?.provider ?? 'noop';
}

async function refreshDashboard(): Promise<void> {
  const result = await window.lumina?.dashboard();
  Object.assign(dashboard, result ?? fallbackDashboard);
}

async function refreshAssets(): Promise<void> {
  const result = (await window.lumina?.assets(query.value, filter.value)) as Asset[] | undefined;
  assets.value = result ?? [];
}

async function scanNow(): Promise<void> {
  busy.value = true;
  statusMessage.value = '正在扫描本机资产...';
  showNotice('info', '正在扫描资产', '正在读取默认目录和已添加目录，请稍候。扫描不依赖翻译 Provider。');
  try {
    const result = await window.lumina?.scan();
    if (!result) throw new Error('客户端 IPC 未返回扫描结果');
    lastScan.value = result;
    await Promise.all([refreshDashboard(), refreshAssets(), loadStatus()]);
    const changed = result.created + result.updated + result.removed;
    const detail = `新增 ${result.created}，更新 ${result.updated}，未变 ${result.unchanged}，移除 ${result.removed}，失败 ${result.failed}。`;
    statusMessage.value = `扫描完成：${detail}`;
    showNotice(
      result.failed ? 'warning' : changed || result.unchanged ? 'success' : 'warning',
      '扫描完成',
      result.created + result.updated + result.unchanged > 0
        ? detail
        : `${detail}没有发现资产。请确认本机存在 Codex skills/plugins，或点击“添加目录”。`
    );
  } catch (error) {
    const message = messageFromError(error);
    statusMessage.value = `扫描失败：${message}`;
    showNotice('error', '扫描失败', message);
  } finally {
    busy.value = false;
  }
}

function setFilter(next: string): void {
  filter.value = next;
  void refreshAssets();
}

async function selectAsset(id: string): Promise<void> {
  activeView.value = activeView.value === 'overview' ? 'library' : activeView.value;
  const result = (await window.lumina?.asset(id)) as DetailedAsset | undefined;
  selectedAsset.value = result;
  detailTab.value = result?.translatedText || result?.chineseDescription ? 'zh' : 'source';
}

async function translateSelected(): Promise<void> {
  if (!selectedAsset.value) return;
  busy.value = true;
  statusMessage.value = `正在翻译：${selectedAsset.value.displayName}`;
  try {
    const result = await window.lumina?.translateAsset(selectedAsset.value.id);
    statusMessage.value = result?.message ?? '翻译任务已结束';
    await selectAsset(selectedAsset.value.id);
    await refreshAll();
  } finally {
    busy.value = false;
  }
}

async function translatePending(): Promise<void> {
  busy.value = true;
  statusMessage.value = '正在翻译队列中的前 10 个资产...';
  try {
    const result = await window.lumina?.translatePending(10);
    statusMessage.value = result?.message ?? '翻译队列已处理';
    await refreshAll();
  } finally {
    busy.value = false;
  }
}

async function loadPending(): Promise<void> {
  const result = (await window.lumina?.pendingTranslations()) as Asset[] | undefined;
  assets.value = result ?? [];
}

async function pickAndAddFile(): Promise<void> {
  const filePath = await window.lumina?.pickFile();
  if (!filePath) return;
  busy.value = true;
  try {
    const result = await window.lumina?.addFile(filePath, '其他文件');
    statusMessage.value = `文件已加入：新增 ${result?.created ?? 0}，更新 ${result?.updated ?? 0}`;
    await refreshAll();
  } finally {
    busy.value = false;
  }
}

async function pickAndAddRoot(): Promise<void> {
  const directory = await window.lumina?.pickDirectory();
  if (!directory) return;
  await window.lumina?.addRoot(directory, 'project_root');
  statusMessage.value = `已添加扫描目录：${directory}`;
  await scanNow();
}

async function runDoctor(): Promise<void> {
  const report = await window.lumina?.doctor();
  doctorChecks.value = report?.checks ?? [];
  activeView.value = 'settings';
  const failed = doctorChecks.value.filter((item) => item.status === 'fail').length;
  const warned = doctorChecks.value.filter((item) => item.status === 'warn').length;
  statusMessage.value = `环境检查完成：失败 ${failed}，警告 ${warned}`;
  showNotice(failed ? 'error' : warned ? 'warning' : 'success', '环境检查完成', `失败 ${failed}，警告 ${warned}`);
}

async function saveTranslator(): Promise<void> {
  const result = await window.lumina?.setTranslator({
    provider: translatorForm.provider,
    model: translatorForm.model || undefined,
    baseUrl: translatorForm.baseUrl || undefined,
    targetLang: 'zh-CN',
    apiKeySource: translatorForm.apiKeySource || undefined
  });
  statusMessage.value = result?.message ?? '翻译配置已保存';
  await loadStatus();
  await loadAgentGuide();
}

async function loadAgentGuide(): Promise<void> {
  try {
    if (!window.lumina?.agentGuide) {
      throw new Error('当前不是 Electron 桌面运行环境，无法生成本机 Agent 手册。');
    }
    const result = await window.lumina?.agentGuide();
    agentGuide.value = result?.data;
  } catch (error) {
    showNotice('error', 'Agent 手册生成失败', messageFromError(error));
  }
}

async function copyAgentPrompt(): Promise<void> {
  if (!agentGuide.value?.promptText) return;
  await navigator.clipboard.writeText(agentGuide.value.promptText);
  promptCopied.value = true;
  showNotice('success', '已复制给 Codex 的提示词', '新开 Codex 对话时粘贴这段话，它会先读取本机 Agent 操作手册。');
  window.setTimeout(() => {
    promptCopied.value = false;
  }, 1800);
}

async function openPath(target: string): Promise<void> {
  await window.lumina?.openPath(target);
}

async function showItem(target: string): Promise<void> {
  await window.lumina?.showItem(target);
}

function iconForType(type: Asset['type']) {
  if (type === 'skill') return Sparkles;
  if (type === 'plugin') return Package;
  if (type === 'agent_file') return Bot;
  if (type === 'project_doc') return FileText;
  return Text;
}

function typeLabel(type: Asset['type']): string {
  const labels: Record<Asset['type'], string> = {
    skill: 'Skill',
    plugin: 'Plugin',
    agent_file: 'Agent',
    project_doc: '项目文档',
    generic_file: '其他文件',
    markdown_doc: 'Markdown',
    text_doc: '文本'
  };
  return labels[type];
}

function statusLabel(status: Asset['translationStatus']): string {
  const labels: Record<Asset['translationStatus'], string> = {
    none: '未翻译',
    translated: '已翻译',
    stale: '已过期',
    failed: '失败'
  };
  return labels[status];
}

function showNotice(kind: NoticeKind, title: string, detail: string): void {
  notice.value = { kind, title, detail };
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
</script>
