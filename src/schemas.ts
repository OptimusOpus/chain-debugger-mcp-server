import { z } from "zod";

// Schema for alert response
export const AlertSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  expressions: z.array(z.object({
    type: z.string(),
    expression: z.record(z.any())  // Allow any expression structure
  })),
  delivery_channels: z.array(z.object({
    delivery_channel_id: z.string(),
    delivery_channel: z.object({
      id: z.string(),
      type: z.string(),
      owner_id: z.string(),
      project_id: z.string().nullable(),
      label: z.string(),
      reference_id: z.string(),
      enabled: z.boolean(),
      created_at: z.string(),
      information: z.record(z.any())
    }),
    enabled: z.boolean(),
    created_at: z.string()
  })),
  project_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  color: z.string().nullable(),
  severity: z.string(),
  is_editable: z.boolean()
});

export const GetAlertsResponseSchema = z.object({
  alerts: z.array(AlertSchema)
});

export const GetAlertResponseSchema = z.object({
  alert: AlertSchema
});

// Schema for the simulate_transaction tool arguments
export const SimulateTransactionSchema = z.object({
  network_id: z.string().describe("ID of the network to run the simulation on."),
  from: z.string().describe("Address initiating the transaction."),
  to: z.string().describe("The recipient address of the transaction."),
  input: z.string().describe("Encoded contract method call data."),
  gas: z.number().describe("Amount of gas provided for the simulation."),
  gas_price: z.string().optional().describe("The gas price for the transaction."),
  value: z.string().optional().describe("The value transferred in the transaction (in wei)."),
  block_number: z.union([z.number(), z.literal("latest")]).optional().describe("Simulate transaction at a specific block number or 'latest'."),
  simulation_type: z.enum(["full", "quick"]).optional().describe("The type of simulation to run ('full' or 'quick').")
});

export type SimulateTransactionParams = z.infer<typeof SimulateTransactionSchema>;

// Schema for generic EVM RPC calls
export const EvmRpcCallSchema = z.object({
  method: z.string().describe("The JSON-RPC method to execute"),
  params: z.array(z.any()).describe("The parameters for the JSON-RPC method"),
});

export type EvmRpcCallParams = z.infer<typeof EvmRpcCallSchema>;

// Schema for Zircuit-specific RPC calls
export const ZircuitIsQuarantinedSchema = z.object({
  transactionHash: z.string().describe("The transaction hash to check quarantine status"),
});

export const ZircuitGetQuarantinedSchema = z.object({
  address: z.string().optional().describe("Optional address to filter quarantined transactions"),
});

export type ZircuitIsQuarantinedParams = z.infer<typeof ZircuitIsQuarantinedSchema>;
export type ZircuitGetQuarantinedParams = z.infer<typeof ZircuitGetQuarantinedSchema>;

// MegaETH schemas
export const MegaethSendRawTransactionSchema = z.object({
  signedTransaction: z.string().describe("Signed transaction data in hex format"),
  timeout: z.number().optional().describe("Timeout in milliseconds for transaction inclusion"),
});

export const MegaethGetLogsSchema = z.object({
  fromBlock: z.union([z.number(), z.string()]).optional().describe("Starting block number or 'latest'"),
  toBlock: z.union([z.number(), z.string()]).optional().describe("Ending block number or 'latest'"),
  address: z.union([z.string(), z.array(z.string())]).optional().describe("Contract address(es) to filter logs"),
  topics: z.array(z.union([z.string(), z.array(z.string()), z.null()])).optional().describe("Topics to filter logs"),
  cursor: z.string().optional().describe("Cursor for pagination"),
  limit: z.number().min(1).max(1000).default(100).optional().describe("Maximum number of logs to return"),
});

export const MegaethSubscribeSchema = z.object({
  eventType: z.enum(["newHeads", "logs", "newPendingTransactions", "syncing"]).describe("Type of blockchain events to subscribe to"),
  params: z.record(z.any()).optional().describe("Event-specific parameters (e.g., log filters)"),
});

export const MegaethUnsubscribeSchema = z.object({
  subscriptionId: z.string().describe("Subscription ID to cancel"),
});

export const MegaethGetBlockSchema = z.object({
  blockNumber: z.union([z.number(), z.string()]).describe("Block number or 'latest'/'pending'"),
  includeTransactions: z.boolean().default(false).optional().describe("Whether to include transaction details"),
});

export type MegaethSendRawTransactionParams = z.infer<typeof MegaethSendRawTransactionSchema>;
export type MegaethGetLogsParams = z.infer<typeof MegaethGetLogsSchema>;
export type MegaethSubscribeParams = z.infer<typeof MegaethSubscribeSchema>;
export type MegaethUnsubscribeParams = z.infer<typeof MegaethUnsubscribeSchema>;
export type MegaethGetBlockParams = z.infer<typeof MegaethGetBlockSchema>;

// Memory/RAG schemas
export const MemoryAddDocumentSchema = z.object({
  content: z.string().min(1).describe("The text content to add to memory"),
  title: z.string().optional().describe("Optional title for the document"),
  source: z.string().optional().describe("Optional source identifier (e.g., file path, URL)"),
});

export const MemoryQuerySchema = z.object({
  query: z.string().min(1).describe("The question or search query"),
  limit: z.number().min(1).max(20).default(5).optional().describe("Maximum number of results to return"),
});

export const MemoryRemoveDocumentSchema = z.object({
  id: z.string().describe("The document ID to remove"),
});

export const MemoryGetDocumentSchema = z.object({
  id: z.string().describe("The document ID to retrieve"),
});

export type MemoryAddDocumentParams = z.infer<typeof MemoryAddDocumentSchema>;
export type MemoryQueryParams = z.infer<typeof MemoryQuerySchema>;
export type MemoryRemoveDocumentParams = z.infer<typeof MemoryRemoveDocumentSchema>;
export type MemoryGetDocumentParams = z.infer<typeof MemoryGetDocumentSchema>;
