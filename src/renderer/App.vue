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
          :title="item.count !== undefined ? `${item.label}：${item.count}` : item.label"
          @click="setActiveView(item.key as ViewKey)"
        >
          <component :is="item.icon" :size="18" />
          <span>{{ item.label }}</span>
          <strong v-if="item.count !== undefined">{{ item.count }}</strong>
        </button>
      </nav>

      <div class="sidebar-footer">
        <div class="provider-box">
          <span>Provider 配置</span>
          <p>
            <i :class="providerConfigured ? 'dot ok' : 'dot warn'"></i>
            {{ providerConfigured ? '已配置' : '未配置' }}
          </p>
        </div>
        <button class="secondary wide" :disabled="busy" title="检查配置、索引和扫描目录状态" @click="runDoctor">
          <ShieldCheck :size="17" :class="{ spin: isBusy('doctor') }" />
          {{ isBusy('doctor') ? '检查中' : '检查环境' }}
        </button>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div class="search">
          <Search :size="18" />
          <input v-model="query" placeholder="搜索 skill、插件、Agent、文件或用途" @input="refreshAssets" />
        </div>
        <button class="secondary" :disabled="busy" title="把单个文件加入资产库" @click="pickAndAddFile">
          <FilePlus2 :size="17" /> 添加文件
        </button>
        <button class="secondary" :disabled="busy" title="把目录加入扫描范围并立即扫描" @click="pickAndAddRoot">
          <FolderPlus :size="17" /> 添加目录
        </button>
        <button class="primary" :disabled="busy" title="扫描默认目录和已添加目录，并立即刷新左侧统计" @click="scanNow">
          <RefreshCw :size="17" :class="{ spin: isBusy('scan') }" />
          {{ isBusy('scan') ? '扫描中' : '扫描资产' }}
        </button>
      </header>

      <div v-if="notice" :class="['notice', notice.kind]">
        <div>
          <strong>{{ notice.title }}</strong>
          <p>{{ notice.detail }}</p>
        </div>
        <button class="ghost" title="关闭提示" @click="notice = undefined">关闭</button>
      </div>

      <section v-if="activeView === 'overview'" class="content overview">
        <div class="section-title">
          <div>
            <h2>总览</h2>
            <p>当前电脑上的 AI skill、插件、Agent 指令和可翻译文档状态。</p>
          </div>
          <button class="secondary" :disabled="busy" title="刷新左侧统计、当前列表和配置状态" @click="refreshNow">
            <RefreshCw :size="16" :class="{ spin: isBusy('refresh') }" />
            {{ isBusy('refresh') ? '刷新中' : '刷新' }}
          </button>
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
            <button class="ghost" title="进入资产库" @click="setActiveView('library')">查看资产库</button>
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
          <button class="secondary" :disabled="busy" title="重新生成本机 Codex 操作手册" @click="regenerateAgentGuide">
            <RefreshCw :size="16" :class="{ spin: isBusy('agent-guide') }" />
            {{ isBusy('agent-guide') ? '生成中' : '重新生成' }}
          </button>
        </div>

        <div class="assistant-grid">
          <article class="panel">
            <div class="panel-head">
              <h3>给 Codex 的提示词</h3>
              <button class="primary" title="复制给 Codex 新线程使用的提示词" @click="copyAgentPrompt">
                <Copy :size="16" /> {{ promptCopied ? '已复制' : '复制提示词' }}
              </button>
            </div>
            <pre class="prompt-box">{{ agentGuide?.promptText || fallbackAgentPrompt }}</pre>
          </article>

          <article class="panel">
            <h3>本机固定文件</h3>
            <div class="path-list">
              <label>Agent 操作手册</label>
              <code>{{ agentGuide?.runbookPath || '%APPDATA%/LuminaLink/AGENT_RUNBOOK.md' }}</code>
              <label>配置 helper</label>
              <code>{{ agentGuide?.helperPath || '%APPDATA%/LuminaLink/LuminaLink-Agent.ps1' }}</code>
              <label>配置文件</label>
              <code>{{ agentGuide?.configPath || '%APPDATA%/LuminaLink/config.json' }}</code>
            </div>
            <div class="assistant-actions">
              <button class="secondary" :disabled="!agentGuide" title="在资源管理器中定位 Agent 手册" @click="showItem(agentGuide!.runbookPath)">
                <FolderOpen :size="16" /> 定位手册
              </button>
              <button class="secondary" :disabled="!agentGuide" title="打开 Agent 操作手册" @click="openPath(agentGuide!.runbookPath)">
                <FileText :size="16" /> 打开手册
              </button>
              <button class="secondary" :disabled="!agentGuide" title="定位辅助脚本" @click="showItem(agentGuide!.helperPath)">
                <SquareTerminal :size="16" /> 定位 helper
              </button>
            </div>
          </article>

          <article class="panel">
            <h3>当前状态</h3>
            <div class="state-list">
              <span>扫描目录</span>
              <strong>{{ agentGuide ? `${agentGuide.scanRoots.length} 个` : '等待连接' }}</strong>
              <span>Provider</span>
              <strong>{{ agentGuide ? (agentGuide.translator.configured ? '已配置' : '未配置') : '等待连接' }}</strong>
              <span>Provider 类型</span>
              <strong>{{ agentGuide?.translator.provider || '等待连接' }}</strong>
            </div>
            <p class="hint">扫描资产不需要 Provider；Provider 只影响“翻译此项”和“翻译队列”。</p>
            <div class="assistant-actions">
              <button class="primary" :disabled="busy" title="扫描资产并刷新统计" @click="scanNow">
                <RefreshCw :size="16" :class="{ spin: isBusy('scan') }" />
                {{ isBusy('scan') ? '扫描中' : '扫描资产' }}
              </button>
              <button class="secondary" :disabled="busy" title="检查当前环境" @click="runDoctor">
                <ShieldCheck :size="16" :class="{ spin: isBusy('doctor') }" />
                {{ isBusy('doctor') ? '检查中' : '检查环境' }}
              </button>
            </div>
          </article>
        </div>
      </section>

      <section
        v-else
        ref="workspaceRef"
        :class="['content', 'workspace', { 'settings-workspace': activeView === 'settings' }]"
        :style="{ '--detail-width': `${detailPaneWidth}px` }"
      >
        <div class="asset-pane">
          <div v-if="showFilterTabs" class="tabs">
            <button
              v-for="filterItem in filters"
              :key="filterItem.key"
              :class="{ active: filter === filterItem.key }"
              @click="setFilter(filterItem.key)"
            >
              {{ filterItem.label }}
            </button>
          </div>
          <div v-else-if="categoryHeader" class="category-header">
            <div>
              <h2>{{ categoryHeader.title }}</h2>
              <p>{{ categoryHeader.description }}</p>
            </div>
            <strong>{{ visibleAssets.length }}</strong>
          </div>

          <div v-if="activeView === 'translations'" class="queue-actions">
            <button class="secondary" :disabled="busy" title="刷新待翻译队列和左侧数量" @click="loadPending">
              <RefreshCw :size="16" :class="{ spin: isBusy('pending') }" />
              {{ isBusy('pending') ? '刷新中' : '刷新队列' }}
            </button>
            <button class="primary" :disabled="busy" title="翻译队列前 10 个资产" @click="translatePending">
              <Languages :size="16" />
              {{ isBusy('translate-pending') ? '翻译中' : '翻译前 10 个' }}
            </button>
          </div>

          <div v-if="activeView === 'settings'" class="settings-panel">
            <h2>设置</h2>
            <p>扫描目录和 Provider 配置会永久保存在本机 `%APPDATA%/LuminaLink/config.json`。</p>
            <div class="settings-grid">
              <label>
                翻译服务
                <select v-model="translatorForm.provider" @change="applyProviderPreset">
                  <option
                    v-for="preset in providerOptions"
                    :key="preset.provider"
                    :value="preset.provider"
                  >
                    {{ preset.label }}
                  </option>
                </select>
              </label>
              <label>
                模型
                <select
                  v-if="selectedProviderPreset.modelOptions.length"
                  v-model="translatorForm.model"
                  :disabled="translatorForm.provider === 'noop'"
                >
                  <option
                    v-for="model in selectedProviderPreset.modelOptions"
                    :key="model"
                    :value="model"
                  >
                    {{ model }}
                  </option>
                </select>
                <input
                  v-else
                  v-model="translatorForm.model"
                  :disabled="translatorForm.provider === 'noop'"
                  placeholder="qwen2.5:7b"
                />
              </label>
              <label>
                Base URL
                <input
                  v-model="translatorForm.baseUrl"
                  :disabled="!selectedProviderPreset.baseUrlEditable || translatorForm.provider === 'noop'"
                  :placeholder="selectedProviderPreset.baseUrl || 'http://localhost:11434/v1'"
                />
              </label>
              <label>
                API Key
                <span class="secret-field">
                  <input
                    v-model="translatorForm.apiKeySource"
                    :type="showApiKey ? 'text' : 'password'"
                    list="api-key-source-options"
                    :disabled="translatorForm.provider === 'noop'"
                    :placeholder="selectedProviderPreset.defaultApiKeySource || '可留空'"
                    autocomplete="off"
                    spellcheck="false"
                  />
                  <button
                    type="button"
                    class="icon-button"
                    :disabled="translatorForm.provider === 'noop'"
                    :title="showApiKey ? '隐藏 API Key' : '显示 API Key'"
                    @click="showApiKey = !showApiKey"
                  >
                    <EyeOff v-if="showApiKey" :size="16" />
                    <Eye v-else :size="16" />
                  </button>
                </span>
                <small class="field-note">
                  `env:DEEPSEEK_API_KEY` 表示从系统环境变量读取；要本机保存 Key，请直接粘贴真实 API Key 后保存。
                </small>
              </label>
              <datalist id="api-key-source-options">
                <option value="env:OPENAI_API_KEY" />
                <option value="env:DEEPSEEK_API_KEY" />
              </datalist>
              <div class="settings-help">
                <strong>{{ selectedProviderPreset.label }}</strong>
                <span>{{ selectedProviderPreset.hint }}</span>
              </div>
              <button class="primary" :disabled="isBusy('save-settings')" title="立即把翻译配置保存到本机配置文件" @click="saveTranslator">
                <RefreshCw v-if="isBusy('save-settings')" :size="16" class="spin" />
                {{ isBusy('save-settings') ? '保存中' : '立即保存' }}
              </button>
              <span class="save-state">{{ settingsSaveState }}</span>
            </div>
            <div class="doctor-list">
              <div v-for="check in doctorChecks" :key="check.name" :class="['doctor-row', check.status]">
                <span>{{ check.name }}</span>
                <strong>{{ check.status }}</strong>
                <em>{{ check.detail }}</em>
              </div>
            </div>
          </div>

          <div v-else class="asset-list" @scroll="closeFloatingLayers" @mouseleave="hideDescriptionTooltip">
            <div v-if="lastScan" class="scan-summary">
              <strong>上次扫描</strong>
              <span>
                新增 {{ lastScan.created }} · 更新 {{ lastScan.updated }} · 未变 {{ lastScan.unchanged }} ·
                失败 {{ lastScan.failed }}
              </span>
            </div>
            <div v-if="visibleAssets.length" class="list-toolbar">
              <span>{{ visibleAssets.length }} 个资产</span>
              <button
                class="secondary selection-mode-button"
                :class="{ active: selectionMode }"
                :disabled="busy"
                :title="selectionMode ? '退出多选模式并清空选择' : '进入多选模式'"
                @click="toggleSelectionMode"
              >
                <X v-if="selectionMode" :size="16" />
                <CheckSquare v-else :size="16" />
                {{ selectionMode ? '退出多选' : '多选' }}
              </button>
            </div>
            <div v-if="selectionMode" class="bulk-actions">
              <strong>{{ selectedAssetCount ? `已选择 ${selectedAssetCount} 个` : '多选模式' }}</strong>
              <span>
                {{ selectedAssetCount ? '可以只翻译需要的资产，或者把不需要的项标记为跳过。' : '勾选需要批量处理的资产。' }}
              </span>
              <button class="secondary" :disabled="busy" title="选择或取消当前列表所有资产" @click="toggleVisibleSelection">
                <CheckSquare v-if="allVisibleSelected" :size="16" />
                <Square v-else :size="16" />
                {{ allVisibleSelected ? '取消全选' : '全选当前列表' }}
              </button>
              <button class="secondary" :disabled="busy || !selectedAssetCount" title="清空当前选择" @click="clearVisibleSelection">清空选择</button>
              <button class="secondary" :disabled="busy || !selectedAssetCount" title="把选中资产标记为已跳过" @click="skipSelectedTranslations">
                <Ban :size="16" /> 跳过翻译
              </button>
              <button class="primary" :disabled="busy || !selectedAssetCount" title="只翻译选中的资产" @click="translateSelectedBatch">
                <Languages :size="16" />
                {{ isBusy('translate-selected') ? '翻译中' : '翻译选中项' }}
              </button>
            </div>
            <div :class="['table-head', { 'selection-mode': selectionMode }]">
              <button
                v-if="selectionMode"
                class="select-toggle"
                :class="{ active: allVisibleSelected }"
                :title="allVisibleSelected ? '取消选择当前列表' : '选择当前列表'"
                @click="toggleVisibleSelection"
              >
                <CheckSquare v-if="allVisibleSelected" :size="17" />
                <Square v-else :size="17" />
              </button>
              <span>名称</span>
              <span>类型</span>
              <span>翻译</span>
              <span>路径</span>
            </div>
            <div
              v-for="asset in visibleAssets"
              :key="asset.id"
              :class="[
                'asset-row',
                {
                  selected: selectedAsset?.id === asset.id,
                  checked: selectionMode && selectedAssetIds.has(asset.id),
                  'context-open': contextMenu.asset?.id === asset.id,
                  'selection-mode': selectionMode
                }
              ]"
              role="button"
              tabindex="0"
              @click="selectAsset(asset.id)"
              @contextmenu.prevent="openAssetContextMenu($event, asset)"
              @keydown.enter="selectAsset(asset.id)"
            >
              <button
                v-if="selectionMode"
                type="button"
                class="row-check"
                :class="{ active: selectedAssetIds.has(asset.id) }"
                :title="selectedAssetIds.has(asset.id) ? '取消选择' : '选择资产'"
                @click.stop="toggleAssetSelection(asset.id)"
              >
                <CheckSquare v-if="selectedAssetIds.has(asset.id)" :size="17" />
                <Square v-else :size="17" />
              </button>
              <span class="asset-name">
                <span :class="['asset-type-icon', `asset-type-icon--${asset.type}`]" aria-hidden="true">
                  <component :is="iconForType(asset.type)" />
                </span>
                <span
                  class="asset-copy"
                  @mouseenter="showDescriptionTooltip($event, asset)"
                  @mousemove="moveDescriptionTooltip"
                  @mouseleave="hideDescriptionTooltip"
                >
                  <strong>{{ asset.displayName }}</strong>
                  <em>{{ assetPreviewText(asset) }}</em>
                </span>
              </span>
              <span>{{ typeLabel(asset.type) }}</span>
              <span :class="['status', asset.translationStatus]">{{ statusLabel(asset.translationStatus) }}</span>
              <span class="path">{{ asset.sourcePath }}</span>
            </div>
            <div v-if="!visibleAssets.length" class="empty-state">
              <Sparkles :size="30" />
              <h3>暂无资产</h3>
              <p>点击“扫描资产”读取本机默认目录；如果你的项目不在默认目录，可以先添加目录。</p>
              <div>
                <button class="primary" :disabled="busy" title="扫描默认目录和已添加目录" @click="scanNow">
                  <RefreshCw :size="16" :class="{ spin: isBusy('scan') }" />
                  {{ isBusy('scan') ? '扫描中' : '扫描资产' }}
                </button>
                <button class="secondary" :disabled="busy" title="添加一个新的扫描目录" @click="pickAndAddRoot"><FolderPlus :size="16" /> 添加目录</button>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="showDetailPane"
          class="pane-resizer"
          role="separator"
          aria-label="调整详情区域宽度"
          @pointerdown="startDetailResize"
        ></div>

        <aside v-if="showDetailPane" class="detail-pane">
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
                <div v-if="liveTranslation?.assetId === selectedAsset.id && liveTranslation.phase === 'delta'" class="live-note">
                  <RefreshCw :size="14" class="spin" />
                  正在生成译文，内容会实时写入这里。
                </div>
                <div v-if="selectedAsset.translationStatus === 'failed' && selectedAsset.translationError" class="error-note">
                  <strong>上次翻译失败</strong>
                  <p>{{ selectedAsset.translationError }}</p>
                </div>
                <div v-if="selectedAsset.translationStatus === 'stale'" class="stale-note">
                  <strong>源文件已更新</strong>
                  <p>当前中文说明可能来自旧版本。可以点击“重新翻译”生成最新译文。</p>
                </div>
                <p v-if="selectedZhText">
                  {{ selectedZhText }}
                </p>
                <p v-else class="empty">暂无中文译文。可以点击“翻译此项”。</p>
              </article>
              <article v-else-if="detailTab === 'source'" class="markdown source">
                <pre>{{ selectedSourceText }}</pre>
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
              <button class="secondary" title="在资源管理器中定位源文件" @click="showItem(selectedAsset.sourcePath)">
                <FolderOpen :size="16" /> 定位文件
              </button>
              <button class="secondary" title="用系统默认程序打开源文件" @click="openPath(selectedAsset.sourcePath)">
                <FileText :size="16" /> 打开文件
              </button>
              <button class="secondary reader-button" title="在独立阅读窗口查看当前内容" @click="openReaderWindow">
                <BookOpen :size="16" /> 阅读窗口
              </button>
              <button class="primary" :disabled="busy" title="翻译或重新翻译当前资产" @click="translateSelected">
                <Languages :size="16" />
                {{ isBusy('translate') ? '翻译中' : selectedAsset.translationStatus === 'stale' ? '重新翻译' : '翻译此项' }}
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

    <div
      v-if="descriptionTooltip.visible"
      class="description-tooltip"
      :style="descriptionTooltipStyle"
    >
      <strong>{{ descriptionTooltip.label }}</strong>
      <p>{{ descriptionTooltip.text }}</p>
    </div>

    <nav
      v-if="contextMenu.visible && contextMenu.asset"
      class="asset-context-menu"
      :style="contextMenuStyle"
      role="menu"
      @click.stop
      @contextmenu.prevent
    >
      <header>
        <strong>{{ contextMenu.asset.displayName }}</strong>
        <span>{{ typeLabel(contextMenu.asset.type) }} · {{ statusLabel(contextMenu.asset.translationStatus) }}</span>
      </header>
      <button role="menuitem" :disabled="busy" @click="translateContextAsset">
        <Languages :size="16" /> {{ contextMenuTranslateLabel }}
      </button>
      <button role="menuitem" @click="openReaderForContextAsset">
        <BookOpen :size="16" /> 阅读窗口
      </button>
      <button role="menuitem" @click="openContextAsset">
        <FileText :size="16" /> 打开文件
      </button>
      <button role="menuitem" @click="showContextAsset">
        <FolderOpen :size="16" /> 定位文件
      </button>
      <hr />
      <button role="menuitem" :disabled="busy || !contextMenuCanSkip" @click="skipContextAsset">
        <Ban :size="16" /> 跳过翻译
      </button>
      <button role="menuitem" @click="copyContextAssetPath">
        <Copy :size="16" /> 复制路径
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import {
  Ban,
  BookOpen,
  Bot,
  CheckSquare,
  Clock3,
  Copy,
  Database,
  Eye,
  EyeOff,
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
  Square,
  SquareTerminal,
  Sparkles,
  Text,
  TriangleAlert,
  X
} from 'lucide-vue-next';
import type { Asset, DashboardSummary, DoctorCheck } from '../shared/types';
import type { AgentGuideInfo, ReaderWindowPayload, ScanSummary, TranslationProgressEvent, TranslatorConfig } from '../shared/types';
import { getTranslatorPreset, translatorProviderPresets } from '../shared/provider-presets';
import { toPreviewText, toReadableText } from '../shared/readable-text';

