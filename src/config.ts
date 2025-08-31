import { z } from "zod";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const configSchema = z.object({
  // Tenderly configuration
  accountSlug: z.string().min(1, "Account slug is required"),
  projectId: z.string().min(1, "Project ID is required"),
  accessToken: z.string().min(1, "Access token is required"),
  
  // EVM RPC configuration (optional)
  evmRpcUrl: z.string().optional(),
  evmChainName: z.string().optional(),
  enableAnalytics: z.boolean().optional(),
  analyticsDbPath: z.string().optional(),
  
  // MegaETH configuration (optional)
  megaethRpcUrl: z.string().optional(),
  megaethWsUrl: z.string().optional(),
  megaethChainId: z.number().optional(),
  megaethConnectionTimeout: z.number().default(30000).optional(),
  megaethMaxSubscriptions: z.number().default(100).optional(),
  
  // Memory/RAG configuration (optional)
  enableMemory: z.boolean().default(false).optional(),
  memoryStorePath: z.string().default("./memory_store").optional(),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let evmRpcUrl = process.env.EVM_RPC_URL;
  let evmChainName = process.env.EVM_CHAIN_NAME;
  let enableAnalytics = process.env.ENABLE_ANALYTICS === "true";
  let analyticsDbPath = process.env.ANALYTICS_DB_PATH;
  
  // MegaETH configuration
  let megaethRpcUrl = process.env.MEGAETH_RPC_URL;
  let megaethWsUrl = process.env.MEGAETH_WS_URL;
  let megaethChainId = process.env.MEGAETH_CHAIN_ID ? parseInt(process.env.MEGAETH_CHAIN_ID) : undefined;
  let megaethConnectionTimeout = process.env.MEGAETH_CONNECTION_TIMEOUT ? parseInt(process.env.MEGAETH_CONNECTION_TIMEOUT) : 30000;
  let megaethMaxSubscriptions = process.env.MEGAETH_MAX_SUBSCRIPTIONS ? parseInt(process.env.MEGAETH_MAX_SUBSCRIPTIONS) : 100;
  
  // Memory/RAG configuration
  let enableMemory = process.env.ENABLE_MEMORY === "true";
  let memoryStorePath = process.env.MEMORY_STORE_PATH || "./memory_store";

  // Check for command line overrides
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--rpc-url" && i + 1 < args.length) {
      evmRpcUrl = args[i + 1];
      i++;
    } else if (args[i] === "--chain-name" && i + 1 < args.length) {
      evmChainName = args[i + 1];
      i++;
    } else if (args[i] === "--analytics") {
      enableAnalytics = true;
    } else if (args[i] === "--db-path" && i + 1 < args.length) {
      analyticsDbPath = args[i + 1];
      i++;
    } else if (args[i].startsWith("--db-path=")) {
      analyticsDbPath = args[i].substring("--db-path=".length);
    }
  }

  const config = {
    accountSlug: process.env.TENDERLY_ACCOUNT_SLUG,
    projectId: process.env.TENDERLY_PROJECT_ID,
    accessToken: process.env.TENDERLY_ACCESS_TOKEN,
    evmRpcUrl,
    evmChainName,
    enableAnalytics,
    analyticsDbPath,
    megaethRpcUrl,
    megaethWsUrl,
    megaethChainId,
    megaethConnectionTimeout,
    megaethMaxSubscriptions,
    enableMemory,
    memoryStorePath,
  };

  const result = configSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Configuration error: ${result.error.message}`);
  }

  return result.data;
} 