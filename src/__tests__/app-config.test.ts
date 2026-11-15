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

  it("keeps the laidir scheme the phase 3 Cognito redirects rely on", () => {
    expect(loadConfig().scheme).toBe("laidir");
    expect(loadConfig("development").scheme).toBe("laidir");
  });
});