type ViewKey =
  | 'overview'
  | 'library'
  | 'skills'
  | 'plugins'
  | 'agents'
  | 'files'
  | 'translations'
  | 'migration'
  | 'settings'
  | 'assistant';
type DetailedAsset = Asset & { sourceText?: string; translatedText?: string; translationError?: string };
type NoticeKind = 'success' | 'warning' | 'error' | 'info';
type BusyTask =
  | 'refresh'
  | 'scan'
  | 'pending'
  | 'translate'
  | 'translate-pending'
  | 'translate-selected'
  | 'skip'
  | 'doctor'
  | 'add-file'
  | 'add-root'
  | 'agent-guide'
  | 'save-settings';
type LiveTranslationState = {
  assetId: string;
  phase: TranslationProgressEvent['phase'];
  text: string;
  message?: string;
};

const fallbackDashboard: DashboardSummary = {
  assetsTotal: 0,
  skillTotal: 0,
  pluginTotal: 0,
  agentTotal: 0,
  fileTotal: 0,
  translatedTotal: 0,
  pendingTranslationTotal: 0,
  staleTranslationTotal: 0,
  failedTotal: 0,
  skippedTotal: 0,
  riskTotal: 0,
  recentAssets: []
};

const activeView = ref<ViewKey>('library');
const query = ref('');
const filter = ref('all');
const busy = ref(false);
const busyTask = ref<BusyTask | undefined>();
const statusMessage = ref('正在初始化 LuminaLink...');
const providerConfigured = ref(false);
const assets = ref<Asset[]>([]);
const selectedAsset = ref<DetailedAsset | undefined>();
const selectedAssetIds = ref<Set<string>>(new Set());
const selectionMode = ref(false);
const contextMenu = reactive<{ visible: boolean; x: number; y: number; asset?: Asset }>({
  visible: false,
  x: 0,
  y: 0,
  asset: undefined
});
const descriptionTooltip = reactive<{ visible: boolean; x: number; y: number; label: string; text: string }>({
  visible: false,
  x: 0,
  y: 0,
  label: '',
  text: ''
});
const workspaceRef = ref<HTMLElement | undefined>();
const notice = ref<{ kind: NoticeKind; title: string; detail: string } | undefined>();
const lastScan = ref<ScanSummary | undefined>();
const agentGuide = ref<AgentGuideInfo | undefined>();
const promptCopied = ref(false);
const detailTab = ref<'zh' | 'source' | 'meta'>('zh');
const doctorChecks = ref<DoctorCheck[]>([]);
const detailPaneWidth = ref(readSavedDetailPaneWidth());
const liveTranslation = ref<LiveTranslationState | undefined>();
const showApiKey = ref(false);
const providerOptions = translatorProviderPresets;
const settingsSaveState = ref('配置会自动保存到本机');
const settingsHydrated = ref(false);
let settingsSaveTimer: ReturnType<typeof window.setTimeout> | undefined;
let stopTranslationProgress: (() => void) | undefined;
const translatorForm = reactive<TranslatorConfig>({
  provider: 'noop',
  model: '',
  baseUrl: '',
  targetLang: 'zh-CN',
  apiKeySource: ''
});
const dashboard = reactive<DashboardSummary>({ ...fallbackDashboard });
const fallbackAgentPrompt = `请帮我配置 LuminaLink。

请先读取这台电脑上的 LuminaLink Agent 操作手册：
%APPDATA%/LuminaLink/AGENT_RUNBOOK.md

如果这个文件还不存在，请让我先安装并打开最新版本 LuminaLink，然后进入“Codex 协助”页面。

操作要求：
1. 只检查和修改 LuminaLink 本机配置。
2. 不要输出或保存 raw API key/token/cookie/私钥。
3. 先检查扫描目录和配置文件。
4. 扫描资产不需要 Provider；Provider 只影响翻译功能。
5. 默认扫描目录应包含 %USERPROFILE%/.codex/agents。
6. 如果用户不想配置 Provider，可以使用 LuminaLink CLI 导出/导入智能体翻译任务包。
7. 如果需要翻译 Provider，优先使用 Windows 用户/系统环境变量 OPENAI_API_KEY。`;

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
  { key: 'skills', label: 'Skill', icon: Sparkles, count: dashboard.skillTotal },
  { key: 'plugins', label: 'Plugin', icon: Package, count: dashboard.pluginTotal },
  { key: 'agents', label: 'Agent', icon: Bot, count: dashboard.agentTotal },
  { key: 'files', label: '其他文件', icon: FileText, count: dashboard.fileTotal },
  { key: 'translations', label: '未翻译', icon: Languages, count: dashboard.pendingTranslationTotal },
  { key: 'assistant', label: 'Codex 协助', icon: Bot },
  { key: 'migration', label: '迁移备份', icon: Package },
  { key: 'settings', label: '设置', icon: Settings }
]);

