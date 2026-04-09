/** Detect likely transient failures from Supabase/fetch (Node undici). */

export function isLikelyTransientNetworkError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const name = err instanceof Error ? err.name.toLowerCase() : "";
  return (
    name.includes("abort") ||
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("und_err_connect_timeout") ||
    msg.includes("und_err_headers_timeout") ||
    msg.includes("und_err_socket") ||
    msg.includes("network error") ||
    msg.includes("socket hang up") ||
    msg.includes("client network socket disconnected")
  );
}

export async function sleepMs(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}
