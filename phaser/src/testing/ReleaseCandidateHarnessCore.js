import { COMBAT_STATES } from "../data/combat.js";
import { CITY_ANCHORS, LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";

const CLUB_ENTRY = Object.freeze({ x: 642, y: 404 });
const REFUGE = Object.freeze({ x: 150, y: 146 });
const REVEAL_TIMEOUT_MS = 15_000;

function nextFrame() {
  return new Promise(resolve => window.setTimeout(resolve, 16));
}

export class ReleaseCandidateHarness {
  constructor(gameScene, uiScene) {
    this.scene = gameScene;
    this.uiScene = uiScene;
    this.events = [];
    this.startedAt = performance.now();
    this.originalTriggerArrest = null;

    gameScene.events?.on?.("mission:return-finale-started", payload => {
      this.events.push({ type: "return-finale-started", payload, at: performance.now() });
    });
    gameScene.events?.on?.("mission:return-finale-completed", payload => {
      this.events.push({ type: "return-finale-completed", payload, at: performance.now() });
    });
    gameScene.events?.on?.("mission:step-changed", payload => {
      this.events.push({ type: "mission-step-changed", payload, at: performance.now() });
    });
    gameScene.events?.on?.("police:violence-escalated", payload => {
      this.events.push({ type: "police-violence-escalated", payload, at: performance.now() });
    });
    gameScene.events?.on?.("combat:entity-recovered", payload => {
      this.events.push({ type: "entity-recovered", payload, at: performance.now() });
    });
  }

  async waitFor(predicate, { timeoutMs = 4_000, label = "condition" } = {}) {
    const started = performance.now();
    while (performance.now() - started < timeoutMs) {
      if (predicate()) return true;
      await nextFrame();
    }
    throw new Error(`RC harness timed out waiting for ${label}`);
  }

  taskRevealIdle() {
    const system = this.scene.taskRevealSystem;
    return Boolean(
      !this.scene.registry.get("taskRevealActive")
      && !system?.active
      && !system?.waiting
      && !system?.queued
      && !system?.pollTimer
    );
  }

  unlockPostTutorialWorld() {
    const director = this.scene.tutorialDirector;
    if (!director) throw new Error("TutorialDirector is unavailable");
    director.started = true;
    director.introPromise ||= Promise.resolve();
    director.finishTutorial();
    if (this.uiScene.introOpen) this.uiScene.closeIntro();
    return director;
  }

  async focusStreet(point, label) {
    this.scene.switchLayer(LAYERS.STREET, point, label);
    await window.NBD_CITY_STREAM?.forceFocus?.(point.x, point.y, 512, 0);
    this.scene.entityStreamSystem?.resync?.();
    this.scene.npcSystem?.rebuildSpatialIndex?.();
    return point;
  }

  preparePoliceOfficers(count = 2, point = CITY_ANCHORS.policeEntrance) {
    const police = this.scene.policeSystem;
    const allPolice = () => police.allPolice?.() || police.police();
    while (allPolice().length < count) police.spawnPolice?.(0);
    const offsets = [
      { x: -18, y: 0 },
      { x: 18, y: 0 },
      { x: 0, y: -22 },
      { x: 0, y: 22 },
      { x: -30, y: -20 },
      { x: 30, y: 20 },
      { x: -30, y: 20 },
      { x: 30, y: -20 }
    ];
    const officers = allPolice().slice(0, count);
    officers.forEach((officer, index) => {
      const offset = offsets[index % offsets.length];
      officer.x = point.x + offset.x;
      officer.y = point.y + offset.y;
      officer.layer = LAYERS.STREET;
      officer.dead = false;
      officer.inactive = false;
      officer.intercepted = false;
      officer.hiddenBody = false;
      officer.stunnedTimer = 0;
      officer.active = true;
      officer.container?.setPosition?.(officer.x, officer.y);
      officer.container?.setAlpha?.(1);
      officer.container?.setVisible?.(true);
      this.scene.entityStreamSystem?.applyNpcState?.(officer, 0);
    });
    this.scene.entityStreamSystem?.resync?.();
    this.scene.npcSystem?.rebuildSpatialIndex?.();
    return officers;
  }

  async prepareJournalistObjective() {
    this.unlockPostTutorialWorld();

    // Mission progression uses public gameplay APIs rather than assigning
    // mission.step directly.
    while ((this.scene.missionSystem.rooftopJumps || 0) < 3) {
      this.scene.missionSystem.onRooftopJump();
    }
    this.scene.missionSystem.collectPoliceRoofTip();

    await this.waitFor(
      () => this.scene.missionSystem.step === 1 && this.taskRevealIdle(),
      { timeoutMs: REVEAL_TIMEOUT_MS, label: "informant objective reveal" }
    );

    this.scene.switchLayer(
      LAYERS.STREET,
      CLUB_ENTRY,
      "RC test: arrived at the nightclub district."
    );
    this.scene.missionSystem.update();

    await this.waitFor(
      () => this.scene.missionSystem.step === 2 && this.taskRevealIdle(),
      { timeoutMs: REVEAL_TIMEOUT_MS, label: "journalist objective reveal" }
    );
    return this.snapshot();
  }

  async neutralizeJournalist(kind = "killed") {
    const journalist = this.scene.npcSystem?.npcs?.find(npc => npc.id === "journalist");
    if (!journalist) throw new Error("Journalist NPC is unavailable");
    if (this.scene.missionSystem.step !== 2) throw new Error("Journalist objective is not active");

    this.scene.switchLayer(
      journalist.layer,
      { x: journalist.x, y: journalist.y + 12 },
      `RC test: approaching journalist for ${kind} outcome.`
    );

    if (kind === "drained") {
      const started = this.scene.feedingSystem.startDrain(journalist, {
        source: "rc-test",
        eligibility: "downed"
      });
      if (!started) throw new Error("Unable to start journalist drain");
      this.scene.feedingSystem.completeDrain();
    } else if (kind === "killed") {
      this.scene.feedingSystem.kill(journalist);
    } else {
      throw new Error(`Unsupported journalist outcome ${kind}`);
    }

    await this.waitFor(
      () => this.scene.missionSystem.step === 3 && this.taskRevealIdle(),
      { timeoutMs: REVEAL_TIMEOUT_MS, label: "return-to-refuge objective reveal" }
    );
    return this.snapshot();
  }

  returnToRefuge() {
    if (this.scene.missionSystem.step !== 3) throw new Error("Return objective is not active");
    this.scene.switchLayer(
      LAYERS.ROOF_HIGH,
      REFUGE,
      "RC test: returned to the rooftop refuge."
    );
    this.scene.missionSystem.update();
    return this.snapshot();
  }

  async policeEscalationSequence() {
    this.unlockPostTutorialWorld();
    await this.focusStreet(
      CITY_ANCHORS.policeEntrance,
      "RC test: police escalation sequence."
    );

    const police = this.scene.policeSystem;
    const originalTriggerArrest = police.triggerArrest.bind(police);
    police.triggerArrest = reason => {
      this.events.push({ type: "escalation-arrest-would-trigger", payload: { reason }, at: performance.now() });
    };

    try {
      const officers = this.preparePoliceOfficers(2, CITY_ANCHORS.policeEntrance);
      if (officers.length < 2) throw new Error("At least two police officers are required");
      const [first, second] = officers;
      const levels = [];

      this.scene.events.emit("combat:hit", {
        targetId: first.id,
        weaponId: "unarmed",
        downed: false
      });
      levels.push(this.scene.exposureSystem.level());

      this.scene.events.emit("combat:hit", {
        targetId: first.id,
        weaponId: "unarmed",
        downed: true
      });
      levels.push(this.scene.exposureSystem.level());

      this.scene.events.emit("combat:hit", {
        targetId: second.id,
        weaponId: "pipe",
        downed: true
      });
      levels.push(this.scene.exposureSystem.level());

      this.scene.events.emit("combat:entity-neutralized", {
        targetId: first.id,
        weaponId: "drain",
        kind: "drained"
      });
      const duplicateLevel = this.scene.exposureSystem.level();

      await this.waitFor(
        () => police.helicopter.active,
        { timeoutMs: 4_000, label: "helicopter after level-three escalation" }
      );

      return {
        levels,
        duplicateLevel,
        helicopter: Boolean(police.helicopter.active),
        escalations: this.events
          .filter(event => event.type === "police-violence-escalated")
          .map(event => event.payload)
      };
    } finally {
      police.triggerArrest = originalTriggerArrest;
    }
  }

  async policeRecoverySequence() {
    this.unlockPostTutorialWorld();
    await this.focusStreet(
      CITY_ANCHORS.policeEntrance,
      "RC test: police recovery sequence."
    );

    const officer = this.preparePoliceOfficers(1, CITY_ANCHORS.policeEntrance)[0];
    this.scene.combatSystem.ensureCombatStates();
    if (!officer) throw new Error("A police officer is required for recovery testing");
    const recoveryEventsBefore = this.events.filter(event => event.type === "entity-recovered").length;

    this.scene.combatSystem.knockDown(officer, {
      id: "rc-recovery",
      name: "RC Recovery Hit",
      staggerMs: 100,
      witnessSeverity: 0
    });

    await this.waitFor(
      () => officer.combat?.state === COMBAT_STATES.DOWNED
        && Number.isFinite(officer.ai?.recoverAt)
        && officer.ai.recoverAt > 0,
      { label: "police recovery timer" }
    );
    const scheduledDelayMs = Math.max(0, officer.ai.recoverAt - this.scene.time.now);

    await this.waitFor(
      () => officer.combat?.state === COMBAT_STATES.STAGGERED
        && officer.combat?.resilience === 2,
      { timeoutMs: 3_000, label: "police recovery" }
    );

    const recoveryEvents = this.events.filter(event => event.type === "entity-recovered");
    return {
      officerId: officer.id,
      scheduledDelayMs,
      state: officer.combat.state,
      resilience: officer.combat.resilience,
      maxResilience: officer.combat.maxResilience,
      recoveredEventsAdded: recoveryEvents.length - recoveryEventsBefore,
      lastRecovery: recoveryEvents.at(-1)?.payload || null
    };
  }

  perceptionSplitSequence() {
    this.unlockPostTutorialWorld();
    const source = { x: 500, y: 320, layer: LAYERS.STREET };
    this.scene.switchLayer(LAYERS.STREET, source, "RC test: sight and hearing split.");

    const civilians = this.scene.npcSystem.npcs.filter(npc => (
      npc.type === NPC_TYPES.CIVILIAN
      && !npc.dead
      && !npc.inactive
      && !npc.hiddenBody
      && !npc.intercepted
    ));
    if (civilians.length < 2) throw new Error("Two civilians are required for perception testing");
    const [viewer, listener] = civilians;

    const prepare = npc => {
      npc.layer = LAYERS.STREET;
      npc.dead = false;
      npc.inactive = false;
      npc.intercepted = false;
      npc.hiddenBody = false;
      npc.alarmed = false;
      npc.hasReported = false;
      npc.reportTarget = null;
      npc.reportSeverity = 0;
      npc.witnessReason = "";
      npc.witnessSource = null;
      npc.masqueradeRisk = false;
      npc.reactionTimer = 0;
      npc.soundReactionTimer = 0;
      npc.chasingPlayer = false;
      npc.enemyAttack = null;
      npc.stunnedTimer = 0;
      if (npc.combat) npc.combat.state = COMBAT_STATES.ACTIVE;
    };
    prepare(viewer);
    prepare(listener);

    viewer.x = 450;
    viewer.y = 320;
    viewer.dirX = 1;
    viewer.dirY = 0;
    listener.x = 500;
    listener.y = 410;
    listener.dirX = 1;
    listener.dirY = 0;
    viewer.container?.setPosition?.(viewer.x, viewer.y);
    listener.container?.setPosition?.(listener.x, listener.y);
    this.scene.npcSystem.rebuildSpatialIndex?.();

    const summary = this.scene.sensoryAwarenessSystem.emit("roofDrop", source);
    return {
      summary,
      viewer: {
        id: viewer.id,
        alarmed: Boolean(viewer.alarmed),
        reportTarget: viewer.reportTarget?.id || null,
        soundReactionTimer: viewer.soundReactionTimer || 0,
        chasingPlayer: Boolean(viewer.chasingPlayer)
      },
      listener: {
        id: listener.id,
        alarmed: Boolean(listener.alarmed),
        reportTarget: listener.reportTarget?.id || null,
        soundReactionTimer: listener.soundReactionTimer || 0,
        chasingPlayer: Boolean(listener.chasingPlayer),
        wtfVisible: Boolean(listener.__nbdWtfLabel?.visible)
      }
    };
  }

  async startPoliceStress() {
    this.unlockPostTutorialWorld();

    const police = this.scene.policeSystem;
    if (!this.originalTriggerArrest) {
      this.originalTriggerArrest = police.triggerArrest.bind(police);
      police.triggerArrest = reason => {
        this.events.push({ type: "stress-arrest-would-trigger", payload: { reason }, at: performance.now() });
      };
    }

    await this.focusStreet(
      CITY_ANCHORS.policeEntrance,
      "RC stress: central police response zone."
    );
    this.scene.exposureSystem.forceLevel(3, "RC stress scenario: maximum police response.");
    police.spawnForExposure(3);
    this.preparePoliceOfficers(6, CITY_ANCHORS.policeEntrance);

    await this.waitFor(
      () => this.scene.exposureSystem.level() >= 3
        && police.police().length >= 6
        && police.helicopter.active,
      { timeoutMs: 5_000, label: "level-three police response" }
    );
    return this.stressSnapshot();
  }

  stopPoliceStress() {
    if (this.originalTriggerArrest) {
      this.scene.policeSystem.triggerArrest = this.originalTriggerArrest;
      this.originalTriggerArrest = null;
    }
  }

  stressSnapshot() {
    const diagnostics = window.NBD_RUNTIME_DIAGNOSTICS?.snapshot?.() || null;
    return {
      level: this.scene.exposureSystem.level(),
      police: this.scene.policeSystem.police().length,
      helicopter: Boolean(this.scene.policeSystem.helicopter.active),
      missionFailed: Boolean(this.scene.missionSystem.failed),
      domNodes: document.querySelectorAll("*").length,
      dialogueNodes: document.querySelectorAll("#tutorial-dialogue").length,
      taskRevealNodes: document.querySelectorAll("#task-reveal").length,
      weaponHudNodes: document.querySelectorAll(".weapon-hud").length,
      arrestAttempts: this.events.filter(event => event.type === "stress-arrest-would-trigger").length,
      diagnostics
    };
  }

  snapshot() {
    return {
      rcTestMode: Boolean(window.NBD_RC_TEST_MODE),
      missionStep: this.scene.missionSystem.step,
      completed: this.scene.missionSystem.completed,
      failed: this.scene.missionSystem.failed,
      returnFinalePending: this.scene.missionSystem.returnFinalePending,
      result: this.scene.registry.get("missionResult") || null,
      dialogueOpen: Boolean(document.querySelector("#tutorial-dialogue.open")),
      dialogueText: document.querySelector(".tutorial-dialogue__text")?.textContent || "",
      directorState: this.scene.tutorialDirector?.state || null,
      directorBusy: Boolean(this.scene.tutorialDirector?.busy),
      taskRevealActive: Boolean(this.scene.registry.get("taskRevealActive")),
      inputEdges: {
        primaryPressed: Boolean(this.scene.inputSystem?.primaryPressed),
        drainPressed: Boolean(this.scene.inputSystem?.drainPressed),
        wheelStep: Number(this.scene.inputSystem?.pendingWheelStep || 0)
      },
      events: [...this.events]
    };
  }
}
