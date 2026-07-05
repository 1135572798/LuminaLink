import { fetch as undiciFetch, ProxyAgent } from 'undici';

interface ProxyMatch {
  source: string;
  url: string;
}

type UndiciRequestInit = NonNullable<Parameters<typeof undiciFetch>[1]>;

const proxyAgents = new Map<string, ProxyAgent>();

export async function fetchWithProxy(endpoint: string, init: UndiciRequestInit = {}): Promise<Response> {
  const proxy = resolveProxyForUrl(endpoint);
  const requestInit = proxy
    ? ({ ...init, dispatcher: getProxyAgent(proxy.url) } as UndiciRequestInit & { dispatcher: ProxyAgent })
    : init;

  try {
    return (await undiciFetch(endpoint, requestInit)) as unknown as Response;
  } catch (error) {
    throw enhanceNetworkError(error, endpoint, proxy);
  }
}

export function proxyDescriptionForUrl(endpoint: string): string {
  const proxy = resolveProxyForUrl(endpoint);
  if (!proxy) return '未使用代理';
  return `${proxy.source}=${redactProxyUrl(proxy.url)}`;
}

function getProxyAgent(proxyUrl: string): ProxyAgent {
  const existing = proxyAgents.get(proxyUrl);
  if (existing) return existing;
  const agent = new ProxyAgent(proxyUrl);
  proxyAgents.set(proxyUrl, agent);
  return agent;
}

function resolveProxyForUrl(endpoint: string): ProxyMatch | undefined {
  const url = new URL(endpoint);
  if (shouldBypassProxy(url)) return undefined;

  const candidates =
    url.protocol === 'https:'
      ? ['HTTPS_PROXY', 'https_proxy', 'ALL_PROXY', 'all_proxy', 'HTTP_PROXY', 'http_proxy']
      : ['HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy'];

  for (const source of candidates) {
    const value = process.env[source];
    if (value?.trim()) {
      return { source, url: value.trim() };
    }
  }
  return undefined;
}

function shouldBypassProxy(url: URL): boolean {
  const host = normalizeHost(url.hostname);
  if (isLocalHost(host)) return true;

  const noProxy = getEnvValue(['NO_PROXY', 'no_proxy']);
  if (!noProxy) return false;
  const entries = noProxy
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return entries.some((entry) => {
    if (entry === '*') return true;
    const normalized = normalizeNoProxyEntry(entry);
    if (!normalized) return false;
    if (normalized.includes(':') && normalized === `${host}:${url.port || defaultPort(url)}`) return true;
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
}

function normalizeNoProxyEntry(entry: string): string {
  const withoutProtocol = entry.replace(/^https?:\/\//, '');
  return withoutProtocol.replace(/^\./, '').replace(/\/$/, '').replace(/^\[/, '').replace(/\]$/, '');
}

function isLocalHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function defaultPort(url: URL): string {
  if (url.protocol === 'https:') return '443';
  if (url.protocol === 'http:') return '80';
  return '';
}

function getEnvValue(names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value?.trim()) return value.trim();
  }
  return undefined;
}

function enhanceNetworkError(error: unknown, endpoint: string, proxy?: ProxyMatch): Error {
  const original = error instanceof Error ? error : new Error(String(error));
  const cause = (original as Error & { cause?: { code?: string; message?: string } }).cause;
  const causeText = [cause?.code, cause?.message].filter(Boolean).join(': ');
  const target = new URL(endpoint).host;
  const proxyText = proxy
    ? `已尝试使用代理 ${proxy.source}=${redactProxyUrl(proxy.url)}`
    : '未检测到可用于该地址的代理环境变量';
  return new Error(`网络连接失败：无法连接 ${target}。${causeText || original.message}。${proxyText}。`);
}

function redactProxyUrl(proxyUrl: string): string {
  try {
    const url = new URL(proxyUrl);
    if (url.username || url.password) {
      url.username = url.username ? '***' : '';
      url.password = url.password ? '***' : '';
    }
    return url.toString();
  } catch {
    return proxyUrl.replace(/\/\/([^:@/]+):([^@/]+)@/, '//***:***@');
  }
}
