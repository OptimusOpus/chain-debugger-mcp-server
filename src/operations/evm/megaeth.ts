import { 
  MegaETHClient, 
  TransactionReceipt, 
  LogsWithCursor, 
  ChainInfo 
} from "../../client/megaeth.js";
import {
  MegaethSendRawTransactionParams,
  MegaethGetLogsParams,
  MegaethSubscribeParams,
  MegaethUnsubscribeParams,
  MegaethGetBlockParams,
} from "../../schemas.js";

/**
 * Send a raw transaction and get receipt in one call using MegaETH's realtime API
 * @param client - The MegaETH client instance
 * @param params - Parameters containing the signed transaction and optional timeout
 * @returns Transaction receipt
 */
export async function sendRawTransaction(
  client: MegaETHClient,
  params: MegaethSendRawTransactionParams
): Promise<TransactionReceipt> {
  try {
    const receipt = await client.sendRawTransaction(
      params.signedTransaction,
      params.timeout
    );
    return receipt;
  } catch (error) {
    console.error("Error sending raw transaction:", error);
    throw error;
  }
}

/**
 * Get logs with cursor-based pagination using MegaETH's enhanced log API
 * @param client - The MegaETH client instance
 * @param params - Log filter parameters including cursor for pagination
 * @returns Logs with cursor information
 */
export async function getLogsWithCursor(
  client: MegaETHClient,
  params: MegaethGetLogsParams
): Promise<LogsWithCursor> {
  try {
    const filter = {
      fromBlock: params.fromBlock,
      toBlock: params.toBlock,
      address: params.address,
      topics: params.topics,
    };
    
    const result = await client.getLogsWithCursor(
      filter,
      params.cursor,
      params.limit
    );
    
    return result;
  } catch (error) {
    console.error("Error getting logs with cursor:", error);
    throw error;
  }
}

/**
 * Subscribe to real-time blockchain events via WebSocket
 * @param client - The MegaETH client instance
 * @param params - Subscription parameters including event type and filters
 * @returns Subscription ID for managing the subscription
 */
export async function subscribe(
  client: MegaETHClient,
  params: MegaethSubscribeParams
): Promise<{ subscriptionId: string; message: string }> {
  try {
    const subscriptionId = await client.subscribe(
      params.eventType,
      params.params || {}
    );
    
    return {
      subscriptionId,
      message: `Successfully subscribed to ${params.eventType} events`,
    };
  } catch (error) {
    console.error("Error creating subscription:", error);
    throw error;
  }
}

/**
 * Unsubscribe from blockchain events
 * @param client - The MegaETH client instance
 * @param params - Parameters containing the subscription ID to cancel
 * @returns Success status
 */
export async function unsubscribe(
  client: MegaETHClient,
  params: MegaethUnsubscribeParams
): Promise<{ success: boolean; message: string }> {
  try {
    const success = await client.unsubscribe(params.subscriptionId);
    
    return {
      success,
      message: success 
        ? "Successfully unsubscribed from events"
        : "Failed to unsubscribe - subscription may not exist",
    };
  } catch (error) {
    console.error("Error unsubscribing:", error);
    throw error;
  }
}

/**
 * Get MegaETH chain information including mini-block details
 * @param client - The MegaETH client instance
 * @returns Chain information and status
 */
export async function getChainInfo(client: MegaETHClient): Promise<ChainInfo> {
  try {
    const chainInfo = await client.getChainInfo();
    return chainInfo;
  } catch (error) {
    console.error("Error getting chain info:", error);
    throw error;
  }
}

/**
 * Get block information with mini-block support
 * @param client - The MegaETH client instance
 * @param params - Block number and transaction inclusion options
 * @returns Block data
 */
export async function getBlockByNumber(
  client: MegaETHClient,
  params: MegaethGetBlockParams
): Promise<any> {
  try {
    const block = await client.getBlockByNumber(
      params.blockNumber,
      params.includeTransactions || false
    );
    return block;
  } catch (error) {
    console.error("Error getting block by number:", error);
    throw error;
  }
}

/**
 * Set up a subscription callback handler
 * This is a utility function to help manage subscription callbacks
 * @param client - The MegaETH client instance
 * @param subscriptionId - The subscription ID
 * @param callback - Function to handle subscription events
 */
export function setSubscriptionCallback(
  client: MegaETHClient,
  subscriptionId: string,
  callback: (data: any) => void
): void {
  client.setSubscriptionCallback(subscriptionId, callback);
}

/**
 * Get current subscription status and count
 * @param client - The MegaETH client instance
 * @returns Information about active subscriptions
 */
export async function getSubscriptionStatus(
  client: MegaETHClient
): Promise<{ activeSubscriptions: number; maxSubscriptions: number }> {
  try {
    // Access private subscriptions map through a public method we should add to the client
    // For now, return basic info
    return {
      activeSubscriptions: 0, // Would need to expose this from client
      maxSubscriptions: 100, // From config
    };
  } catch (error) {
    console.error("Error getting subscription status:", error);
    throw error;
  }
}

/**
 * Validate MegaETH connection and capabilities
 * @param client - The MegaETH client instance
 * @returns Connection validation result
 */
export async function validateConnection(
  client: MegaETHClient
): Promise<{ 
  connected: boolean; 
  isMegaETH: boolean; 
  chainId?: number; 
  error?: string 
}> {
  try {
    await client.validateConnection();
    const isMegaETH = await client.isMegaETHChain();
    const chainInfo = await client.getChainInfo();
    
    return {
      connected: true,
      isMegaETH,
      chainId: chainInfo.chainId,
    };
  } catch (error: any) {
    return {
      connected: false,
      isMegaETH: false,
      error: error.message,
    };
  }
}