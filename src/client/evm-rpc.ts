import axios from "axios";
import { Config } from "../config.js";

export class EvmRpcClient {
  private readonly rpcUrl: string;
  private readonly chainName: string;
  private chainId: number | null = null;

  constructor(config: Config) {
    this.rpcUrl = config.evmRpcUrl || "https://eth.llamarpc.com";
    this.chainName = config.evmChainName || "Ethereum";
  }

  /**
   * Makes a JSON-RPC call to the Ethereum endpoint
   * @param method - The RPC method to call
   * @param params - The parameters to pass to the method
   * @returns The result of the RPC call
   * @throws Error if the RPC call fails or returns an error
   */
  async callRPC(method: string, params: any[]): Promise<any> {
    if (!method) {
      throw new Error("RPC method is required");
    }

    const payload = {
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    };

    try {
      const response = await axios.post(this.rpcUrl, payload);
      if (response.data.error) {
        const errorMessage = response.data.error.message || "Unknown RPC error";
        throw new Error(`RPC Error: ${errorMessage}`);
      }

      return response.data.result;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      console.error(`Failed RPC call to "${method}":`, errorMessage);

      error.rpcMethod = method;
      error.rpcParams = params;

      throw error;
    }
  }

  /**
   * Gets the chain ID from the Ethereum network
   * @returns The chain ID as an integer
   * @throws Error if the RPC call fails
   */
  async getChainId(): Promise<number> {
    if (this.chainId !== null) {
      return this.chainId;
    }

    try {
      const chainIdHex = await this.callRPC("eth_chainId", []);
      const chainIdInt = parseInt(chainIdHex, 16);
      console.log(`Chain ID: ${chainIdHex} (${chainIdInt} in decimal)`);
      this.chainId = chainIdInt;
      return chainIdInt;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      console.error(`Failed to get chain ID: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Validates the RPC URL by testing the connection
   * @returns true if the connection is valid
   * @throws Error if the connection fails
   */
  async validateConnection(): Promise<boolean> {
    console.log(`Validating Ethereum RPC URL: ${this.rpcUrl}`);

    try {
      // Test the connection with a simple eth_blockNumber call
      const blockNumber = await this.callRPC("eth_blockNumber", []);
      console.log(`✅ RPC endpoint is working. Current block number: ${blockNumber}`);
      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      console.error(`❌ Failed to connect to RPC endpoint: ${errorMessage}`);
      console.error(
        "Please check that the URL is correct and the endpoint is accessible."
      );
      throw error;
    }
  }

  /**
   * Checks if the connected chain is Zircuit
   * @returns true if the chain ID matches Zircuit
   */
  async isZircuitChain(): Promise<boolean> {
    const ZIRCUIT_CHAIN_ID = 48900;
    const chainId = await this.getChainId();
    return chainId === ZIRCUIT_CHAIN_ID;
  }

  /**
   * Get the RPC URL
   */
  getRpcUrl(): string {
    return this.rpcUrl;
  }

  /**
   * Get the chain name
   */
  getChainName(): string {
    return this.chainName;
  }
}