// Cliente mínimo del servidor MCP oficial de OP.GG (Streamable HTTP), sin dependencias.
const URL_MCP = "https://mcp-api.op.gg/mcp";
let sid = null, nid = 1;
async function rpc(method, params, notify = false) {
  const body = notify ? { jsonrpc: "2.0", method, params } : { jsonrpc: "2.0", id: nid++, method, params };
  const h = { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" };
  if (sid) h["Mcp-Session-Id"] = sid;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(URL_MCP, { method: "POST", headers: h, body: JSON.stringify(body) });
    if (r.headers.get("mcp-session-id")) sid = r.headers.get("mcp-session-id");
    if (notify) return null;
    if (r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 2000 * (attempt + 1))); continue; }
    const txt = await r.text();
    let msg;
    if ((r.headers.get("content-type") || "").includes("text/event-stream")) {
      const datas = txt.split(/\r?\n/).filter(l => l.startsWith("data:")).map(l => l.slice(5).trim()).filter(Boolean);
      msg = datas.map(d => { try { return JSON.parse(d); } catch { return null; } }).filter(Boolean).find(m => m.id !== undefined) || {};
    } else { try { msg = JSON.parse(txt); } catch { throw new Error(`HTTP ${r.status}: ${txt.slice(0, 300)}`); } }
    if (msg.error) throw new Error(`${method}: ${JSON.stringify(msg.error).slice(0, 400)}`);
    return msg.result;
  }
  throw new Error(`${method}: demasiados reintentos`);
}
export async function connect() {
  await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "lol-counters-app", version: "1.0" } });
  await rpc("notifications/initialized", {}, true);
}
export const listTools = () => rpc("tools/list", {});
export async function call(name, args) {
  const res = await rpc("tools/call", { name, arguments: args });
  if (res.structuredContent) return res.structuredContent;
  const t = (res.content || []).filter(c => c.type === "text").map(c => c.text).join("\n");
  try { return JSON.parse(t); } catch { return t; }
}
