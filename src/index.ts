#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpAnalytics } from "mcp-analytics-middleware";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { TenderlyClient } from "./client/tenderly.js";
import { EvmRpcClient } from "./client/evm-rpc.js";
import { MegaETHClient } from "./client/megaeth.js";
import { MemoryService } from "./memory/MemoryService.js";
import { getAlertById, listAlerts } from "./operations/alerts.js";
import { simulateTransaction } from "./operations/simulations.js";
import { 
  addDocument as memoryAddDocument,
  queryMemory as memoryQuery,
  listDocuments as memoryListDocuments,
  getDocument as memoryGetDocument,
  removeDocument as memoryRemoveDocument,
  clearMemory as memoryClearMemory,
  getMemoryInfo,
} from "./operations/memory.js";
import { executeRpcCall, getRpcInfo } from "./operations/evm/rpc.js";
import { isQuarantined, getQuarantined } from "./operations/evm/zircuit.js";
import { 
  sendRawTransaction as megaethSendRawTransaction,
  getLogsWithCursor as megaethGetLogsWithCursor,
  subscribe as megaethSubscribe,
  unsubscribe as megaethUnsubscribe,
  getChainInfo as megaethGetChainInfo,
  getBlockByNumber as megaethGetBlockByNumber,
  validateConnection as megaethValidateConnection,
} from "./operations/evm/megaeth.js";
import {
  SimulateTransactionSchema,
  EvmRpcCallSchema,
  ZircuitIsQuarantinedSchema,
  ZircuitGetQuarantinedSchema,
  MegaethSendRawTransactionSchema,
  MegaethGetLogsSchema,
  MegaethSubscribeSchema,
  MegaethUnsubscribeSchema,
  MegaethGetBlockSchema,
  MemoryAddDocumentSchema,
  MemoryQuerySchema,
  MemoryRemoveDocumentSchema,
  MemoryGetDocumentSchema,
} from "./schemas.js";

async function initializeClients() {
  const config = loadConfig();
  const tenderlyClient = new TenderlyClient(config);

  // Initialize EVM RPC client if configured
  let evmRpcClient: EvmRpcClient | null = null;
  let isZircuitChain = false;

  if (config.evmRpcUrl) {
    evmRpcClient = new EvmRpcClient(config);
    try {
      // Validate connection and check if it's Zircuit
      await evmRpcClient.validateConnection();
      isZircuitChain = await evmRpcClient.isZircuitChain();
      if (isZircuitChain) {
        console.error("Detected Zircuit chain, enabling Zircuit-specific tools");
      }
    } catch (error: any) {
      console.error("Warning: Could not connect to EVM RPC endpoint:", error.message);
      console.error("EVM RPC features will be disabled.");
      evmRpcClient = null;
    }
  }

  // Initialize MegaETH client if configured
  let megaethClient: MegaETHClient | null = null;
  let isMegaETHChain = false;

  if (config.megaethRpcUrl) {
    try {
      megaethClient = new MegaETHClient(config);
      await megaethClient.validateConnection();
      isMegaETHChain = await megaethClient.isMegaETHChain();
      console.error("MegaETH connection established");
      if (isMegaETHChain) {
        console.error("Detected MegaETH chain, enabling MegaETH real-time features");
      }
    } catch (error: any) {
      console.error("Warning: Could not connect to MegaETH:", error.message);
      console.error("MegaETH features will be disabled.");
      megaethClient = null;
    }
  }

  // Initialize Memory service if configured
  let memoryService: MemoryService | null = null;
  
  if (config.enableMemory) {
    try {
      memoryService = new MemoryService(config);
      await memoryService.initialize();
      console.error("Memory service initialized successfully");
    } catch (error: any) {
      console.error("Warning: Could not initialize memory service:", error.message);
      console.error("Memory features will be disabled.");
      memoryService = null;
    }
  }

  return { config, tenderlyClient, evmRpcClient, isZircuitChain, megaethClient, isMegaETHChain, memoryService };
}

const { config, tenderlyClient, evmRpcClient, isZircuitChain, megaethClient, isMegaETHChain, memoryService } = await initializeClients();

const GetAlertByIdSchema = z.object({
  id: z.string().describe("The ID of the alert to retrieve"),
});

// Build capabilities based on configuration
const capabilities: any = {
  resources: {
    "tenderly://alerts": {
      description: "All Tenderly alerts for the given project",
    },
    "tenderly://simulations": {
      description: "Tenderly transaction simulations",
    },
  },
  tools: {
    get_alert_by_id: {
      description: "Retrieve a specific Tenderly alert by ID",
    },
    simulate_transaction: {
      description: "Simulate a transaction on Tenderly to predict its outcome",
    },
  },
};

