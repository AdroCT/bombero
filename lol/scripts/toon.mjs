// Convierte la respuesta compacta de OP.GG ("class X: a,b\n\nX(1,\"y\",[...])") en objetos JS.
export function parseOpgg(text) {
  if (typeof text !== "string") return text;
  const lines = text.split("\n");
  const classes = {};
  let i = 0;
  for (; i < lines.length; i++) {
    const m = lines[i].match(/^class (\w+): ?(.*)$/);
    if (m) classes[m[1]] = m[2] ? m[2].split(",").map(s => s.trim()) : [];
    else if (lines[i].trim() === "" && Object.keys(classes).length) { i++; break; }
    else if (!Object.keys(classes).length) break;
  }
  const src = lines.slice(i).join("\n").trim();
  let p = 0;
  const ws = () => { while (p < src.length && /\s/.test(src[p])) p++; };
  function value() {
    ws();
    const c = src[p];
    if (c === '"') {
      let s = ""; p++;
      while (p < src.length && src[p] !== '"') {
        if (src[p] === "\\") { const n = src[p + 1]; s += n === "n" ? "\n" : n === "t" ? "\t" : n === "u" ? String.fromCharCode(parseInt(src.substr(p + 2, 4), 16)) : n; p += n === "u" ? 6 : 2; }
        else s += src[p++];
      }
      p++; return s;
    }
    if (c === "[") { p++; const arr = []; ws(); if (src[p] === "]") { p++; return arr; }
      while (true) { arr.push(value()); ws(); if (src[p] === ",") { p++; continue; } if (src[p] === "]") { p++; break; } throw new Error("lista mal formada en " + p); }
      return arr; }
    const m = src.slice(p).match(/^-?\d+(\.\d+)?([eE][-+]?\d+)?/);
    if (m) { p += m[0].length; return Number(m[0]); }
    const id = src.slice(p).match(/^[A-Za-z_]\w*/);
    if (!id) throw new Error("token inesperado en " + p + ": " + src.slice(p, p + 30));
    p += id[0].length;
    if (id[0] === "true") return true; if (id[0] === "false") return false; if (id[0] === "null" || id[0] === "None") return null;
    ws();
    if (src[p] !== "(") return id[0];
    p++;
    const fields = classes[id[0]] || [];
    const args = []; ws();
    if (src[p] === ")") p++;
    else while (true) { args.push(value()); ws(); if (src[p] === ",") { p++; continue; } if (src[p] === ")") { p++; break; } throw new Error("argumentos mal formados en " + p); }
    const o = {}; args.forEach((v, k) => { o[fields[k] ?? "_" + k] = v; }); return o;
  }
  return value();
}
