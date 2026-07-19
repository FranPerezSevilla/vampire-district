import { LAYERS } from "../data/district.js";

const CLUB_ENTRY = Object.freeze({ x: 642, y: 404 });
const REFUGE = Object.freeze({ x: 150, y: 146 });

function nextFrame() {
  return new Promise(resolve => window.requestAnimationFrame(resolve));
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
  }

  async waitFor(predicate, { timeoutMs = 4_000, label = "condition" } = {}) {
    const started = performance.now();
    while (performance.now() - started < timeoutMs) {
      if (predicate()) return true;
      await nextFrame();
    }
    throw new Error(`RC harness timed out waiting for ${label}`);
  }

  async prepareJournalistObjective() {
    const director = this.scene.tutorialDirector;
    if (!director) throw new Error("TutorialDirector is unavailable");

    // Explicit test-only shortcut: mission progression below still uses public
    // gameplay APIs rather than assigning mission.step directly.
    director.started = true;
    director.introPromise ||= Promise.resolve();
    director.finishTutorial();
    if (this.uiScene.introOpen) this.uiScene.closeIntro();

    while ((this.scene.missionSystem.rooftopJumps || 0) < 3) {
      this.scene.missionSystem.onRooftopJump();
    }
    this.scene.missionSystem.collectPoliceRoofTip();

    await this.waitFor(
      () => this.scene.missionSystem.step === 1 && !this.scene.registry.get("taskRevealActive"),
      { label: "informant objective reveal" }
    );

    this.scene.switchLayer(
      LAYERS.STREET,
      CLUB_ENTRY,
      "RC test: arrived at the nightclub district."
    );
    this.scene.missionSystem.update();

    await this.waitFor(
      () => this.scene.missionSystem.step === 2 && !this.scene.registry.get("taskRevealActive"),
      { label: "journalist objective reveal" }
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
      () => this.scene.missionSystem.step === 3 && !this.scene.registry.get("taskRevealActive"),
      { label: "return-to-refuge objective reveal" }
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

  async startPoliceStress() {
    const director = this.scene.tutorialDirector;
    director.started = true;
    director.introPromise ||= Promise.resolve();
    director.finishTutorial();
    if (this.uiScene.introOpen) this.uiScene.closeIntro();

    const police = this.scene.policeSystem;
    if (!this.originalTriggerArrest) {
      this.originalTriggerArrest = police.triggerArrest.bind(police);
      police.triggerArrest = reason => {
        this.events.push({ type: "stress-arrest-would-trigger", payload: { reason }, at: performance.now() });
      };
    }

    this.scene.switchLayer(
      LAYERS.STREET,
      { x: 488, y: 326 },
      "RC stress: central crossroad."
    );
    this.scene.exposureSystem.forceLevel(3, "RC stress scenario: maximum police response.");
    police.spawnForExposure(3);

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
