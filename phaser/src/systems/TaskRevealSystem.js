import { CAMERA, WORLD } from "../data/balance.js";
import { LAYERS } from "../data/district.js";

const TASK_REVEALS = Object.freeze({
  1: Object.freeze({ step: "TASK 2 / 4", text: "The journalist is near the nightclub. Reach the club district." }),
  2: Object.freeze({ step: "TASK 3 / 4", text: "Find and neutralize the journalist without breaking the veil." }),
  3: Object.freeze({ step: "TASK 4 / 4", text: "Return to the rooftop refuge and report to your sire." })
});

const ZOOM_IN_MS = 760;
const HOLD_MS = 4_500;
const ZOOM_OUT_MS = 2_400;
const BUBBLE_TO_ZOOM_GAP_MS = 260;

function renderScale() {
  return typeof window !== "undefined"
    ? window.NBD_RESOLUTION_PRESET?.renderScale || 1
    : 1;
}

function normalZoomFor(scene) {
  const baseZoom = scene.currentLayer === LAYERS.ROOF_HIGH
    ? CAMERA.roofHighZoom
    : scene.currentLayer === LAYERS.ROOF_LOW
      ? CAMERA.roofLowZoom
      : scene.currentLayer === LAYERS.SEWER
        ? CAMERA.sewerZoom
        : CAMERA.streetZoom;
  return baseZoom * renderScale();
}

function ensureUi() {
  if (typeof document === "undefined") return null;
  if (!document.getElementById("nbd-task-reveal-style")) {
    const style = document.createElement("style");
    style.id = "nbd-task-reveal-style";
    style.textContent = `
      .task-reveal {
        position: absolute;
        left: 50%;
        top: 31%;
        width: min(520px, calc(100% - 48px));
        padding: 17px 20px 18px;
        border: 1px solid rgba(255, 242, 168, .92);
        border-radius: 18px;
        background: linear-gradient(145deg, rgba(17, 15, 24, .98), rgba(7, 8, 14, .97));
        box-shadow: 0 22px 80px rgba(0, 0, 0, .72), inset 0 0 0 1px rgba(255,255,255,.045);
        color: #f8f1ff;
        opacity: 0;
        transform: translate(-50%, -24px) scale(.82);
        transform-origin: 50% 100%;
        transition: opacity .22s ease, transform .38s cubic-bezier(.2,.9,.2,1.15);
        pointer-events: none;
        z-index: 80;
        text-align: left;
      }
      .task-reveal.open { opacity: 1; transform: translate(-50%, 0) scale(1); }
      .task-reveal__header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; color: #ffb02e; font-size: 12px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
      .task-reveal__step { padding: 4px 7px; border: 1px solid rgba(255, 176, 46, .55); border-radius: 999px; background: rgba(255, 176, 46, .09); white-space: nowrap; }
      .task-reveal__text { font-size: clamp(18px, 1.8vw, 26px); line-height: 1.24; font-weight: 780; letter-spacing: -.015em; text-wrap: balance; }
      .game-ui.task-cinematic > :not(.task-reveal):not(.ui-modal) { opacity: .16; filter: saturate(.65); transition: opacity .25s ease, filter .25s ease; }
      .game-ui.task-cinematic .hud-button, .game-ui.task-cinematic button { pointer-events: none !important; }
      @media (max-width: 720px) {
        .task-reveal { top: 27%; width: calc(100% - 30px); padding: 14px 16px 16px; }
        .task-reveal__text { font-size: 17px; }
      }
      @media (prefers-reduced-motion: reduce) { .task-reveal { transition: none !important; } }
    `;
    document.head.appendChild(style);
  }

  const host = document.getElementById("game-ui") || document.querySelector(".game-frame");
  if (!host) return null;
  let root = document.getElementById("task-reveal");
  if (!root) {
    root = document.createElement("div");
    root.id = "task-reveal";
    root.className = "task-reveal";
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");
    root.innerHTML = `
      <div class="task-reveal__header">
        <span class="task-reveal__step">TASK</span>
        <span>New objective</span>
      </div>
      <div class="task-reveal__text"></div>
    `;
    host.appendChild(root);
  }
  return {
    root,
    step: root.querySelector(".task-reveal__step"),
    text: root.querySelector(".task-reveal__text")
  };
}

export class TaskRevealSystem {
  constructor(scene) {
    this.scene = scene;
    this.ui = ensureUi();
    this.active = false;
    this.queued = null;
    this.waiting = null;
    this.pollTimer = null;
    this.onMissionStep = payload => this.handleMissionStep(payload);
    scene.events?.on?.("mission:step-changed", this.onMissionStep);
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.taskRevealSystem = this;
    scene.playTaskReveal = payload => this.play(payload);
  }

