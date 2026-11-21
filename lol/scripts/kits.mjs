// Kits oficiales de Riot (Data Dragon): estadísticas, habilidades por rango y coste de objetos.
import { writeFileSync, readFileSync, existsSync } from "node:fs";
const v = (await (await fetch("https://ddragon.leagueoflegends.com/api/versions.json")).json())[0];
const full = (await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/es_ES/championFull.json`)).json()).data;
const items = (await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${v}/data/es_ES/item.json`)).json()).data;
const strip = s => String(s || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/\{\{[^}]+\}\}/g, "?").replace(/\s+/g, " ").trim();
const kits = {};
for (const c of Object.values(full)) {
  const s = c.stats;
  kits[c.key] = {
    key: c.id, name: c.name, title: c.title, tags: c.tags, res: c.partype,
    stats: { range: s.attackrange, ms: s.movespeed, hp: s.hp, hpl: s.hpperlevel, ar: s.armor, arl: s.armorperlevel, mr: s.spellblock, mrl: s.spellblockperlevel, ad: s.attackdamage, adl: s.attackdamageperlevel, as: s.attackspeed, asl: s.attackspeedperlevel, mp: s.mp, mpl: s.mpperlevel },
    passive: { n: c.passive.name, d: strip(c.passive.description) },
    spells: c.spells.map((sp, i) => ({ k: "QWER"[i], n: sp.name, cd: sp.cooldown, cost: sp.cost, range: sp.range, max: sp.maxrank, d: strip(sp.description) })),
    ally: c.allytips, enemy: c.enemytips
  };
}
const it = {};
for (const [id, x] of Object.entries(items)) if (x.gold && x.maps?.["11"]) it[id] = { n: x.name, g: x.gold.total, tags: x.tags, from: x.from || [], d: strip(x.plaintext || "") };
writeFileSync("lol/data/kits.json", JSON.stringify({ ddragon: v, kits }));
writeFileSync("lol/data/items.json", JSON.stringify(it));
console.log("kits", Object.keys(kits).length, "items", Object.keys(it).length, "ddragon", v);