const selectedProviderPreset = computed(() => getTranslatorPreset(translatorForm.provider));

const showFilterTabs = computed(() => activeView.value === 'library');
const showDetailPane = computed(() => activeView.value !== 'settings');

const contextMenuStyle = computed(() => ({
  left: `${contextMenu.x}px`,
  top: `${contextMenu.y}px`
}));

const descriptionTooltipStyle = computed(() => ({
  left: `${descriptionTooltip.x}px`,
  top: `${descriptionTooltip.y}px`
}));

const contextMenuTranslateLabel = computed(() => {
  const status = contextMenu.asset?.translationStatus;
  if (status === 'stale' || status === 'translated') return '重新翻译';
  if (status === 'skipped') return '翻译此项';
  return '翻译此项';
});

const contextMenuCanSkip = computed(() => {
  const status = contextMenu.asset?.translationStatus;
  return Boolean(status && status !== 'translated' && status !== 'skipped');
});

const categoryHeader = computed(() => {
  if (activeView.value === 'skills') {
    return {
      title: 'Skill',
      description: '只显示本机扫描到的 Skill。'
    };
  }
  if (activeView.value === 'plugins') {
    return {
      title: 'Plugin',
      description: '只显示本机扫描到的插件资产。'
    };
  }
  if (activeView.value === 'agents') {
    return {
      title: 'Agent',
      description: '只显示本机扫描到的 Agent 指令文件。'
    };
  }
  if (activeView.value === 'files') {
    return {
      title: '其他文件',
      description: '只显示手动添加或项目目录中识别到的文档文件。'
    };
  }
  if (activeView.value === 'translations') {
    return {
      title: '未翻译',
      description: '只显示未翻译、已过期或翻译失败的资产。'
    };
  }
  return undefined;
});

