import {
  accountFromIdToken,
  createSession,
  SessionExpiredError,
  type TokenStorage,
} from "../session";

const b64url = (s: string) =>
  Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const idToken = (claims: object) => `h.${b64url(JSON.stringify(claims))}.sig`;
const SUB = "aaaaaaaa-1111-4111-8111-111111111111";

function memoryStorage(): TokenStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get: async (k) => map.get(k) ?? null,
    set: async (k, v) => {
      map.set(k, v);
    },
    delete: async (k) => {
      map.delete(k);
    },
  };
}

function tokenResponse(body: object, status = 200) {
  return { ok: status < 300, status, json: async () => body } as Response;
}

describe("auth session", () => {
  let time: number;
  const now = () => time;
  beforeEach(() => {
    time = 1_800_000_000_000;
  });

  it("reads sub and email from the id token (including non-ASCII)", () => {
    expect(accountFromIdToken(idToken({ sub: SUB, email: "seán@example.ie" }))).toEqual({
      sub: SUB,
      email: "seán@example.ie",
    });
  });

  it("stores tokens at sign-in and survives a restart", async () => {
    const storage = memoryStorage();
    const first = createSession({ storage, now, fetchFn: jest.fn() });
    await first.signedIn({
      accessToken: "a1",
      refreshToken: "r1",
      idToken: idToken({ sub: SUB, email: "me@example.com" }),
      expiresIn: 3600,
    });
    const restarted = createSession({ storage, now, fetchFn: jest.fn() });
    expect(await restarted.load()).toEqual({ sub: SUB, email: "me@example.com" });
    expect(await restarted.accessToken()).toBe("a1");
  });

  it("refreshes near expiry, keeps the rotated refresh token, and shares one refresh", async () => {
    const storage = memoryStorage();
    const fetchFn = jest.fn(async () =>
      tokenResponse({ access_token: "a2", refresh_token: "r2", expires_in: 3600 }),
    );
    const session = createSession({ storage, now, fetchFn: fetchFn as unknown as typeof fetch });
    await session.signedIn({
      accessToken: "a1",
      refreshToken: "r1",
      idToken: idToken({ sub: SUB }),
      expiresIn: 3600,
    });

    time += 3600_000 - 30_000; // inside the 60 s margin
    const [x, y] = await Promise.all([session.accessToken(), session.accessToken()]);
    expect([x, y]).toEqual(["a2", "a2"]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const body = String((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body);
    expect(body).toContain("grant_type=refresh_token");
    expect(body).toContain("refresh_token=r1");
    expect(storage.map.get("laidir.refresh_token")).toBe("r2");
  });

  it("signs out when the refresh token is rejected", async () => {
    const storage = memoryStorage();
    const fetchFn = jest.fn(async () => tokenResponse({ error: "invalid_grant" }, 400));
    const session = createSession({ storage, now, fetchFn: fetchFn as unknown as typeof fetch });
    await session.signedIn({
      accessToken: "a1",
      refreshToken: "r1",
      idToken: idToken({ sub: SUB }),
      expiresIn: 60,
    });
    await expect(session.accessToken()).rejects.toBeInstanceOf(SessionExpiredError);
    expect(session.account()).toBeNull();
    expect(storage.map.size).toBe(0);
  });

  it("revokes the refresh token on sign-out, even if offline afterwards", async () => {
    const storage = memoryStorage();
    const fetchFn = jest.fn(async () => {
      throw new Error("offline");
    });
    const session = createSession({ storage, now, fetchFn: fetchFn as unknown as typeof fetch });
    await session.signedIn({
      accessToken: "a1",
      refreshToken: "r1",
      idToken: idToken({ sub: SUB }),
    });
    await session.signOut();
    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining("/oauth2/revoke"),
      expect.anything(),
    );
    expect(storage.map.size).toBe(0);
    expect(await session.accessToken()).toBeNull();
  });
});
