/** Helpers that shape HTTP responses. The only sanctioned path for
 * setting status, headers, and body. Don't call res.writeHead directly. */

export function sendJson(
  res: any,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export function sendError(res: any, status: number, message: string) {
  sendJson(res, status, { error: message });
}
