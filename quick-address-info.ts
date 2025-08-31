#!/usr/bin/env tsx
import dotenv from "dotenv";
import { loadConfig } from "./src/config.js";
import { EvmRpcClient } from "./src/client/evm-rpc.js";
import { executeRpcCall } from "./src/operations/evm/rpc.js";

dotenv.config();

const targetAddress = "0xcaCcdF49C3D4339e3e7a252c99F86AcF76d664E3";

async function getAddressInfo() {
  try {
    const config = loadConfig();
    const evmClient = new EvmRpcClient(config);
    
    console.log("📊 Address Analysis for:", targetAddress);
    console.log("=".repeat(60));
    
    // Get basic info
    const [balanceHex, nonceHex, currentBlockHex] = await Promise.all([
      executeRpcCall(evmClient, { method: "eth_getBalance", params: [targetAddress, "latest"] }),
      executeRpcCall(evmClient, { method: "eth_getTransactionCount", params: [targetAddress, "latest"] }),
      executeRpcCall(evmClient, { method: "eth_blockNumber", params: [] })
    ]);
    
    const balance = Number(BigInt(balanceHex)) / 1e18;
    const nonce = parseInt(nonceHex, 16);
    const currentBlock = parseInt(currentBlockHex, 16);
    
    console.log("Current Balance:", balance.toFixed(6), "ETH");
    console.log("Total Transactions Sent:", nonce);
    console.log("Current Block:", currentBlock);
    
    // Get contract code (to see if it's a contract)
    const code = await executeRpcCall(evmClient, {
      method: "eth_getCode",
      params: [targetAddress, "latest"]
    });
    
    const isContract = code && code !== "0x";
    console.log("Account Type:", isContract ? "Smart Contract" : "EOA (Externally Owned Account)");
    
    if (isContract) {
      console.log("Contract Code Size:", (code.length - 2) / 2, "bytes");
    }
    
    // Since searching full blocks is slow, let's try a different approach
    // We'll check if this is a known contract or token by trying some common calls
    
    if (isContract) {
      console.log("\n🔍 Contract Analysis:");
      
      // Try to get contract name (ERC-20/ERC-721 standard)
      try {
        const nameCall = await executeRpcCall(evmClient, {
          method: "eth_call",
          params: [{
            to: targetAddress,
            data: "0x06fdde03" // name() function selector
          }, "latest"]
        });
        
        if (nameCall && nameCall !== "0x") {
          console.log("  - Contract has name() function");
        }
      } catch (e) {
        // Contract doesn't have name function
      }
      
      // Try to get symbol
      try {
        const symbolCall = await executeRpcCall(evmClient, {
          method: "eth_call",
          params: [{
            to: targetAddress,
            data: "0x95d89b41" // symbol() function selector
          }, "latest"]
        });
        
        if (symbolCall && symbolCall !== "0x") {
          console.log("  - Contract has symbol() function");
        }
      } catch (e) {
        // Contract doesn't have symbol function
      }
    }
    
    console.log("\n📈 Transaction History Summary:");
    console.log("- This address has sent", nonce, "transactions");
    console.log("- Current balance suggests it has received ETH");
    
    if (nonce > 0) {
      console.log("- Most recent outgoing transaction nonce:", nonce - 1);
    }
    
    console.log("\n💡 Note: To find the exact last transaction, we'd need to:");
    console.log("1. Search through recent blocks (time-consuming)");
    console.log("2. Use a block explorer API (faster)");
    console.log("3. Use enhanced RPC methods if available");
    
    // Let's try a quick search of just the last 10 blocks for any recent activity
    console.log("\n🔍 Quick check of last 10 blocks:");
    
    for (let i = 0; i < 10; i++) {
      const blockNum = currentBlock - i;
      const blockHex = "0x" + blockNum.toString(16);
      
      try {
        const block = await executeRpcCall(evmClient, {
          method: "eth_getBlockByNumber",
          params: [blockHex, true]
        });
        
        if (block && block.transactions) {
          const relevantTxs = block.transactions.filter(tx => 
            tx.to?.toLowerCase() === targetAddress.toLowerCase() || 
            tx.from?.toLowerCase() === targetAddress.toLowerCase()
          );
          
          if (relevantTxs.length > 0) {
            const tx = relevantTxs[0];
            const date = new Date(parseInt(block.timestamp, 16) * 1000);
            const value = Number(BigInt(tx.value)) / 1e18;
            
            console.log("\n🎯 Found recent transaction in block", blockNum, ":");
            console.log("Hash:", tx.hash);
            console.log("Date:", date.toLocaleString());
            console.log("From:", tx.from);
            console.log("To:", tx.to);
            console.log("Value:", value, "ETH");
            console.log("Type:", tx.from.toLowerCase() === targetAddress.toLowerCase() ? "Sent" : "Received");
            break;
          }
        }
      } catch (e) {
        // Continue searching
      }
      
      console.log("Checked block", blockNum, "- no transactions found");
    }
    
    console.log("\n✅ Analysis complete!");
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

getAddressInfo();