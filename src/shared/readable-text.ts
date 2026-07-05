export function toReadableText(input: string | undefined | null): string {
  if (!input) return '';
  let output = String(input).replace(/\u0000/g, '');

  const escapedNewlines = output.match(/\\r\\n|\\n|\\r/g)?.length ?? 0;
  const realNewlines = output.match(/\r?\n/g)?.length ?? 0;
  const looksLikeEscapedDocument =
    escapedNewlines >= 2 ||
    /\\n(?:#{1,6}\s|[-*]\s|\d+\.\s|\s{0,4}[A-Z][A-Za-z ]{2,}:)/.test(output);

  if (looksLikeEscapedDocument) {
    output = output
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\\t/g, '  ')
      .replace(/\\"/g, '"');
  }

  if (realNewlines || looksLikeEscapedDocument) {
    output = output.replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n');
  }

  return output.trim();
}

export function toPreviewText(input: string | undefined | null, maxLength = 160): string {
  const readable = toReadableText(input).replace(/\s+/g, ' ').trim();
  if (readable.length <= maxLength) return readable;
  return `${readable.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
