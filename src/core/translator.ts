import type { TranslatorConfig } from '../shared/types.js';
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

export async function translateText(config: TranslatorConfig, input: TranslateInput): Promise<TranslateResult> {
  if (config.provider === 'noop') {
    throw new Error('翻译 Provider 未配置');
  }

  if (config.provider === 'openai') {
    return translateWithOpenAI(config, input);
  }

  if (config.provider === 'openai-compatible') {
    return translateWithOpenAICompatible(config, input);
  }

  throw new Error(`不支持的翻译 Provider: ${config.provider}`);
}

async function translateWithOpenAI(config: TranslatorConfig, input: TranslateInput): Promise<TranslateResult> {
  const apiKey = resolveApiKey(config.apiKeySource);
  if (!apiKey) {
    throw new Error('OpenAI API key 未配置，请通过环境变量配置后重试');
  }

  const endpoint = 'https://api.openai.com/v1/chat/completions';
  return requestChatCompletion(endpoint, apiKey, config.model ?? 'gpt-4.1-mini', input, 'openai');
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
  return requestChatCompletion(endpoint, apiKey, config.model ?? 'qwen2.5:7b', input, 'openai-compatible');
}

async function requestChatCompletion(
  endpoint: string,
  apiKey: string,
  model: string,
  input: TranslateInput,
  provider: string
): Promise<TranslateResult> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
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
    throw new Error(`翻译请求失败: ${response.status} ${body.slice(0, 500)}`);
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
