import { describe, it, expect, vi } from "vitest";
import {
  sendRawTransaction,
  getLogsWithCursor,
  subscribe,
  unsubscribe,
  getChainInfo,
  getBlockByNumber,
  setSubscriptionCallback,
  validateConnection,
} from "../../../src/operations/evm/megaeth.js";

class FakeMegaethClient {
  sendRawTransaction = vi.fn(async (signed: string, timeout?: number) => ({ transactionHash: "0xhash" }));
  getLogsWithCursor = vi.fn(async (filter: any, cursor?: string, limit?: number) => ({ logs: [], cursor: undefined, hasMore: false }));
  subscribe = vi.fn(async (eventType: string, params: any) => "sub_1");
  unsubscribe = vi.fn(async (subId: string) => true);
  getChainInfo = vi.fn(async () => ({ chainId: 1337, networkName: "MegaETH", isRealtimeEnabled: true, latestBlock: 1, miniBlockInterval: 100 }));
  getBlockByNumber = vi.fn(async (block: number | string, include: boolean) => ({ number: block }));
  setSubscriptionCallback = vi.fn((id: string, cb: (d: any) => void) => {});
  validateConnection = vi.fn(async () => {});
  isMegaETHChain = vi.fn(async () => true);
}

describe("operations/evm/megaeth", () => {
  it("sendRawTransaction forwards args and returns receipt", async () => {
    const client = new FakeMegaethClient();
    const res = await sendRawTransaction(client as any, { signedTransaction: "0xdead", timeout: 5000 });
    expect(res.transactionHash).toBeDefined();
    expect(client.sendRawTransaction).toHaveBeenCalledWith("0xdead", 5000);
  });

  it("getLogsWithCursor builds filter and forwards pagination", async () => {
    const client = new FakeMegaethClient();
    await getLogsWithCursor(client as any, { fromBlock: 1, toBlock: 2, address: "0xabc", topics: ["0x1"], cursor: "c", limit: 10 });
    expect(client.getLogsWithCursor).toHaveBeenCalledWith({ fromBlock: 1, toBlock: 2, address: "0xabc", topics: ["0x1"] }, "c", 10);
  });

  it("subscribe returns id and success message", async () => {
    const client = new FakeMegaethClient();
    const res = await subscribe(client as any, { eventType: "newHeads", params: {} });
    expect(res.subscriptionId).toBe("sub_1");
    expect(res.message).toContain("newHeads");
  });

  it("unsubscribe returns success true/false with message", async () => {
    const client = new FakeMegaethClient();
    client.unsubscribe.mockResolvedValueOnce(true);
    let res = await unsubscribe(client as any, { subscriptionId: "sub_1" });
    expect(res).toEqual({ success: true, message: "Successfully unsubscribed from events" });

    client.unsubscribe.mockResolvedValueOnce(false);
    res = await unsubscribe(client as any, { subscriptionId: "sub_2" });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Failed to unsubscribe/);
  });

  it("getChainInfo returns chain info", async () => {
    const client = new FakeMegaethClient();
    const info = await getChainInfo(client as any);
    expect(info.chainId).toBe(1337);
  });

  it("getBlockByNumber forwards number and includeTransactions default false", async () => {
    const client = new FakeMegaethClient();
    await getBlockByNumber(client as any, { blockNumber: 10 });
    expect(client.getBlockByNumber).toHaveBeenCalledWith(10, false);
    await getBlockByNumber(client as any, { blockNumber: "latest", includeTransactions: true });
    expect(client.getBlockByNumber).toHaveBeenLastCalledWith("latest", true);
  });

  it("setSubscriptionCallback calls client", () => {
    const client = new FakeMegaethClient();
    const cb = vi.fn();
    setSubscriptionCallback(client as any, "sub_1", cb);
    expect(client.setSubscriptionCallback).toHaveBeenCalledWith("sub_1", cb);
  });

  it("validateConnection aggregates success data", async () => {
    const client = new FakeMegaethClient();
    client.validateConnection.mockResolvedValueOnce();
    client.isMegaETHChain.mockResolvedValueOnce(true);
    client.getChainInfo.mockResolvedValueOnce({ chainId: 9, networkName: "MegaETH", isRealtimeEnabled: true, latestBlock: 1, miniBlockInterval: 100 });

    const res = await validateConnection(client as any);
    expect(res).toEqual({ connected: true, isMegaETH: true, chainId: 9 });
  });

  it("validateConnection failure returns connected false with error", async () => {
    const client = new FakeMegaethClient();
    client.validateConnection.mockRejectedValueOnce(new Error("bad"));

    const res = await validateConnection(client as any);
    expect(res.connected).toBe(false);
    expect(res.error).toBe("bad");
  });
});
