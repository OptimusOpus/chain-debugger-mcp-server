import axios, { AxiosInstance } from "axios";
import { Config } from "../config.js";
import WebSocket from "ws";

export interface TransactionReceipt {
  blockHash: string;
  blockNumber: string;
  contractAddress: string | null;
  cumulativeGasUsed: string;
  from: string;
  gasUsed: string;
  logs: any[];
  logsBloom: string;
  status: string;
  to: string | null;
  transactionHash: string;
  transactionIndex: string;
  type: string;
}

export interface LogFilter {
  fromBlock?: number | string;
  toBlock?: number | string;
  address?: string | string[];
  topics?: (string | string[] | null)[];
}

export interface LogsWithCursor {
  logs: any[];
  cursor?: string;
  hasMore: boolean;
}

export interface Subscription {
  id: string;
  eventType: string;
  params: any;
  callback: (data: any) => void;
}

export interface ChainInfo {
  chainId: number;
  networkName: string;
  isRealtimeEnabled: boolean;
  latestBlock: number;
  miniBlockInterval: number;
}

export class MegaETHError extends Error {
  constructor(message: string, public code: string, public data?: any) {
    super(message);
    this.name = "MegaETHError";
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

class WebSocketManager {
  private connection: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private eventHandlers: Map<string, Function[]> = new Map();
  private isConnecting = false;
  
  constructor(private url: string, private timeout: number = 30000) {}
  
  async connect(): Promise<void> {
    if (this.connection && this.connection.readyState === WebSocket.OPEN) {
      return;
    }
    
    if (this.isConnecting) {
      return new Promise((resolve, reject) => {
        const checkConnection = () => {
          if (this.connection && this.connection.readyState === WebSocket.OPEN) {
            resolve();
          } else if (!this.isConnecting) {
            reject(new Error("Connection failed"));
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });
    }
    
    this.isConnecting = true;
    
    try {
      this.connection = new WebSocket(this.url);
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("WebSocket connection timeout"));
        }, this.timeout);
        
        this.connection!.on("open", () => {
          clearTimeout(timeout);
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.setupHeartbeat();
          resolve();
        });
        
        this.connection!.on("error", (error) => {
          clearTimeout(timeout);
          this.isConnecting = false;
          reject(error);
        });
        
        this.connection!.on("close", () => {
          this.isConnecting = false;
          this.handleReconnection();
        });
        
        this.connection!.on("message", (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.emit("message", message);
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        });
      });
    } catch (error) {
      this.isConnecting = false;
      throw error;
    }
  }
  
  async disconnect(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    
    this.eventHandlers.clear();
  }
  
  private setupHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(() => {
      if (this.connection && this.connection.readyState === WebSocket.OPEN) {
        this.connection.ping();
      }
    }, 30000); // Ping every 30 seconds
  }
  
  private async handleReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit("maxReconnectAttemptsReached");
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    setTimeout(async () => {
      try {
        await this.connect();
        this.emit("reconnected");
      } catch (error) {
        this.emit("reconnectFailed", error);
      }
    }, delay);
  }
  
  send(data: any): void {
    if (this.connection && this.connection.readyState === WebSocket.OPEN) {
      this.connection.send(JSON.stringify(data));
    } else {
      throw new Error("WebSocket connection not open");
    }
  }
  
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }
  
  removeListener(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }
  
  private emit(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }
}

export class MegaETHClient {
  private readonly httpClient: AxiosInstance;
  private wsManager: WebSocketManager | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private requestId = 1;
  
