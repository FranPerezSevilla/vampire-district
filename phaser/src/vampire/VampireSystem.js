import { VAMPIRE_ASSETS, VAMPIRE_CONTACTS, VAMPIRE_DONORS, VAMPIRE_RULES as R, assetById, contactById, donorById, powerStage } from "./VampireCatalog.js";

// All transactions run through the existing campaign authorities. This service
// owns agreements/business operations, not the campaign mission registry.
export class VampireSystem {
  constructor(campaign) {
    this.campaign = campaign;
    this.events = campaign.events;
    this.events.on("hunting:assessed", event => {
      const id = event.payload.assessmentId;
      if (!this.state.pending.includes(id)) this.state.pending.push(id);
      this.state.pending = this.state.pending.slice(-100);
      this.reviewHunting();
    });
    this.events.on("hunting:violation-discovered", () => this.reviewHunting());
  }

  get state() { return this.campaign.state.vampire; }
  get wallet() { return this.campaign.wallet; }
  trust(id) { return this.campaign.reputation.contact(id); }
  contact(id) { return this.state.contacts[id]; }
  notify(text) {
    this.state.notices.push({ text, at: this.state.elapsed });
    this.state.notices = this.state.notices.slice(-15);
    this.events.emit("vampire:changed", { text, stage: powerStage(this.state) });
    return { ok: true, text };
  }
  reject(text) { return { ok: false, text }; }
  changeTrust(id, amount) {
    this.campaign.reputation.modifyContact(id, amount, { source: "vampire_network" });
    const factionId = contactById(id)?.factionId;
    if (factionId) this.campaign.reputation.modifyFaction(factionId, Math.round(amount / 3), { source: "vampire_network" });
    if (this.trust(id) < R.endorsementTrust) this.contact(id).endorsed = false;
  }
  charge(amount, reason) {
    if (!this.wallet.canAfford(amount)) return false;
    this.wallet.debit(amount, { source: "vampire_network", reason });
    return true;
  }
  meet(id) {
    const def = contactById(id), person = this.contact(id);
    if (!def || !person) return this.reject("Unknown contact.");
    if (!person.met) {
      person.met = true;
      this.changeTrust(id, 5);
      return this.notify(`${def.name}: ${def.greeting}`);
    }
    return { ok: true, text: this.contactSummary(id) };
  }
  contactSummary(id) {
    const def = contactById(id), person = this.contact(id);
    if (!def || !person) return "Unknown contact";
    if (person.suspended) return `${def.name}: ${person.reason} Repair our agreement for $${R.repairCost}, or complete a delivery for me.`;
    const debt = person.debt ? ` You owe $${person.debt}; delivery earnings repay it first.` : " No outstanding debt.";
    const support = person.endorsed ? " You have my support for Prince." : this.trust(id) >= R.endorsementTrust ? " You have earned my trust." : " Keep your word and our relationship will grow.";
    return `${def.name} · Trust ${this.trust(id)}:${debt}${support}`;
  }
  borrow() {
    const person = this.contact("sire");
    if (!person.met) return this.reject("Speak to your Sire first.");
    if (person.debt) return this.reject("The Sire: Finish a delivery or repay what you owe first.");
    if (this.state.bloodBags >= R.carryCapacity) return this.reject("Your blood pouch is full.");
    person.debt = 200;
    this.state.bloodBags = Math.min(R.carryCapacity, this.state.bloodBags + 2);
    this.wallet.credit(150, { source: "sire_advance", reason: "Blood and startup cash against a $200 obligation" });
    return this.notify("The Sire: Two blood bags and $150. You owe me $200. Delivery earnings will repay it first.");
  }
  rescue() {
    this.contact("sire").met = true;
    this.contact("sire").debt += 120;
    return this.notify("The Sire arranged your morgue rescue. You owe another $120; work or repay at the refuge.");
  }
  repay(id) {
    const person = this.contact(id);
    if (!person?.debt) return this.reject("No debt to repay.");
    if (!this.charge(person.debt, `Repay ${contactById(id).name}`)) return this.reject("Insufficient cash. Deliveries can repay this debt without an advance.");
    person.debt = 0;
    this.changeTrust(id, 5);
    return this.notify(`${contactById(id).name}: Your debt is settled. We can do business again.`);
  }
  acceptDelivery(id) {
    const person = this.contact(id), def = contactById(id);
    if (!person?.met || !def) return this.reject("Meet this contact first.");
    if (this.state.job) return this.reject("Finish or abandon the current delivery before accepting another.");
    this.state.job = { issuer: id, stage: "accepted", sequence: ++this.state.sequence };
    this.state.guide = "delivery";
    return this.notify(`${def.name}: Collect at ${this.siteLabel(def.pickup)}, then deliver to ${this.siteLabel(def.delivery)}. Payment $${def.reward}; debt is deducted first. Keep the cargo intact.`);
  }
  siteLabel(id) {
    return ({ hospital: "the hospital", club: "the club", warehouse: "the canal warehouse", marketBlock: "West Market", saintOrisonHotel: "Saint Orison Hotel" })[id] || id;
  }
  deliverySite() {
    const job = this.state.job, def = contactById(job?.issuer);
    return def ? (job.stage === "accepted" ? def.pickup : def.delivery) : null;
  }
  handoff(buildingId) {
    const job = this.state.job, def = contactById(job?.issuer);
    if (!job || !def || this.deliverySite() !== buildingId) return this.reject("This is not the agreed handoff location.");
    if (job.stage === "accepted") {
      job.stage = "collected";
      return this.notify(`Sealed supplies collected. Deliver to ${this.siteLabel(def.delivery)} for ${def.name}.`);
    }
    const person = this.contact(def.id);
    const repaid = Math.min(person.debt, def.reward);
    person.debt -= repaid;
    person.jobs++;
    this.state.job = null; // clear before emitting wallet/reputation events
    this.state.guide = `contact:${def.id}`;
    if (def.reward > repaid) this.wallet.credit(def.reward - repaid, { source: "vampire_delivery", reason: `Delivery for ${def.name}`, referenceId: String(job.sequence) });
    this.changeTrust(def.id, 15);
    this.restoreAgreement(def.id);
    return this.notify(`${def.name}: Delivered. $${def.reward - repaid} paid${repaid ? `; $${repaid} debt repaid` : ""}. Trust ${this.trust(def.id)}. ${person.jobs === 1 ? "You can now negotiate hunting access and investment." : "Our agreement stands."}`);
  }
  abandonDelivery({ death = false } = {}) {
    const job = this.state.job;
    if (!job) return this.reject("No delivery is active.");
    const def = contactById(job.issuer);
    this.state.job = null;
    this.changeTrust(def.id, -10);
    this.state.guide = `contact:${def.id}`;
    return this.notify(`${def.name}: ${death ? "The cargo was lost during your collapse." : "You abandoned our delivery."} Trust fell. You can still work to earn it back.`);
  }
  buyBlood(id) {
    const person = this.contact(id);
    if (!person?.met || person.suspended || !["sire", "mara"].includes(id)) return this.reject("This contact cannot supply you right now.");
    if (this.state.bloodBags >= R.carryCapacity) return this.reject("Blood pouch full (4 bags). Consume a bag before buying another.");
    const price = this.trust(id) >= R.endorsementTrust ? 60 : R.bagPrice;
    if (!this.charge(price, "Purchase stored blood")) return this.reject(`Need $${price}. Deliveries require no investment; the Sire can also offer an advance.`);
    this.state.bloodBags++;
    return this.notify(`${contactById(id).name}: One blood bag for $${price}. Pouch ${this.state.bloodBags}/${R.carryCapacity}.`);
  }
  consumeBlood(hunger) {
    if (!(this.state.bloodBags > 0)) return this.reject("No stored blood. Visit your Sire, Mara or an owned supply business.");
    if (!(hunger > 0)) return this.reject("You are already satiated.");
    this.state.bloodBags--;
    const result = this.notify(`Blood bag consumed. Hunger -${Math.min(hunger, R.bagRelief)}. ${this.state.bloodBags} bag(s) remain.`);
    return { ...result, relief: R.bagRelief };
  }
  grantAccess(id) {
    const def = contactById(id), person = this.contact(id);
    if (!def || !person?.met || person.suspended || person.debt || this.trust(id) < R.investmentTrust) return this.reject("Hunting access requires trust 15, a settled debt and an intact agreement.");
    const district = this.campaign.territory.district(def.districtId);
    this.campaign.huntingLaw.grantRight({ id: `network:${id}`, districtId: def.districtId, factionId: district.ownerId || def.factionId || "first_estate", source: "vampire_agreement", referenceId: id });
    return this.notify(`${def.name}: You may hunt in ${district.name}. Victims must survive; keep feeding out of public view. Discovery of a breach suspends services.`);
  }
  suspend(id, reason) {
    const person = this.contact(id), def = contactById(id);
    if (!person || person.suspended) return;
    person.suspended = true;
    person.reason = reason;
    person.endorsed = false;
    this.changeTrust(id, -20);
    this.campaign.huntingLaw.revokeRight(`network:${id}`, { source: "agreement_breach" });
    return this.notify(`${def.name}: ${reason} Hunting access and business production are suspended. Pay $${R.repairCost} or complete a delivery to repair the agreement.`);
  }
  restoreAgreement(id) {
    const person = this.contact(id);
    person.suspended = false;
    person.reason = "";
    for (const donor of VAMPIRE_DONORS.filter(value => value.contactId === id)) {
      if (!this.state.donors[donor.id].dead) this.state.donors[donor.id].refused = false;
    }
  }
  repair(id) {
    const donorBreach = VAMPIRE_DONORS.some(def => def.contactId === id && this.state.donors[def.id].refused && !this.state.donors[def.id].dead);
    if (!this.contact(id)?.suspended && !donorBreach) return this.reject("This agreement is already intact.");
    if (!this.charge(R.repairCost, "Repair a broken vampire agreement")) return this.reject("Insufficient cash. Complete a delivery for this contact to repair the agreement instead.");
    this.restoreAgreement(id);
    this.changeTrust(id, 10);
    return this.notify(`${contactById(id).name}: Compensation accepted. Services resume; negotiate your hunting permission again.`);
  }
  reviewHunting() {
    for (const id of [...this.state.pending]) {
      const assessment = this.campaign.huntingLaw.assessment(id);
      if (!assessment || this.state.processed.includes(id)) { this.state.pending = this.state.pending.filter(value => value !== id); continue; }
      if (assessment.currentDiscoveryState !== "known") continue;
      this.state.processed.push(id);
      this.state.processed = this.state.processed.slice(-200);
      this.state.pending = this.state.pending.filter(value => value !== id);
      const def = VAMPIRE_CONTACTS.find(person => person.id !== "sire" && person.districtId === assessment.districtId && this.contact(person.id).met);
      if (def && (assessment.politicalViolation || !assessment.victimAlive || (assessment.evidenceSources || []).includes("direct_witness"))) {
        this.suspend(def.id, `The feeding of ${assessment.victimId} in ${assessment.districtName} was discovered.`);
      }
    }
  }
  donorAvailable(id) {
    const def = donorById(id), donor = this.state.donors[id], contact = this.contact(def?.contactId);
    if (!donor || !contact?.met) return "Meet the donor's patron first.";
    if (donor.dead) return "This donor died. Other donors and suppliers remain available.";
    if (donor.refused || contact.suspended) return "The donor refuses. Repair the agreement with their patron.";
    if (donor.readyAt > this.state.elapsed) return `Recovering for ${Math.ceil(donor.readyAt - this.state.elapsed)}s. Find another source of blood.`;
    if (this.trust(def.contactId) < R.investmentTrust) return "Earn trust 15 with the patron to arrange a voluntary donation.";
    return "";
  }
  donate(id, hunger) {
    const reason = this.donorAvailable(id);
    if (reason) return this.reject(reason);
    if (!(hunger > 0)) return this.reject("You are already satiated.");
    this.state.donors[id].readyAt = this.state.elapsed + R.donorRecovery;
    this.state.donors[id].depth = "quick_bite";
    return { ...this.notify(`${donorById(id).name}: Enough for now. Give me time to recover. Hunger -${Math.min(hunger, R.donorRelief)}.`), relief: R.donorRelief };
  }
  harmDonor(id, { depth = "full_feed", dead = false } = {}) {
    const def = donorById(id), donor = this.state.donors[id];
    if (!def || !donor) return;
    donor.depth = depth;
    donor.dead = donor.dead || dead;
    donor.refused = true;
    donor.readyAt = this.state.elapsed + R.donorRecovery * 2;
    // The donor knows their own assault; no citywide omniscient reputation hit.
    this.notify(`${def.name}: ${dead ? "Your donor is dead." : "You broke the agreement. I will not donate again until this is repaired."}`);
  }
  invest(id) {
    const def = assetById(id), asset = this.state.assets[id], person = this.contact(def?.contactId);
    if (!def || !asset || !person?.met) return this.reject("Meet the operator first.");
    if (person.suspended || person.debt || this.trust(def.contactId) < R.investmentTrust) return this.reject("Investment requires trust 15, an intact agreement and no debt to the operator.");
    if (asset.level >= 2) return this.reject("You already control this business.");
    const price = asset.level ? Math.round(def.price * 0.75) : def.price;
    if (!this.charge(price, `Invest in ${def.name}`)) return this.reject(`Need $${price}. Complete deliveries or let existing businesses produce income.`);
    asset.level++;
    this.changeTrust(def.contactId, 10);
    if (id === "depot") {
      const refuges = this.campaign.state.world.unlockedRefuges;
      if (!refuges.includes("canal_depot_refuge")) refuges.push("canal_depot_refuge");
    }
    this.grantAccess(def.contactId);
    return this.notify(`${def.name}: ${asset.level === 2 ? "You now control the operation. Its staff manage routine supply." : "Investment accepted. Income and blood reserves accumulate while you play."} ${def.description}`);
  }
  withdrawBlood(id) {
    const def = assetById(id), asset = this.state.assets[id];
    if (!def || !asset?.level || this.contact(def.contactId).suspended) return this.reject("This supply operation is unavailable.");
    const amount = Math.min(asset.reserve, R.carryCapacity - this.state.bloodBags);
    if (!amount) return this.reject(asset.reserve ? "Your blood pouch is full." : "No reserves ready. Production advances while you play.");
    asset.reserve -= amount;
    this.state.bloodBags += amount;
    return this.notify(`${def.name}: ${amount} blood bag(s) collected. Your network supplies you now.`);
  }
  setPolicy(id, policy) {
    const def = assetById(id), asset = this.state.assets[id];
    if (!def || asset?.level !== 2 || !["open", "discreet"].includes(policy)) return this.reject("Control the business before setting its policy.");
    if (this.contact(def.contactId).suspended) return this.reject("Repair this agreement before changing policy.");
    asset.policy = policy;
    return this.notify(`${def.name}: ${policy === "open" ? "Sell access to other vampires: 50% more income; blood production falls by one bag per cycle." : "Reserve capacity for your network: normal income and full blood production."}`);
  }
  endorse(id) {
    const person = this.contact(id), def = contactById(id);
    const asset = VAMPIRE_ASSETS.find(value => value.contactId === id);
    if (!asset || this.state.assets[asset.id].level < 2 || !person || person.suspended || person.debt || this.trust(id) < R.endorsementTrust) return this.reject("Support requires a controlled business, trust 40, no debt and an intact agreement.");
    if (person.endorsed) return this.reject("This contact already supports your claim.");
    person.endorsed = true;
    return this.notify(`${def.name}: You control something the city needs, and you keep your word. I support your claim to Prince.`);
  }
  princeRequirements() {
    return [
      { text: "Control all three businesses", met: VAMPIRE_ASSETS.every(def => this.state.assets[def.id].level >= 2) },
      { text: "Secure Vesper, Rook and Mara's support", met: ["vesper", "rook", "mara"].every(id => this.contact(id).endorsed && !this.contact(id).suspended && this.trust(id) >= R.endorsementTrust) },
      { text: "Settle every debt", met: VAMPIRE_CONTACTS.every(def => !this.contact(def.id).debt) },
      { text: `Fund the city compact: $${R.princeCost}`, met: this.wallet.canAfford(R.princeCost) }
    ];
  }
  claimPrince() {
    if (this.state.prince) return this.reject("You are already Prince. Your businesses and agreements remain playable.");
    const missing = this.princeRequirements().filter(value => !value.met);
    if (missing.length) return this.reject(missing.map(value => value.text).join(" · "));
    this.charge(R.princeCost, "Found the city compact");
    this.state.prince = true;
    this.state.claimedAt = this.state.elapsed;
    for (const district of Object.values(this.campaign.territory.snapshot().districts)) {
      this.campaign.huntingLaw.grantRight({ id: `prince:${district.id}`, districtId: district.id, factionId: district.ownerId || "first_estate", source: "prince_compact", referenceId: "player" });
    }
    return this.notify("The city compact is signed. You are Prince of the city. Citywide hunting access is yours; control your businesses' access and blood policies. Witnesses and broken personal agreements still have consequences.");
  }
  tick(seconds) {
    const dt = Math.max(0, Math.min(300, Number(seconds) || 0));
    if (!dt) return;
    const previousSecond = Math.floor(this.state.elapsed);
    this.state.elapsed += dt;
    let income = 0, blood = 0;
    for (const def of VAMPIRE_ASSETS) {
      const asset = this.state.assets[def.id];
      if (!asset.level || this.contact(def.contactId).suspended) continue;
      asset.cycle += dt;
      while (asset.cycle >= R.businessPeriod) {
        asset.cycle -= R.businessPeriod;
        income += Math.round(def.income * asset.level * (asset.policy === "open" ? 1.5 : 1));
        const before = asset.reserve;
        asset.reserve = Math.min(12, asset.reserve + Math.max(0, def.bags + (asset.level - 1) - (asset.policy === "open" ? 1 : 0)));
        blood += asset.reserve - before;
      }
    }
    if (Math.floor(this.state.elapsed) !== previousSecond) this.reviewHunting();
    if (income) {
      this.wallet.credit(income, { source: "vampire_business", reason: "Delegated business income" });
      this.notify(`Your network earned $${income}${blood ? ` and stored ${blood} blood bag(s)` : ""}. Production is handled by your contacts.`);
    }
  }
  snapshot() {
    return { ...JSON.parse(JSON.stringify(this.state)), stage: powerStage(this.state), cash: this.wallet.balance(), requirements: this.princeRequirements(), trust: Object.fromEntries(VAMPIRE_CONTACTS.map(def => [def.id, this.trust(def.id)])) };
  }
}
