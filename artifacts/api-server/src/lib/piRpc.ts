const PI_TESTNET_RPC = "https://rpc.testnet.minepi.com";

type RpcResponse<T = unknown> = {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string };
};

let _reqId = 1;

async function rpcCall<T = unknown>(method: string, params: unknown[] = []): Promise<RpcResponse<T>> {
  const id = _reqId++;
  try {
    const res = await fetch(PI_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      signal: AbortSignal.timeout(8000),
    });
    return (await res.json()) as RpcResponse<T>;
  } catch (err) {
    return { jsonrpc: "2.0", id, error: { code: -32000, message: String(err) } };
  }
}

export async function getChainHealth(): Promise<{ healthy: boolean; detail: string }> {
  const r = await rpcCall("getHealth");
  if (r.error) return { healthy: false, detail: r.error.message };
  return { healthy: true, detail: JSON.stringify(r.result ?? "ok") };
}

export async function getLatestBlockhash(): Promise<{ blockhash: string | null }> {
  const r = await rpcCall<{ blockhash: string }>("getLatestBlockhash");
  return { blockhash: r.result?.blockhash ?? null };
}

export async function getAccountBalance(walletAddress: string): Promise<{ lamports: number | null }> {
  const r = await rpcCall<{ value: number }>("getBalance", [walletAddress]);
  return { lamports: r.result?.value ?? null };
}

export function hashTerms(terms: Record<string, unknown>): string {
  const str = JSON.stringify(terms, Object.keys(terms).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}
