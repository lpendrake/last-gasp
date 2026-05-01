/** Sole sanctioned client HTTP path. All adapter modules in
 * src/data/http/* go through this wrapper; nothing else calls fetch. */

export class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`HTTP ${status}: ${body}`);
    this.status = status;
    this.body = body;
  }
}

/** GET/POST/PUT a URL and parse the JSON body. Throws ApiError on non-2xx. */
export async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}

/** Fetch a URL and throw ApiError on non-2xx. Returns the raw Response so
 * callers can read text, headers, etc. */
export async function rawFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res;
}
