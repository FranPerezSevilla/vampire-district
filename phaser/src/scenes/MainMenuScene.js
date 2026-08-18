import { titleScreenController } from "../ui/TitleScreenController.js";

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
  }

  create() {
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.startWorldPreview();
  }

  startWorldPreview() {
    const gameScene = this.scene.get("GameScene");
    if (!gameScene) {
      titleScreenController.showFailure(new Error("The city preview scene is unavailable."));
      return;
    }

    this.previewScene = gameScene;

    // GameScene CREATE is the readiness boundary. It fires after GameScene.create()
    // has constructed the world, GameplayRuntime and InputSystem. Register before
    // launch so a fast hosted boot cannot outrun the title-screen handoff.
    if (this.scene.isActive("GameScene") && gameScene.inputSystem) {
      this.activateWorldPreview(gameScene);
      return;
    }

    const createEvent = Phaser.Scenes?.Events?.CREATE || "create";
    this.previewCreateEvent = createEvent;
    this.previewCreateListener = () => this.activateWorldPreview(gameScene);
    gameScene.events.once(createEvent, this.previewCreateListener);

    if (!this.scene.isActive("GameScene")) this.scene.launch("GameScene");
    this.scene.bringToTop("MainMenuScene");
  }

  activateWorldPreview(gameScene = this.previewScene) {
    if (!this.sys.isActive() || this.previewPresented) return;
    this.detachPreviewCreateListener();

    if (!this.lockPreviewControl(gameScene)) {
      titleScreenController.showFailure(new Error("The city preview input authority is unavailable."));
      return;
    }

    this.previewPresented = true;
    gameScene?.registry?.set?.("mainMenuActive", true);
    this.scene.bringToTop("MainMenuScene");

    // TitleScreenController commits the browser-anchored menu behind the opaque
    // boot cover for two animation frames before beginning the crossfade. No
    // renderer polling or timing heuristic is required here.
    titleScreenController.present({ onNewNight: () => this.beginNight() })
      .catch(error => titleScreenController.showFailure(error));
  }

  detachPreviewCreateListener() {
    if (this.previewScene && this.previewCreateEvent && this.previewCreateListener) {
      this.previewScene.events.off(this.previewCreateEvent, this.previewCreateListener);
    }
    this.previewCreateEvent = null;
    this.previewCreateListener = null;
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

    this.scene.bringToTop("MainMenuScene");
    return true;
  }

  restorePreviewControl() {
    if (!this.previewLocked) return;
    const gameScene = this.previewScene || this.scene.get("GameScene");
    if (gameScene?.input) gameScene.input.enabled = this.previewInputWasEnabled;

    if (this.previewInputSystem) {
      if (this.previewPointerWorldPoint) {
        this.previewInputSystem.pointerWorldPoint = this.previewPointerWorldPoint;
      }
      this.previewInputSystem.setWorldEnabled?.(this.previewWorldInputWasEnabled);
      this.previewInputSystem.resetWorldEdges?.();
    }

    gameScene?.combatSystem?.graphics?.setVisible?.(this.previewCombatGraphicsWasVisible);
    this.previewLocked = false;
  }

  async beginNight() {
    if (this.transitioning) return;
    this.transitioning = true;

    try {
      await titleScreenController.exitToGame();
      this.finishNightTransition();
    } catch (error) {
      this.transitioning = false;
      titleScreenController.showFailure(error);
    }
  }

  finishNightTransition() {
    if (!this.scene.isActive("GameScene")) this.scene.launch("GameScene");
    if (!this.scene.isActive("UIScene")) this.scene.launch("UIScene");

    // Hand control to the exact live scene that has been running behind the DOM title layer.
    // There is deliberately no blackout, camera fade, GameScene stop or GameScene restart.
    this.restorePreviewControl();
    const gameScene = this.previewScene || this.scene.get("GameScene");
    gameScene?.registry?.set?.("mainMenuActive", false);
    this.handoffComplete = true;
    this.scene.stop("MainMenuScene");
  }

  cleanup() {
    this.detachPreviewCreateListener();
    titleScreenController.detachNewNightHandler();
    if (this.handoffComplete) return;
    titleScreenController.resetToBoot();
    this.restorePreviewControl();
  }
}
