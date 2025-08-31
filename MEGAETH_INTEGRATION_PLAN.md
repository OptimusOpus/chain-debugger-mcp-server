# MegaETH Realtime API Integration Plan

## 1. Overview

MegaETH is a high-performance Ethereum-compatible blockchain that offers a Realtime API for low-latency access to transaction and state data. This document outlines a comprehensive plan to integrate the MegaETH Realtime API into the Tenderly MCP server, enabling developers to leverage its real-time features through new MCP operations.

## 2. Key Features

The MegaETH Realtime API provides several key features that differentiate it from the standard Ethereum JSON-RPC API:

- **Real-time State Queries**: Methods that query chain and account states return values as of the most recent mini block when using `pending` or `latest` tags.
- **Instant Transaction Visibility**: Methods that query transaction data can see and return results as soon as a transaction is included in a mini block.
- **WebSocket Subscriptions**: The `eth_subscribe` method, when used over a WebSocket connection, streams transaction logs, state changes, and block content as soon as the corresponding mini block is produced.
- **Simplified Transaction Sending**: The `realtime_sendRawTransaction` method submits a transaction and returns the receipt in a single call, eliminating the need for polling.
- **Paginated Log Queries**: The `eth_getLogsWithCursor` method supports paginated log queries using a cursor, allowing for efficient retrieval of large datasets.
- **Mini Blocks**: High-frequency block production with sub-second latency, enabling real-time data access.

## 3. Implementation Architecture

### 3.1 Configuration Updates

Update `src/config.ts` to include MegaETH-specific configuration:

```typescript
const configSchema = z.object({
  // Existing configuration...
  
  // MegaETH configuration (optional)
  megaethRpcUrl: z.string().optional(),
  megaethWsUrl: z.string().optional(),
  megaethChainId: z.number().optional(),
  megaethConnectionTimeout: z.number().default(30000).optional(),
  megaethMaxSubscriptions: z.number().default(100).optional(),
});
```

Environment variables:
- `MEGAETH_RPC_URL`: HTTP/HTTPS endpoint for standard RPC calls
- `MEGAETH_WS_URL`: WebSocket endpoint for subscriptions
- `MEGAETH_CHAIN_ID`: Chain ID for validation

### 3.2 Client Implementation

Create `src/client/megaeth.ts` following the existing client pattern:

```typescript
export class MegaETHClient {
  private readonly httpClient: AxiosInstance;
  private wsClient: WebSocket | null = null;
  private subscriptions: Map<string, Subscription>;
  
  constructor(config: Config) {
    // Initialize HTTP client with retry logic
    // Setup WebSocket connection manager
  }
  
  // Core methods
  async validateConnection(): Promise<void>
  async isMegaETHChain(): Promise<boolean>
  async callRPC(method: string, params: any[]): Promise<any>
  
  // WebSocket methods
  async connectWebSocket(): Promise<void>
  async subscribe(eventType: string, params: any): Promise<string>
  async unsubscribe(subscriptionId: string): Promise<boolean>
  
  // Specialized methods
  async sendRawTransaction(signedTx: string): Promise<TransactionReceipt>
  async getLogsWithCursor(filter: LogFilter, cursor?: string): Promise<LogsWithCursor>
}
```

### 3.3 Operation Structure

Create `src/operations/evm/megaeth.ts`:

```typescript
// Transaction operations
export async function sendRawTransaction(
  client: MegaETHClient,
  params: MegaethSendRawTransactionParams
): Promise<TransactionReceipt>

// Log operations
export async function getLogsWithCursor(
  client: MegaETHClient,
  params: MegaethGetLogsParams
): Promise<LogsWithCursor>

// Subscription operations
export async function subscribe(
  client: MegaETHClient,
  params: MegaethSubscribeParams
): Promise<SubscriptionResponse>

export async function unsubscribe(
  client: MegaETHClient,
  params: MegaethUnsubscribeParams
): Promise<boolean>

// Chain info operations
export async function getChainInfo(
  client: MegaETHClient
): Promise<ChainInfo>

// Block operations with mini-block support
export async function getBlockByNumber(
  client: MegaETHClient,
  params: MegaethGetBlockParams
): Promise<Block>
```

### 3.4 Schema Definitions

Add to `src/schemas.ts`:

```typescript
// Transaction schemas
export const MegaethSendRawTransactionSchema = z.object({
  signedTransaction: z.string().describe("Signed transaction data in hex format"),
  timeout: z.number().optional().describe("Timeout in milliseconds for transaction inclusion"),
});

// Log query schemas
export const MegaethGetLogsSchema = z.object({
  fromBlock: z.union([z.number(), z.string()]).optional(),
  toBlock: z.union([z.number(), z.string()]).optional(),
  address: z.union([z.string(), z.array(z.string())]).optional(),
  topics: z.array(z.union([z.string(), z.array(z.string()), z.null()])).optional(),
  cursor: z.string().optional().describe("Cursor for pagination"),
  limit: z.number().min(1).max(1000).default(100).optional(),
});

// Subscription schemas
export const MegaethSubscribeSchema = z.object({
  eventType: z.enum(["newHeads", "logs", "newPendingTransactions", "syncing"]),
  params: z.record(z.any()).optional().describe("Event-specific parameters"),
});

export const MegaethUnsubscribeSchema = z.object({
  subscriptionId: z.string().describe("Subscription ID to cancel"),
});
```

