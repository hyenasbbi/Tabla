import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import test from "node:test";

for (const path of ["netlify/functions/dashboard.mjs", "dashboard.mjs"]) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
    .replace(/import[\s\S]*?from\s+"[^"]+";/g, "")
    .replace("export default async function", "async function");
  const context = vm.createContext({});
  vm.runInContext(`${source}\nthis.normalize = normalizeSettings; this.sanitize = sanitizeState;`, context);
  test(`${path}: legacy state gets defaults and retains sales`, () => {
    const state = context.sanitize({team:[{id:"seller", shortName:"Seller",sales:123,target:3500}]});
    assert.equal(state.settings.monthlyTarget, 20000);
    assert.equal(state.team[0].sales,123);
  });
  test(`${path}: settings survive cloud sanitization`, () => {
    const state=context.sanitize({team:[{id:"seller",shortName:"Seller",target:8000}],settings:{monthLabel:"Mi mes",bannerColor:"#663399",monthlyTarget:40000,bonuses:[{target:2500,reward:75}]}});
    assert.equal(state.settings.monthLabel,"Mi mes");
    assert.equal(state.settings.bannerColor,"#663399");
    assert.equal(state.settings.monthlyTarget,40000);
    assert.equal(state.settings.bonuses[0].reward,75);
    assert.equal(state.settings.bonuses[1].target,3000);
    assert.equal(state.team[0].target,8000);
  });
  test(`${path}: invalid inputs cannot create unsafe colors or zero divisors`, () => {
    assert.equal(context.normalize(null).monthlyTarget,20000);
    const settings=context.normalize({bannerColor:"url(evil)",monthlyTarget:0,bonuses:[{target:-1,reward:-2}]});
    assert.equal(settings.bannerColor,"#161d3d");
    assert.equal(settings.monthlyTarget,1);
    assert.equal(settings.bonuses[0].target,1);
    assert.equal(settings.bonuses[0].reward,0);
  });
}
