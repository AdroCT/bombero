// Actualizador de datos para la app de counters de LoL.
// Fuentes: servidor MCP oficial de OP.GG (estadísticas) y Data Dragon de Riot (iconos, runas, hechizos).
import { connect, call } from "./mcp.mjs";
import { parseOpgg } from "./toon.mjs";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";

const OUT = "lol/data";
const POS = ["top", "jungle", "mid", "adc", "support"];
const LANG = "es_ES";
const APP = "LoLCountersApp/1.0 (github.com/AdroCT/bombero)";
const N_COUNTERS = 8, N_EASY = 5, MIN_GAMES = 150, MIN_GAMES_FALLBACK = 50, CONC = 3;
const force = process.argv.includes("--force");
const limit = (() => { const a = process.argv.find(x => x.startsWith("--limit=")); return a ? +a.split("=")[1] : Infinity; })();

const sleep = ms => new Promise(r => setTimeout(r, ms));
const save = (p, d) => { mkdirSync(p.replace(/\/[^/]+$/, ""), { recursive: true }); writeFileSync(p, JSON.stringify(d)); };
const r3 = x => x == null ? null : Math.round(x * 1000) / 1000;
async function op(name, args, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { return parseOpgg(await call(name, { client_app: APP, ...args })); }
    catch (e) { if (i === tries - 1) throw e; await sleep(1500 * (i + 1)); }
  }
}
async function pool(items, fn) {
  let i = 0; const res = [];
  await Promise.all(Array.from({ length: CONC }, async () => { while (i < items.length) { const k = i++; res[k] = await fn(items[k], k); await sleep(250); } }));
  return res;
}
const upper = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['.]/g, "").replace(/&/g, " ").trim().replace(/\s+/g, "_").toUpperCase();
const snake = k => k.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();

await connect();

// 1) Meta por línea (en inglés para casar nombres) + versión del parche
const metaEn = await op("lol_list_lane_meta_champions", { position: "all", lang: "en_US",
  desired_output_fields: POS.map(p => `data.positions.${p}[].{champion,is_rip,play,win_rate,pick_rate,role_rate,ban_rate,kda,tier,rank}`) });
const anyChamp = metaEn.data.positions.mid[0].champion;
const probe = await op("lol_get_champion_analysis", { champion: upper(anyChamp), position: "mid", game_mode: "ranked", lang: LANG,
  desired_output_fields: ["data.trends.win.{created_at,rank,rate,version}"] });
const tw = probe?.data?.trends?.win; const patch = (Array.isArray(tw) ? tw[0] : tw)?.version || "desconocido";
const prev = existsSync(`${OUT}/meta.json`) ? JSON.parse(readFileSync(`${OUT}/meta.json`, "utf8")) : null;
const ageDays = prev ? (Date.now() - Date.parse(prev.updated)) / 864e5 : 99;
console.log("Parche OP.GG:", patch, "| anterior:", prev?.patch, "| antigüedad (días):", ageDays.toFixed(1));
if (!force && prev && prev.patch === patch && ageDays < 3) { console.log("Sin cambios de parche y datos recientes: no se actualiza."); process.exit(0); }

// 2) Campeones (nombres en inglés y español) y Data Dragon
// OP.GG incluye variantes "Jade_*" (ids 60000+) con el mismo nombre que el campeón real: se descartan.
const dedupe = arr => [...new Map(arr.filter(c => c.champion_id > 0 && c.champion_id < 60000 && !/^Jade_/i.test(c.key || "")).map(c => [c.champion_id, c])).values()];
const champsEn = dedupe((await op("lol_list_champions", { lang: "en_US", desired_output_fields: ["data.champions[].{champion_id,key,name}"] })).data.champions);
const champsEs = dedupe((await op("lol_list_champions", { lang: LANG, desired_output_fields: ["data.champions[].{champion_id,key,name}"] })).data.champions);
const esName = Object.fromEntries(champsEs.map(c => [c.champion_id, c.name]));
const ddv = (await (await fetch("https://ddragon.leagueoflegends.com/api/versions.json")).json())[0];
const runesDD = await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${ddv}/data/es_ES/runesReforged.json`)).json();
const spellsDD = (await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${ddv}/data/es_ES/summoner.json`)).json()).data;
const runes = {};
for (const tree of runesDD) { runes[tree.id] = { n: tree.name, i: tree.icon }; for (const slot of tree.slots) for (const r of slot.runes) runes[r.id] = { n: r.name, i: r.icon }; }
const SHARDS = { 5001: "Vida escalable", 5002: "Armadura", 5003: "Resistencia mágica", 5005: "Velocidad de ataque", 5007: "Aceleración de habilidades", 5008: "Fuerza adaptable", 5010: "Velocidad de movimiento", 5011: "Vida", 5013: "Tenacidad y resistencia a ralentizaciones" };
const spells = Object.fromEntries(Object.values(spellsDD).map(s => [s.key, { n: s.name, img: s.image.full }]));