const visibleAssets = computed(() => {
  if (activeView.value === 'skills') {
    return assets.value.filter((asset) => asset.type === 'skill');
  }
  if (activeView.value === 'plugins') {
    return assets.value.filter((asset) => asset.type === 'plugin');
  }
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

const visibleAssetIds = computed(() => visibleAssets.value.map((asset) => asset.id));

const selectedVisibleAssetIds = computed(() =>
  visibleAssetIds.value.filter((id) => selectedAssetIds.value.has(id))
);

const selectedAssetCount = computed(() => selectedVisibleAssetIds.value.length);

const allVisibleSelected = computed(
  () => visibleAssetIds.value.length > 0 && selectedVisibleAssetIds.value.length === visibleAssetIds.value.length
);

const selectedZhText = computed(() => {
  if (!selectedAsset.value) return '';
  if (liveTranslation.value?.assetId === selectedAsset.value.id && liveTranslation.value.text) {
    return toReadableText(liveTranslation.value.text);
  }
  return toReadableText(selectedAsset.value.translatedText || selectedAsset.value.chineseDescription);
});

const selectedSourceText = computed(() => {
  if (!selectedAsset.value) return '';
  return toReadableText(selectedAsset.value.sourceText || selectedAsset.value.originalDescription);
});

onMounted(async () => {
  stopTranslationProgress = window.lumina?.onTranslationProgress?.(handleTranslationProgress);
  window.addEventListener('click', closeContextMenu);
  window.addEventListener('keydown', handleGlobalKeydown);
  await refreshAll();
  await loadAgentGuide();
});

onUnmounted(() => {
  stopTranslationProgress?.();
  window.removeEventListener('click', closeContextMenu);
  window.removeEventListener('keydown', handleGlobalKeydown);
});

watch(
  () => [translatorForm.provider, translatorForm.model, translatorForm.baseUrl, translatorForm.apiKeySource],
  () => {
    if (!settingsHydrated.value) return;
    scheduleTranslatorAutoSave();
  }
);

function startBusy(task: BusyTask, message?: string): void {
  busy.value = true;
  busyTask.value = task;
  if (message) {
    statusMessage.value = message;
  }
}

function stopBusy(task: BusyTask): void {
  if (busyTask.value === task) {
    busy.value = false;
    busyTask.value = undefined;
  }
}

function isBusy(task: BusyTask): boolean {
  return busy.value && busyTask.value === task;
}

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

async function refreshNow(): Promise<void> {
  startBusy('refresh', '正在刷新统计、列表和配置状态...');
  try {
    await refreshAll();
    statusMessage.value = '刷新完成：左侧数量和当前列表已同步';
    showNotice('success', '刷新完成', '左侧统计、当前列表和 Provider 状态已同步。');
  } finally {
    stopBusy('refresh');
  }
}

async function loadStatus(): Promise<void> {
  const result = await window.lumina?.status();
  providerConfigured.value = Boolean(result?.data?.translator?.configured);
  hydrateTranslatorForm(result?.data?.translator as TranslatorConfig | undefined);
}

async function refreshDashboard(): Promise<void> {
  const result = await window.lumina?.dashboard();
  Object.assign(dashboard, result ?? fallbackDashboard);
}

async function refreshAssets(): Promise<void> {
  const result = (await window.lumina?.assets(query.value, filter.value)) as Asset[] | undefined;
  assets.value = result ?? [];
  pruneSelectedAssets();
}

async function scanNow(): Promise<void> {
  startBusy('scan', '正在扫描本机资产...');
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
    stopBusy('scan');
  }
}

function setFilter(next: string): void {
  closeFloatingLayers();
  exitSelectionMode();
  filter.value = next;
  void Promise.all([refreshDashboard(), refreshAssets()]);
}

function setActiveView(next: ViewKey): void {
  closeFloatingLayers();
  exitSelectionMode();
  activeView.value = next;
  void refreshDashboard();
  if (next === 'skills') {
    filter.value = 'skill';
    void Promise.all([refreshDashboard(), refreshAssets()]);
    return;
  }
  if (next === 'plugins') {
    filter.value = 'plugin';
    void Promise.all([refreshDashboard(), refreshAssets()]);
    return;
  }
  if (next === 'agents') {
    filter.value = 'agent_file';
    void Promise.all([refreshDashboard(), refreshAssets()]);
    return;
  }
  if (next === 'files') {
    filter.value = 'all';
    void Promise.all([refreshDashboard(), refreshAssets()]);
    return;
  }
  if (next === 'translations') {
    filter.value = 'untranslated';
    void Promise.all([refreshDashboard(), refreshAssets()]);
    return;
  }
  if (next === 'library') {
    filter.value = 'all';
    void Promise.all([refreshDashboard(), refreshAssets()]);
  }
}

async function selectAsset(id: string): Promise<void> {
  hideDescriptionTooltip();
  activeView.value = activeView.value === 'overview' ? 'library' : activeView.value;
  const result = (await window.lumina?.asset(id)) as DetailedAsset | undefined;
  selectedAsset.value = result;
  detailTab.value = result?.translatedText || result?.chineseDescription ? 'zh' : 'source';
  if (liveTranslation.value?.assetId !== id) {
    liveTranslation.value = undefined;
  }
}

function openAssetContextMenu(event: MouseEvent, asset: Asset): void {
  hideDescriptionTooltip();
  const position = clampFloatingPosition(event.clientX, event.clientY, 244, 326);
  contextMenu.visible = true;
  contextMenu.x = position.x;
  contextMenu.y = position.y;
  contextMenu.asset = asset;
  void selectAsset(asset.id);
}

function closeContextMenu(): void {
  contextMenu.visible = false;
  contextMenu.asset = undefined;
}

function closeFloatingLayers(): void {
  closeContextMenu();
  hideDescriptionTooltip();
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    closeFloatingLayers();
  }
}

