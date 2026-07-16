import { CAMERA, WORLD } from "./data/balance.js";
import { LAYERS } from "./data/district.js";
import { GameScene } from "./scenes/GameScene.js";

const REVEAL_HOLD_MS = 4500;
const ZOOM_IN_MS = 760;
const ZOOM_OUT_MS = 2200;
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

function finalCameraScroll(camera, player, zoom) {
  const viewWidth = camera.width / zoom;
  const viewHeight = camera.height / zoom;

  const scrollX = viewWidth >= WORLD.width
    ? (WORLD.width - viewWidth) / 2
    : Phaser.Math.Clamp(player.x - viewWidth / 2, 0, WORLD.width - viewWidth);

  const scrollY = viewHeight >= WORLD.height
    ? (WORLD.height - viewHeight) / 2
    : Phaser.Math.Clamp(player.y - viewHeight / 2, 0, WORLD.height - viewHeight);

  return { x: scrollX, y: scrollY };
}

function smoothStep(value) {
  const t = Phaser.Math.Clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function keepPlayerInsideView(center, player, camera, zoom) {
  const halfWidth = camera.width / zoom / 2;
  const halfHeight = camera.height / zoom / 2;

  // The player always keeps a generous safety margin while the camera opens up.
  const marginX = Math.min(halfWidth * 0.34, Math.max(12, halfWidth - 12));
  const marginY = Math.min(halfHeight * 0.34, Math.max(12, halfHeight - 12));
  const horizontalRoom = Math.max(8, halfWidth - marginX);
  const verticalRoom = Math.max(8, halfHeight - marginY);

  return {
    x: Phaser.Math.Clamp(center.x, player.x - horizontalRoom, player.x + horizontalRoom),
    y: Phaser.Math.Clamp(center.y, player.y - verticalRoom, player.y + verticalRoom)
  };
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
            const targetScroll = finalCameraScroll(camera, this.player, targetZoom);
            const targetCenter = {
              x: targetScroll.x + camera.width / targetZoom / 2,
              y: targetScroll.y + camera.height / targetZoom / 2
            };
            const zoomAtStart = camera.zoom;
            const focusAtStart = { x: this.player.x, y: this.player.y };

            // Tween a neutral progress value instead of scrollX/scrollY directly.
            // This keeps the character visible throughout the whole zoom-out and
            // only eases toward the final legal camera framing near the end.
            this.tweens.addCounter({
              from: 0,
              to: 1,
              duration: ZOOM_OUT_MS,
              ease: "Sine.easeInOut",
              onUpdate: tween => {
                const progress = tween.getValue();
                const zoom = Phaser.Math.Linear(zoomAtStart, targetZoom, progress);
                camera.setZoom(zoom);

                const framingProgress = smoothStep((progress - 0.68) / 0.32);
                const desiredCenter = {
                  x: Phaser.Math.Linear(focusAtStart.x, targetCenter.x, framingProgress),
                  y: Phaser.Math.Linear(focusAtStart.y, targetCenter.y, framingProgress)
                };
                const safeCenter = keepPlayerInsideView(desiredCenter, this.player, camera, zoom);
                camera.centerOn(safeCenter.x, safeCenter.y);
              },
              onComplete: () => {
                // At this point the camera is already at exactly the normal view,
                // so restoring bounds and follow does not create a second jump.
                camera.setZoom(targetZoom);
                camera.setBounds(0, 0, WORLD.width, WORLD.height);
                camera.setScroll(targetScroll.x, targetScroll.y);
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
