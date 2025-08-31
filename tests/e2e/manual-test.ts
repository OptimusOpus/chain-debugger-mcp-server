#!/usr/bin/env tsx
/**
 * Manual E2E Test Script
 * 
 * Quick verification script to test Tenderly MCP Server functionality.
 * Run with: npm run test:e2e or tsx tests/e2e/manual-test.ts
 */

import dotenv from "dotenv";
import { loadConfig } from "../../src/config.js";
import { TenderlyClient } from "../../src/client/tenderly.js";
import { EvmRpcClient } from "../../src/client/evm-rpc.js";
import { listAlerts } from "../../src/operations/alerts.js";
import { executeRpcCall, getRpcInfo } from "../../src/operations/evm/rpc.js";

// Load environment variables
dotenv.config();

interface TestResult {
  name: string;
  status: "✅ PASS" | "❌ FAIL" | "⚠️ SKIP";
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
  results.push(result);
  console.log(`${result.status} ${result.name}: ${result.message}`);
  if (result.details) {
    console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
  }
}

async function testTenderlyConnection(client: TenderlyClient): Promise<void> {
  try {
    const startTime = Date.now();
    const alerts = await listAlerts(client);
    const duration = Date.now() - startTime;
    
    logResult({
      name: "Tenderly API Connection",
      status: "✅ PASS",
      message: `Retrieved ${alerts.length} alerts in ${duration}ms`,
      details: alerts.length > 0 ? {
        firstAlert: {
          id: alerts[0].id,
          name: alerts[0].name,
          status: alerts[0].enabled ? 'enabled' : 'disabled'
        }
      } : "No alerts found"
    });
  } catch (error: any) {
    logResult({
      name: "Tenderly API Connection",
      status: "❌ FAIL",
      message: `Failed to connect: ${error.message}`,
      details: {
        error: error.message,
        stack: error.stack?.split('\n')[0]
      }
    });
  }
}

async function testEvmRpcConnection(client: EvmRpcClient | null, config: any): Promise<void> {
  if (!client) {
    logResult({
      name: "EVM RPC Connection",
      status: "⚠️ SKIP",
      message: "EVM RPC not configured"
    });
    return;
  }

  try {
    const startTime = Date.now();
    
    // Test connection
    const isValid = await client.validateConnection();
    const rpcInfo = await getRpcInfo(client);
    
    // Test basic RPC calls
    const chainIdResult = await executeRpcCall(client, {
      method: "eth_chainId",
      params: []
    });
    
    const blockNumberResult = await executeRpcCall(client, {
      method: "eth_blockNumber", 
      params: []
    });
    
    const duration = Date.now() - startTime;
    
    logResult({
      name: "EVM RPC Connection",
      status: "✅ PASS",
      message: `Connected to ${config.evmChainName || 'Unknown'} in ${duration}ms`,
      details: {
        url: config.evmRpcUrl,
        chainName: rpcInfo.chainName,
        chainId: rpcInfo.chainId,
        blockNumber: rpcInfo.blockNumber,
        chainIdHex: chainIdResult,
        blockNumberHex: blockNumberResult
      }
    });
  } catch (error: any) {
    logResult({
      name: "EVM RPC Connection",
      status: "❌ FAIL",
      message: `Failed to connect: ${error.message}`,
      details: {
        url: config.evmRpcUrl,
        error: error.message
      }
    });
  }
}

async function testEvmRpcBalanceQuery(client: EvmRpcClient | null): Promise<void> {
  if (!client) {
    logResult({
      name: "EVM RPC Balance Query",
      status: "⚠️ SKIP", 
      message: "EVM RPC not configured"
    });
    return;
  }

  try {
    const startTime = Date.now();
    
    // Query Vitalik's ETH balance
    const vitalikAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
    const balanceResult = await executeRpcCall(client, {
      method: "eth_getBalance",
      params: [vitalikAddress, "latest"]
    });
    
    if (!balanceResult) {
      throw new Error(`No balance result returned: ${JSON.stringify(balanceResult)}`);
    }
    
    const balanceWei = BigInt(balanceResult);
    const balanceEth = Number(balanceWei) / Math.pow(10, 18);
    const duration = Date.now() - startTime;
    
    logResult({
      name: "EVM RPC Balance Query",
      status: "✅ PASS",
      message: `Retrieved balance in ${duration}ms`,
      details: {
        address: vitalikAddress,
        balanceWei: balanceResult,
        balanceEth: `${balanceEth.toFixed(4)} ETH`
      }
    });
  } catch (error: any) {
    logResult({
      name: "EVM RPC Balance Query",
      status: "❌ FAIL",
      message: `Failed to query balance: ${error.message}`,
      details: { error: error.message }
    });
  }
}

async function main() {
  console.log("🚀 Starting Tenderly MCP Server Manual E2E Tests\n");
  
  try {
    // Load configuration
    const config = loadConfig();
    
    // Initialize clients
    const tenderlyClient = new TenderlyClient(config);
    const evmRpcClient = config.evmRpcUrl ? new EvmRpcClient(config) : null;
    
    console.log("Configuration loaded:");
    console.log(`  Tenderly: ${config.accountSlug}/${config.projectId}`);
    console.log(`  EVM RPC: ${config.evmRpcUrl || 'Not configured'}`);
    console.log(`  Chain: ${config.evmChainName || 'Not specified'}\n`);
    
    // Run tests
    await testTenderlyConnection(tenderlyClient);
    await testEvmRpcConnection(evmRpcClient, config);
    await testEvmRpcBalanceQuery(evmRpcClient);
    
  } catch (error: any) {
    logResult({
      name: "Test Setup",
      status: "❌ FAIL",
      message: `Failed to initialize: ${error.message}`,
      details: { error: error.message }
    });
  }
  
  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(60));
  
  const passed = results.filter(r => r.status === "✅ PASS").length;
  const failed = results.filter(r => r.status === "❌ FAIL").length;
  const skipped = results.filter(r => r.status === "⚠️ SKIP").length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️ Skipped: ${skipped}`);
  
  if (failed > 0) {
    console.log("\n❌ Some tests failed. Check your configuration and network connectivity.");
    process.exit(1);
  } else {
    console.log("\n🎉 All configured services are working correctly!");
    process.exit(0);
  }
}

// Run the tests
main().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});