#!/usr/bin/env tsx
/**
 * Test script to query transaction details for a specific address
 * This demonstrates using the MCP server's EVM RPC functionality
 */

import dotenv from "dotenv";
import { loadConfig } from "./src/config.js";
import { EvmRpcClient } from "./src/client/evm-rpc.js";
import { executeRpcCall } from "./src/operations/evm/rpc.js";

// Load environment variables
dotenv.config();

const targetAddress = "0xcaCcdF49C3D4339e3e7a252c99F86AcF76d664E3";

async function getAddressTransactionHistory() {
  try {
    const config = loadConfig();
    
    if (!config.evmRpcUrl) {
      throw new Error("EVM RPC URL not configured");
    }
    
    const evmClient = new EvmRpcClient(config);
    
    console.log(`🔍 Querying transaction history for: ${targetAddress}\n`);
    
    // Get current block number first
    const currentBlockHex = await executeRpcCall(evmClient, {
      method: "eth_blockNumber",
      params: []
    });
    const currentBlock = parseInt(currentBlockHex, 16);
    
    console.log(`📊 Current block: ${currentBlock} (${currentBlockHex})`);
    
    // Get the account balance
    const balanceHex = await executeRpcCall(evmClient, {
      method: "eth_getBalance",
      params: [targetAddress, "latest"]
    });
    const balanceWei = BigInt(balanceHex);
    const balanceEth = Number(balanceWei) / Math.pow(10, 18);
    
    console.log(`💰 Current balance: ${balanceEth.toFixed(6)} ETH (${balanceHex})\n`);
    
    // Get transaction count (nonce)
    const nonceHex = await executeRpcCall(evmClient, {
      method: "eth_getTransactionCount",
      params: [targetAddress, "latest"]
    });
    const nonce = parseInt(nonceHex, 16);
    
    console.log(`📈 Transaction count (nonce): ${nonce}\n`);
    
    if (nonce === 0) {
      console.log("ℹ️ This address has never sent any transactions.");
      console.log("🔍 Let's check if it has received any transactions by looking at recent blocks...\n");
    }
    
    // Search recent blocks for transactions involving this address
    console.log("🔍 Searching last 10 blocks for transactions involving this address...\n");
    
    let foundTransactions = [];
    const searchBlocks = 10;
    
    for (let i = 0; i < searchBlocks; i++) {
      const blockNumber = currentBlock - i;
      const blockHex = `0x${blockNumber.toString(16)}`;
      
      try {
        const block = await executeRpcCall(evmClient, {
          method: "eth_getBlockByNumber",
          params: [blockHex, true] // true = include transaction details
        });
        
        if (block && block.transactions) {
          // Check each transaction in the block
          for (const tx of block.transactions) {
            if (tx.to && tx.to.toLowerCase() === targetAddress.toLowerCase() ||
                tx.from && tx.from.toLowerCase() === targetAddress.toLowerCase()) {
              foundTransactions.push({
                ...tx,
                blockNumber: blockNumber,
                timestamp: parseInt(block.timestamp, 16)
              });
            }
          }
        }
        
        // Show progress
        if (i % 2 === 0) {
          process.stdout.write(`📦 Checked block ${blockNumber}...\\r`);
        }
      } catch (error) {
        console.log(`⚠️ Error checking block ${blockNumber}:`, error.message);
      }
    }
    
    console.log(`\\n📋 Found ${foundTransactions.length} transactions in last ${searchBlocks} blocks`);
    
    if (foundTransactions.length > 0) {
      console.log("\\n🎯 RECENT TRANSACTIONS:");
      console.log("=" + "=".repeat(80));
      
      // Sort by block number (most recent first)
      foundTransactions.sort((a, b) => b.blockNumber - a.blockNumber);
      
      foundTransactions.forEach((tx, index) => {
        const date = new Date(tx.timestamp * 1000);
        const value = BigInt(tx.value);
        const valueEth = Number(value) / Math.pow(10, 18);
        
        console.log(`\\n📝 Transaction ${index + 1}:`);
        console.log(`   Hash: ${tx.hash}`);
        console.log(`   Block: ${tx.blockNumber} (${tx.timestamp})`);
        console.log(`   Date: ${date.toISOString()}`);
        console.log(`   From: ${tx.from}`);
        console.log(`   To: ${tx.to || 'Contract Creation'}`);
        console.log(`   Value: ${valueEth} ETH (${tx.value})`);
        console.log(`   Gas Used: ${parseInt(tx.gas, 16).toLocaleString()}`);
        console.log(`   Gas Price: ${parseInt(tx.gasPrice, 16)} wei`);
        console.log(`   Status: ${tx.to === targetAddress ? '📥 Received' : '📤 Sent'}`);
      });
      
      // Show the most recent transaction details
      const lastTx = foundTransactions[0];
      console.log("\\n" + "=".repeat(80));
      console.log("🔍 MOST RECENT TRANSACTION DETAILS:");
      console.log("=" + "=".repeat(80));
      
      // Get transaction receipt for more details
      try {
        const receipt = await executeRpcCall(evmClient, {
          method: "eth_getTransactionReceipt",
          params: [lastTx.hash]
        });
        
        const date = new Date(lastTx.timestamp * 1000);
        const value = BigInt(lastTx.value);
        const valueEth = Number(value) / Math.pow(10, 18);
        const gasUsed = parseInt(receipt.gasUsed, 16);
        const gasPrice = BigInt(lastTx.gasPrice);
        const txFee = Number(gasUsed * gasPrice) / Math.pow(10, 18);
        
        console.log(`Hash: ${lastTx.hash}`);
        console.log(`Block: ${lastTx.blockNumber} (confirmed)`);
        console.log(`Date: ${date.toLocaleString()}`);
        console.log(`From: ${lastTx.from}`);
        console.log(`To: ${lastTx.to || 'Contract Creation'}`);
        console.log(`Value: ${valueEth} ETH`);
        console.log(`Status: ${receipt.status === '0x1' ? '✅ Success' : '❌ Failed'}`);
        console.log(`Gas Used: ${gasUsed.toLocaleString()} / ${parseInt(lastTx.gas, 16).toLocaleString()}`);
        console.log(`Gas Price: ${Number(gasPrice) / 1e9} Gwei`);
        console.log(`Transaction Fee: ${txFee.toFixed(6)} ETH`);
        console.log(`Logs: ${receipt.logs.length} event logs`);
        
        if (receipt.logs.length > 0) {
          console.log("\\n📄 Event Logs:");
          receipt.logs.forEach((log, i) => {
            console.log(`   Log ${i + 1}: ${log.address} (${log.topics.length} topics)`);
          });
        }
        
      } catch (error) {
        console.log(`⚠️ Could not get transaction receipt: ${error.message}`);
      }
    } else {
      console.log("\\n🔍 No transactions found in recent blocks.");
      console.log("💡 This could mean:");
      console.log("   • The address is inactive");
      console.log("   • Transactions occurred more than 10 blocks ago");
      console.log("   • The address only holds tokens (not ETH transactions)");
    }
    
    console.log("\\n" + "=".repeat(80));
    console.log("✅ Query completed successfully!");
    
  } catch (error) {
    console.error("❌ Error querying address:", error.message);
    process.exit(1);
  }
}

// Run the query
getAddressTransactionHistory();