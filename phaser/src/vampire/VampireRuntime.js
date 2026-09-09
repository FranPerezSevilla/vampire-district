import { buildings, LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { COMBAT_STATES } from "../data/combat.js";
import { VAMPIRE_CONTACTS, VAMPIRE_ASSETS, VAMPIRE_DONORS, VAMPIRE_RULES as R, contactById, assetById, donorById, powerStage } from "./VampireCatalog.js";
import { createVampireSites, directionTo } from "./VampireWorldSites.js";
import { FrenzyController } from "./FrenzyController.js";
import { VampireHud } from "./VampireHud.js";
import { VampireDomainPanel, DOMAIN_TABS } from "./VampireDomainPanel.js";
import { clampMapPoint, domainDestination, errandModel } from "./VampireDomainModel.js";

export class VampireRuntime {
  constructor(scene) {
    this.scene = scene;
    this.sites = createVampireSites(buildings, (x, y) => scene.canStandAt?.(x, y) !== false);
    this.people = new Map();
    this.labels = new Map();
    this.boundService = null;
    this.refreshAt = 0;
    this.saveElapsed = 0;
    this.noticeQueue = [];
    this.currentNotice = "";
    this.noticeUntil = 0;
    this.frenzy = new FrenzyController(scene, {
      state: () => this.service.state.frenzy, now: () => this.service?.state.elapsed || 0,
      notify: text => this.notice(text)
    });
    this.hud = new VampireHud(this);
    this.domain = new VampireDomainPanel(this);
    this.destinationLabel = scene.add?.text?.(0, 0, "", { fontFamily: "Arial, Helvetica, sans-serif", fontSize: "12px", color: "#ffdc93", backgroundColor: "#10151d", padding: { x: 5, y: 3 } });
    this.destinationLabel?.setOrigin?.(0.5, 1)?.setDepth?.(74);
    this.destinationLabel?.setVisible?.(false);
    this.feedListener = event => {
      const id = event.targetId;
      if (donorById(id)) this.service?.harmDonor(id, { depth: event.depth, dead: !event.victimAlive });
    };
    this.hitListener = event => {
      if (donorById(event.targetId)) this.service?.harmDonor(event.targetId, {});
    };
    this.deathListener = () => {
      this.frenzy.reset();
      this.service?.abandonDelivery({ death: true });
    };
    this.rescueListener = () => this.service?.rescue();
    this.bodyListener = () => { this.persistBody(); if (this.campaign?.autoSave && this.restored) this.campaign.save(); };
    scene.events?.on?.("feeding:resolved", this.feedListener);
    scene.events?.on?.("combat:hit", this.hitListener);
    scene.events?.on?.("player:died", this.deathListener);
    scene.events?.on?.("death:hospital-recovery-ready", this.rescueListener);
    scene.events?.on?.("hunger:changed", this.bodyListener);
    scene.events?.on?.("player:damaged", this.bodyListener);
    scene.events?.on?.("beast:frenzy-started", this.bodyListener);
    scene.events?.on?.("beast:frenzy-ended", this.bodyListener);
    this.bind();
  }
  get campaign() { return this.scene.campaignSystem || globalThis.NBD_CAMPAIGN_SYSTEM; }
  get service() { return this.campaign?.vampire; }
  bind() {
    if (!this.service || this.service === this.boundService) return;
    if (this.boundService && this.scene.interactionSystem?.isOpen) this.scene.interactionSystem.close("Campaign reloaded.");
    this.disposeNotice?.();
    this.boundService = this.service;
    this.disposeNotice = this.service.events.on("vampire:changed", event => this.notice(event.payload.text));
    this.frenzy.reset();
    this.restored = false;
    this.saveElapsed = 0;
    this.domain?.invalidate();
    this.createPeople();
  }
  notice(text) {
    if (!text) return;
    this.scene.lastActionText = text;
    this.refreshAt = 0;
    this.domain?.invalidate();
    if (this.domain) this.domain.feedback = text;
    if (/^(FRENZY|HUNGER|Control returns)/.test(text)) {
      this.currentNotice = text;
      this.noticeUntil = (this.service?.state.elapsed || 0) + 8;
    } else {
      this.noticeQueue.push(text);
      this.noticeQueue = this.noticeQueue.slice(-4);
      if (!this.currentNotice || (this.service?.state.elapsed || 0) >= this.noticeUntil) this.nextNotice();
    }
  }
  nextNotice() {
    this.currentNotice = this.noticeQueue.shift() || "";
    this.noticeUntil = (this.service?.state.elapsed || 0) + 7;
  }
  createPeople() {
    for (const def of [...VAMPIRE_CONTACTS, ...VAMPIRE_DONORS]) {
      if (this.people.has(def.id)) continue;
      const site = this.sites[def.buildingId];
      const donor = Boolean(donorById(def.id));
      const candidates = donor ? [{ x: site.x + 28, y: site.y }, { x: site.x - 28, y: site.y }, { x: site.x, y: site.y + 28 }] : [site];
      const point = candidates.find(value => this.scene.canStandAt?.(value.x, value.y) !== false) || site;
      const npc = this.scene.npcSystem?.createNpc?.({
        ...point,
        id: donor ? def.id : `vampire:${def.id}`, name: def.name,
        type: NPC_TYPES.CIVILIAN, layer: LAYERS.STREET,
        behavior: "guard", speed: 0, dirX: 0, dirY: 1,
        vampire: !donor, noHeartbeat: !donor, missionInformant: !donor,
        vampireContact: def.id
      });
      if (!npc) continue;
      this.people.set(def.id, npc);
      this.scene.npcSystem.npcs.push(npc);
      if (donor) this.syncDonor(def.id, true);
      const label = this.scene.add?.text?.(npc.x, npc.y - 22, def.name, {
        fontFamily: "Arial, Helvetica, sans-serif", fontSize: "11px", color: "#dfffee",
        backgroundColor: "#10151d", padding: { x: 4, y: 2 }
      });
      label?.setOrigin?.(0.5, 1)?.setDepth?.(73);
      label?.setResolution?.(3);
      this.labels.set(def.id, label);
    }
    this.scene.npcSystem?.rebuildSpatialIndex?.();
  }
  syncDonor(id, restore = false) {
    const state = this.service?.state.donors[id], npc = this.people.get(id);
    if (!state || !npc) return;
    if (npc.dead && !state.dead && !restore) this.service.harmDonor(id, { depth: "drain", dead: true });
    if (state.dead) { npc.dead = true; npc.container?.setVisible?.(false); return; }
    if (restore) {
      npc.dead = false;
      npc.feedingDepth = state.depth;
      npc.feedingUnconscious = state.depth === "full_feed";
      if (npc.feedingUnconscious && npc.combat) {
        npc.combat.state = COMBAT_STATES.DOWNED;
        npc.combat.resilience = 0;
        npc.stunnedTimer = Number.POSITIVE_INFINITY;
      } else if (npc.combat) {
        npc.combat.state = COMBAT_STATES.ACTIVE;
        npc.combat.resilience = npc.combat.maxResilience;
        npc.stunnedTimer = 0;
        npc.inactive = false;
      }
    }
    if (state.readyAt && this.service.state.elapsed >= state.readyAt && !npc.drainVictim) {
      state.readyAt = 0;
      state.depth = "none";
      npc.feedingDepth = "none";
      npc.feedingUnconscious = false;
      npc.inactive = false;
      npc.stunnedTimer = 0;
      if (npc.combat) { npc.combat.state = COMBAT_STATES.ACTIVE; npc.combat.resilience = npc.combat.maxResilience; }
    }
  }
  update(dt, frame) {
    this.bind();
    if (!this.service) return frame;
    const running = frame?.worldEnabled && !this.scene.interactionSystem?.isOpen && !this.scene.transitionSystem?.active && !this.scene.playerDamageSystem?.isDead?.();
    if (!running) { this.present(frame); return frame; }
    if (!this.restored) {
      this.restored = true;
      const body = this.service.state.body;
      if (body.hunger != null) this.scene.feedingSystem.hunger = body.hunger;
      if (body.vitality != null && this.scene.playerDamageSystem?.state) {
        this.scene.playerDamageSystem.state.vitality = body.vitality;
        if (body.vitality <= 0) {
          this.scene.playerDamageSystem.state.dead = true;
          this.scene.events?.emit?.("player:died", { sourceId: "saved_collapse", label: "Recovery interrupted by reload" });
          const locked = { ...frame, worldEnabled: false };
          this.present(locked);
          return locked;
        }
      }
      for (const def of VAMPIRE_DONORS) this.syncDonor(def.id, true);
      if (!this.service.state.started) {
        this.service.state.started = true;
        this.notice("Build your network and become Prince. Meet your Sire at the refuge frontage. DOMAIN shows objectives and resources; MAP saves destinations; BLOOD uses a reserve bag.");
      }
    }
    this.service.tick(dt);
    const filtered = this.frenzy.update(dt, frame);
    this.saveElapsed += dt;
    if (this.saveElapsed >= R.savePeriod) { this.saveElapsed = 0; this.persistBody(); if (this.campaign.autoSave) this.campaign.save(); }
    for (const def of VAMPIRE_DONORS) this.syncDonor(def.id);
    this.present(filtered);
    return filtered;
  }
  persistBody() {
    if (!this.service || !this.restored) return;
    this.service.state.body.hunger = this.scene.feedingSystem?.hunger || 0;
    this.service.state.body.vitality = this.scene.playerDamageSystem?.state?.vitality ?? 100;
  }
  available() {
    return Boolean(this.service && this.scene.currentInputFrame?.worldEnabled && !this.scene.registry?.get?.("uiPaused") && !this.scene.transitionSystem?.active && !this.scene.playerDamageSystem?.isDead?.() && !this.frenzy.active);
  }
  outcome(result) { if (result && !result.ok) this.notice(result.text); this.persistBody(); if (this.campaign.autoSave) this.campaign.save(); return result; }
  useBlood() {
    if (!this.available() || this.scene.feedingSystem?.isActive?.()) return false;
    const result = this.service.consumeBlood(this.scene.feedingSystem.hunger);
    if (result.ok) this.scene.feedingSystem.relieveHunger(result.relief, "stored_blood");
    this.outcome(result);
    return result.ok;
  }
  mendBlood() {
    if (!this.available() || !this.frenzy.allowsPowers()) return false;
    const damage = this.scene.playerDamageSystem;
    if ((damage?.state?.vitality ?? 100) >= 100) { this.notice("Vitality is already full."); return false; }
    this.scene.powersSystem.addHunger(12, "Blood mending");
    damage.restoreVitality(30, "blood_mending");
    this.notice("Blood mending · Vitality +30 · Hunger +12. Reaching 100 triggers frenzy.");
    this.outcome({ ok: true });
    return true;
  }
  refugeRecovery() {
    if (!this.available()) return false;
    if (this.scene.heatSystem?.level?.() > 0) { this.notice("Lose the active police search before using the refuge."); return false; }
    const result = this.service.consumeBlood(this.scene.feedingSystem.hunger || 1);
    if (result.ok) {
      this.scene.feedingSystem.relieveHunger(result.relief, "refuge_blood");
      this.scene.playerDamageSystem.restoreVitality(45, "refuge_recovery");
      this.notice("Refuge recovery · one blood bag spent · Hunger -35 · Vitality +45.");
    }
    this.outcome(result);
    return result.ok;
  }
  option(id, label, detail, run) { return { id, label, detail, type: "vampire", run }; }
  open(title, detail, options) {
    if (!this.available()) return false;
    this.scene.interactionSystem.open(options.slice(0, 9), { title, detail });
    return true;
  }
  track(id) {
    if (!domainDestination(this, id)) { this.notice("That destination is no longer available."); return false; }
    this.service.state.guide = id;
    const target = this.guideTarget();
    this.notice(`Tracking ${target?.label || "your network"}. Follow the direction in the vampire panel.`);
    this.outcome({ ok: true });
    return true;
  }
  saveMarker(target, point = null) {
    const destination = target === "player" ? { ...this.scene.player, label: "My marked position" } : target ? domainDestination(this, target) : null;
    const position = clampMapPoint(point || destination);
    if (!position) return this.outcome({ ok: false, text: "Choose a valid destination on the map." });
    return this.outcome(this.service.saveMarker({ ...position, label: destination?.label, target: target === "player" || target === "delivery" ? null : target }));
  }
  openDomain(tab = "overview", target = null) {
    if (!this.available() || this.scene.feedingSystem?.isActive?.()) return false;
    this.domain.show(tab, target);
    const options = DOMAIN_TABS.map(label => this.option(`domain:${label.toLowerCase()}`, label, "Open this section", () => this.openDomain(label.toLowerCase())));
    options.push(this.option("domain:close", "Return to city", "Resume play", () => {}));
    this.scene.interactionSystem.open(options, { title: "Your vampire domain", view: "vampire-domain" });
    this.scene.interactionSystem.menu.index = DOMAIN_TABS.findIndex(label => label.toLowerCase() === this.domain.tab);
    this.scene.interactionSystem.publish();
    this.domain.render(this.scene.interactionSystem.menu);
    return true;
  }
  acceptDelivery(id) {
    const result = this.outcome(this.service.acceptDelivery(id));
    if (result.ok) this.openDomain("errand");
    return result;
  }
  openNetwork() {
    if (this.scene.interactionSystem?.isOpen || !this.available()) return false;
    return this.openDomain();
  }
  openAccounts() {
    return this.openDomain("resources");
  }
  openPrince() {
    const requirements = this.service.princeRequirements();
    const options = requirements.map((item, index) => this.option(`requirement:${index}`, `${item.met ? "READY" : "NEEDED"} · ${item.text}`, "View your contacts and assets for the next step", () => this.openAccounts()));
    return this.open(this.service.state.prince ? "Prince of the city" : "The city compact", "Meet the Sire at your refuge to claim the title once all requirements are met. Citywide hunting access is the reward.", options);
  }
  openContact(id) {
    if (!this.available()) return false;
    const def = contactById(id);
    const meeting = this.outcome(this.service.meet(id));
    if (!meeting.ok) return this.open(`${def.name} · Introduction needed`, meeting.text, [this.option(`introduction:${id}`, "View introduction objectives", "Contacts and the next useful step", () => this.openDomain("contacts"))]);
    const person = this.service.contact(id);
    const options = this.service.state.job
      ? [this.option("work:active", "View your current errand", "Finish or abandon it before accepting another", () => this.openDomain("errand"))]
      : [this.option(`work:${id}`, "Accept a supply delivery", `$${def.reward} · earns trust · repayments deducted`, () => this.acceptDelivery(id))];
    if (["sire", "mara"].includes(id)) options.push(this.option(`blood:${id}`, "Buy one blood bag", `$${this.service.trust(id) >= 40 ? 60 : R.bagPrice} · Hunger -35`, () => this.outcome(this.service.buyBlood(id))));
    if (id === "sire") {
      options.push(this.option("sire:advance", "Ask for blood and startup cash", "2 bags + $150 · owe $200", () => this.outcome(this.service.borrow())));
      options.push(this.option("sire:prince", "Claim the title of Prince", "3 controlled businesses · 3 supporters · debts settled · $1200", () => this.outcome(this.service.claimPrince())));
      options.push(this.option("sire:recover", "Recover at the refuge", "Spend 1 blood bag · Vitality +45 · lose the police first", () => this.refugeRecovery()));
    } else {
      options.push(this.option(`access:${id}`, "Negotiate hunting permission", "Trust 15 · no debt · keep victims alive and feeding discreet", () => this.outcome(this.service.grantAccess(id))));
      const asset = VAMPIRE_ASSETS.find(value => value.contactId === id);
      if (asset) options.push(this.option(`business:${asset.id}`, "Business and investment", asset.name, () => this.openBusiness(asset.id)));
      options.push(this.option(`support:${id}`, "Ask for support as Prince", "Trust 40 · control the business · no debt", () => this.outcome(this.service.endorse(id))));
    }
    if (person.debt) options.push(this.option(`repay:${id}`, "Repay outstanding debt", `$${person.debt}`, () => this.outcome(this.service.repay(id))));
    if (person.suspended || VAMPIRE_DONORS.some(d => d.contactId === id && this.service.state.donors[d.id].refused)) options.push(this.option(`repair:${id}`, "Repair the agreement", `$${R.repairCost} · a successful delivery also repairs it`, () => this.outcome(this.service.repair(id))));
    return this.open(`${def.name} · ${def.role}`, this.service.contactSummary(id), options);
  }
  openBusiness(id) {
    const def = assetById(id), asset = this.service.state.assets[id];
    const options = [];
    if (asset.level < 2) options.push(this.option(`invest:${id}`, asset.level ? "Buy control of this business" : "Invest in this business", `$${asset.level ? Math.round(def.price * 0.75) : def.price} · trust 15`, () => this.outcome(this.service.invest(id))));
    if (asset.level) options.push(this.option(`withdraw:${id}`, "Collect blood reserves", `${asset.reserve} ready · pouch capacity 4`, () => this.outcome(this.service.withdrawBlood(id))));
    if (asset.level >= 2) {
      options.push(this.option(`policy:${id}:discreet`, "Reserve capacity for your network", "Full blood production · normal income", () => this.outcome(this.service.setPolicy(id, "discreet"))));
      options.push(this.option(`policy:${id}:open`, "Sell access to other vampires", "Income +50% · production -1 blood bag/cycle", () => this.outcome(this.service.setPolicy(id, "open"))));
    }
    if (id === "depot" && asset.level) options.push(this.option("depot:recover", "Recover at your depot refuge", "Spend 1 blood bag · Vitality +45 · lose the police first", () => this.refugeRecovery()));
    return this.open(def.name, `${def.description} Production every 90s of play. ${asset.level ? "Staff handle income automatically." : "Start as an investor, then buy control."}`, options);
  }
  collectInteractions() {
    if (!this.available() || this.scene.currentLayer !== LAYERS.STREET || this.scene.feedingSystem?.isActive?.()) return [];
    const options = [];
    for (const def of [...VAMPIRE_CONTACTS, ...VAMPIRE_DONORS]) {
      const npc = this.people.get(def.id);
      if (!npc || npc.dead || npc.inactive || npc.feedingUnconscious) continue;
      const distance = Math.hypot(npc.x - this.scene.player.x, npc.y - this.scene.player.y);
      if (distance > 46) continue;
      const donor = donorById(def.id);
      options.push({ ...this.option(`talk:${def.id}`, donor ? `Ask ${def.name} for a donation` : `Talk to ${def.name}`, donor ? this.service.donorAvailable(def.id) || "Voluntary donation · Hunger -28 · recovery 4 min" : this.service.contactAccess(def.id).available ? def.role : "Introduction needed · view objectives", () => {
        if (donor) {
          const result = this.service.donate(def.id, this.scene.feedingSystem.hunger);
          if (result.ok) { this.scene.feedingSystem.relieveHunger(result.relief, "consensual_donation"); npc.feedingDepth = "quick_bite"; }
          this.outcome(result);
        } else this.openContact(def.id);
      }), priority: 130, x: npc.x, y: npc.y, distance });
    }
    const site = this.sites[this.service.deliverySite()];
    if (site) {
      const distance = Math.hypot(site.x - this.scene.player.x, site.y - this.scene.player.y);
      if (distance <= 55) options.push({ ...this.option("delivery:handoff", this.service.state.job.stage === "accepted" ? "Collect sealed supplies" : "Deliver sealed supplies", contactById(this.service.state.job.issuer).name, () => this.outcome(this.service.handoff(site.id))), priority: 150, x: site.x, y: site.y, distance });
    }
    return options;
  }
  guideTarget() {
    return domainDestination(this, this.service.state.guide) || domainDestination(this, "contact:sire");
  }
  present(frame) {
    if (!this.service) return;
    this.domain.render(this.scene.interactionSystem?.menu, !frame?.worldEnabled || Boolean(this.scene.registry?.get?.("uiPaused")));
    const now = this.service.state.elapsed;
    if (now >= this.noticeUntil) this.nextNotice();
    const target = this.guideTarget();
    const visible = Boolean(this.service.state.started && frame?.worldEnabled && !this.scene.registry?.get?.("uiPaused"));
    if (now < this.refreshAt && this.lastVisible === visible) return;
    this.refreshAt = now + 0.12;
    this.lastVisible = visible;
    this.hud.render({ visible, stage: powerStage(this.service.state), cash: this.service.wallet.balance(), bags: this.service.state.bloodBags,
      guide: `${target.label} · ${directionTo(this.scene.player, target)}${this.scene.currentLayer !== LAYERS.STREET ? " · meet at street level" : ""}`,
      errand: this.service.state.job ? errandModel(this).summary : "No active errand",
      notice: this.currentNotice, locked: this.frenzy.active || Boolean(this.scene.interactionSystem?.isOpen), frenzy: this.frenzy.active });
    for (const [id, label] of this.labels) {
      const npc = this.people.get(id);
      const near = Math.hypot(npc.x - this.scene.player.x, npc.y - this.scene.player.y) < 260;
      label?.setPosition?.(npc.x, npc.y - 22);
      label?.setVisible?.(visible && near && !npc.dead && this.scene.currentLayer === LAYERS.STREET);
    }
    const targetNear = Math.hypot(target.x - this.scene.player.x, target.y - this.scene.player.y) < 350;
    this.destinationLabel?.setText?.(`◆ ${target.label}`);
    this.destinationLabel?.setPosition?.(target.x, target.y - 42);
    this.destinationLabel?.setVisible?.(visible && targetNear && this.scene.currentLayer === LAYERS.STREET && !this.scene.interactionSystem?.isOpen);
    const stage = powerStage(this.service.state);
    if (this.scene.registry?.get?.("vampireStage") !== stage) this.scene.registry?.set?.("vampireStage", stage);
    if (this.scene.registry?.get?.("vampireFrenzy") !== this.frenzy.active) this.scene.registry?.set?.("vampireFrenzy", this.frenzy.active);
    const exhausted = this.frenzy.exhausted() || this.frenzy.hunger() >= 100;
    if (this.scene.registry?.get?.("vampireExhausted") !== exhausted) this.scene.registry?.set?.("vampireExhausted", exhausted);
  }
  destroy() {
    this.persistBody();
    if (this.campaign?.autoSave && this.restored) this.campaign.save();
    this.disposeNotice?.();
    this.frenzy.destroy();
    this.hud.destroy();
    this.domain.destroy();
    this.destinationLabel?.destroy?.();
    for (const label of this.labels.values()) label?.destroy?.();
    this.scene.events?.off?.("feeding:resolved", this.feedListener);
    this.scene.events?.off?.("combat:hit", this.hitListener);
    this.scene.events?.off?.("player:died", this.deathListener);
    this.scene.events?.off?.("death:hospital-recovery-ready", this.rescueListener);
    this.scene.events?.off?.("hunger:changed", this.bodyListener);
    this.scene.events?.off?.("player:damaged", this.bodyListener);
    this.scene.events?.off?.("beast:frenzy-started", this.bodyListener);
    this.scene.events?.off?.("beast:frenzy-ended", this.bodyListener);
  }
}