## 4. Technical Implementation Details

### 4.1 WebSocket Manager

Implement a robust WebSocket connection manager:

```typescript
class WebSocketManager {
  private connection: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timer | null = null;
  
  async connect(url: string): Promise<void>
  async disconnect(): Promise<void>
  private setupHeartbeat(): void
  private handleReconnection(): Promise<void>
  
  on(event: string, handler: Function): void
  removeListener(event: string, handler: Function): void
}
```

### 4.2 Error Handling

Define custom error types:

```typescript
export class MegaETHError extends Error {
  constructor(message: string, public code: string, public data?: any) {
    super(message);
  }
}

export class RealtimeTransactionExpiredError extends MegaETHError {
  constructor(txHash: string) {
    super(`Transaction ${txHash} expired before inclusion`, "REALTIME_TX_EXPIRED");
  }
}

export class MiniBlockNotFoundError extends MegaETHError {
  constructor(blockNumber: number) {
    super(`Mini block ${blockNumber} not found`, "MINI_BLOCK_NOT_FOUND");
  }
}

export class SubscriptionLimitError extends MegaETHError {
  constructor(limit: number) {
    super(`Subscription limit of ${limit} exceeded`, "SUBSCRIPTION_LIMIT_EXCEEDED");
  }
}
```

### 4.3 Connection Pooling and Rate Limiting

Implement connection pooling for HTTP requests:

```typescript
class ConnectionPool {
  private pool: AxiosInstance[];
  private currentIndex = 0;
  
  constructor(urls: string[], maxConnections: number = 5) {
    // Initialize connection pool
  }
  
  getConnection(): AxiosInstance {
    // Round-robin connection selection
  }
}
```

Rate limiting implementation:

```typescript
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;
  
  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }
  
  async checkLimit(): Promise<boolean> {
    // Check if request can proceed
  }
}
```

## 5. MCP Server Integration

Update `src/index.ts` to include MegaETH capabilities:

```typescript
// Initialize MegaETH client if configured
let megaethClient: MegaETHClient | null = null;
if (config.megaethRpcUrl) {
  megaethClient = new MegaETHClient(config);
  try {
    await megaethClient.validateConnection();
    console.error("MegaETH connection established");
  } catch (error) {
    console.error("Warning: Could not connect to MegaETH:", error.message);
    megaethClient = null;
  }
}

// Add MegaETH capabilities
if (megaethClient) {
  capabilities.resources["megaeth://chain_info"] = {
    description: "MegaETH chain information and mini-block status",
  };
  
  capabilities.tools["megaeth_sendRawTransaction"] = {
    description: "Send transaction and receive receipt in one call",
  };
  
  capabilities.tools["megaeth_getLogs"] = {
    description: "Get logs with cursor-based pagination",
  };
  
  capabilities.tools["megaeth_subscribe"] = {
    description: "Subscribe to real-time blockchain events",
  };
  
  capabilities.tools["megaeth_unsubscribe"] = {
    description: "Unsubscribe from blockchain events",
  };
}
```

## 6. Testing Strategy

### 6.1 Unit Tests

- Test each operation in isolation
- Mock MegaETH RPC responses
- Test error handling scenarios
- Validate schema parsing

### 6.2 Integration Tests

- Test full transaction lifecycle
- Verify WebSocket subscription flow
- Test pagination with cursors
- Validate mini-block behavior

### 6.3 Load Tests

- Test WebSocket connection limits
- Verify rate limiting behavior
- Test connection pool performance
- Measure response latencies

## 7. Documentation

### 7.1 API Reference

Document each MCP operation with:
- Description and use cases
- Parameter specifications
- Response format
- Error conditions
- Code examples

### 7.2 Integration Guide

- Setup instructions
- Configuration options
- Best practices
- Troubleshooting guide

### 7.3 Examples

Provide examples for common use cases:
- Monitoring new transactions
- Tracking contract events
- Building real-time dashboards
- Transaction status tracking

## 8. Security Considerations

- **Input Validation**: Validate all parameters against schemas
- **Connection Security**: Use TLS for all connections
- **Authentication**: Support API key authentication if required
- **Resource Limits**: Implement subscription and connection limits
- **Audit Logging**: Log all operations for security monitoring

## 9. Performance Optimizations

- **Connection Reuse**: Maintain persistent connections
- **Batch Operations**: Support batch RPC calls where applicable
- **Caching**: Cache chain info and static data
- **Compression**: Enable WebSocket compression
- **Resource Cleanup**: Properly close connections and clear subscriptions

## 10. Future Enhancements

- **Analytics Integration**: Track usage patterns and performance metrics
- **Multi-chain Support**: Extend to support multiple MegaETH networks
- **Advanced Filtering**: Support complex event filtering
- **State Proof Verification**: Add merkle proof validation
- **GraphQL Support**: If MegaETH adds GraphQL endpoints
