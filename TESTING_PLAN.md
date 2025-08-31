# Testing Plan: MegaETH + EVM RPC

This document outlines a practical, code-aware test plan for the MegaETH and EVM RPC clients and the related operation modules in this repository.

- Repository paths referenced:
  - Clients: `src/client/evm-rpc.ts`, `src/client/megaeth.ts`
  - Ops: `src/operations/evm/rpc.ts`, `src/operations/evm/megaeth.ts`
  - Server entry: `src/index.ts`
  - Config: `src/config.ts`

## Goals

- Ensure correctness of HTTP JSON-RPC interactions and MegaETH-specific behaviors.
- Validate WebSocket subscription lifecycle, reconnection, and heartbeat logic.
- Confirm operation wrappers forward parameters, return shapes, and handle errors consistently.
- Cover error mapping and edge cases with deterministic mocks.

## Tooling and Setup

- Test runner: Vitest (ESM-friendly, fast, built-in mocking and fake timers).
- Coverage: c8 via Vitest.
- Suggested `package.json` scripts:
  - `test`: `vitest run --coverage`
  - `test:watch`: `vitest --watch`
- Create `vitest.config.ts` with:
  - Node test environment
  - ESM/TypeScript support
  - Optional `tests/setup.ts` for global mocks/utilities
- Directory structure (suggested):
  - `tests/clients/evm-rpc.test.ts`
  - `tests/clients/megaeth.http.test.ts`
  - `tests/clients/megaeth.ws.test.ts`
  - `tests/operations/evm/rpc.test.ts`
  - `tests/operations/evm/megaeth.test.ts`

## Mocking Strategy (Seams)

- HTTP:
  - For `EvmRpcClient` (`src/client/evm-rpc.ts`), mock `axios.post`.
  - For `MegaETHClient` (`src/client/megaeth.ts`), mock `axios.create` to return a fake instance whose `post()` is a stub.
- WebSocket:
  - Mock `ws` default export with a test double exposing `on/open/error/close/message` handlers, `send()`, `ping()`, `close()`, `readyState`, and `OPEN` constant.
  - Provide helpers to simulate server-side events and messages.
- Timers:
  - Use fake timers (`vi.useFakeTimers()`) to test subscription timeouts (10s), heartbeat pings (30s), and exponential reconnect delays.
- Config factory:
  - Implement a `createTestConfig(overrides)` helper returning a valid `Config` (see `src/config.ts`) with MegaETH URLs/limits.

## Unit Tests by Module

### A. `EvmRpcClient` (`src/client/evm-rpc.ts`)

- callRPC success:
  - Mock `axios.post` to resolve `{ data: { result } }`.
  - Assert return value, payload shape (jsonrpc/id/method/params), and error-free path.
- callRPC RPC error mapping:
  - Mock `{ data: { error: { message: "boom" } } }`.
  - Assert thrown `Error("RPC Error: boom")` and `error.rpcMethod`/`error.rpcParams` annotations.
- callRPC network/axios error:
  - Reject with axios-like error containing `response.data.error.message`.
  - Assert annotations and rethrow.
- getChainId caches:
  - Spy `client.callRPC`; two calls return same int; `callRPC` invoked once.
- validateConnection:
  - Success path: `eth_blockNumber` mocked → returns true.
  - Failure path: throws; ensure logs present.
- isZircuitChain:
  - `eth_chainId` → 48900 returns true; others false.

### B. `MegaETHClient` HTTP (`src/client/megaeth.ts`)

- callRPC success:
  - `axios.create().post("/")` resolves `{ data: { result } }`.
  - Assert returned value.
- callRPC error mapping:
  - Message includes "realtime transaction expired" → throws `RealtimeTransactionExpiredError` including tx hash.
  - Message includes "mini block not found" → throws `MiniBlockNotFoundError`.
  - Other RPC error → throws `MegaETHError` with `code`/`data` preserved.
  - Network/axios error → rethrow with `rpcMethod`/`rpcParams` annotated.
- validateConnection:
  - OK: `eth_chainId` matches `config.megaethChainId`.
  - Mismatch: throws with message prefixed "Failed to validate MegaETH connection:".
- isMegaETHChain heuristic:
  - If `realtime_sendRawTransaction` → "method not found" → false.
  - If it errors but not "method not found" (e.g., bad params) → true.
  - If it does not error → expected true. Note: current code returns false here (see Potential Bug below).
- sendRawTransaction:
  - Verify method/params with and without `timeout`.
- getLogsWithCursor:
  - Cursor present → `hasMore: true`; absent → `false`. Filter merged correctly.
- getChainInfo:
  - Combines `eth_chainId` and `eth_blockNumber` results; parses hex to integers; returns constant `networkName` and `miniBlockInterval`.
- getBlockByNumber:
  - Number is hex-encoded; hex string passed through; `includeTransactions` default `false`.

