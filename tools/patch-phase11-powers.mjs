import fs from 'node:fs';

const files = {
  game: 'phaser/src/scenes/GameScene.js',
  ui: 'phaser/src/scenes/UIScene.js',
  rootIndex: 'index.html',
  phaserIndex: 'phaser/index.html'
};

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOnce(content, search, replacement, label) {
  if (!content.includes(search)) throw new Error(`Missing patch anchor: ${label}`);
  return content.replace(search, replacement);
}

function patchGameScene() {
  let content = read(files.game);

  if (!content.includes('PowersSystem')) {
    content = replaceOnce(
      content,
      'import { PoliceSystem } from "../systems/PoliceSystem.js";\n',
      'import { PoliceSystem } from "../systems/PoliceSystem.js";\nimport { PowersSystem } from "../systems/PowersSystem.js";\n',
      'PowersSystem import'
    );
  }

  if (!content.includes('dash: Phaser.Input.Keyboard.KeyCodes.Q')) {
    content = replaceOnce(
      content,
      '      interact: Phaser.Input.Keyboard.KeyCodes.E,\n',
      '      interact: Phaser.Input.Keyboard.KeyCodes.E,\n      dash: Phaser.Input.Keyboard.KeyCodes.Q,\n      whisper: Phaser.Input.Keyboard.KeyCodes.R,\n      sense: Phaser.Input.Keyboard.KeyCodes.F,\n',
      'power key bindings'
    );
  }

  if (!content.includes('this.powersSystem = new PowersSystem(this);')) {
    content = replaceOnce(
      content,
      '    this.hunterSystem = new HunterSystem(this);\n',
      '    this.hunterSystem = new HunterSystem(this);\n    this.powersSystem = new PowersSystem(this);\n',
      'PowersSystem construction'
    );
  }

  if (!content.includes('this.powersSystem.update(dt, this.keys);')) {
    content = replaceOnce(
      content,
      '    this.handleLayerDebugKeys();\n\n    const availableActions = this.collectInteractions();\n',
      '    this.handleLayerDebugKeys();\n    this.powersSystem.update(dt, this.keys);\n\n    const availableActions = this.collectInteractions();\n',
      'PowersSystem update'
    );
  }

  if (!content.includes('this.registry.set("powersText"')) {
    content = replaceOnce(
      content,
      '    this.registry.set("hungerText", this.feedingSystem ? this.feedingSystem.summary() : "Hunger loading");\n',
      '    this.registry.set("hungerText", this.feedingSystem ? this.feedingSystem.summary() : "Hunger loading");\n    this.registry.set("powersText", this.powersSystem ? this.powersSystem.summary() : "Powers loading");\n',
      'Powers HUD registry'
    );
  }

  write(files.game, content);
}

function patchUIScene() {
  let content = read(files.ui);

  content = content.replace('this.panel = this.add.rectangle(14, 14, 710, 244, 0x05060b, 0.78)', 'this.panel = this.add.rectangle(14, 14, 720, 262, 0x05060b, 0.78)');
  content = content.replace(/this\.phase = this\.add\.text\(14, 606, "PHASE [^"]+"/, 'this.phase = this.add.text(14, 606, "PHASE 11: powers + Blood Sense polish"');

  if (!content.includes('this.powers = this.add.text')) {
    content = replaceOnce(
      content,
      '    this.prompt = this.add.text(26, 216, "", {\n',
      '    this.powers = this.add.text(26, 216, "Powers: loading", {\n      fontFamily: "monospace",\n      fontSize: "10px",\n      color: "#a75cff"\n    }).setScrollFactor(0);\n\n    this.prompt = this.add.text(26, 233, "", {\n',
      'insert powers HUD row'
    );
    content = content.replace('    this.lastAction = this.add.text(26, 231, "", {', '    this.lastAction = this.add.text(26, 248, "", {');
  }

  if (!content.includes('const powersText = this.registry.get("powersText")')) {
    content = replaceOnce(
      content,
      '    const hungerText = this.registry.get("hungerText") || "Hunger unavailable";\n',
      '    const hungerText = this.registry.get("hungerText") || "Hunger unavailable";\n    const powersText = this.registry.get("powersText") || "Powers unavailable";\n',
      'powers registry read'
    );
  }

  content = content.replace(
    'this.registry.get("interactionPrompt") || "E near routes/lamps/objectives/feed/body/witnesses · movement cancels feeding";',
    'this.registry.get("interactionPrompt") || "Q/Space Dash · R Whisper · F Blood Sense · E interact/feed/body/routes";'
  );

  if (!content.includes('this.powers.setText')) {
    content = replaceOnce(
      content,
      '    this.hunger.setText(hungerText);\n',
      '    this.hunger.setText(hungerText);\n    this.powers.setText(`Powers: ${powersText}`);\n',
      'powers HUD setText'
    );
  }

  write(files.ui, content);
}

function patchPages() {
  for (const path of [files.rootIndex, files.phaserIndex]) {
    let content = read(path);
    content = content.replace(/<b>Phase \d+:<\/b>[^\n]+/, '<b>Phase 11:</b> Powers build. Blood Sense, Shadow Dash and Whisper now work in Phaser. Legacy remains under <a href="legacy/">/legacy/</a>.');
    if (path === files.phaserIndex) content = content.replace('href="legacy/"', 'href="../legacy/"');
    content = content.replace(/<span>[^<]*<\/span>/, '<span>WASD / arrows move · Q/Space Dash · R Whisper · F Blood Sense · E interact/feed/body/hide/intercept/routes</span>');
    write(path, content);
  }
}

patchGameScene();
patchUIScene();
patchPages();
console.log('Applied Phaser phase 11 powers patch.');
// trigger: phase11-powers-1