// 3) Resolver el nombre que acepta OP.GG para cada campeón
const byName = Object.fromEntries(champsEn.map(c => [c.name, c]));
const opName = {};
async function resolve(c) {
  const cands = [...new Set([upper(c.name), snake(c.key), c.key.toUpperCase(), upper(c.name.split(/[ &]/)[0])])];
  for (const cand of cands) {
    try { await op("lol_list_champion_details", { champions: [cand], lang: LANG, desired_output_fields: ["data.champions[].{id}"] }, 1); return cand; } catch { }
  }
  return null;
}
for (let i = 0; i < champsEn.length; i += 10) {
  const batch = champsEn.slice(i, i + 10);
  try { await op("lol_list_champion_details", { champions: batch.map(c => upper(c.name)), lang: LANG, desired_output_fields: ["data.champions[].{id}"] }, 1); batch.forEach(c => opName[c.champion_id] = upper(c.name)); }
  catch { for (const c of batch) { const r = await resolve(c); if (r) opName[c.champion_id] = r; else console.log("Sin nombre OP.GG para", c.name); } }
}

// 4) Consejos de Riot y habilidades (de 10 en 10)
const tips = {};
const ids = champsEn.map(c => c.champion_id).filter(id => opName[id]);
for (let i = 0; i < ids.length; i += 10) {
  const batch = ids.slice(i, i + 10);
  const r = await op("lol_list_champion_details", { champions: batch.map(id => opName[id]), lang: LANG,
    desired_output_fields: ["data.champions[].{id,key,name,title,ally_tips[],enemy_tips[],partype,tags[]}", "data.champions[].passive.{description,name}", "data.champions[].spells[].{cooldown_burn[],description,key,name}"] });
  for (const ch of r.data.champions) {
    const c = champsEn.find(x => x.key === ch.id || x.key === ch.key || String(x.champion_id) === String(ch.key));
    if (!c) continue;
    tips[c.champion_id] = { title: ch.title, tags: ch.tags, res: ch.partype, ally: ch.ally_tips || [], enemy: ch.enemy_tips || [],
      passive: ch.passive ? { n: ch.passive.name, d: ch.passive.description } : null,
      spells: (ch.spells || []).map((s, k) => ({ k: ["Q", "W", "E", "R"][k] || s.key, n: s.name, cd: s.cooldown_burn, d: s.description })) };
  }
}

// 5) Campeones y líneas que se juegan
const champs = champsEn.filter(c => c.champion_id > 0).map(c => ({ id: c.champion_id, key: c.key, name: esName[c.champion_id] || c.name, en: c.name, positions: [] }));
const byId = Object.fromEntries(champs.map(c => [c.id, c]));
for (const p of POS) for (const row of metaEn.data.positions[p] || []) {
  const c = byName[row.champion]; if (!c) continue;
  if (row.role_rate >= 0.08 || row.play >= 1500) byId[c.champion_id].positions.push({ pos: p, tier: row.tier, rank: row.rank, wr: r3(row.win_rate), pr: r3(row.pick_rate), br: r3(row.ban_rate), games: row.play, rip: row.is_rip });
}

