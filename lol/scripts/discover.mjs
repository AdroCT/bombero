import { connect, listTools, call } from "./mcp.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync("lol/discovery", { recursive: true });
const save = (f, d) => writeFileSync("lol/discovery/" + f, typeof d === "string" ? d : JSON.stringify(d, null, 1));
await connect();
const tools = await listTools();
save("tools.json", tools);
const tries = [
  ["lol_list_champions", { lang: "es_ES" }],
  ["lol_list_champions", {}],
  ["lol_get_champion_analysis", { champion: "AHRI", position: "mid", game_mode: "ranked", lang: "es_ES" }],
  ["lol_get_lane_matchup_guide", { champion: "AHRI", target_champion: "ZED", position: "mid", lang: "es_ES" }],
  ["lol_list_lane_meta_champions", { position: "mid", lang: "es_ES" }],
  ["lol_list_champion_details", { champions: ["AHRI"], lang: "es_ES" }],
];
for (const [i, [name, args]] of tries.entries()) {
  try { save(`call${i}_${name}.json`, { args, out: await call(name, args) }); }
  catch (e) { save(`call${i}_${name}.err.txt`, String(e)); }
}
console.log("ok");
