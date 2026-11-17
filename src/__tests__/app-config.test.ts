import type { ConfigContext, ExpoConfig } from "expo/config";

function loadConfig(variant?: string): ExpoConfig {
  if (variant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = variant;
  let config: ExpoConfig | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const build = require("../../app.config").default as (ctx: ConfigContext) => ExpoConfig;
    config = build({ config: {}, projectRoot: "", staticConfigPath: null, packageJsonPath: null });
  });
  if (!config) throw new Error("config not built");
  return config;
}

afterEach(() => {
  delete process.env.APP_VARIANT;
});

describe("app.config variants", () => {
  it("defaults to the preview app", () => {
    const config = loadConfig();
    expect(config.name).toBe("Láidir");
    expect(config.android?.package).toBe("ie.eamonnhegarty.laidir");
  });

  it("gives the development build its own package so both can be installed", () => {
    const config = loadConfig("development");
    expect(config.name).toBe("Láidir (dev)");
    expect(config.android?.package).toBe("ie.eamonnhegarty.laidir.dev");
  });

  it("gives only the real app the laidir scheme Cognito redirects to", () => {
    expect(loadConfig().scheme).toBe("laidir");
    // Its own scheme, so the dev client never competes for laidir://auth/callback.
    expect(loadConfig("development").scheme).toBe("laidir-dev");
  });

  it("uses the Play-safe exact-alarm permission", () => {
    const { android } = loadConfig();
    expect(android?.permissions).toContain("android.permission.SCHEDULE_EXACT_ALARM");
    expect(android?.permissions).not.toContain("android.permission.USE_EXACT_ALARM");
    expect(android?.blockedPermissions).toContain("android.permission.USE_EXACT_ALARM");
  });

  it("blocks permissions the app doesn't need (each is a Play review question)", () => {
    const blocked = loadConfig().android?.blockedPermissions ?? [];
    for (const p of [
      "RECORD_AUDIO",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
      "SYSTEM_ALERT_WINDOW",
    ]) {
      expect(blocked).toContain(`android.permission.${p}`);
    }
    // The dev client keeps its overlay permission for the dev menu.
    expect(loadConfig("development").android?.blockedPermissions).not.toContain(
      "android.permission.SYSTEM_ALERT_WINDOW",
    );
  });

  it("ships over-the-air updates only to compatible builds", () => {
    const config = loadConfig();
    expect(config.runtimeVersion).toEqual({ policy: "fingerprint" });
    expect(config.updates?.url).toBe("https://u.expo.dev/da82ec53-fc13-49cf-97a9-9864e7969fed");
  });
});
