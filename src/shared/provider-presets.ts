import type { TranslatorConfig } from './types.js';

export interface TranslatorProviderPreset {
  provider: TranslatorConfig['provider'];
  label: string;
  defaultModel?: string;
  baseUrl?: string;
  defaultApiKeySource?: string;
  modelOptions: string[];
  baseUrlEditable: boolean;
  apiKeyRequired: boolean;
  hint: string;
}

export const translatorProviderPresets: TranslatorProviderPreset[] = [
  {
    provider: 'noop',
    label: '不翻译',
    modelOptions: [],
    baseUrlEditable: false,
    apiKeyRequired: false,
    hint: '只扫描和查看原文，不调用任何翻译服务。'
  },
  {
    provider: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-4.1-mini',
    baseUrl: 'https://api.openai.com/v1',
    defaultApiKeySource: 'env:OPENAI_API_KEY',
    modelOptions: ['gpt-4.1-mini', 'gpt-4o-mini'],
    baseUrlEditable: false,
    apiKeyRequired: true,
    hint: '使用 OpenAI Platform API，和 ChatGPT Pro 订阅分开计费。'
  },
  {
    provider: 'deepseek',
    label: 'DeepSeek',
    defaultModel: 'deepseek-v4-flash',
    baseUrl: 'https://api.deepseek.com',
    defaultApiKeySource: 'env:DEEPSEEK_API_KEY',
    modelOptions: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    baseUrlEditable: false,
    apiKeyRequired: true,
    hint: '使用 DeepSeek OpenAI-compatible Chat API。'
  },
  {
    provider: 'openai-compatible',
    label: 'OpenAI-compatible / 本地模型',
    defaultModel: 'qwen2.5:7b',
    baseUrl: 'http://localhost:11434/v1',
    defaultApiKeySource: '',
    modelOptions: ['qwen2.5:7b', 'qwen3:8b', 'llama3.1:8b'],
    baseUrlEditable: true,
    apiKeyRequired: false,
    hint: '适合 Ollama、LM Studio 或兼容 OpenAI Chat Completions 的服务。'
  }
];

export function getTranslatorPreset(provider: TranslatorConfig['provider']): TranslatorProviderPreset {
  return (
    translatorProviderPresets.find((preset) => preset.provider === provider) ??
    translatorProviderPresets[0]
  );
}

export function withTranslatorDefaults(config: TranslatorConfig): TranslatorConfig {
  const preset = getTranslatorPreset(config.provider);
  if (preset.provider === 'noop') {
    return {
      provider: 'noop',
      targetLang: 'zh-CN'
    };
  }

  return {
    provider: preset.provider,
    model: config.model || preset.defaultModel,
    baseUrl: config.baseUrl || preset.baseUrl,
    targetLang: 'zh-CN',
    apiKeySource: config.apiKeySource ?? preset.defaultApiKeySource
  };
}
