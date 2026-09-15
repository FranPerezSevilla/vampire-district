import { buildNightLedgerModel } from "./NightLedgerModel.js";

// Read-only projection helpers. These never own gameplay or render DOM nodes.
export const gameUiReadMethods = {
  readState() {
    const get = (key, fallback = "") => this.registry.get(key) ?? fallback;
    const result = this.registry.get("missionResult") || null;
    return {
      mission: get("missionText", "Objective unavailable"),
      campaignMission: this.registry.get("campaignMission") || result?.mission || null,
      visibility: get("visibilityText", "Visibility unknown"),
      exposureText: get("exposureText", "Exposure unavailable"),
      heatText: get("heatText", "Heat unavailable"),
      wantedLevel: Math.max(0, Math.min(3, Number(get("wantedLevel", 0)) || 0)),
      policeText: get("policeText", "Police unavailable"),
      witnessText: get("witnessText", "Witnesses unavailable"),
      hunterText: get("hunterText", "Hunters dormant"),
      evidenceText: get("evidenceText", "Evidence unavailable"),
      npcText: get("npcText", "NPCs unavailable"),
      propText: get("propText", "Props unavailable"),
      aiText: get("aiText", "AI unavailable"),
      runtimeText: get("runtimeText", "Runtime unavailable"),
      performanceText: get("performanceText", "Performance unavailable"),
      hungerText: get("hungerText", "Hunger unavailable"),
      powersText: get("powersText", "Powers unavailable"),
      xy: get("playerXY", "0, 0"),
      prompt: get("interactionPrompt", ""),
      lastAction: get("lastActionText", ""),
      menu: this.registry.get("interactionMenu") || null,
      result,
      weapon: this.registry.get("weaponState") || {
        id: "unarmed",
        name: "Unarmed",
        ammoText: "∞",
        empty: false,
        inventory: ["unarmed"]
      },
      inputBindings: this.registry.get("inputBindings") || null
    };
  },
  collectPoliceLedgerState(gameScene) {
    if (!gameScene) return {};
    const heatSystem = gameScene.heatSystem;
    const exposureSystem = gameScene.exposureSystem;
    const police = gameScene.policeSystem;
    const witnesses = gameScene.witnessSystem;
    const evidence = gameScene.evidenceSystem;
    const officers = police?.police?.() || [];
    const chasing = officers.filter(officer => officer.chasingPlayer).length;
    const level = Math.max(0, Math.min(3, Number(heatSystem?.level?.()) || 0));
    const hottest = heatSystem?.hottestZone?.() || police?.hottestZone?.() || null;
    const hottestHeat = hottest
      ? Number(heatSystem?.valueFor?.(hottest.id) ?? police?.localHeat?.[hottest.id]) || 0
      : 0;
    const heatSnapshot = heatSystem?.snapshot?.() || {};
    const exposureSnapshot = exposureSystem?.snapshot?.() || {};
    const exposureRecords = exposureSystem?.activeEvidence?.() || Object.values(exposureSnapshot.records || {});
    const motorized = gameScene.motorizedPoliceSystem?.snapshot?.() || {};
    const fleeing = witnesses?.alarmedWitnesses?.() || [];
    return {
      level,
      heat: {
        ...heatSnapshot,
        level,
        value: Number(heatSystem?.maximum?.()) || 0,
        max: 100,
        hottestZoneName: hottest?.name || "No hot zone",
        hottestZoneHeat: hottestHeat,
        incidents: heatSystem?.recent?.(10) || heatSnapshot.incidents || []
      },
      exposure: {
        ...exposureSnapshot,
        level: Math.max(0, Number(exposureSystem?.level?.()) || 0),
        value: Number(exposureSystem?.value) || 0,
        max: 125,
        records: exposureRecords,
        lastReason: exposureSystem?.lastReason || exposureSnapshot.lastReason || "No supernatural evidence is known."
      },
      lastReason: heatSnapshot.lastReason || "No active police escalation.",
      summary: police?.summary?.() || "Police status unavailable",
      footOfficers: officers.length,
      chasingOfficers: chasing,
      searchingOfficers: level >= 1 ? Math.max(0, officers.length - chasing) : 0,
      motorizedUnits: Number(motorized.activeUnits) || 0,
      desiredMotorizedUnits: Number(motorized.desiredUnits) || 0,
      fleeingWitnesses: fleeing.length,
      veilRiskWitnesses: fleeing.filter(witness => witness.masqueradeRisk).length,
      witnessReports: Number(witnesses?.reports) || 0,
      bodiesDiscovered: Number(evidence?.stats?.bodiesDiscovered) || 0,
      bodiesHidden: Number(evidence?.stats?.bodiesHidden) || 0,
      bloodEvidence: Array.isArray(evidence?.bloodStains) ? evidence.bloodStains.length : 0,
      hottestZoneName: hottest?.name || "No hot zone",
      hottestZoneHeat: hottestHeat,
      hunterSummary: gameScene.hunterSystem?.summary?.() || "Hunters dormant"
    };
  },
  readNightLedgerState(force = false) {
    const now = this.time?.now || 0;
    if (!force && this.ledgerModel && now < this.ledgerRefreshAt) return this.ledgerModel;
    this.ledgerRefreshAt = now + 400;
    const game = this.scene.get("GameScene");
    const campaign = game?.campaignSystem || globalThis.NBD_CAMPAIGN_SYSTEM;
    this.ledgerModel = buildNightLedgerModel({
      campaignSnapshot: campaign?.snapshot?.() || null,
      currentDistrict: game?.territoryRuntimeSystem?.current?.() || null,
      policeState: this.collectPoliceLedgerState(game),
      now: Date.now()
    });
    return this.ledgerModel;
  }
};
