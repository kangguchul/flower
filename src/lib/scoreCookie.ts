const SCORE_COOKIE = 'hwatu-score';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function parseScoreCookie(cookieHeader: string): number | null {
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    const raw = part.slice(separator + 1).trim();
    if (name === SCORE_COOKIE && /^\d+$/.test(raw)) return Number(raw);
  }
  return null;
}

export function formatScoreCookie(score: number, secure = false): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(score) ? score : 0));
  return `${SCORE_COOKIE}=${safe}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export function readScoreCookie(cookieHeader = typeof document === 'undefined' ? '' : document.cookie): number | null {
  return parseScoreCookie(cookieHeader);
}

export function writeScoreCookie(score: number) {
  if (typeof document === 'undefined') return;
  const secure = typeof location !== 'undefined' && location.protocol === 'https:';
  document.cookie = formatScoreCookie(score, secure);
}