// Add EVM capabilities if configured
if (config.evmRpcUrl) {
  capabilities.resources["evm://rpc_info"] = {
    description: "Information about the current EVM RPC connection",
  };
  capabilities.resources["evm://chain_info"] = {
    description: "Chain ID and network information",
  };
  capabilities.tools["eth_json_rpc_call"] = {
    description: "Execute any Ethereum JSON-RPC method",
  };
  
  // Add Zircuit-specific capabilities if detected
  if (isZircuitChain) {
    capabilities.tools["zirc_isQuarantined"] = {
      description: "Check if a transaction is quarantined on Zircuit",
    };
    capabilities.tools["zirc_getQuarantined"] = {
      description: "Get quarantined transactions on Zircuit",
    };
  }
}

// Add MegaETH capabilities if configured
if (megaethClient) {
  capabilities.resources["megaeth://chain_info"] = {
    description: "MegaETH chain information and mini-block status",
  };
  
  capabilities.tools["megaeth_sendRawTransaction"] = {
    description: "Send transaction and receive receipt in one call using MegaETH's realtime API",
  };
  
  capabilities.tools["megaeth_getLogs"] = {
    description: "Get logs with cursor-based pagination using MegaETH's enhanced API",
  };
  
  capabilities.tools["megaeth_subscribe"] = {
    description: "Subscribe to real-time blockchain events via WebSocket",
  };
  
  capabilities.tools["megaeth_unsubscribe"] = {
    description: "Unsubscribe from blockchain events",
  };
  
  capabilities.tools["megaeth_getBlockByNumber"] = {
    description: "Get block information with mini-block support",
  };
  
  capabilities.tools["megaeth_validateConnection"] = {
    description: "Validate MegaETH connection and check capabilities",
  };
}

// Add Memory capabilities if configured
if (memoryService) {
  capabilities.resources["memory://documents"] = {
    description: "List of all documents stored in memory",
  };
  capabilities.resources["memory://store_info"] = {
    description: "Information about the memory store (document count, path, status)",
  };
  
  capabilities.tools["memory_addDocument"] = {
    description: "Add a document (text content) to the memory store",
  };
  capabilities.tools["memory_queryMemory"] = {
    description: "Search for relevant information in the memory store",
  };
  capabilities.tools["memory_listDocuments"] = {
    description: "List all documents in the memory store",
  };
  capabilities.tools["memory_getDocument"] = {
    description: "Retrieve a specific document by ID",
  };
  capabilities.tools["memory_removeDocument"] = {
    description: "Remove a specific document from the memory store",
  };
  capabilities.tools["memory_clearMemory"] = {
    description: "Clear all documents from the memory store",
  };
}

// Create server instance with all capabilities
let server = new McpServer({
  name: "tenderly-mcp-server",
  version: "0.0.1",
  capabilities,
});

// Apply analytics middleware if enabled
if (config.enableAnalytics) {
  const analytics = new McpAnalytics(config.analyticsDbPath);
  server = analytics.enhance(server);
  console.error("Analytics enabled");
}

// Register the alerts resource
server.resource("list_alerts", "tenderly://alerts", async (uri) => {
  try {
    const alerts = await listAlerts(tenderlyClient);
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(alerts, null, 2),
        },
      ],
    };
  } catch (error) {
    console.error("Error reading alerts resource:", error);
    throw error;
  }
});

server.tool("get_alert_by_id", GetAlertByIdSchema.shape, async (args) => {
  const alert = await getAlertById(tenderlyClient, args.id);
  return {
    content: [
      {
        type: "resource",
        resource: {
          uri: `tenderly://alerts/${args.id}`,
          mimeType: "application/json",
          text: JSON.stringify(alert, null, 2),
        },
      },
    ],
  };
});

server.tool("simulate_transaction", SimulateTransactionSchema.shape, async (args) => {
  const simulationResult = await simulateTransaction(tenderlyClient, args);
  return {
    content: [
      {
        type: "resource",
        resource: {
          uri: `tenderly://simulations/${simulationResult.simulation.id}`,
          mimeType: "application/json",
          text: JSON.stringify(simulationResult, null, 2),
        },
      },
    ],
  };
});

// Register EVM RPC tools and resources if client is available
if (evmRpcClient) {
  // Register EVM resources
  server.resource("evm_rpc_info", "evm://rpc_info", async (uri) => {
    if (!evmRpcClient) {
      throw new Error("EVM RPC client not configured");
    }
    try {
      const info = await getRpcInfo(evmRpcClient);
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(info, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Error reading RPC info resource:", error);
      throw error;
    }
  });

  // Register generic RPC call tool
  server.tool("eth_json_rpc_call", EvmRpcCallSchema.shape, async (args) => {
    if (!evmRpcClient) {
      throw new Error("EVM RPC client not configured");
    }
    try {
      const result = await executeRpcCall(evmRpcClient, args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error executing RPC call: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  });

  // Register Zircuit-specific tools if connected to Zircuit chain
  if (isZircuitChain) {
    server.tool("zirc_isQuarantined", ZircuitIsQuarantinedSchema.shape, async (args) => {
        if (!evmRpcClient) {
          throw new Error("EVM RPC client not configured");
        }
        try {
          const result = await isQuarantined(evmRpcClient, args);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error executing RPC call: ${error.message || "Unknown error"}`,
              },
            ],
          };
        }
      });

      server.tool("zirc_getQuarantined", ZircuitGetQuarantinedSchema.shape, async (args) => {
        if (!evmRpcClient) {
          throw new Error("EVM RPC client not configured");
        }
        try {
          const result = await getQuarantined(evmRpcClient, args);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Error executing RPC call: ${error.message || "Unknown error"}`,
              },
            ],
          };
        }
      });
  }
}

