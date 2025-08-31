#!/usr/bin/env tsx
/**
 * Find the most recent transaction for an address by searching backwards from current block
 */

import dotenv from "dotenv";
import { loadConfig } from "./src/config.js";
import { EvmRpcClient } from "./src/client/evm-rpc.js";
import { executeRpcCall } from "./src/operations/evm/rpc.js";

dotenv.config();

const targetAddress = "0xcaCcdF49C3D4339e3e7a252c99F86AcF76d664E3";

async function findLastTransaction() {
  try {
    const config = loadConfig();
    const evmClient = new EvmRpcClient(config);
    
    console.log(`🔍 Finding the most recent transaction for: ${targetAddress}\n`);
    
    // Get current block
    const currentBlockHex = await executeRpcCall(evmClient, {
      method: "eth_blockNumber",
      params: []
    });
    const currentBlock = parseInt(currentBlockHex, 16);
    
    console.log(`📊 Current block: ${currentBlock}`);
    
    // Get nonce to confirm transactions exist
    const nonceHex = await executeRpcCall(evmClient, {
      method: "eth_getTransactionCount",
      params: [targetAddress, "latest"]
    });
    const nonce = parseInt(nonceHex, 16);
    console.log(`📈 Total transactions sent: ${nonce}`);
    
    // Since the nonce is 16, this address has sent 16 transactions
    // Let's use a binary search approach to find the last transaction more efficiently
    
    console.log(`\\n🔍 Searching for most recent transaction...\\n`);
    
    let foundTransactions = [];
    let searchRange = 1000; // Search last 1000 blocks
    
    for (let i = 0; i < searchRange; i++) {
      const blockNumber = currentBlock - i;
      
      if (blockNumber < 0) break;
      
      const blockHex = `0x${blockNumber.toString(16)}`;
      
      try {
        const block = await executeRpcCall(evmClient, {
          method: "eth_getBlockByNumber",
          params: [blockHex, true]
        });
        
        if (block && block.transactions) {
          for (const tx of block.transactions) {
            if ((tx.to && tx.to.toLowerCase() === targetAddress.toLowerCase()) ||
                (tx.from && tx.from.toLowerCase() === targetAddress.toLowerCase())) {
              foundTransactions.push({
                ...tx,
                blockNumber: blockNumber,
                timestamp: parseInt(block.timestamp, 16)
              });
            }
          }
        }
        
        // Show progress every 50 blocks
        if (i % 50 === 0 && i > 0) {
          console.log(\`📦 Searched \${i} blocks, found \${foundTransactions.length} transactions...\`);
        }
        
        // If we found transactions, we can stop early and show the most recent
        if (foundTransactions.length > 0 && i > 100) {
          console.log(\`\\n✅ Found transactions! Stopping search at block \${blockNumber}\`);
          break;
        }
        
      } catch (error) {
        if (i % 100 === 0) {
          console.log(\`⚠️ Error at block \${blockNumber}: \${error.message}\`);
        }
      }
    }
    
    console.log(\`\\n📊 Search complete. Found \${foundTransactions.length} transactions.\`);
    
    if (foundTransactions.length > 0) {
      // Sort by block number (most recent first)
      foundTransactions.sort((a, b) => b.blockNumber - a.blockNumber);
      
      const mostRecent = foundTransactions[0];
      
      console.log("\\n" + "=".repeat(80));
      console.log("🎯 MOST RECENT TRANSACTION FOUND:");
      console.log("=" + "=".repeat(80));
      
      const date = new Date(mostRecent.timestamp * 1000);
      const value = BigInt(mostRecent.value);
      const valueEth = Number(value) / Math.pow(10, 18);
      
      console.log(\`Hash: \${mostRecent.hash}\`);
      console.log(\`Block: \${mostRecent.blockNumber}\`);
      console.log(\`Date: \${date.toLocaleString()}\`);
      console.log(\`From: \${mostRecent.from}\`);
      console.log(\`To: \${mostRecent.to || 'Contract Creation'}\`);
      console.log(\`Value: \${valueEth} ETH\`);
      console.log(\`Gas: \${parseInt(mostRecent.gas, 16).toLocaleString()}\`);
      console.log(\`Gas Price: \${Number(BigInt(mostRecent.gasPrice)) / 1e9} Gwei\`);
      console.log(\`Nonce: \${parseInt(mostRecent.nonce, 16)}\`);
      console.log(\`Type: \${mostRecent.from.toLowerCase() === targetAddress.toLowerCase() ? '📤 Outgoing' : '📥 Incoming'}\`);
      
      // Get transaction receipt for more details
      try {
        console.log("\\n🔍 Getting transaction receipt...");
        const receipt = await executeRpcCall(evmClient, {
          method: "eth_getTransactionReceipt", 
          params: [mostRecent.hash]
        });
        
        const gasUsed = parseInt(receipt.gasUsed, 16);
        const gasPrice = BigInt(mostRecent.gasPrice);
        const txFee = Number(BigInt(gasUsed) * gasPrice) / Math.pow(10, 18);
        
        console.log("\\n📄 Transaction Receipt:");
        console.log(\`Status: \${receipt.status === '0x1' ? '✅ Success' : '❌ Failed'}\`);
        console.log(\`Gas Used: \${gasUsed.toLocaleString()} / \${parseInt(mostRecent.gas, 16).toLocaleString()}\`);
        console.log(\`Transaction Fee: \${txFee.toFixed(6)} ETH\`);
        console.log(\`Cumulative Gas Used: \${parseInt(receipt.cumulativeGasUsed, 16).toLocaleString()}\`);
        console.log(\`Transaction Index: \${parseInt(receipt.transactionIndex, 16)}\`);
        console.log(\`Logs: \${receipt.logs.length} event logs\`);
        
        if (receipt.logs.length > 0) {
          console.log("\\n📄 Event Logs:");
          receipt.logs.forEach((log, i) => {
            console.log(\`   \${i + 1}. Address: \${log.address}\`);
            console.log(\`      Topics: \${log.topics.length}\`);
            console.log(\`      Data: \${log.data.substring(0, 42)}...\`);
          });
        }
        
        // Check if it's a contract interaction
        if (mostRecent.input && mostRecent.input !== '0x') {
          console.log(\`\\n🔧 Contract Interaction:\`);
          console.log(\`   Input Data: \${mostRecent.input.substring(0, 42)}... (\${mostRecent.input.length - 2} bytes)\`);
          console.log(\`   Method ID: \${mostRecent.input.substring(0, 10)}\`);
        }
        
      } catch (error) {
        console.log(\`⚠️ Could not get receipt: \${error.message}\`);
      }
      
      // Show additional recent transactions if found
      if (foundTransactions.length > 1) {
        console.log("\\n" + "=".repeat(80));
        console.log(\`📚 OTHER RECENT TRANSACTIONS (\${foundTransactions.length - 1} more):\`);
        console.log("=" + "=".repeat(80));
        
        foundTransactions.slice(1, 6).forEach((tx, i) => {
          const date = new Date(tx.timestamp * 1000);
          const value = Number(BigInt(tx.value)) / Math.pow(10, 18);
          console.log(\`\\n\${i + 2}. \${tx.hash}\`);
          console.log(\`   Block: \${tx.blockNumber} | Date: \${date.toLocaleDateString()}\`);
          console.log(\`   \${tx.from.toLowerCase() === targetAddress.toLowerCase() ? '📤 Sent' : '📥 Received'} \${value} ETH\`);
        });
      }
      
    } else {
      console.log("\\n❌ No transactions found in the searched range.");
      console.log("💡 The address might be very old or inactive.");
    }
    
    console.log("\\n" + "=".repeat(80));
    console.log("✅ Analysis complete!");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

findLastTransaction();