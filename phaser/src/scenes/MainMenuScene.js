import { titleScreenController } from "../ui/TitleScreenController.js";
import { titleScreenAudioGate } from "../ui/TitleScreenAudioGate.js";
import { preloadTitleExperience } from "../ui/TitleAssetPreloader.js";

const MENU_CAMERA_HORIZONTAL_BIAS = 0.22;
const MENU_TO_GAME_MS = 430;

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
    this.transitioning = false;
    this.handoffComplete = false;
    this.previewLocked = false;
    this.previewPresented = false;
    this.previewInputWasEnabled = true;
    this.previewWorldInputWasEnabled = true;
    this.previewInputSystem = null;
    this.previewPointerWorldPoint = null;
    this.previewCombatGraphicsWasVisible = true;
    this.previewScene = null;
    this.previewCreateEvent = null;
    this.previewCreateListener = null;
    this.assetsReady = null;
    this.cameraTransitionStartedAt = 0;
    this.cameraTransitionFrom = null;
  }

  create() {
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.publishReadiness("preloading-title-assets");
    this.assetsReady = preloadTitleExperience().catch(error => {
      this.publishReadiness("failure", String(error?.message || error));
      titleScreenController.showFailure(error);
      throw error;
    });
    this.startWorldPreview();
  }

  update() {
    if (!this.previewPresented) return;
    if (this.transitioning) this.updateCameraTransition();
    else this.composeMenuCamera();
  }

  publishReadiness(state, detail = null) {
    window.NBD_MAIN_MENU_READINESS = Object.freeze({
      state,
      detail,
      timestamp: Date.now()
    });
  }

  startWorldPreview() {
    const gameScene = this.scene.get("GameScene");
    if (!gameScene) {
      this.publishReadiness("failure", "GameScene unavailable");
      titleScreenController.showFailure(new Error("The city preview scene is unavailable."));
      return;
    }

    this.previewScene = gameScene;

    if (this.scene.isActive("GameScene") && gameScene.inputSystem) {
      this.publishReadiness("game-scene-already-created");
      this.activateWorldPreview(gameScene);
      return;
    }

    const createEvent = Phaser.Scenes?.Events?.CREATE || "create";
    this.previewCreateEvent = createEvent;
    this.previewCreateListener = () => {
      this.publishReadiness("game-scene-created");
      this.activateWorldPreview(gameScene);
    };
    gameScene.events.once(createEvent, this.previewCreateListener);
    this.publishReadiness("waiting-for-game-scene-create");

    if (!this.scene.isActive("GameScene")) this.scene.launch("GameScene");
    this.scene.bringToTop("MainMenuScene");
  }

  activateWorldPreview(gameScene = this.previewScene) {
    if (!this.sys.isActive() || this.previewPresented) return;
    this.detachPreviewCreateListener();

    if (!this.lockPreviewControl(gameScene)) {
      this.publishReadiness("failure", "InputSystem unavailable after GameScene CREATE");
      titleScreenController.showFailure(new Error("The city preview input authority is unavailable."));
      return;
    }

    this.previewPresented = true;
    // The normal zoom updater is suppressed while the menu owns the camera.
    // Initialize it explicitly before composing or exposing the first preview.
    gameScene.cameras?.main?.setZoom?.(gameScene.cameraZoomForLayer());
    gameScene?.registry?.set?.("mainMenuActive", true);
    this.scene.bringToTop("MainMenuScene");
    this.composeMenuCamera();

    // The world preview and every title/gameplay sample warm in parallel behind
    // the opaque boot surface. Only after both are ready do we offer the browser
    // gesture gate. The gesture starts music and moves directly to the menu.
    this.publishReadiness("waiting-for-title-assets");
    Promise.all([this.assetsReady, this.waitForPreviewGeometry(gameScene)])
      .then(() => {
        if (!this.sys.isActive()) return false;
        this.publishReadiness("awaiting-user-gesture");
        return titleScreenAudioGate.waitForStart();
      })
      .then(started => {
        if (!started || !this.sys.isActive()) return false;
        this.publishReadiness("presenting-title");
        return titleScreenController.present({ onNewNight: () => this.beginNight() }).then(() => true);
      })
      .then(presented => {
        if (presented) this.publishReadiness("title-presented");
      })
      .catch(error => {
        if (!this.sys.isActive()) return;
        this.publishReadiness("failure", String(error?.message || error));
        titleScreenController.showFailure(error);
      });
  }

  async waitForPreviewGeometry(gameScene) {
    const stream = gameScene?.cityStreamSystem;
    if (!stream) return;
    await stream.initialization;
    if (!this.sys.isActive()) return;
    // Chunk activation remains on GameScene's existing lightweight title frame.
    // This promise rejects on a loading error/timeout instead of revealing holes.
    await stream.waitUntilReady();
    if (!this.sys.isActive()) return;
    gameScene.entityStreamSystem?.update?.(0);
    gameScene.redrawLayer?.();
  }

  detachPreviewCreateListener() {
    if (this.previewScene && this.previewCreateEvent && this.previewCreateListener) {
      this.previewScene.events.off(this.previewCreateEvent, this.previewCreateListener);
    }
    this.previewCreateEvent = null;
    this.previewCreateListener = null;
  }

  cameraFrame(gameScene = this.previewScene || this.scene.get("GameScene")) {
    const camera = gameScene?.cameras?.main;
    const player = gameScene?.player;
    if (!camera || !player) return null;
    const zoom = Math.max(0.001, Number(camera.zoom) || 1);
    const viewWidth = camera.width / zoom;
    // Phaser scroll is unzoomed. getScroll handles zoom-aware bounds; using
    // player - worldView.width / 2 here moves the subject off-screen at high quality.
    const centered = camera.getScroll(player.x, player.y);
    const centeredX = centered.x, centeredY = centered.y;
    const canvasRect = gameScene.game?.canvas?.getBoundingClientRect?.();
    const hostRect = globalThis.document?.getElementById?.("game-root")?.getBoundingClientRect?.();
    const visibleFraction = canvasRect?.width > 0 && hostRect?.width > 0 ? Math.min(1, hostRect.width / canvasRect.width) : 1;
    const menu = camera.getScroll(player.x - viewWidth * visibleFraction * MENU_CAMERA_HORIZONTAL_BIAS, player.y);
    const menuX = menu.x;
    return { camera, player, centeredX, centeredY, menuX };
  }

  composeMenuCamera() {
    const frame = this.cameraFrame();
    if (!frame) return;
    frame.camera.stopFollow?.();
    frame.camera.setScroll?.(frame.menuX, frame.centeredY);
  }

  updateCameraTransition() {
    const frame = this.cameraFrame();
    if (!frame || !this.cameraTransitionFrom) return;
    const now = performance.now();
    const t = Math.min(1, Math.max(0, (now - this.cameraTransitionStartedAt) / MENU_TO_GAME_MS));
    const eased = 1 - Math.pow(1 - t, 3);
    frame.camera.stopFollow?.();
    frame.camera.setScroll?.(
      this.cameraTransitionFrom.x + (frame.centeredX - this.cameraTransitionFrom.x) * eased,
      this.cameraTransitionFrom.y + (frame.centeredY - this.cameraTransitionFrom.y) * eased
    );
  }

  lockPreviewControl(gameScene = this.previewScene || this.scene.get("GameScene")) {
    if (this.previewLocked) return true;
    const inputSystem = gameScene?.inputSystem;
    if (!gameScene || !inputSystem) return false;

    this.previewLocked = true;
    if (gameScene.input) {
      this.previewInputWasEnabled = gameScene.input.enabled;
      gameScene.input.enabled = false;
    }

    this.previewInputSystem = inputSystem;
    this.previewWorldInputWasEnabled = inputSystem.worldEnabled;
    this.previewPointerWorldPoint = inputSystem.pointerWorldPoint;
    inputSystem.setWorldEnabled?.(false);
    inputSystem.reset?.();
    inputSystem.pointerWorldPoint = () => inputSystem.playerFallbackPoint();

    const combatGraphics = gameScene.combatSystem?.graphics;
    if (combatGraphics) {
      this.previewCombatGraphicsWasVisible = combatGraphics.visible;
      combatGraphics.setVisible(false);
    }

    gameScene.cameras?.main?.stopFollow?.();
    this.scene.bringToTop("MainMenuScene");
    return true;
  }

  restorePreviewControl() {
    if (!this.previewLocked) return;
    const gameScene = this.previewScene || this.scene.get("GameScene");
    if (gameScene?.input) gameScene.input.enabled = this.previewInputWasEnabled;

    if (this.previewInputSystem) {
      if (this.previewPointerWorldPoint) this.previewInputSystem.pointerWorldPoint = this.previewPointerWorldPoint;
      this.previewInputSystem.setWorldEnabled?.(this.previewWorldInputWasEnabled);
      this.previewInputSystem.resetWorldEdges?.();
    }

    gameScene?.combatSystem?.graphics?.setVisible?.(this.previewCombatGraphicsWasVisible);
    gameScene?.cameras?.main?.startFollow?.(gameScene.player, true, 0.12, 0.12);
    this.previewLocked = false;
  }

  async beginNight() {
    if (this.transitioning) return;
    this.transitioning = true;
    const frame = this.cameraFrame();
    this.cameraTransitionFrom = frame ? { x: frame.camera.scrollX, y: frame.camera.scrollY } : null;
    this.cameraTransitionStartedAt = performance.now();
    titleScreenAudioGate.fadeOut(MENU_TO_GAME_MS);

    try {
      await titleScreenController.exitToGame();
      const finalFrame = this.cameraFrame();
      finalFrame?.camera?.setScroll?.(finalFrame.centeredX, finalFrame.centeredY);
      this.finishNightTransition();
    } catch (error) {
      this.transitioning = false;
      titleScreenController.showFailure(error);
    }
  }

  finishNightTransition() {
    if (!this.scene.isActive("GameScene")) this.scene.launch("GameScene");
    if (!this.scene.isActive("UIScene")) this.scene.launch("UIScene");

    this.restorePreviewControl();
    const gameScene = this.previewScene || this.scene.get("GameScene");
    gameScene?.registry?.set?.("mainMenuActive", false);
    this.handoffComplete = true;
    this.scene.stop("MainMenuScene");
  }

  cleanup() {
    this.detachPreviewCreateListener();
    titleScreenAudioGate.dispose();
    titleScreenController.detachNewNightHandler();
    if (this.handoffComplete) return;
    titleScreenController.resetToBoot();
    this.restorePreviewControl();
  }
}
