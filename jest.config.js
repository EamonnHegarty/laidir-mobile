// Two projects:
// - app:  React Native components and screens, on the jest-expo preset.
// - data: the SQLite data layer and contract checks. Plain Node (real SQLite via node:sqlite) with the
//         same Babel transform but without jest-expo's React Native setup, whose lazy runtime globals
//         don't work in a Node test environment.
// passWithNoTests is only valid at the root, not in a project.
const { passWithNoTests: _passWithNoTests, ...expoPreset } = require("jest-expo/jest-preset");

const DATA_TESTS = [
  "<rootDir>/src/data/**/__tests__/**/*.test.ts",
  "<rootDir>/src/__tests__/contract.test.ts",
];
const IGNORE = ["/node_modules/", "/dist/", "/.expo/"];

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: "app",
      preset: "jest-expo",
      testPathIgnorePatterns: [...IGNORE, "/src/data/", "/src/__tests__/contract\\.test\\.ts$"],
    },
    {
      ...expoPreset,
      displayName: "data",
      testEnvironment: "node",
      setupFiles: [],
      setupFilesAfterEnv: [],
      testMatch: DATA_TESTS,
      testPathIgnorePatterns: IGNORE,
    },
  ],
};
