import { TenderlyClient } from "../client/tenderly.js";
import { SimulateTransactionParams } from "../schemas.js";

/**
 * Simulates a transaction on Tenderly.
 * @param client The TenderlyClient instance.
 * @param args The arguments for the transaction simulation.
 * @returns The simulation result.
 */
export async function simulateTransaction(client: TenderlyClient, args: SimulateTransactionParams) {
  try {
    // The simulation endpoint is not part of the standard project-based API path
    const simulationResult = await client.request<any>("/simulate", {
        method: 'POST',
        body: JSON.stringify(args),
    });
    return simulationResult;
  } catch (error) {
    console.error("Error simulating transaction:", error);
    throw error;
  }
}
