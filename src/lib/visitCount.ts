const STORAGE_KEY = 'hwatu-visitor-id';
const VISITOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type VisitWindow = Window & {
  __hwatuVisitTotal?: number;
  __hwatuVisitOrdinal?: number;
  __hwatuVisitCount?: Promise<number | null>;
};

function visitWindow(): VisitWindow | null {
  return typeof window === 'undefined' ? null : window;
}

export function readVisitTotal(): number | null {
  const view = visitWindow();
  const ordinal = view?.__hwatuVisitOrdinal;
  if (typeof ordinal === 'number') return ordinal;
  const total = view?.__hwatuVisitTotal;
  return typeof total === 'number' ? total : null;
}

function visitorId(): string {
  const generated = crypto.randomUUID();
  try {
    const existing = localStorage.getItem(STORAGE_KEY) ?? '';
    if (VISITOR_ID.test(existing)) return existing;
    localStorage.setItem(STORAGE_KEY, generated);
  }
  catch {
    return generated;
  }
  return generated;
}

async function requestVisitCount(): Promise<number | null> {
  const response = await fetch('/visits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: visitorId() }),
    cache: 'no-store'
  });
  if (!response.ok) return null;
  const payload = await response.json() as { total?: unknown; ordinal?: unknown };
  const ordinal = typeof payload.ordinal === 'number' ? payload.ordinal : typeof payload.total === 'number' ? payload.total : null;
  const view = visitWindow();
  if (view && ordinal != null) {
    view.__hwatuVisitOrdinal = ordinal;
    if (typeof payload.total === 'number') view.__hwatuVisitTotal = payload.total;
  }
  return ordinal;
}

export function startVisitPresence(): () => void {
  const beat = () => {
    void fetch('/visits/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: visitorId() }),
      cache: 'no-store'
    }).catch(() => undefined);
  };
  beat();
  const timer = window.setInterval(beat, 45_000);
  return () => window.clearInterval(timer);
}

export function loadVisitCount(): Promise<number | null> {
  const view = visitWindow();
  if (!view) return Promise.resolve(null);
  if (!view.__hwatuVisitCount) {
    view.__hwatuVisitCount = requestVisitCount().catch(() => null);
  }
  return view.__hwatuVisitCount;
}
