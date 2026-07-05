import type { TranslatorConfig } from '../shared/types.js';
import { withTranslatorDefaults } from '../shared/provider-presets.js';
import { fetchWithProxy, proxyDescriptionForUrl } from './proxy-fetch.js';
import { resolveApiKey } from './translation-store.js';

export interface TranslateInput {
  sourceText: string;
  sourceLang: string;
  targetLang: string;
  scope: string;
}

export interface TranslateResult {
  translatedText: string;
  provider: string;
}

export type TranslateProgressCallback = (text: string, delta: string) => void;

export interface TranslatorProbeResult {
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export async function translateText(config: TranslatorConfig, input: TranslateInput): Promise<TranslateResult> {
  const normalized = withTranslatorDefaults(config);
  if (normalized.provider === 'noop') {
    throw new Error('翻译 Provider 未配置');
  }

  if (normalized.provider === 'openai') {
    return translateWithOpenAI(normalized, input);
  }

  if (normalized.provider === 'deepseek') {
    return translateWithDeepSeek(normalized, input);
  }

  if (normalized.provider === 'openai-compatible') {
    return translateWithOpenAICompatible(normalized, input);
  }

  throw new Error(`不支持的翻译 Provider: ${normalized.provider}`);
}

export async function translateTextStream(
  config: TranslatorConfig,
  input: TranslateInput,
  onProgress: TranslateProgressCallback
): Promise<TranslateResult> {
  const normalized = withTranslatorDefaults(config);
  if (normalized.provider === 'noop') {
    throw new Error('翻译 Provider 未配置');
  }

  if (normalized.provider === 'openai') {
    const apiKey = resolveApiKey(normalized.apiKeySource);
    if (!apiKey) {
      throw new Error('OpenAI API key 未配置，请通过环境变量配置后重试');
    }
    return requestChatCompletion(
      'https://api.openai.com/v1/chat/completions',
      apiKey,
      normalized.model ?? 'gpt-4.1-mini',
      input,
      'openai',
      'OpenAI',
      { stream: true, onProgress }
    );
  }

  if (normalized.provider === 'deepseek') {
    const apiKey = resolveApiKey(normalized.apiKeySource);
    if (!apiKey) {
      throw new Error('DeepSeek API key 未配置，请通过环境变量配置后重试');
    }
    const baseUrl = (normalized.baseUrl || 'https://api.deepseek.com').replace(/\/$/, '');
    return requestChatCompletion(
      `${baseUrl}/chat/completions`,
      apiKey,
      normalized.model ?? 'deepseek-v4-flash',
      input,
      'deepseek',
      'DeepSeek',
      { stream: true, onProgress }
    );
  }

  if (normalized.provider === 'openai-compatible') {
    if (!normalized.baseUrl) {
      throw new Error('OpenAI-compatible baseUrl 未配置');
    }
    const apiKey = resolveApiKey(normalized.apiKeySource) ?? 'not-required';
    return requestChatCompletion(
      `${normalized.baseUrl.replace(/\/$/, '')}/chat/completions`,
      apiKey,
      normalized.model ?? 'qwen2.5:7b',
      input,
      'openai-compatible',
      'OpenAI-compatible',
      { stream: true, onProgress }
    );
  }

  throw new Error(`不支持的翻译 Provider: ${normalized.provider}`);
}

export async function probeTranslator(config: TranslatorConfig): Promise<TranslatorProbeResult> {
  const normalized = withTranslatorDefaults(config);
  if (normalized.provider === 'noop') {
    return { status: 'warn', detail: '未配置 Provider，仍可扫描和查看原文' };
  }

  if (normalized.provider === 'openai') {
    const apiKey = resolveApiKey(normalized.apiKeySource);
    if (!apiKey) {
      return { status: 'fail', detail: 'OpenAI API key 未配置或当前进程不可见' };
    }
    return probeChatCompletion(
      'https://api.openai.com/v1/chat/completions',
      apiKey,
      normalized.model ?? 'gpt-4.1-mini',
      'OpenAI'
    );
  }

  if (normalized.provider === 'deepseek') {
    const apiKey = resolveApiKey(normalized.apiKeySource);
    if (!apiKey) {
      return { status: 'fail', detail: 'DeepSeek API key 未配置或当前进程不可见' };
    }
    const baseUrl = (normalized.baseUrl || 'https://api.deepseek.com').replace(/\/$/, '');
    return probeChatCompletion(
      `${baseUrl}/chat/completions`,
      apiKey,
      normalized.model ?? 'deepseek-v4-flash',
      'DeepSeek'
    );
  }

  if (normalized.provider === 'openai-compatible') {
    if (!normalized.baseUrl) {
      return { status: 'fail', detail: 'OpenAI-compatible baseUrl 未配置' };
    }
    const apiKey = resolveApiKey(normalized.apiKeySource) ?? 'not-required';
    return probeChatCompletion(
      `${normalized.baseUrl.replace(/\/$/, '')}/chat/completions`,
      apiKey,
      normalized.model ?? 'qwen2.5:7b',
      'OpenAI-compatible'
    );
  }

  return { status: 'fail', detail: `不支持的翻译 Provider: ${normalized.provider}` };
}

async function translateWithOpenAI(config: TranslatorConfig, input: TranslateInput): Promise<TranslateResult> {
  const apiKey = resolveApiKey(config.apiKeySource);
  if (!apiKey) {
    throw new Error('OpenAI API key 未配置，请通过环境变量配置后重试');
  }

  const endpoint = 'https://api.openai.com/v1/chat/completions';
  return requestChatCompletion(endpoint, apiKey, config.model ?? 'gpt-4.1-mini', input, 'openai', 'OpenAI');
}

async function translateWithDeepSeek(config: TranslatorConfig, input: TranslateInput): Promise<TranslateResult> {
  const apiKey = resolveApiKey(config.apiKeySource);
  if (!apiKey) {
    throw new Error('DeepSeek API key 未配置，请通过环境变量配置后重试');
  }

  const baseUrl = (config.baseUrl || 'https://api.deepseek.com').replace(/\/$/, '');
  const endpoint = `${baseUrl}/chat/completions`;
  return requestChatCompletion(endpoint, apiKey, config.model ?? 'deepseek-v4-flash', input, 'deepseek', 'DeepSeek');
}

async function translateWithOpenAICompatible(
  config: TranslatorConfig,
  input: TranslateInput
): Promise<TranslateResult> {
  if (!config.baseUrl) {
    throw new Error('OpenAI-compatible baseUrl 未配置');
  }
  const apiKey = resolveApiKey(config.apiKeySource) ?? 'not-required';
  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  return requestChatCompletion(
    endpoint,
    apiKey,
    config.model ?? 'qwen2.5:7b',
    input,
    'openai-compatible',
    'OpenAI-compatible'
  );
}

async function requestChatCompletion(
  endpoint: string,
  apiKey: string,
  model: string,
  input: TranslateInput,
  provider: string,
  providerLabel = provider,
  options: { stream?: boolean; onProgress?: TranslateProgressCallback } = {}
): Promise<TranslateResult> {
  const response = await fetchWithProxy(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      stream: options.stream || undefined,
      messages: [
        {
          role: 'system',
          content:
            '你是开发工具文档翻译助手。把英文技术说明翻译成简洁准确的简体中文。保留命令、路径、文件名、函数名、配置键、代码块和产品名。不要扩写功能，不要翻译疑似密钥或 token。'
        },
        {
          role: 'user',
          content: `目标语言：${input.targetLang}\n内容范围：${input.scope}\n\n请翻译以下内容：\n\n${input.sourceText}`
        }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`翻译请求失败: ${formatProviderHttpError(response.status, body, providerLabel)}`);
  }

  if (options.stream) {
    return readStreamingChatCompletion(response, provider, options.onProgress);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const translatedText = json.choices?.[0]?.message?.content?.trim();
  if (!translatedText) {
    throw new Error('翻译 Provider 返回为空');
  }
  return { translatedText, provider };
}

async function readStreamingChatCompletion(
  response: Response,
  provider: string,
  onProgress?: TranslateProgressCallback
): Promise<TranslateResult> {
  if (!response.body) {
    throw new Error('翻译 Provider 未返回可读取的流式响应');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;

      const chunk = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
      };
      const delta = chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content ?? '';
      if (!delta) continue;
      accumulated += delta;
      onProgress?.(accumulated, delta);
    }
  }

