import { titleScreenController } from "../ui/TitleScreenController.js";

const PREVIEW_READY_RETRY_MS = 16;
const PREVIEW_READY_MAX_ATTEMPTS = 180;
const READY_RENDER_FRAMES = 2;

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
    this.transitioning = false;
    this.handoffComplete = false;
    this.previewLocked = false;
    this.previewInputWasEnabled = true;
    this.previewWorldInputWasEnabled = true;
    this.previewInputSystem = null;
    this.previewPointerWorldPoint = null;
    this.previewCombatGraphicsWasVisible = true;
    this.readyRenderEvent = null;
    this.readyRenderListener = null;
  }

  create() {
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.startWorldPreview();
    this.waitForPreviewAuthority();
  }

  startWorldPreview() {
    if (!this.scene.isActive("GameScene")) this.scene.launch("GameScene");
    this.scene.bringToTop("MainMenuScene");
  }

  waitForPreviewAuthority(attempt = 0) {
    if (!this.sys.isActive()) return;

    if (this.lockPreviewControl()) {
      const gameScene = this.scene.get("GameScene");
      gameScene?.registry?.set?.("mainMenuActive", true);
      this.presentTitleAfterRenderedWorld();
      return;
    }

    if (attempt >= PREVIEW_READY_MAX_ATTEMPTS) {
      titleScreenController.showFailure(new Error("The city preview did not become ready."));
      return;
    }

    this.time.delayedCall(PREVIEW_READY_RETRY_MS, () => this.waitForPreviewAuthority(attempt + 1));
  }

  presentTitleAfterRenderedWorld() {
    const postRenderEvent = Phaser.Core?.Events?.POST_RENDER || "postrender";
    let renderedFrames = 0;

    const waitForPostRender = () => {
      if (!this.sys.isActive()) return;
      renderedFrames += 1;
      if (renderedFrames < READY_RENDER_FRAMES) {
        this.game.events.once(postRenderEvent, waitForPostRender);
        return;
      }

      this.readyRenderEvent = null;
      this.readyRenderListener = null;
      titleScreenController.present({ onNewNight: () => this.beginNight() })
        .catch(error => titleScreenController.showFailure(error));
    };

    this.readyRenderEvent = postRenderEvent;
    this.readyRenderListener = waitForPostRender;
    this.game.events.once(postRenderEvent, waitForPostRender);
  }

  lockPreviewControl() {
    if (this.previewLocked) return true;
    const gameScene = this.scene.get("GameScene");
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
    const gameScene = this.scene.get("GameScene");
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
    const gameScene = this.scene.get("GameScene");
    gameScene?.registry?.set?.("mainMenuActive", false);
    this.handoffComplete = true;
    this.scene.stop("MainMenuScene");
  }

  cleanup() {
    if (this.readyRenderEvent && this.readyRenderListener) {
      this.game.events.off(this.readyRenderEvent, this.readyRenderListener);
      this.readyRenderEvent = null;
      this.readyRenderListener = null;
    }

    titleScreenController.detachNewNightHandler();
    if (this.handoffComplete) return;
    titleScreenController.resetToBoot();
    this.restorePreviewControl();
  }
}
