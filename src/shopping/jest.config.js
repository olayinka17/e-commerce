import { createDefaultPreset } from "ts-jest";

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
export default {
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts"],
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
//   testEnvironment: "jest-doctor/env/node",
//   // optional
//   reporters: ["default", "jest-doctor/reporter"],
//   testEnvironmentOptions: {
//   verbose: true,
//   timerIsolation: "afterEach",
//   clearTimers: false,
//   delayThreshold: Number.MAX_SAFE_INTEGER,
//   report: {
//     timers: { onError: "warn" },
//     console: false,
//     processOutputs: false,
//     promises: false,
//   },
// },
  extensionsToTreatAsEsm: [".ts"],
  moduleFileExtensions: ["ts", "js"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  roots: ["<rootDir>/src/test"],
};
