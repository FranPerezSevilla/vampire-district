export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create() {
    this.registry.set("buildName", "Phaser migration Phase 0");
    this.registry.set("currentLayer", 2);
    this.registry.set("statusText", "Rooftop refuge · movement sandbox");

    if (window.NBD_RC_TEST_MODE) {
      this.scene.start("GameScene");
      this.scene.launch("UIScene");
      return;
    }

    this.scene.start("MainMenuScene");
  }
}