function showDescriptionTooltip(event: MouseEvent, asset: Asset): void {
  const text = assetPreviewFullText(asset);
  if (!text.trim()) return;
  descriptionTooltip.visible = true;
  descriptionTooltip.label = asset.chineseDescription?.trim() ? '中文说明' : '原文描述';
  descriptionTooltip.text = text;
  moveDescriptionTooltip(event);
}

function moveDescriptionTooltip(event: MouseEvent): void {
  if (!descriptionTooltip.visible) return;
  const position = clampFloatingPosition(event.clientX + 14, event.clientY + 16, 360, 230);
  descriptionTooltip.x = position.x;
  descriptionTooltip.y = position.y;
}

function hideDescriptionTooltip(): void {
  descriptionTooltip.visible = false;
}

async function translateContextAsset(): Promise<void> {
  const asset = contextMenu.asset;
  if (!asset) return;
  closeContextMenu();
  await selectAsset(asset.id);
  await translateSelected();
}

async function openReaderForContextAsset(): Promise<void> {
  const asset = contextMenu.asset;
  if (!asset) return;
  closeContextMenu();
  await selectAsset(asset.id);
  await openReaderWindow();
}

async function openContextAsset(): Promise<void> {
  const asset = contextMenu.asset;
  if (!asset) return;
  closeContextMenu();
  await openPath(asset.sourcePath);
}

