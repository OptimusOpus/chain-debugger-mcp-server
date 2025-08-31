import { EvmRpcClient } from "../../client/evm-rpc.js";
import {
  ZircuitIsQuarantinedParams,
  ZircuitGetQuarantinedParams,
} from "../../schemas.js";

/**
 * Check if a transaction is quarantined on Zircuit
 * @param client - The EVM RPC client instance
 * @param params - Parameters containing the transaction hash
 * @returns The quarantine status of the transaction
 */
export async function isQuarantined(
  client: EvmRpcClient,
  params: ZircuitIsQuarantinedParams
): Promise<any> {
  try {
    const result = await client.callRPC("zirc_isQuarantined", [
      params.transactionHash,
    ]);
    return result;
  } catch (error) {
    console.error("Error checking quarantine status:", error);
    throw error;
  }
}

/**
 * Get quarantined transactions on Zircuit, optionally filtered by address
 * @param client - The EVM RPC client instance
 * @param params - Optional parameters containing an address to filter by
 * @returns List of quarantined transactions
 */
export async function getQuarantined(
  client: EvmRpcClient,
  params: ZircuitGetQuarantinedParams
): Promise<any> {
  try {
    const rpcParams = params.address ? [params.address] : [];
    const result = await client.callRPC("zirc_getQuarantined", rpcParams);
    return result;
  } catch (error) {
    console.error("Error getting quarantined transactions:", error);
    throw error;
  }
}