// Flux configuration types and validation. Invalid values throw rather than coerce silently.

export type CsrfStrategy = 'meta' | 'cookie' | 'none';

export interface CsrfConfig {
  /** Where the token is read from. `none` disables CSRF injection. */
  strategy: CsrfStrategy;
  /** For `meta`: the `<meta name=...>` to read. */
  metaName?: string;
  /** For `cookie`: the cookie name. */
  cookieName?: string;
  /** Header set on same-origin mutation requests. */
  headerName?: string;
}

export interface FluxConfig {
  htmx?: {
    /** Default swap style. Defaults to `innerHTML`; opt into morphing explicitly when input or focus must be preserved across swaps. */
    defaultSwap?: string;
  };
  requests?: {
    /** Per-request timeout in ms. `0` uses HTMX's default. */
    timeoutMs?: number;
    /** Fetch credentials mode. Never implicitly `include`. */
    credentials?: RequestCredentials;
  };
  csrf?: Partial<CsrfConfig>;
  feedback?: {
    /** Global indicator selector shown for any in-flight request. */
    indicator?: string;
  };
}

export interface ResolvedConfig {
  htmx: { defaultSwap: string };
  requests: { timeoutMs: number; credentials: RequestCredentials };
  csrf: CsrfConfig;
  feedback: { indicator: string | undefined };
}

const DEFAULTS: ResolvedConfig = {
  htmx: { defaultSwap: 'innerHTML' },
  requests: { timeoutMs: 0, credentials: 'same-origin' },
  csrf: {
    strategy: 'meta',
    metaName: 'csrf-token',
    cookieName: 'csrftoken',
    headerName: 'X-CSRFToken',
  },
  feedback: { indicator: undefined },
};

const STRATEGIES: ReadonlySet<CsrfStrategy> = new Set(['meta', 'cookie', 'none']);
const CREDENTIALS: ReadonlySet<RequestCredentials> = new Set(['omit', 'same-origin', 'include']);

function fail(field: string, value: unknown, expected: string): never {
  throw new Error(
    `[flux] invalid config: ${field}=${JSON.stringify(value)} (expected ${expected}). No silent fallback — set the field explicitly.`,
  );
}

/** Merges `userConfig` onto defaults, validating each field. Throws on invalid values. */
export function resolveConfig(user?: FluxConfig): ResolvedConfig {
  const out: ResolvedConfig = {
    htmx: { ...DEFAULTS.htmx },
    requests: { ...DEFAULTS.requests },
    csrf: { ...DEFAULTS.csrf },
    feedback: { ...DEFAULTS.feedback },
  };

  mergeHtmx(out, user?.htmx);
  mergeRequests(out, user?.requests);
  mergeCsrf(out, user?.csrf);
  mergeFeedback(out, user?.feedback);

  return out;
}

function mergeHtmx(out: ResolvedConfig, htmx?: FluxConfig['htmx']): void {
  if (htmx?.defaultSwap === undefined) return;

  if (typeof htmx.defaultSwap !== 'string' || htmx.defaultSwap.trim() === '') {
    fail('htmx.defaultSwap', htmx.defaultSwap, 'non-empty string');
  }
  out.htmx.defaultSwap = htmx.defaultSwap;
}

function mergeRequests(out: ResolvedConfig, requests?: FluxConfig['requests']): void {
  if (requests?.timeoutMs !== undefined) {
    if (
      typeof requests.timeoutMs !== 'number' ||
      !Number.isFinite(requests.timeoutMs) ||
      requests.timeoutMs < 0
    ) {
      fail('requests.timeoutMs', requests.timeoutMs, 'finite number >= 0');
    }
    out.requests.timeoutMs = requests.timeoutMs;
  }

  if (requests?.credentials !== undefined) {
    if (!CREDENTIALS.has(requests.credentials)) {
      fail('requests.credentials', requests.credentials, [...CREDENTIALS].join(' | '));
    }
    out.requests.credentials = requests.credentials;
  }
}

function mergeCsrf(out: ResolvedConfig, csrf?: Partial<CsrfConfig>): void {
  if (csrf?.strategy !== undefined) {
    if (!STRATEGIES.has(csrf.strategy)) {
      fail('csrf.strategy', csrf.strategy, [...STRATEGIES].join(' | '));
    }
    out.csrf.strategy = csrf.strategy;
  }
  if (csrf?.metaName !== undefined) out.csrf.metaName = String(csrf.metaName);
  if (csrf?.cookieName !== undefined) out.csrf.cookieName = String(csrf.cookieName);
  if (csrf?.headerName !== undefined) out.csrf.headerName = String(csrf.headerName);
}

function mergeFeedback(out: ResolvedConfig, feedback?: FluxConfig['feedback']): void {
  if (feedback?.indicator !== undefined) {
    out.feedback.indicator = String(feedback.indicator);
  }
}