async function showContextAsset(): Promise<void> {
  const asset = contextMenu.asset;
  if (!asset) return;
  closeContextMenu();
  await showItem(asset.sourcePath);
}

async function copyContextAssetPath(): Promise<void> {
  const asset = contextMenu.asset;
  if (!asset) return;
  closeContextMenu();
  try {
    await copyText(asset.sourcePath);
    showNotice('success', '已复制路径', asset.sourcePath);
  } catch (error) {
    showNotice('warning', '复制路径失败', messageFromError(error));
  }
}

async function skipContextAsset(): Promise<void> {
  const asset = contextMenu.asset;
  if (!asset || !contextMenuCanSkip.value) return;
  closeContextMenu();
  startBusy('skip', `正在跳过：${asset.displayName}`);
  try {
    const result = await window.lumina?.skipTranslations([asset.id]);
    statusMessage.value = result?.message ?? `已跳过：${asset.displayName}`;
    showNotice(result?.ok ? 'success' : 'warning', '已标记跳过翻译', result?.message ?? `已跳过：${asset.displayName}`);
    await refreshAll();
    if (selectedAsset.value?.id === asset.id) await selectAsset(asset.id);
  } finally {
    stopBusy('skip');
  }
}

function toggleSelectionMode(): void {
  if (selectionMode.value) {
    exitSelectionMode();
    return;
  }
  selectionMode.value = true;
}

function exitSelectionMode(): void {
  selectionMode.value = false;
  selectedAssetIds.value = new Set();
}