// 6) Por cada campeón y línea: tabla de enfrentamientos y build de cada counter contra él
const trimGuide = g => {
  const d = g.data || {};
  const top = (arr, n) => (arr || []).slice(0, n).map(x => ({ ids: x.ids, n: x.ids_names, g: x.play, wr: x.play ? r3(x.win / x.play) : null, pr: r3(x.pick_rate) }));
  const rune = (d.runes || []).slice(0, 2).map(r => ({ main: r.primary_page_id, sub: r.secondary_page_id, p: r.primary_rune_ids, s: r.secondary_rune_ids, m: r.stat_mod_ids, g: r.play, wr: r.play ? r3(r.win / r.play) : null, pr: r3(r.pick_rate) }));
  return { runes: rune, start: top(d.starter_items, 2), core: top(d.core_items, 3), boots: top(d.boots, 2), spells: top(d.summoner_spells, 2),
    skills: (d.skills || []).slice(0, 1).map(s => ({ o: s.order, g: s.play, wr: s.play ? r3(s.win / s.play) : null }))[0] || null,
    max: (d.skill_masteries || [])[0]?.ids || null,
    len: (d.game_lengths || []).map(x => ({ t: x.game_length, wr: r3(x.rate) })),
    items: (d.last_items || []).slice(0, 8).map(x => ({ id: x.ids[0], n: x.ids_names[0], pr: r3(x.pick_rate), wr: x.play ? r3(x.win / x.play) : null })),
    games: d.summary?.average_stats?.play ?? null };
};
if (limit === Infinity) { const { rmSync } = await import("node:fs"); rmSync(`${OUT}/m`, { recursive: true, force: true }); }
const tasks = [];
for (const c of champs) for (const p of c.positions) tasks.push([c, p.pos]);
const todo = tasks.slice(0, limit);
let done = 0, fails = 0;
await pool(todo, async ([c, pos]) => {
  if (!opName[c.id]) return;
  try {
    const metaList = metaEn.data.positions[pos]; const opp = metaList.find(r => r.champion !== c.en)?.champion;
    const g = await op("lol_get_lane_matchup_guide", { my_champion: opName[c.id], opponent_champion: opName[byName[opp].champion_id], position: pos, lang: LANG });
    const rows = (g.data?.counters || []).map(r => ({ id: r.champion_id, g: r.play, wr: r.play ? r.win / r.play : null })).filter(r => r.wr != null && byId[r.id]);
    let pool_ = rows.filter(r => r.g >= MIN_GAMES); if (pool_.length < N_COUNTERS) pool_ = rows.filter(r => r.g >= MIN_GAMES_FALLBACK);
    const sorted = [...pool_].sort((a, b) => a.wr - b.wr);
    const counters = sorted.slice(0, N_COUNTERS), easy = sorted.slice(-N_EASY).reverse();
    const vs = {};
    for (const k of counters) {
      if (!opName[k.id]) continue;
      try { vs[k.id] = trimGuide(await op("lol_get_lane_matchup_guide", { my_champion: opName[k.id], opponent_champion: opName[c.id], position: pos, lang: LANG })); }
      catch (e) { console.log("  fallo guía", byId[k.id].name, "vs", c.name, pos, String(e).slice(0, 120)); }
      await sleep(200);
    }
    save(`${OUT}/m/${pos}/${c.id}.json`, { id: c.id, pos, patch,
      counters: counters.map(r => ({ id: r.id, g: r.g, myWr: r3(r.wr) })), easy: easy.map(r => ({ id: r.id, g: r.g, myWr: r3(r.wr) })),
      all: rows.length, vs });
  } catch (e) { fails++; console.log("Fallo", c.name, pos, String(e).slice(0, 160)); }
  if (++done % 20 === 0) console.log(`${done}/${todo.length}`);
});

save(`${OUT}/meta.json`, { patch, updated: new Date().toISOString(), ddragon: ddv, source: "OP.GG (servidor MCP oficial) · Data Dragon de Riot", champs, runes, shards: SHARDS, spells, fails });
save(`${OUT}/tips.json`, tips);
console.log("Hecho. Campeón-línea:", todo.length, "fallos:", fails);
