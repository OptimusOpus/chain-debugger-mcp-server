import { describe, it, expect, vi } from "vitest";
import { isQuarantined, getQuarantined } from "../../../src/operations/evm/zircuit.js";

class FakeEvmClient {
  callRPC = vi.fn(async (_method: string, _params: any[]) => ({ ok: true }));
}

describe("operations/evm/zircuit", () => {
  it("isQuarantined forwards tx hash and returns result", async () => {
    const client = new FakeEvmClient();
    client.callRPC.mockResolvedValueOnce(true);
    const res = await isQuarantined(client as any, { transactionHash: "0xabc" });
    expect(res).toBe(true);
    expect(client.callRPC).toHaveBeenCalledWith("zirc_isQuarantined", ["0xabc"]);
  });

  it("isQuarantined rethrows errors", async () => {
    const client = new FakeEvmClient();
    client.callRPC.mockRejectedValueOnce(new Error("boom"));
    await expect(isQuarantined(client as any, { transactionHash: "0xabc" })).rejects.toThrow("boom");
  });

  it("getQuarantined with address forwards single param", async () => {
    const client = new FakeEvmClient();
    client.callRPC.mockResolvedValueOnce(["tx1"]);
    const res = await getQuarantined(client as any, { address: "0xdef" });
    expect(res).toEqual(["tx1"]);
    expect(client.callRPC).toHaveBeenCalledWith("zirc_getQuarantined", ["0xdef"]);
  });

  it("getQuarantined without address forwards empty params", async () => {
    const client = new FakeEvmClient();
    client.callRPC.mockResolvedValueOnce(["tx2"]);
    const res = await getQuarantined(client as any, {});
    expect(res).toEqual(["tx2"]);
    expect(client.callRPC).toHaveBeenCalledWith("zirc_getQuarantined", []);
  });

  it("getQuarantined rethrows errors", async () => {
    const client = new FakeEvmClient();
    client.callRPC.mockRejectedValueOnce(new Error("bad"));
    await expect(getQuarantined(client as any, {})).rejects.toThrow("bad");
  });
});
