export function detectLanguage(text: string): 'zh-CN' | 'en' | 'mixed' | 'unknown' {
  const sample = text.slice(0, 4000);
  if (!sample.trim()) return 'unknown';
  const cjk = (sample.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const latinWords = (sample.match(/[A-Za-z]{3,}/g) ?? []).length;

  if (cjk > 20 && latinWords < cjk * 1.2) return 'zh-CN';
  if (latinWords > 20 && cjk < 10) return 'en';
  if (cjk > 0 && latinWords > 0) return 'mixed';
  return 'unknown';
}

export function needsChineseTranslation(text: string): boolean {
  const lang = detectLanguage(text);
  return lang === 'en' || lang === 'mixed';
}