  constructor(private config: Config) {
    if (!config.megaethRpcUrl) {
      throw new Error("MegaETH RPC URL is required");
    }
    
    this.httpClient = axios.create({
      baseURL: config.megaethRpcUrl,
      timeout: config.megaethConnectionTimeout || 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    // Initialize WebSocket manager if WebSocket URL is provided
    if (config.megaethWsUrl) {
      this.wsManager = new WebSocketManager(
        config.megaethWsUrl,
        config.megaethConnectionTimeout || 30000
      );
      
      this.wsManager.on("message", (message: any) => {
        this.handleWebSocketMessage(message);
      });
      
      this.wsManager.on("reconnected", () => {
        this.resubscribeAll();
      });
    }
  }
  
  async validateConnection(): Promise<void> {
    try {
      const result = await this.callRPC("eth_chainId", []);
      if (this.config.megaethChainId && parseInt(result, 16) !== this.config.megaethChainId) {
        throw new Error(`Chain ID mismatch: expected ${this.config.megaethChainId}, got ${parseInt(result, 16)}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to validate MegaETH connection: ${error.message}`);
    }
  }
  
  async isMegaETHChain(): Promise<boolean> {
    try {
      // Try to call a MegaETH-specific method to verify it's a MegaETH chain
      await this.callRPC("realtime_sendRawTransaction", []);
      return false; // This call should fail with method not found, but if it doesn't error it means we're on MegaETH
    } catch (error: any) {
      // Check if the error indicates the method exists but has wrong parameters
      return error.message && !error.message.includes("method not found");
    }
  }
  
  async callRPC(method: string, params: any[]): Promise<any> {
    if (!method) {
      throw new Error("RPC method is required");
    }
    
    const payload = {
      jsonrpc: "2.0",
      id: this.requestId++,
      method,
      params,
    };
    
    try {
      const response = await this.httpClient.post("/", payload);
      
      if (response.data.error) {
        const errorMessage = response.data.error.message || "Unknown RPC error";
        const errorCode = response.data.error.code || "UNKNOWN";
        
        // Handle specific MegaETH errors
        if (errorMessage.includes("realtime transaction expired")) {
          throw new RealtimeTransactionExpiredError(params[0] || "unknown");
        }
        if (errorMessage.includes("mini block not found")) {
          throw new MiniBlockNotFoundError(params[0] || 0);
        }
        
        throw new MegaETHError(errorMessage, errorCode, response.data.error.data);
      }
      
      return response.data.result;
    } catch (error: any) {
      if (error instanceof MegaETHError) {
        throw error;
      }
      
      const errorMessage = error.response?.data?.error?.message || error.message;
      console.error(`Failed RPC call to "${method}":`, errorMessage);
      
      error.rpcMethod = method;
      error.rpcParams = params;
      
      throw error;
    }
  }
  
  async connectWebSocket(): Promise<void> {
    if (!this.wsManager) {
      throw new Error("WebSocket URL not configured");
    }
    
    await this.wsManager.connect();
  }
  
  async subscribe(eventType: string, params: any = {}): Promise<string> {
    if (!this.wsManager) {
      throw new Error("WebSocket not configured");
    }
    
    if (this.subscriptions.size >= (this.config.megaethMaxSubscriptions || 100)) {
      throw new SubscriptionLimitError(this.config.megaethMaxSubscriptions || 100);
    }
    
    await this.connectWebSocket();
    
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const payload = {
      jsonrpc: "2.0",
      id: this.requestId++,
      method: "eth_subscribe",
      params: [eventType, params],
    };
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Subscription timeout"));
      }, 10000);
      
      const messageHandler = (message: any): void => {
        if (message.id === payload.id) {
          clearTimeout(timeout);
          this.wsManager!.removeListener("message", messageHandler);
          
          if (message.error) {
            reject(new MegaETHError(message.error.message, message.error.code));
          } else {
            const serverSubId = message.result;
            this.subscriptions.set(subscriptionId, {
              id: serverSubId,
              eventType,
              params,
              callback: () => {}, // Will be set by caller
            });
            resolve(subscriptionId);
          }
        }
      };
      
      this.wsManager!.on("message", messageHandler);
      this.wsManager!.send(payload);
    });
  }
  
  async unsubscribe(subscriptionId: string): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }
    
    if (!this.wsManager) {
      return false;
    }
    
    const payload = {
      jsonrpc: "2.0",
      id: this.requestId++,
      method: "eth_unsubscribe",
      params: [subscription.id],
    };
    
    try {
      this.wsManager.send(payload);
      this.subscriptions.delete(subscriptionId);
      return true;
    } catch (error) {
      console.error("Failed to unsubscribe:", error);
      return false;
    }
  }
  
  async sendRawTransaction(signedTx: string, timeout?: number): Promise<TransactionReceipt> {
    const params = timeout ? [signedTx, timeout] : [signedTx];
    return await this.callRPC("realtime_sendRawTransaction", params);
  }
  
  async getLogsWithCursor(filter: LogFilter, cursor?: string, limit?: number): Promise<LogsWithCursor> {
    const params: any = { ...filter };
    if (cursor) params.cursor = cursor;
    if (limit) params.limit = limit;
    
    const result = await this.callRPC("eth_getLogsWithCursor", [params]);
    
    return {
      logs: result.logs || [],
      cursor: result.cursor,
      hasMore: !!result.cursor,
    };
  }
  
  async getChainInfo(): Promise<ChainInfo> {
    const [chainId, blockNumber] = await Promise.all([
      this.callRPC("eth_chainId", []),
      this.callRPC("eth_blockNumber", []),
    ]);
    
    return {
      chainId: parseInt(chainId, 16),
      networkName: "MegaETH",
      isRealtimeEnabled: true,
      latestBlock: parseInt(blockNumber, 16),
      miniBlockInterval: 100, // 100ms mini blocks (example)
    };
  }
  
  async getBlockByNumber(blockNumber: number | string, includeTransactions: boolean = false): Promise<any> {
    const blockParam = typeof blockNumber === "number" ? `0x${blockNumber.toString(16)}` : blockNumber;
    return await this.callRPC("eth_getBlockByNumber", [blockParam, includeTransactions]);
  }
  
  private handleWebSocketMessage(message: any): void {
    if (message.method === "eth_subscription") {
      const subscriptionData = message.params;
      const serverSubId = subscriptionData.subscription;
      
      // Find the local subscription by server subscription ID
      for (const [localId, subscription] of this.subscriptions.entries()) {
        if (subscription.id === serverSubId) {
          subscription.callback(subscriptionData.result);
          break;
        }
      }
    }
  }
  
  private async resubscribeAll(): Promise<void> {
    const currentSubscriptions = Array.from(this.subscriptions.entries());
    this.subscriptions.clear();
    
    for (const [localId, subscription] of currentSubscriptions) {
      try {
        await this.subscribe(subscription.eventType, subscription.params);
      } catch (error) {
        console.error(`Failed to resubscribe to ${subscription.eventType}:`, error);
      }
    }
  }
  
  setSubscriptionCallback(subscriptionId: string, callback: (data: any) => void): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.callback = callback;
    }
  }
  
  async disconnect(): Promise<void> {
    if (this.wsManager) {
      await this.wsManager.disconnect();
    }
    this.subscriptions.clear();
  }
}