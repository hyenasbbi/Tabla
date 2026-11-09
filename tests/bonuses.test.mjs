import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import test from "node:test";

for (const path of ["public/index.html", "index.html"]) {
  const html = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const settings = html.slice(html.indexOf("function normalizeSettings("), html.indexOf('    const STORAGE_KEY'));
  const bonuses = html.slice(html.indexOf("    function setBonusStatus("), html.indexOf("    function updateDateLabel("));
  function evaluate(team, winner3k = null) {
    const nodes = new Map();
    const state = {team, winner3k};
    const context = vm.createContext({state, document:{getElementById(id) {
      if (!nodes.has(id)) nodes.set(id,{style:{},classList:{toggle(){}},textContent:""});
      return nodes.get(id);
    }}});
    vm.runInContext(`${settings}\n${bonuses}\nrenderBonuses(state.team);`, context);
    return {nodes,state};
  }
  test(`${path}: insufficient sales block all bonuses, including stale winner and checked ticket`, () => {
    const {nodes,state} = evaluate([{shortName:"Seller",sales:1000,ticket2k:true}],"Seller");
    for (const id of ["status2k","status3k","status5k","status6k"]) assert.match(nodes.get(id).textContent,/Bloqueado/);
    assert.equal(state.winner3k,null);
  });
  test(`${path}: thresholds unlock bonuses only when reached`, () => {
    for (const [sales,unlocked] of [[1999,0],[2000,1],[2999,1],[3000,2],[5000,3],[6500,4]]) {
      const {nodes} = evaluate([{shortName:"Seller",sales,ticket2k:true}]);
      const statuses=["status2k","status3k","status5k","status6k"];
      assert.equal(statuses.filter(id=>nodes.get(id).textContent.includes("Desbloqueado")).length,unlocked);
    }
  });
  test(`${path}: ticket bonus also requires confirmation of a single ticket`, () => {
    const {nodes} = evaluate([{shortName:"Seller",sales:7000,ticket2k:false}]);
    assert.match(nodes.get("status2k").textContent,/Bloqueado/);
  });
  test(`${path}: correcting sales revokes the old winner and reevaluates eligibility`, () => {
    const {nodes,state} = evaluate([{shortName:"Old",sales:1000},{shortName:"Eligible",sales:3000}],"Old");
    assert.equal(state.winner3k,"Eligible");
    assert.equal(nodes.get("copy3k").textContent,"Ganador: Eligible");
  });
}
