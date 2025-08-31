import { afterEach, vi } from "vitest";
import type { Config } from "../src/config.js";

export function createTestConfig(overrides: Partial<Config> = {}): Config {
  const base: Config = {
    accountSlug: "test-account",
    projectId: "test-project",
    accessToken: "test-token",
    evmRpcUrl: "http://localhost:8545",
    evmChainName: "Testnet",
    enableAnalytics: false,
    analyticsDbPath: "./tmp/analytics.db",
    megaethRpcUrl: "http://localhost:18545",
    megaethWsUrl: undefined,
    megaethChainId: 1337,
    megaethConnectionTimeout: 1000,
    megaethMaxSubscriptions: 3,
    enableMemory: false,
    memoryStorePath: "./memory_store",
  } as Config;
  return { ...base, ...overrides } as Config;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.resetModules();
});
