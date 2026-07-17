import "./tutorial-copy.js";
import { CAMERA, WORLD } from "./data/balance.js";
import { LAYERS } from "./data/district.js";
import { GameScene } from "./scenes/GameScene.js";

const REVEAL_HOLD_MS = 4500;
const ZOOM_IN_MS = 760;
const ZOOM_OUT_MS = 2400;
const BUBBLE_TO_ZOOM_GAP_MS = 260;

function renderScale() {
  return window.NBD_RESOLUTION_PRESET?.renderScale || 1;
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

function setRevealUi(payload, open) {
  const overlay = document.getElementById("task-reveal");
  if (!overlay) return;

  const step = overlay.querySelector("#task-reveal-step");
  const text = overlay.querySelector("#task-reveal-text");

  if (payload) {
    if (step) step.textContent = payload.step || "NEW TASK";
    if (text) text.textContent = payload.text || "";
  }

  if (open) {
    window.requestAnimationFrame(() => overlay.classList.add("open"));
  } else {
    overlay.classList.remove("open");
  }
}

function installCalmTaskRevealCamera() {
  const current = GameScene.prototype.playTaskReveal;
  if (!current) {
    window.requestAnimationFrame(installCalmTaskRevealCamera);
    return;
  }
  if (current.__nbdCalmZoomOutPatch) return;

  function playTaskRevealWithCalmReturn(payload) {
    if (!payload || this.missionSystem?.failed || this.missionSystem?.completed) return;

    this.taskRevealCinematic ||= {
      active: false,
      queued: null,
      initialPlayed: false
    };

    if (this.taskRevealCinematic.active) {
      this.taskRevealCinematic.queued = payload;
      return;
    }

    const cinematic = this.taskRevealCinematic;
    const camera = this.cameras.main;
    const startingZoom = normalZoomFor(this);
    const closeZoom = Math.min(startingZoom * 3.15, 8.75);

    cinematic.active = true;
    cinematic.queued = null;
    this.registry.set("taskRevealActive", true);
    this.nearestInteraction = null;
    this.interactionSystem?.close?.();
    this.input.keyboard?.resetKeys?.();

    setRevealUi(payload, false);
    document.getElementById("game-ui")?.classList.add("task-cinematic");

    this.tweens.killTweensOf(camera);
    camera.stopFollow();
    camera.setBounds(-WORLD.width, -WORLD.height, WORLD.width * 3, WORLD.height * 3);
    camera.centerOn(this.player.x, this.player.y);
    camera.setZoom(startingZoom);

    this.tweens.add({
      targets: camera,
      zoom: closeZoom,
      duration: ZOOM_IN_MS,
      ease: "Cubic.easeOut",
      onUpdate: () => camera.centerOn(this.player.x, this.player.y),
      onComplete: () => {
        setRevealUi(payload, true);

        this.time.delayedCall(REVEAL_HOLD_MS, () => {
          setRevealUi(payload, false);

          this.time.delayedCall(BUBBLE_TO_ZOOM_GAP_MS, () => {
            const targetZoom = normalZoomFor(this);
            const zoomAtStart = camera.zoom;

            // Restore the real world bounds before opening the camera. As the
            // viewport grows, Phaser clamps the camera progressively instead of
            // snapping it into the rooftop framing at the very end.
            camera.setBounds(0, 0, WORLD.width, WORLD.height);

            this.tweens.addCounter({
              from: 0,
              to: 1,
              duration: ZOOM_OUT_MS,
              ease: "Sine.easeInOut",
              onUpdate: tween => {
                const progress = tween.getValue();
                const zoom = Phaser.Math.Linear(zoomAtStart, targetZoom, progress);
                camera.setZoom(zoom);

                // Keep the character as the camera focus for the whole zoom-out.
                // The active bounds perform any required rooftop/world framing
                // gradually while guaranteeing the player remains on screen.
                camera.centerOn(this.player.x, this.player.y);
              },
              onComplete: () => {
                camera.setZoom(targetZoom);
                camera.centerOn(this.player.x, this.player.y);
                camera.startFollow(this.player, true, 0.12, 0.12);

                cinematic.active = false;
                this.registry.set("taskRevealActive", false);
                document.getElementById("game-ui")?.classList.remove("task-cinematic");
                this.input.keyboard?.resetKeys?.();

                const queued = cinematic.queued;
                cinematic.queued = null;
                if (queued) this.time.delayedCall(220, () => this.playTaskReveal(queued));
              }
            });
          });
        });
      }
    });
  }

  playTaskRevealWithCalmReturn.__nbdCalmZoomOutPatch = true;
  GameScene.prototype.playTaskReveal = playTaskRevealWithCalmReturn;
}

installCalmTaskRevealCamera();
