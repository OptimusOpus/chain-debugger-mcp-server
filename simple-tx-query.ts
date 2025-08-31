#!/usr/bin/env tsx
import dotenv from "dotenv";
import { loadConfig } from "./src/config.js";
import { EvmRpcClient } from "./src/client/evm-rpc.js";
import { executeRpcCall } from "./src/operations/evm/rpc.js";

dotenv.config();

const targetAddress = "0xcaCcdF49C3D4339e3e7a252c99F86AcF76d664E3";

async function findRecentTransaction() {
  try {
    const config = loadConfig();
    const evmClient = new EvmRpcClient(config);
    
    console.log("🔍 Searching for recent transactions for:", targetAddress);
    
    const currentBlockHex = await executeRpcCall(evmClient, {
      method: "eth_blockNumber",
      params: []
    });
    const currentBlock = parseInt(currentBlockHex, 16);
    
    console.log("Current block:", currentBlock);
    
    // Check account info
    const balanceHex = await executeRpcCall(evmClient, {
      method: "eth_getBalance",
      params: [targetAddress, "latest"]
    });
    const balance = Number(BigInt(balanceHex)) / 1e18;
    console.log("Current balance:", balance.toFixed(6), "ETH");
    
    const nonceHex = await executeRpcCall(evmClient, {
      method: "eth_getTransactionCount",
      params: [targetAddress, "latest"]
    });
    const nonce = parseInt(nonceHex, 16);
    console.log("Transaction count:", nonce);
    
    // Search recent blocks
    console.log("\nSearching last 100 blocks...");
    let found = [];
    
    for (let i = 0; i < 100; i++) {
      const blockNum = currentBlock - i;
      const blockHex = "0x" + blockNum.toString(16);
      
      try {
        const block = await executeRpcCall(evmClient, {
          method: "eth_getBlockByNumber", 
          params: [blockHex, true]
        });
        
        if (block && block.transactions) {
          for (const tx of block.transactions) {
            if (tx.to?.toLowerCase() === targetAddress.toLowerCase() || 
                tx.from?.toLowerCase() === targetAddress.toLowerCase()) {
              found.push({...tx, blockNumber: blockNum, blockTimestamp: block.timestamp});
            }
          }
        }
        
        if (i % 20 === 0) {
          console.log("Checked", i, "blocks, found", found.length, "transactions");
        }
        
      } catch (error) {
        // Skip errors, continue searching
      }
    }
    
    console.log("\nFound", found.length, "transactions in last 100 blocks");
    
    if (found.length > 0) {
      // Sort by block number (most recent first)
      found.sort((a, b) => b.blockNumber - a.blockNumber);
      
      const latest = found[0];
      console.log("\n" + "=".repeat(60));
      console.log("MOST RECENT TRANSACTION:");
      console.log("=".repeat(60));
      
      const date = new Date(parseInt(latest.blockTimestamp, 16) * 1000);
      const value = Number(BigInt(latest.value)) / 1e18;
      
      console.log("Hash:", latest.hash);
      console.log("Block:", latest.blockNumber);
      console.log("Date:", date.toLocaleString());
      console.log("From:", latest.from);
      console.log("To:", latest.to || "Contract Creation");
      console.log("Value:", value, "ETH");
      console.log("Gas:", parseInt(latest.gas, 16).toLocaleString());
      console.log("Gas Price:", Number(BigInt(latest.gasPrice)) / 1e9, "Gwei");
      console.log("Type:", latest.from.toLowerCase() === targetAddress.toLowerCase() ? "Outgoing" : "Incoming");
      
      // Get receipt
      try {
        const receipt = await executeRpcCall(evmClient, {
          method: "eth_getTransactionReceipt",
          params: [latest.hash]
        });
        
        const gasUsed = parseInt(receipt.gasUsed, 16);
        const fee = Number(BigInt(gasUsed) * BigInt(latest.gasPrice)) / 1e18;
        
        console.log("\nTransaction Receipt:");
        console.log("Status:", receipt.status === "0x1" ? "Success ✅" : "Failed ❌");
        console.log("Gas Used:", gasUsed.toLocaleString());
        console.log("Fee:", fee.toFixed(6), "ETH");
        console.log("Logs:", receipt.logs.length);
        
        if (latest.input && latest.input !== "0x") {
          console.log("\nContract Interaction:");
          console.log("Input data length:", latest.input.length - 2, "bytes");
          console.log("Method signature:", latest.input.substring(0, 10));
        }
        
      } catch (receiptError) {
        console.log("Could not get receipt:", receiptError.message);
      }
      
    } else {
      console.log("\nNo transactions found in recent blocks");
      console.log("This address might be inactive or transactions are older");
    }
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

findRecentTransaction();