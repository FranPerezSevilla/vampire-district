export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create() {
    this.registry.set("buildName", "ViceBlood main menu V1");
    this.registry.set("currentLayer", 2);
    this.registry.set("statusText", "Rooftop refuge · movement sandbox");

    this.scene.start("MainMenuScene");
  }
}
