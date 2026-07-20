import test from "node:test";
import assert from "node:assert/strict";
import { CampaignEventBus } from "../phaser/src/campaign/CampaignEventBus.js";
import { createCampaignState } from "../phaser/src/campaign/CampaignState.js";
import { ReputationSystem } from "../phaser/src/campaign/ReputationSystem.js";
import { WalletSystem } from "../phaser/src/campaign/WalletSystem.js";

function fixture() {
  let now = 1_000;
  const state = createCampaignState({ now });
  const events = new CampaignEventBus(state, { now: () => now++ });
  return {
    state,
    events,
    wallet: new WalletSystem(state, { events, now: () => now++ }),
    reputation: new ReputationSystem(state, { events })
  };
}

test("wallet credits and debits produce an auditable deterministic ledger", () => {
  const { state, wallet } = fixture();
  const mission = wallet.credit(500, {
    source: "mission",
    reason: "Silence the Journalist",
    referenceId: "silence_the_journalist"
  });
  const ammo = wallet.debit(90, {
    source: "supplier",
    reason: "12 pistol rounds",
    referenceId: "pistol_rounds_12"
  });

  assert.equal(wallet.balance(), 410);
  assert.equal(mission.id, "txn-000001");
  assert.equal(mission.balanceBefore, 0);
  assert.equal(mission.balanceAfter, 500);
  assert.equal(ammo.id, "txn-000002");
  assert.equal(ammo.balanceBefore, 500);
  assert.equal(ammo.balanceAfter, 410);
  assert.deepEqual(state.ledger.map(entry => entry.type), ["credit", "debit"]);
});

test("wallet refuses overspending without mutating balance or ledger", () => {
  const { state, wallet } = fixture();
  wallet.credit(50, { source: "test" });
  assert.throws(() => wallet.debit(90, { source: "supplier" }), error => {
    assert.equal(error.code, "INSUFFICIENT_CASH");
    assert.equal(error.required, 90);
    assert.equal(error.balance, 50);
    return true;
  });
  assert.equal(wallet.balance(), 50);
  assert.equal(state.ledger.length, 1);
});

test("faction and contact reputation are separate and clamped", () => {
  const { reputation } = fixture();
  reputation.modifyFaction("blackglass_directorate", 12, { reason: "mission" });
  reputation.modifyContact("police_roof_informant", 4, { reason: "protected identity" });
  reputation.modifyContact("unaligned_mechanic", -18, { reason: "unpaid debt" });

  assert.equal(reputation.faction("blackglass_directorate"), 12);
  assert.equal(reputation.contact("police_roof_informant"), 4);
  assert.equal(reputation.contact("unaligned_mechanic"), -18);
  assert.equal(reputation.tier(12).id, "useful");
  assert.equal(reputation.tier(-18).id, "distrusted");

  reputation.modifyFaction("blackglass_directorate", 500);
  reputation.modifyContact("unaligned_mechanic", -500);
  assert.equal(reputation.faction("blackglass_directorate"), 100);
  assert.equal(reputation.contact("unaligned_mechanic"), -100);
});

test("campaign events record plain-data wallet and reputation changes", () => {
  const { state, events, wallet, reputation } = fixture();
  const received = [];
  events.on("*", event => received.push(event.type));
  wallet.credit(100, { source: "mission" });
  reputation.modifyFaction("red_assembly", -5, { source: "mission" });

  assert.deepEqual(received, ["wallet:changed", "reputation:changed"]);
  assert.deepEqual(state.eventLog.map(event => event.type), received);
  assert.doesNotThrow(() => JSON.stringify(state.eventLog));
});
