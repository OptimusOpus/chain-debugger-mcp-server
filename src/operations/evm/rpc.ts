import { EvmRpcClient } from "../../client/evm-rpc.js";
import { EvmRpcCallParams } from "../../schemas.js";

/**
 * Execute a generic JSON-RPC call
 * @param client - The EVM RPC client instance
 * @param params - The RPC method and parameters
 * @returns The result of the RPC call
 */
export async function executeRpcCall(
  client: EvmRpcClient,
  params: EvmRpcCallParams
): Promise<any> {
  try {
    const result = await client.callRPC(params.method, params.params);
    return result;
  } catch (error) {
    console.error(`Error executing RPC call ${params.method}:`, error);
    throw error;
  }
}

/**
 * Get information about the current RPC connection
 * @param client - The EVM RPC client instance
 * @returns Object containing RPC URL and chain name
 */
export async function getRpcInfo(client: EvmRpcClient): Promise<{
  rpcUrl: string;
  chainName: string;
  chainId: number | null;
}> {
  try {
    const chainId = await client.getChainId().catch(() => null);
    return {
      rpcUrl: client.getRpcUrl(),
      chainName: client.getChainName(),
      chainId,
    };
  } catch (error) {
    console.error("Error getting RPC info:", error);
    throw error;
  }
}