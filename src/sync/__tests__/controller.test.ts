import type { SessionAccount } from "@/auth/session";
import { AccountMismatchError, type SyncRepo } from "@/data/sync";

import { OfflineError } from "../api";
import { createSyncController, EDIT_DEBOUNCE_MS } from "../controller";

const ME: SessionAccount = { sub: "aaaaaaaa-1111-4111-8111-111111111111", email: "me@x.ie" };
const YOU: SessionAccount = { sub: "bbbbbbbb-2222-4222-8222-222222222222", email: "you@x.ie" };

function harness({ stored = null as SessionAccount | null } = {}) {
  let account = stored;
  let linked: SessionAccount | undefined;
  let time = 0;
  const timers: { fn: () => void; at: number }[] = [];
  const api = {
    push: jest.fn(async () => []),
    pull: jest.fn(async () => ({ items: [], next_cursor: "c0", has_more: false })),
    profile: jest.fn(async () => undefined),
  };
  const repo = {
    account: jest.fn(async () => linked),
    bindAccount: jest.fn(async (a: SessionAccount) => {
      if (linked && linked.sub !== a.sub) throw new AccountMismatchError(linked);
      linked = a;
    }),
    eraseSyncedData: jest.fn(async () => {
      linked = undefined;
    }),
    pending: jest.fn(async () => []),
    pendingCount: jest.fn(async () => 0),
    cursor: jest.fn(async () => undefined),
    setCursor: jest.fn(async () => undefined),
    markPushed: jest.fn(),
    applyRemote: jest.fn(async () => false),
  } as unknown as SyncRepo & { bindAccount: jest.Mock; eraseSyncedData: jest.Mock };
  const session = {
    load: jest.fn(async () => account),
    account: () => account,
  } as never;
  const signIn = jest.fn(async () => {
    account = YOU;
    return { type: "success" as const, account: YOU };
  });
  const signOut = jest.fn(async () => {
    account = null;
  });
  const controller = createSyncController({
    session,
    api,
    repo,
    signIn,
    signOut,
    now: () => time,
    setTimer: (fn, ms) => {
      const t = { fn, at: time + ms };
      timers.push(t);
      return t;
    },
    clearTimer: (h) => {
      const i = timers.indexOf(h as (typeof timers)[number]);
      if (i >= 0) timers.splice(i, 1);
    },
  });
  const advance = async (ms: number) => {
    time += ms;
    for (const t of timers.filter((t) => t.at <= time)) {
      timers.splice(timers.indexOf(t), 1);
      t.fn();
    }
    await new Promise((r) => setImmediate(r));
  };
  return {
    controller,
    api,
    repo,
    signIn,
    signOut,
    advance,
    link: (a: SessionAccount) => {
      linked = a;
    },
  };
}

describe("sync controller", () => {
  it("stays signed out (and does nothing) without an account", async () => {
    const h = harness();
    await h.controller.start();
    expect(h.controller.getState()).toEqual({ kind: "signed-out" });
    h.controller.noteLocalChange();
    await h.advance(EDIT_DEBOUNCE_MS);
    expect(h.api.pull).not.toHaveBeenCalled();
  });

  it("restores a session at start, links the phone and syncs", async () => {
    const h = harness({ stored: ME });
    await h.controller.start();
    expect(h.repo.bindAccount).toHaveBeenCalledWith(ME, undefined);
    expect(h.api.pull).toHaveBeenCalledTimes(1);
    expect(h.controller.getState()).toMatchObject({ kind: "signed-in", syncing: false });
  });

  it("syncs a while after local edits, not on every keystroke", async () => {
    const h = harness({ stored: ME });
    await h.controller.start();
    h.controller.noteLocalChange();
    h.controller.noteLocalChange();
    await h.advance(EDIT_DEBOUNCE_MS - 1);
    expect(h.api.pull).toHaveBeenCalledTimes(1);
    await h.advance(1);
    expect(h.api.pull).toHaveBeenCalledTimes(2);
  });

  it("backs off after a failure and says so", async () => {
    const h = harness({ stored: ME });
    h.api.pull.mockRejectedValueOnce(new OfflineError());
    await h.controller.start();
    expect(h.controller.getState()).toMatchObject({
      kind: "signed-in",
      error: "Offline. Will try again.",
    });
    await h.controller.syncNow(); // blocked by backoff
    expect(h.api.pull).toHaveBeenCalledTimes(1);
    await h.advance(30_000);
    expect(h.api.pull).toHaveBeenCalledTimes(2);
    expect(h.controller.getState()).toMatchObject({ kind: "signed-in", error: undefined });
  });

  it("asks before letting a different account take over this phone's data", async () => {
    const h = harness();
    h.link(ME);
    await h.controller.start();
    await h.controller.signIn();
    expect(h.controller.getState()).toMatchObject({ kind: "mismatch", account: YOU, existing: ME });
    expect(h.api.pull).not.toHaveBeenCalled();

    await h.controller.cancelMismatch();
    expect(h.signOut).toHaveBeenCalled();
    expect(h.controller.getState()).toEqual({ kind: "signed-out" });
    expect(h.repo.eraseSyncedData).not.toHaveBeenCalled();
  });

  it("erases and continues when the user chooses to", async () => {
    const h = harness();
    h.link(ME);
    await h.controller.start();
    await h.controller.signIn();
    await h.controller.eraseAndContinue();
    expect(h.repo.eraseSyncedData).toHaveBeenCalled();
    expect(h.repo.bindAccount).toHaveBeenLastCalledWith(YOU, undefined);
    expect(h.controller.getState()).toMatchObject({ kind: "signed-in", account: YOU });
  });
});