// Register MegaETH tools and resources if client is available
if (megaethClient) {
  // Register MegaETH chain info resource
  server.resource("megaeth_chain_info", "megaeth://chain_info", async (uri) => {
    if (!megaethClient) {
      throw new Error("MegaETH client not configured");
    }
    try {
      const chainInfo = await megaethGetChainInfo(megaethClient);
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(chainInfo, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Error reading MegaETH chain info resource:", error);
      throw error;
    }
  });

  // Register MegaETH tools
  server.tool("megaeth_sendRawTransaction", MegaethSendRawTransactionSchema.shape, async (args) => {
    if (!megaethClient) {
      throw new Error("MegaETH client not configured");
    }
    try {
      const result = await megaethSendRawTransaction(megaethClient, args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error sending transaction: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  });

  server.tool("megaeth_getLogs", MegaethGetLogsSchema.shape, async (args) => {
    if (!megaethClient) {
      throw new Error("MegaETH client not configured");
    }
    try {
      const result = await megaethGetLogsWithCursor(megaethClient, args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting logs: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  });

  server.tool("megaeth_subscribe", MegaethSubscribeSchema.shape, async (args) => {
    if (!megaethClient) {
      throw new Error("MegaETH client not configured");
    }
    try {
      const result = await megaethSubscribe(megaethClient, args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating subscription: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  });

  server.tool("megaeth_unsubscribe", MegaethUnsubscribeSchema.shape, async (args) => {
    if (!megaethClient) {
      throw new Error("MegaETH client not configured");
    }
    try {
      const result = await megaethUnsubscribe(megaethClient, args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error unsubscribing: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  });

  server.tool("megaeth_getBlockByNumber", MegaethGetBlockSchema.shape, async (args) => {
    if (!megaethClient) {
      throw new Error("MegaETH client not configured");
    }
    try {
      const result = await megaethGetBlockByNumber(megaethClient, args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting block: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  });

  server.tool("megaeth_validateConnection", z.object({}).shape, async (args) => {
    if (!megaethClient) {
      throw new Error("MegaETH client not configured");
    }
    try {
      const result = await megaethValidateConnection(megaethClient);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error validating connection: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  });
}

// Register Memory resources and tools if service is available
if (memoryService) {
  // Register memory resources
  server.resource("memory_documents", "memory://documents", async (uri) => {
    if (!memoryService) {
      throw new Error("Memory service not configured");
    }
    try {
      const result = await memoryListDocuments(memoryService);
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Error reading memory documents resource:", error);
      throw error;
    }
  });

  server.resource("memory_store_info", "memory://store_info", async (uri) => {
    if (!memoryService) {
      throw new Error("Memory service not configured");
    }
    try {
      const info = await getMemoryInfo(memoryService);
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(info, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Error reading memory store info resource:", error);
      throw error;
    }
  });

  // Register memory tools
  server.tool("memory_addDocument", MemoryAddDocumentSchema.shape, async (args) => {
    if (!memoryService) {
      throw new Error("Memory service not configured");
    }
    try {
      const result = await memoryAddDocument(memoryService, args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error adding document: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  });

  server.tool("memory_queryMemory", MemoryQuerySchema.shape, async (args) => {
    if (!memoryService) {
      throw new Error("Memory service not configured");
    }
    try {
      const result = await memoryQuery(memoryService, args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error querying memory: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  });

  server.tool("memory_listDocuments", z.object({}).shape, async (args) => {
    if (!memoryService) {
      throw new Error("Memory service not configured");
    }
    try {
      const result = await memoryListDocuments(memoryService);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error listing documents: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  });

  server.tool("memory_getDocument", MemoryGetDocumentSchema.shape, async (args) => {
    if (!memoryService) {
      throw new Error("Memory service not configured");
    }
    try {
      const result = await memoryGetDocument(memoryService, args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting document: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  });

  server.tool("memory_removeDocument", MemoryRemoveDocumentSchema.shape, async (args) => {
    if (!memoryService) {
      throw new Error("Memory service not configured");
    }
    try {
      const result = await memoryRemoveDocument(memoryService, args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error removing document: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  });

  server.tool("memory_clearMemory", z.object({}).shape, async (args) => {
    if (!memoryService) {
      throw new Error("Memory service not configured");
    }
    try {
      const result = await memoryClearMemory(memoryService);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error clearing memory: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  });
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  let serverName = "Tenderly MCP Server";
  const components = ["Tenderly"];
  
  if (evmRpcClient) components.push("EVM RPC");
  if (megaethClient) components.push("MegaETH");
  if (memoryService) components.push("Memory");
  
  if (components.length > 1) {
    serverName = `${components.join(" + ")} MCP Server`;
  }
  
  console.error(`${serverName} running on stdio`);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});