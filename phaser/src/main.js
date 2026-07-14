import { BootScene } from "./scenes/BootScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { UIScene } from "./scenes/UIScene.js";
import { WORLD } from "./data/balance.js";

const config = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: WORLD.width,
  height: WORLD.height,
  backgroundColor: "#05060b",
  pixelArt: true,
  roundPixels: true,
  physics: {
    default: "arcade",
    arcade: {
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, GameScene, UIScene]
};

window.NBD_PHASER_GAME = new Phaser.Game(config);
