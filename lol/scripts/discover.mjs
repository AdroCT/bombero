import { connect, call } from "./mcp.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync("lol/discovery", { recursive: true });
const save = (f, d) => writeFileSync("lol/discovery/" + f, typeof d === "string" ? d : JSON.stringify(d, null, 1));
await connect();
const F = ["champion","position","data.weak_counters[].{champion_id,champion_name,counter_win_rate,my_win_rate,play,win,win_rate}","data.strong_counters[].{champion_id,champion_name,counter_win_rate,my_win_rate,play,win,win_rate}","data.runes.{id,pick_rate,play,primary_page_id,primary_page_name,primary_rune_ids[],primary_rune_names[],secondary_page_id,secondary_page_name,secondary_rune_ids[],secondary_rune_names[],stat_mod_ids[],stat_mod_names[],win}","data.core_items.{ids[],ids_names[],pick_rate,play,win}","data.boots.{ids[],ids_names[],pick_rate,play,win}","data.starter_items.{ids[],ids_names[],pick_rate,play,win}","data.summoner_spells.{ids[],ids_names[],pick_rate,play,win}","data.skills.{order[],pick_rate,play,win}","data.skill_masteries.{ids[],pick_rate,play,win}","data.summary.average_stats.{ban_rate,kda,pick_rate,play,rank,tier,win_rate}","data.damage_type","data.trends.win.{created_at,rank,rate,version}"];
const tries = [
  ["lol_get_champion_analysis", { champion: "AHRI", position: "mid", game_mode: "ranked", lang: "es_ES", desired_output_fields: F }],
  ["lol_get_champion_analysis", { champion: "AHRI", position: "mid", game_mode: "ranked", lang: "es_ES", tier: "emerald_plus", desired_output_fields: F.slice(0,4) }],
  ["lol_get_lane_matchup_guide", { my_champion: "FIZZ", opponent_champion: "AHRI", position: "mid", lang: "es_ES", client_app: "LoLCountersApp/1.0" }],
  ["lol_list_champion_details", { champions: ["FIZZ","MONKEY_KING","TWISTED_FATE"], lang: "es_ES", desired_output_fields: ["data.champions[].{id,key,name,title,enemy_tips[],ally_tips[]}","data.champions[].spells[].{key,name}","data.champions[].passive.{name}"] }],
  ["lol_list_lane_meta_champions", { position: "all", lang: "es_ES", desired_output_fields: ["data.positions.top[].{champion,tier,win_rate,pick_rate,ban_rate,rank}"] }],
];
for (const [i, [name, args]] of tries.entries()) {
  const t0 = Date.now();
  try { save(`d2_${i}_${name}.json`, { ms: 0, args, out: await call(name, args), took: Date.now() - t0 }); }
  catch (e) { save(`d2_${i}_${name}.err.txt`, String(e)); }
}
console.log("ok");