  const translatedText = accumulated.trim();
  if (!translatedText) {
    throw new Error('翻译 Provider 返回为空');
  }
  return { translatedText, provider };
}

function formatProviderHttpError(status: number, body: string, providerLabel: string): string {
  const fallback = `${status} ${body.slice(0, 500)}`;
  try {
    const payload = JSON.parse(body) as { error?: { message?: string; type?: string; code?: string } };
    const error = payload.error;
    if (!error) return fallback;
    const code = error.code || error.type || 'unknown_error';
    if (status === 401 || code === 'invalid_api_key') {
      return `API Key 无效或当前项目无权限（${status} ${code}）。请检查 API Key 来源是否正确。`;
    }
    if (status === 429 && code === 'insufficient_quota') {
      return `${providerLabel} 额度不足或账单不可用（${status} ${code}）。请更换有额度的 API Key，或到对应平台检查 Billing/Usage。`;
    }
    if (status === 429) {
      return `请求被限流或额度不足（${status} ${code}）。${error.message ?? ''}`.trim();
    }
    if (status === 404) {
      return `模型或接口不存在（${status} ${code}）。请检查模型名是否对当前 API Key 可用。`;
    }
    return `${status} ${code}: ${error.message ?? body.slice(0, 300)}`;
  } catch {
    return fallback;
  }
}

async function probeChatCompletion(
  endpoint: string,
  apiKey: string,
  model: string,
  label: string
): Promise<TranslatorProbeResult> {
  try {
    await requestChatCompletion(
      endpoint,
      apiKey,
      model,
      {
        sourceText: 'hello',
        sourceLang: 'en',
        targetLang: 'zh-CN',
        scope: 'provider health check'
      },
      label,
      label
    );
    return { status: 'pass', detail: `${label} 翻译探测通过；${proxyDescriptionForUrl(endpoint)}` };
  } catch (error) {
    return {
      status: 'fail',
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}