### C. `MegaETHClient` WebSocket

- subscribe happy path:
  - Simulate ws open, send `eth_subscribe` request, respond with matching `id` and `{ result: "serverSubId" }`.
  - Returns a local `subscriptionId` and maps to server ID.
  - Set callback via `setSubscriptionCallback()`; simulate `eth_subscription` message; callback receives payload.
- subscribe limit enforcement:
  - With `config.megaethMaxSubscriptions = N`, after N subs, next throws `SubscriptionLimitError`.
- subscribe timeout:
  - No response within 10s → rejects `"Subscription timeout"` (use fake timers).
- unsubscribe:
  - When mapping exists: sends `eth_unsubscribe`, removes mapping, returns true.
  - Without ws configured (`megaethWsUrl` unset): returns false.
- heartbeat ping:
  - After open, advance timers by 30s → `ws.ping()` called.
- reconnect + resubscribe:
  - After connect+subscribe, simulate `close` → reconnect backoff → advance timers → on `reconnected`, `resubscribeAll` sends `eth_subscribe` again.
- connect concurrency guard:
  - Two `connectWebSocket()` calls while connecting both resolve; only one physical connect/open.

### D. Operations (in `src/operations/evm/*.ts`)

- `executeRpcCall()`:
  - Forwards to `EvmRpcClient.callRPC`; returns result; rethrows errors.
- `getRpcInfo()`:
  - Returns `{ rpcUrl, chainName, chainId }`; when `getChainId()` fails, `chainId` is `null`.
- `sendRawTransaction()`:
  - Forwards to `MegaETHClient.sendRawTransaction`; rethrows on error.
- `getLogsWithCursor()`:
  - Builds filter from params; forwards to client; returns.
- `subscribe()`/`unsubscribe()`:
  - Returns expected message strings:
    - subscribe → `Successfully subscribed to ${eventType} events`
    - unsubscribe → success/failed messages as implemented
- `getChainInfo()`:
  - Pass-through result.
- `getBlockByNumber()`:
  - Default `includeTransactions` false is respected.
- `validateConnection()`:
  - Success → `{ connected: true, isMegaETH, chainId }`.
  - Failure → `{ connected: false, isMegaETH: false, error }`.

## Integration-Test Ideas (optional)

- Server capabilities selection (`src/index.ts`):
  - With `MEGAETH_RPC_URL` set/unset, verify exposed capabilities. You may refactor to export `initializeClients()` or the capability builder to unit test without booting stdio.
- End-to-end without network:
  - Minimal harness that registers tool handlers with mocked clients and asserts returned content shapes.

## Potential Bug to Fix

- `MegaETHClient.isMegaETHChain()` currently returns `false` when `realtime_sendRawTransaction` succeeds without error, but comment says success implies MegaETH.
- Expected behavior:
  - Return `true` if no error (method exists and works).
  - Return `true` if error is not "method not found" (method exists but invalid params).
  - Return `false` only for "method not found".
- Plan: write failing test first, then adjust implementation accordingly.

## Optional Small Seams to Ease Testing

- Expose subscription stats in `MegaETHClient`:
  - `getActiveSubscriptionCount(): number`
  - `getMaxSubscriptions(): number`
- Consider DI for tests:
  - Allow injecting an `AxiosInstance` and/or a `WebSocketManager` factory to simplify mocking.

## Coverage Targets

- Clients (`src/client/*.ts`): ≥ 90% lines/branches.
- Ops (`src/operations/evm/*.ts`): ≥ 95%.
- Overall: ≥ 85%.

## Proposed Test File Outline

- `tests/clients/evm-rpc.test.ts`
  - callRPC success/error/network
  - getChainId cache
  - validateConnection
  - isZircuitChain
- `tests/clients/megaeth.http.test.ts`
  - callRPC mapping
  - validateConnection ok/mismatch
  - isMegaETHChain scenarios
  - sendRawTransaction / getLogsWithCursor / getChainInfo / getBlockByNumber
- `tests/clients/megaeth.ws.test.ts`
  - subscribe happy/limit/timeout
  - unsubscribe
  - heartbeat
  - reconnect + resubscribe
  - concurrent connect guard
- `tests/operations/evm/rpc.test.ts`
  - executeRpcCall / getRpcInfo
- `tests/operations/evm/megaeth.test.ts`
  - sendRawTransaction / getLogsWithCursor / subscribe / unsubscribe / getChainInfo / getBlockByNumber / validateConnection

## Next Actions

1) Add Vitest + coverage, scripts, and `vitest.config.ts`.
2) Add test helpers: axios and ws mocks + `createTestConfig()`.
3) Implement tests per outline above.
4) (Optional) Add small seams (subscription getters, optional DI) if tests get cumbersome.
5) Run full suite with coverage and integrate into CI.
