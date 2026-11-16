import { CLIENT_ID, discovery } from "./config";

/**
 * The signed-in session: Cognito tokens in secure storage, with the access token refreshed through
 * /oauth2/token. Refresh-token rotation is on for the app client, so every refresh returns a new
 * refresh token that replaces the old one (the old one keeps working for 10 s, for retries).
 *
 * Only one refresh runs at a time; concurrent callers share it.
 */
export type SessionAccount = { sub: string; email?: string };

export type Tokens = {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
  account: SessionAccount;
};

/** Key-value storage for tokens (expo-secure-store in the app, a Map in tests). */
export interface TokenStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/** The refresh token was rejected (expired, revoked or rotated away): sign in again. */
export class SessionExpiredError extends Error {
  constructor() {
    super("Your sign-in has expired. Sign in again to keep syncing.");
    this.name = "SessionExpiredError";
  }
}

/** Couldn't reach Cognito (offline, timeout). Try again later; the session is kept. */
export class AuthNetworkError extends Error {
  constructor(cause?: unknown) {
    super("Couldn't reach the sign-in service.", { cause });
    this.name = "AuthNetworkError";
  }
}

const KEYS = {
  access: "laidir.access_token",
  refresh: "laidir.refresh_token",
  expiresAt: "laidir.expires_at",
  account: "laidir.account",
};

/** Refresh this long before the access token actually expires. */
const EXPIRY_MARGIN_MS = 60_000;

type TokenEndpointResponse = {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in: number;
};

/** Reads `sub` and `email` from an id token's payload (no verification needed: display only). */
export function accountFromIdToken(idToken: string): SessionAccount {
  const payload = idToken.split(".")[1];
  if (!payload) throw new Error("Malformed id token");
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const json = decodeURIComponent(
    Array.from(atob(padded), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""),
  );
  const claims = JSON.parse(json) as { sub?: unknown; email?: unknown };
  if (typeof claims.sub !== "string") throw new Error("Id token has no sub");
  return {
    sub: claims.sub,
    ...(typeof claims.email === "string" ? { email: claims.email } : {}),
  };
}

export function createSession({
  storage,
  fetchFn = fetch,
  now = Date.now,
}: {
  storage: TokenStorage;
  fetchFn?: typeof fetch;
  now?: () => number;
}) {
  let tokens: Tokens | null | undefined; // undefined = not loaded yet
  let refreshing: Promise<Tokens> | null = null;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  async function save(next: Tokens) {
    // Refresh token first: if the app dies midway, the stored one is still valid (rotation grace).
    await storage.set(KEYS.refresh, next.refreshToken);
    await storage.set(KEYS.access, next.accessToken);
    await storage.set(KEYS.expiresAt, String(next.expiresAt));
    await storage.set(KEYS.account, JSON.stringify(next.account));
    tokens = next;
    emit();
  }

  async function clear() {
    for (const key of Object.values(KEYS)) await storage.delete(key);
    tokens = null;
    emit();
  }

  async function postToken(params: Record<string, string>): Promise<Response> {
    try {
      return await fetchFn(discovery.tokenEndpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params).toString(),
      });
    } catch (error) {
      throw new AuthNetworkError(error);
    }
  }

  async function doRefresh(current: Tokens): Promise<Tokens> {
    const res = await postToken({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: current.refreshToken,
    });
    if (res.status === 400 || res.status === 401) {
      // invalid_grant & co: the refresh token is no good any more.
      await clear();
      throw new SessionExpiredError();
    }
    if (!res.ok) throw new AuthNetworkError(new Error(`token endpoint ${res.status}`));
    const body = (await res.json()) as TokenEndpointResponse;
    const next: Tokens = {
      accessToken: body.access_token,
      // With rotation Cognito always sends a new one; keep the old one if it ever doesn't.
      refreshToken: body.refresh_token ?? current.refreshToken,
      expiresAt: now() + body.expires_in * 1000,
      account: body.id_token ? accountFromIdToken(body.id_token) : current.account,
    };
    await save(next);
    return next;
  }

  const session = {
    /** Loads stored tokens (once). Returns the signed-in account, if any. */
    async load(): Promise<SessionAccount | null> {
      if (tokens === undefined) {
        const [access, refresh, expiresAt, account] = await Promise.all([
          storage.get(KEYS.access),
          storage.get(KEYS.refresh),
          storage.get(KEYS.expiresAt),
          storage.get(KEYS.account),
        ]);
        tokens =
          access && refresh && expiresAt && account
            ? {
                accessToken: access,
                refreshToken: refresh,
                expiresAt: Number(expiresAt),
                account: JSON.parse(account) as SessionAccount,
              }
            : null;
        emit();
      }
      return tokens?.account ?? null;
    },

    /** The signed-in account (after load), or null. */
    account(): SessionAccount | null {
      return tokens?.account ?? null;
    },

    /** Stores the tokens from a completed sign-in (authorization code exchange). */
    async signedIn(response: {
      accessToken: string;
      refreshToken?: string;
      idToken?: string;
      expiresIn?: number;
    }): Promise<SessionAccount> {
      if (!response.refreshToken || !response.idToken) {
        throw new Error("Sign-in didn't return the expected tokens.");
      }
      const account = accountFromIdToken(response.idToken);
      await save({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresAt: now() + (response.expiresIn ?? 3600) * 1000,
        account,
      });
      return account;
    },

    /** A valid access token, refreshing first if it's about to expire. Null when signed out. */
    async accessToken({ forceRefresh = false } = {}): Promise<string | null> {
      await session.load();
      const current = tokens;
      if (!current) return null;
      if (!forceRefresh && current.expiresAt - EXPIRY_MARGIN_MS > now()) {
        return current.accessToken;
      }
      refreshing ??= doRefresh(current).finally(() => {
        refreshing = null;
      });
      return (await refreshing).accessToken;
    },

    /** Revokes the refresh token (best effort) and forgets all tokens. */
    async signOut(): Promise<void> {
      const refresh = tokens?.refreshToken;
      await clear();
      if (!refresh) return;
      try {
        await fetchFn(discovery.revocationEndpoint, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: refresh, client_id: CLIENT_ID }).toString(),
        });
      } catch {
        // Offline: the token expires on its own (30 days).
      }
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return session;
}

export type AuthSession = ReturnType<typeof createSession>;
