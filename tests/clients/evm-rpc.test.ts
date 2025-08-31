import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { EvmRpcClient } from "../../src/client/evm-rpc.js";
import { createTestConfig } from "../setup.js";

vi.mock("axios", () => {
  const post = vi.fn();
  return { default: { post }, post };
});

describe("EvmRpcClient", () => {
  beforeEach(() => {
    (axios as any).post.mockReset();
  });

  it("callRPC success returns result and correct payload shape", async () => {
    (axios as any).post.mockResolvedValueOnce({ data: { result: "0x1" } });
    const client = new EvmRpcClient(createTestConfig());

    const result = await client.callRPC("eth_chainId", []);

    expect(result).toBe("0x1");
    expect((axios as any).post).toHaveBeenCalledTimes(1);
    const [url, payload] = (axios as any).post.mock.calls[0];
    expect(url).toBe("http://localhost:8545");
    expect(payload).toMatchObject({ jsonrpc: "2.0", method: "eth_chainId", params: [] });
  });

  it("callRPC maps RPC error to Error with message", async () => {
    (axios as any).post.mockResolvedValueOnce({ data: { error: { message: "boom" } } });
    const client = new EvmRpcClient(createTestConfig());

    await expect(client.callRPC("eth_blockNumber", [])).rejects.toThrow("RPC Error: boom");
  });

  it("callRPC annotates and rethrows network/axios error", async () => {
    (axios as any).post.mockRejectedValueOnce({ response: { data: { error: { message: "net down" } } } });
    const client = new EvmRpcClient(createTestConfig());

    const method = "eth_getBalance";
    const params = ["0xabc", "latest"];
    try {
      await client.callRPC(method, params);
      throw new Error("should not reach");
    } catch (err: any) {
      expect(err.rpcMethod).toBe(method);
      expect(err.rpcParams).toEqual(params);
      expect(err.response.data.error.message).toBe("net down");
    }
  });

  it("getChainId caches after first call", async () => {
    const client = new EvmRpcClient(createTestConfig());
    const spy = vi.spyOn(client, "callRPC").mockResolvedValue("0x2");

    const a = await client.getChainId();
    const b = await client.getChainId();

    expect(a).toBe(2);
    expect(b).toBe(2);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("validateConnection returns true on success", async () => {
    const client = new EvmRpcClient(createTestConfig());
    vi.spyOn(client, "callRPC").mockResolvedValue("0x10");

    await expect(client.validateConnection()).resolves.toBe(true);
  });

  it("validateConnection throws on failure", async () => {
    const client = new EvmRpcClient(createTestConfig());
    vi.spyOn(client, "callRPC").mockRejectedValue(new Error("unavailable"));

    await expect(client.validateConnection()).rejects.toThrow("unavailable");
  });

  it("isZircuitChain returns true only for chainId 48900", async () => {
    const client = new EvmRpcClient(createTestConfig());
    vi.spyOn(client, "getChainId").mockResolvedValue(48900);
    await expect(client.isZircuitChain()).resolves.toBe(true);

    (client.getChainId as any).mockResolvedValueOnce(1);
    await expect(client.isZircuitChain()).resolves.toBe(false);
  });
});
