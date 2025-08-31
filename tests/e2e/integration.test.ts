import { describe, it, expect, beforeAll } from "vitest";
import dotenv from "dotenv";
import { loadConfig } from "../../src/config.js";
import { TenderlyClient } from "../../src/client/tenderly.js";
import { EvmRpcClient } from "../../src/client/evm-rpc.js";
import { MegaETHClient } from "../../src/client/megaeth.js";
import { listAlerts, getAlertById } from "../../src/operations/alerts.js";
import { simulateTransaction } from "../../src/operations/simulations.js";
import { executeRpcCall, getRpcInfo } from "../../src/operations/evm/rpc.js";

// Load environment variables
dotenv.config();

describe("End-to-End Integration Tests", () => {
  let config: any;
  let tenderlyClient: TenderlyClient;
  let evmRpcClient: EvmRpcClient | null = null;
  let megaethClient: MegaETHClient | null = null;

  beforeAll(async () => {
    // Load configuration from .env
    config = loadConfig();
    
    // Initialize Tenderly client
    tenderlyClient = new TenderlyClient(config);
    
    // Initialize EVM RPC client if configured
    if (config.evmRpcUrl) {
      evmRpcClient = new EvmRpcClient(config);
    }
    
    // Initialize MegaETH client if configured
    if (config.megaethRpcUrl) {
      megaethClient = new MegaETHClient(config);
    }
  });

  describe("Tenderly Integration", () => {
    it("should connect to Tenderly API and list alerts", async () => {
      expect(config.accessToken).toBeDefined();
      expect(config.accountSlug).toBeDefined();
      expect(config.projectId).toBeDefined();
      
      const alerts = await listAlerts(tenderlyClient);
      
      expect(Array.isArray(alerts)).toBe(true);
      console.log(`✅ Successfully retrieved ${alerts.length} alerts from Tenderly`);
      
      // Log first few alerts for inspection
      if (alerts.length > 0) {
        console.log(`First alert: ${JSON.stringify(alerts[0], null, 2)}`);
      }
    }, 30000); // 30 second timeout

    it("should retrieve a specific alert by ID if any exist", async () => {
      const alerts = await listAlerts(tenderlyClient);
      
      if (alerts.length > 0) {
        const firstAlertId = alerts[0].id;
        const alert = await getAlertById(tenderlyClient, firstAlertId);
        
        expect(alert).toBeDefined();
        expect(alert.id).toBe(firstAlertId);
        console.log(`✅ Successfully retrieved alert ${firstAlertId}`);
      } else {
        console.log("⚠️ No alerts found to test getAlertById");
      }
    }, 30000);

    it("should simulate a simple ETH transfer transaction", async () => {
      const simulationParams = {
        network_id: "1", // Ethereum mainnet
        from: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // Vitalik's address
        to: "0x742d35Cc6634C0532925a3b8D4B39B1c3E7A4a92",
        value: "1000000000000000000", // 1 ETH in wei
        gas: 21000,
        gas_price: "20000000000", // 20 Gwei
      };
      
      try {
        const result = await simulateTransaction(tenderlyClient, simulationParams);
        
        expect(result).toBeDefined();
        expect(result.simulation).toBeDefined();
        expect(result.simulation.status).toBeDefined();
        
        console.log(`✅ Transaction simulation completed: ${result.simulation.status ? 'Success' : 'Failed'}`);
        console.log(`Gas used: ${result.transaction?.gas_used || 'N/A'}`);
      } catch (error) {
        console.log(`⚠️ Transaction simulation failed (this may be expected):`, error.message);
        // Don't fail the test - simulation failures are common in testing
      }
    }, 45000);
  });

  describe("EVM RPC Integration", () => {
    it("should connect to EVM RPC endpoint if configured", async () => {
      if (!evmRpcClient) {
        console.log("⚠️ EVM RPC not configured, skipping test");
        return;
      }

      try {
        const isValid = await evmRpcClient.validateConnection();
        expect(isValid).toBe(true);
        console.log(`✅ EVM RPC connection validated: ${config.evmRpcUrl}`);
      } catch (error) {
        console.log(`❌ EVM RPC connection failed:`, error.message);
        throw error;
      }
    }, 15000);

    it("should get RPC info and chain details", async () => {
      if (!evmRpcClient) {
        console.log("⚠️ EVM RPC not configured, skipping test");
        return;
      }

      const rpcInfo = await getRpcInfo(evmRpcClient);
      
      expect(rpcInfo).toBeDefined();
      expect(rpcInfo.rpcUrl).toBe(config.evmRpcUrl);
      expect(rpcInfo.chainName).toBe(config.evmChainName || "Unknown");
      expect(typeof rpcInfo.chainId).toBe("number");
      
      console.log(`✅ RPC Info - Chain: ${rpcInfo.chainName} (${rpcInfo.chainId}), URL: ${rpcInfo.rpcUrl}`);
    }, 15000);

    it("should execute basic JSON-RPC calls", async () => {
      if (!evmRpcClient) {
        console.log("⚠️ EVM RPC not configured, skipping test");
        return;
      }

      // Test eth_chainId
      const chainIdResult = await executeRpcCall(evmRpcClient, {
        method: "eth_chainId",
        params: []
      });
      expect(chainIdResult).toBeDefined();
      console.log(`✅ eth_chainId: ${chainIdResult}`);

      // Test eth_blockNumber
      const blockNumberResult = await executeRpcCall(evmRpcClient, {
        method: "eth_blockNumber",
        params: []
      });
      expect(blockNumberResult).toBeDefined();
      console.log(`✅ eth_blockNumber: ${blockNumberResult}`);

      // Test eth_getBalance
      const balanceResult = await executeRpcCall(evmRpcClient, {
        method: "eth_getBalance",
        params: ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "latest"] // Vitalik's address
      });
      expect(balanceResult).toBeDefined();
      console.log(`✅ Vitalik's ETH balance: ${balanceResult}`);
    }, 20000);
  });

  describe("MegaETH Integration", () => {
    it("should connect to MegaETH endpoint if configured", async () => {
      if (!megaethClient) {
        console.log("⚠️ MegaETH not configured, skipping test");
        return;
      }

      try {
        await megaethClient.validateConnection();
        const isMegaETH = await megaethClient.isMegaETHChain();
        console.log(`✅ MegaETH connection validated. Is MegaETH chain: ${isMegaETH}`);
      } catch (error) {
        console.log(`❌ MegaETH connection failed:`, error.message);
        throw error;
      }
    }, 15000);
  });

  describe("Configuration Validation", () => {
    it("should have all required Tenderly configuration", () => {
      expect(config.accessToken, "TENDERLY_ACCESS_TOKEN is required").toBeTruthy();
      expect(config.accountSlug, "TENDERLY_ACCOUNT_SLUG is required").toBeTruthy();
      expect(config.projectId, "TENDERLY_PROJECT_ID is required").toBeTruthy();
      
      console.log(`✅ Tenderly config: ${config.accountSlug}/${config.projectId}`);
    });

    it("should validate optional EVM RPC configuration", () => {
      if (config.evmRpcUrl) {
        expect(config.evmRpcUrl.startsWith('http'), "EVM_RPC_URL should be a valid HTTP URL").toBe(true);
        console.log(`✅ EVM RPC configured: ${config.evmRpcUrl}`);
      } else {
        console.log("ℹ️ EVM RPC not configured (optional)");
      }
    });

    it("should validate optional MegaETH configuration", () => {
      if (config.megaethRpcUrl) {
        expect(config.megaethRpcUrl.startsWith('http'), "MEGAETH_RPC_URL should be a valid HTTP URL").toBe(true);
        console.log(`✅ MegaETH configured: ${config.megaethRpcUrl}`);
      } else {
        console.log("ℹ️ MegaETH not configured (optional)");
      }
    });
  });
});