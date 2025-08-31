import { describe, it, expect, vi } from "vitest";
import { executeRpcCall, getRpcInfo } from "../../../src/operations/evm/rpc.js";

class FakeEvmClient {
  constructor(private opts: Partial<Record<string, any>> = {}) {}
  callRPC = vi.fn(async (_method: string, _params: any[]) => this.opts.callResult ?? null);
  getChainId = vi.fn(async () => this.opts.chainId ?? 1);
  getRpcUrl = vi.fn(() => this.opts.rpcUrl ?? "http://localhost:8545");
  getChainName = vi.fn(() => this.opts.chainName ?? "Testnet");
}

describe("operations/evm/rpc", () => {
  it("executeRpcCall forwards method and params and returns result", async () => {
    const client = new FakeEvmClient({ callResult: "0x1" });
    const res = await executeRpcCall(client as any, { method: "eth_chainId", params: [] });
    expect(res).toBe("0x1");
    expect(client.callRPC).toHaveBeenCalledWith("eth_chainId", []);
  });

  it("executeRpcCall rethrows errors", async () => {
    const client = new FakeEvmClient();
    client.callRPC.mockRejectedValueOnce(new Error("boom"));
    await expect(executeRpcCall(client as any, { method: "x", params: [] })).rejects.toThrow("boom");
  });

  it("getRpcInfo returns url, name and chainId", async () => {
    const client = new FakeEvmClient({ chainId: 5, rpcUrl: "http://rpc", chainName: "Goerli" });
    const info = await getRpcInfo(client as any);
    expect(info).toEqual({ rpcUrl: "http://rpc", chainName: "Goerli", chainId: 5 });
  });

  it("getRpcInfo swallows chainId error and returns null for chainId", async () => {
    const client = new FakeEvmClient({ rpcUrl: "http://rpc", chainName: "Test" });
    client.getChainId.mockRejectedValueOnce(new Error("nope"));
    const info = await getRpcInfo(client as any);
    expect(info).toEqual({ rpcUrl: "http://rpc", chainName: "Test", chainId: null });
  });
});