function toggleAssetSelection(id: string): void {
  if (!selectionMode.value) return;
  const next = new Set(selectedAssetIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedAssetIds.value = next;
}

function toggleVisibleSelection(): void {
  if (!selectionMode.value) selectionMode.value = true;
  const next = new Set(selectedAssetIds.value);
  if (allVisibleSelected.value) {
    for (const id of visibleAssetIds.value) next.delete(id);
  } else {
    for (const id of visibleAssetIds.value) next.add(id);
  }
  selectedAssetIds.value = next;
}

function clearVisibleSelection(): void {
  const next = new Set(selectedAssetIds.value);
  for (const id of visibleAssetIds.value) next.delete(id);
  selectedAssetIds.value = next;
}

function pruneSelectedAssets(): void {
  const knownIds = new Set(assets.value.map((asset) => asset.id));
  const next = new Set([...selectedAssetIds.value].filter((id) => knownIds.has(id)));
  if (next.size !== selectedAssetIds.value.size) {
    selectedAssetIds.value = next;
  }
}

async function translateSelectedBatch(): Promise<void> {
  const ids = selectedVisibleAssetIds.value;
  if (!ids.length) return;
  startBusy('translate-selected', `正在翻译选中的 ${ids.length} 个资产...`);
  try {
    const result = await window.lumina?.translateSelected(ids);
    const payload = result?.data as
      | { results?: Array<{ ok: boolean; message: string }>; translated?: number; ignored?: number }
      | Array<{ ok: boolean; message: string }>
      | undefined;
    const results = Array.isArray(payload) ? payload : payload?.results ?? [];
    const failed = results.filter((item) => !item.ok);
    if (failed.length) {
      showNotice('error', '选中项有翻译失败', `失败 ${failed.length} 个。第一条原因：${failed[0]?.message}`);
    } else if (!Array.isArray(payload) && payload?.translated === 0) {
      showNotice('info', '没有需要翻译的选中项', result?.message ?? '已翻译和已跳过的资产不会再次调用 Provider。');
    } else {
      showNotice('success', '选中项翻译完成', result?.message ?? `已处理 ${ids.length} 个资产`);
    }
    statusMessage.value = result?.message ?? `已处理 ${ids.length} 个资产`;
    exitSelectionMode();
    await refreshAll();
    if (selectedAsset.value) await selectAsset(selectedAsset.value.id);
  } finally {
    stopBusy('translate-selected');
  }
}

async function skipSelectedTranslations(): Promise<void> {
  const ids = selectedVisibleAssetIds.value;
  if (!ids.length) return;
  startBusy('skip', `正在跳过选中的 ${ids.length} 个资产...`);
  try {
    const result = await window.lumina?.skipTranslations(ids);
    statusMessage.value = result?.message ?? `已跳过 ${ids.length} 个资产`;
    showNotice(result?.ok ? 'success' : 'warning', '已标记跳过翻译', result?.message ?? `已跳过 ${ids.length} 个资产`);
    exitSelectionMode();
    await refreshAll();
    if (selectedAsset.value) await selectAsset(selectedAsset.value.id);
  } finally {
    stopBusy('skip');
  }
}

async function translateSelected(): Promise<void> {
  if (!selectedAsset.value) return;
  const assetId = selectedAsset.value.id;
  startBusy('translate', `正在翻译：${selectedAsset.value.displayName}`);
  detailTab.value = 'zh';
  liveTranslation.value = {
    assetId,
    phase: 'started',
    text: '',
    message: '正在连接翻译 Provider...'
  };
  try {
    const result = window.lumina?.translateAssetLive
      ? await window.lumina.translateAssetLive(assetId)
      : await window.lumina?.translateAsset(assetId);
    statusMessage.value = result?.message ?? '翻译任务已结束';
    if (result?.ok) {
      showNotice('success', '翻译完成', result.message);
    } else {
      showNotice('error', '翻译失败', result?.message ?? '客户端 IPC 未返回翻译结果');
    }
    await selectAsset(assetId);
    await refreshAll();
  } finally {
    stopBusy('translate');
  }
}

async function translatePending(): Promise<void> {
  startBusy('translate-pending', '正在翻译队列中的前 10 个资产...');
  try {
    const result = await window.lumina?.translatePending(10);
    statusMessage.value = result?.message ?? '翻译队列已处理';
    const results = (result?.data ?? []) as Array<{ ok: boolean; message: string }>;
    const failed = results.filter((item) => !item.ok);
    if (failed.length) {
      showNotice('error', '翻译队列有失败项', `失败 ${failed.length} 个。第一条原因：${failed[0]?.message}`);
    } else {
      showNotice('success', '翻译队列已处理', result?.message ?? '翻译队列已处理');
    }
    await refreshAll();
  } finally {
    stopBusy('translate-pending');
  }
}

async function loadPending(): Promise<void> {
  startBusy('pending', '正在刷新待翻译队列...');
  try {
    const result = (await window.lumina?.pendingTranslations()) as Asset[] | undefined;
    assets.value = result ?? [];
    await refreshDashboard();
    statusMessage.value = `翻译队列已刷新：${assets.value.length} 个待处理`;
    showNotice('success', '队列已刷新', `当前有 ${assets.value.length} 个待翻译、过期或失败资产。`);
  } catch (error) {
    const message = messageFromError(error);
    statusMessage.value = `刷新队列失败：${message}`;
    showNotice('error', '刷新队列失败', message);
  } finally {
    stopBusy('pending');
  }
}

async function pickAndAddFile(): Promise<void> {
  const filePath = await window.lumina?.pickFile();
  if (!filePath) return;
  startBusy('add-file', '正在添加文件并刷新资产库...');
  try {
    const result = await window.lumina?.addFile(filePath, '其他文件');
    statusMessage.value = `文件已加入：新增 ${result?.created ?? 0}，更新 ${result?.updated ?? 0}`;
    await refreshAll();
    showNotice('success', '文件已加入', `新增 ${result?.created ?? 0}，更新 ${result?.updated ?? 0}。`);
  } catch (error) {
    const message = messageFromError(error);
    statusMessage.value = `添加文件失败：${message}`;
    showNotice('error', '添加文件失败', message);
  } finally {
    stopBusy('add-file');
  }
}

async function pickAndAddRoot(): Promise<void> {
  const directory = await window.lumina?.pickDirectory();
  if (!directory) return;
  startBusy('add-root', '正在添加目录...');
  try {
    await window.lumina?.addRoot(directory, 'project_root');
    statusMessage.value = `已添加扫描目录：${directory}`;
    showNotice('success', '目录已添加', '即将扫描这个目录并刷新左侧统计。');
  } catch (error) {
    const message = messageFromError(error);
    statusMessage.value = `添加目录失败：${message}`;
    showNotice('error', '添加目录失败', message);
    return;
  } finally {
    stopBusy('add-root');
  }
  await scanNow();
}

async function runDoctor(): Promise<void> {
  startBusy('doctor', '正在检查 LuminaLink 本机环境...');
  try {
    const report = await window.lumina?.doctor();
    doctorChecks.value = report?.checks ?? [];
    activeView.value = 'settings';
    await Promise.all([refreshDashboard(), loadStatus()]);
    const failed = doctorChecks.value.filter((item) => item.status === 'fail').length;
    const warned = doctorChecks.value.filter((item) => item.status === 'warn').length;
    statusMessage.value = `环境检查完成：失败 ${failed}，警告 ${warned}`;
    showNotice(failed ? 'error' : warned ? 'warning' : 'success', '环境检查完成', `失败 ${failed}，警告 ${warned}`);
  } catch (error) {
    const message = messageFromError(error);
    statusMessage.value = `环境检查失败：${message}`;
    showNotice('error', '环境检查失败', message);
  } finally {
    stopBusy('doctor');
  }
}

async function saveTranslator(): Promise<void> {
  await persistTranslatorConfig('manual');
}

function hydrateTranslatorForm(translator?: TranslatorConfig): void {
  settingsHydrated.value = false;
  const next = translator ?? { provider: 'noop', targetLang: 'zh-CN' as const };
  const preset = getTranslatorPreset(next.provider);
  translatorForm.provider = next.provider;
  translatorForm.model = next.model || preset.defaultModel || '';
  translatorForm.baseUrl = next.baseUrl || preset.baseUrl || '';
  translatorForm.apiKeySource = next.apiKeySource ?? preset.defaultApiKeySource ?? '';
  translatorForm.targetLang = 'zh-CN';
  window.setTimeout(() => {
    settingsHydrated.value = true;
    settingsSaveState.value = '已读取本机配置';
  }, 0);
}

function applyProviderPreset(): void {
  const preset = getTranslatorPreset(translatorForm.provider);
  translatorForm.model = preset.defaultModel || '';
  translatorForm.baseUrl = preset.baseUrl || '';
  translatorForm.apiKeySource = preset.defaultApiKeySource || '';
}

function scheduleTranslatorAutoSave(): void {
  if (settingsSaveTimer) {
    window.clearTimeout(settingsSaveTimer);
  }
  settingsSaveState.value = '正在等待自动保存...';
  settingsSaveTimer = window.setTimeout(() => {
    void persistTranslatorConfig('auto');
  }, 650);
}

async function persistTranslatorConfig(mode: 'auto' | 'manual'): Promise<void> {
  if (settingsSaveTimer) {
    window.clearTimeout(settingsSaveTimer);
    settingsSaveTimer = undefined;
  }
  if (mode === 'manual') {
    startBusy('save-settings', '正在保存翻译配置...');
  }
  settingsSaveState.value = '正在保存...';
  try {
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
    window.setTimeout(() => {
      settingsSaveState.value = mode === 'auto' ? '已自动保存到本机' : '已保存到本机';
    }, 0);
    if (mode === 'manual') {
      showNotice('success', '配置已保存', '翻译 Provider 设置已写入本机配置。');
    }
  } catch (error) {
    const message = messageFromError(error);
    settingsSaveState.value = `保存失败：${message}`;
    statusMessage.value = `保存翻译配置失败：${message}`;
    if (mode === 'manual') {
      showNotice('error', '保存翻译配置失败', message);
    }
  } finally {
    if (mode === 'manual') {
      stopBusy('save-settings');
    }
  }
}

async function loadAgentGuide(): Promise<boolean> {
  try {
    if (!window.lumina?.agentGuide) {
      throw new Error('本机桥接未连接，已显示通用提示词。请安装 v0.1.3 或更新版本后重试。');
    }
    const result = await window.lumina?.agentGuide();
    agentGuide.value = result?.data;
    return true;
  } catch (error) {
    showNotice('warning', 'Agent 手册暂未生成', messageFromError(error));
    return false;
  }
}

async function regenerateAgentGuide(): Promise<void> {
  startBusy('agent-guide', '正在重新生成 Codex 操作手册...');
  try {
    const ok = await loadAgentGuide();
    if (ok) {
      statusMessage.value = 'Codex 操作手册已刷新';
      showNotice('success', 'Codex 手册已刷新', '提示词和本机固定文件路径已更新。');
    } else {
      statusMessage.value = 'Codex 操作手册刷新失败';
    }
  } finally {
    stopBusy('agent-guide');
  }
}

async function copyAgentPrompt(): Promise<void> {
  await copyText(agentGuide.value?.promptText || fallbackAgentPrompt);
  promptCopied.value = true;
  statusMessage.value = '给 Codex 的提示词已复制';
  showNotice('success', '已复制给 Codex 的提示词', '新开 Codex 对话时粘贴这段话，它会先读取本机 Agent 操作手册。');
  window.setTimeout(() => {
    promptCopied.value = false;
  }, 1800);
}

async function copyText(text: string): Promise<void> {
  if (window.lumina?.copyText) {
    await window.lumina.copyText(text);
    return;
  }
  await navigator.clipboard.writeText(text);
}

async function openPath(target: string): Promise<void> {
  const result = await window.lumina?.openPath(target);
  statusMessage.value = result?.message ?? `已打开：${target}`;
}

async function showItem(target: string): Promise<void> {
  const result = await window.lumina?.showItem(target);
  statusMessage.value = result?.message ?? `已定位：${target}`;
}

async function openReaderWindow(): Promise<void> {
  if (!selectedAsset.value) return;
  const payload = buildReaderPayload(selectedAsset.value);
  const result = await window.lumina?.openReader(payload);
  statusMessage.value = result?.message ?? '阅读窗口已打开';
}

function buildReaderPayload(asset: DetailedAsset): ReaderWindowPayload {
  if (detailTab.value === 'source') {
    return {
      title: asset.displayName,
      subtitle: `${typeLabel(asset.type)} · 原文 · ${asset.sourcePath}`,
      mode: 'source',
      content: selectedSourceText.value
    };
  }
  if (detailTab.value === 'meta') {
    return {
      title: asset.displayName,
      subtitle: `${typeLabel(asset.type)} · 元数据`,
      mode: 'metadata',
      content: [
        `源路径: ${asset.sourcePath}`,
        `内容 Hash: ${asset.contentHash}`,
        `分类: ${asset.categories.join(' / ') || '未分类'}`,
        `标签: ${asset.tags.join(' / ') || '无'}`,
        `风险: ${asset.riskLevel}`
      ].join('\n')
    };
  }
  return {
    title: asset.displayName,
    subtitle: `${typeLabel(asset.type)} · 中文译文`,
    mode: 'translation',
    content: selectedZhText.value || '暂无中文译文。'
  };
}

function handleTranslationProgress(event: TranslationProgressEvent): void {
  if (!selectedAsset.value || selectedAsset.value.id !== event.assetId) return;
  liveTranslation.value = {
    assetId: event.assetId,
    phase: event.phase,
    text: toReadableText(event.text ?? liveTranslation.value?.text ?? ''),
    message: event.message
  };
  if (event.phase === 'delta') {
    detailTab.value = 'zh';
    statusMessage.value = event.message ?? '正在生成译文...';
  }
  if (event.phase === 'complete' || event.phase === 'cached') {
    selectedAsset.value.translatedText = toReadableText(event.text);
    selectedAsset.value.translationStatus = 'translated';
  }
  if (event.phase === 'failed') {
    statusMessage.value = event.message ?? '翻译失败';
  }
}

function previewText(input: string): string {
  return toPreviewText(input, 150);
}

function assetPreviewFullText(asset: Asset): string {
  const chinese = toReadableText(asset.chineseDescription || '');
  if (chinese.trim()) {
    return chinese;
  }
  return toReadableText(asset.originalDescription || asset.sourcePath);
}

function assetPreviewText(asset: Asset): string {
  return toPreviewText(assetPreviewFullText(asset), 150);
}

function readSavedDetailPaneWidth(): number {
  const raw = window.localStorage.getItem('luminalink.detailPaneWidth');
  const parsed = raw ? Number(raw) : 390;
  return Number.isFinite(parsed) ? clamp(parsed, 320, 760) : 390;
}

function startDetailResize(event: PointerEvent): void {
  event.preventDefault();
  const workspace = workspaceRef.value;
  if (!workspace) return;
  const pointerId = event.pointerId;
  (event.currentTarget as HTMLElement).setPointerCapture(pointerId);
  document.body.classList.add('resizing-detail-pane');

  const resize = (clientX: number) => {
    const rect = workspace.getBoundingClientRect();
    const maxWidth = Math.max(320, Math.min(860, rect.width - 520));
    const nextWidth = clamp(rect.right - clientX, 320, maxWidth);
    detailPaneWidth.value = nextWidth;
    window.localStorage.setItem('luminalink.detailPaneWidth', String(Math.round(nextWidth)));
  };

  const onPointerMove = (moveEvent: PointerEvent) => resize(moveEvent.clientX);
  const onPointerUp = () => {
    document.body.classList.remove('resizing-detail-pane');
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  resize(event.clientX);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp, { once: true });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampFloatingPosition(x: number, y: number, width: number, height: number): { x: number; y: number } {
  const padding = 12;
  return {
    x: clamp(x, padding, Math.max(padding, window.innerWidth - width - padding)),
    y: clamp(y, padding, Math.max(padding, window.innerHeight - height - padding))
  };
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
    stale: '译文过期',
    failed: '失败',
    skipped: '已跳过'
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