  handleMissionStep(payload = {}) {
    const reveal = TASK_REVEALS[payload.step];
    if (!reveal) return;
    this.waitUntilPlayable(reveal);
  }

  waitUntilPlayable(payload) {
    this.waiting = payload;
    if (this.pollTimer) return;
    const poll = () => {
      this.pollTimer = null;
      if (!this.waiting || this.scene.missionSystem?.failed || this.scene.missionSystem?.completed) {
        this.waiting = null;
        return;
      }
      const director = this.scene.tutorialDirector;
      const tutorialReady = !director || director.state === "complete";
      const uiPaused = Boolean(this.scene.registry?.get?.("uiPaused"));
      if (!tutorialReady || uiPaused || director?.busy) {
        this.pollTimer = this.scene.time.delayedCall(180, poll);
        return;
      }
      const reveal = this.waiting;
      this.waiting = null;
      this.play(reveal);
    };
    this.pollTimer = this.scene.time.delayedCall(120, poll);
  }

  play(payload) {
    if (!payload || this.scene.missionSystem?.failed || this.scene.missionSystem?.completed) return false;
    if (this.active) {
      this.queued = payload;
      return false;
    }

    const camera = this.scene.cameras.main;
    const startingZoom = normalZoomFor(this.scene);
    const closeZoom = Math.min(startingZoom * 3.15, 8.75);
    this.active = true;
    this.queued = null;
    this.scene.taskRevealCinematic.active = true;
    this.scene.registry.set("taskRevealActive", true);
    this.scene.nearestInteraction = null;
    this.scene.nearestMovement = null;
    this.scene.interactionSystem?.close?.("Objective updated.");
    this.scene.inputSystem?.resetWorldEdges?.();
    this.setUi(payload, false);
    document.getElementById("game-ui")?.classList.add("task-cinematic");

    this.scene.tweens.killTweensOf(camera);
    camera.stopFollow();
    camera.setBounds(-WORLD.width, -WORLD.height, WORLD.width * 3, WORLD.height * 3);
    camera.centerOn(this.scene.player.x, this.scene.player.y);
    camera.setZoom(startingZoom);

    this.scene.tweens.add({
      targets: camera,
      zoom: closeZoom,
      duration: ZOOM_IN_MS,
      ease: "Cubic.easeOut",
      onUpdate: () => camera.centerOn(this.scene.player.x, this.scene.player.y),
      onComplete: () => {
        this.setUi(payload, true);
        this.scene.time.delayedCall(HOLD_MS, () => {
          this.setUi(payload, false);
          this.scene.time.delayedCall(BUBBLE_TO_ZOOM_GAP_MS, () => this.zoomOut(camera));
        });
      }
    });
    return true;
  }

  zoomOut(camera) {
    const targetZoom = normalZoomFor(this.scene);
    const zoomAtStart = camera.zoom;
    camera.setBounds(0, 0, WORLD.width, WORLD.height);

    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: ZOOM_OUT_MS,
      ease: "Sine.easeInOut",
      onUpdate: tween => {
        const progress = tween.getValue();
        camera.setZoom(Phaser.Math.Linear(zoomAtStart, targetZoom, progress));
        camera.centerOn(this.scene.player.x, this.scene.player.y);
      },
      onComplete: () => {
        camera.setZoom(targetZoom);
        camera.centerOn(this.scene.player.x, this.scene.player.y);
        camera.startFollow(this.scene.player, true, 0.12, 0.12);
        this.active = false;
        this.scene.taskRevealCinematic.active = false;
        this.scene.registry.set("taskRevealActive", false);
        document.getElementById("game-ui")?.classList.remove("task-cinematic");
        this.scene.inputSystem?.resetWorldEdges?.();

        const queued = this.queued;
        this.queued = null;
        if (queued) this.scene.time.delayedCall(220, () => this.play(queued));
      }
    });
  }

  setUi(payload, open) {
    if (!this.ui?.root) return;
    if (payload) {
      if (this.ui.step) this.ui.step.textContent = payload.step || "NEW TASK";
      if (this.ui.text) this.ui.text.textContent = payload.text || "";
    }
    this.ui.root.classList.toggle("open", Boolean(open));
  }

  destroy() {
    this.scene.events?.off?.("mission:step-changed", this.onMissionStep);
    this.pollTimer?.remove?.(false);
    this.ui?.root?.remove?.();
  }
}
