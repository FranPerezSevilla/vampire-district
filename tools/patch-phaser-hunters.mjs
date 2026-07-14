import fs from 'node:fs';

// Triggered patch for Phase 10: hunters + route blocking.
const files = {
  game: 'phaser/src/scenes/GameScene.js',
  ui: 'phaser/src/scenes/UIScene.js',
  rootIndex: 'index.html',
  phaserIndex: 'phaser/index.html',
  hunter: 'phaser/src/systems/HunterSystem.js'
};

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceOnce(content, search, replacement, label) {
  if (!content.includes(search)) throw new Error(`Missing patch anchor: ${label}`);
  return content.replace(search, replacement);
}

function ensureImport(content) {
  if (content.includes('HunterSystem')) return content;
  return content.replace(
    'import { FeedingSystem } from "../systems/FeedingSystem.js";\n',
    'import { FeedingSystem } from "../systems/FeedingSystem.js";\nimport { HunterSystem } from "../systems/HunterSystem.js";\n'
  );
}

function patchGameScene() {
  let content = read(files.game);
  content = ensureImport(content);

  if (!content.includes('this.hunterSystem = new HunterSystem(this);')) {
    content = replaceOnce(
      content,
      '    this.policeSystem = new PoliceSystem(this);\n',
      '    this.policeSystem = new PoliceSystem(this);\n    this.hunterSystem = new HunterSystem(this);\n',
      'hunter system construction'
    );
  }

  if (!content.includes('this.hunterSystem.update(dt);')) {
    content = replaceOnce(
      content,
      '      this.policeSystem.update(dt);\n',
      '      this.policeSystem.update(dt);\n      this.hunterSystem.update(dt);\n',
      'hunter update loop'
    );
  }

  if (!content.includes('this.registry.set("hunterText"')) {
    content = replaceOnce(
      content,
      '    this.registry.set("policeText", this.policeSystem ? this.policeSystem.summary() : "Police loading");\n',
      '    this.registry.set("policeText", this.policeSystem ? this.policeSystem.summary() : "Police loading");\n    this.registry.set("hunterText", this.hunterSystem ? this.hunterSystem.summary() : "Hunters dormant");\n',
      'hunter HUD registry'
    );
  }

  if (!content.includes('this.drawHunterRouteBlocks();')) {
    content = replaceOnce(
      content,
      '    this.drawRouteMarkers();\n    this.drawMissionMarker();\n',
      '    this.drawRouteMarkers();\n    this.drawMissionMarker();\n    this.drawHunterRouteBlocks();\n',
      'draw hunter route blocks call'
    );
  }

  if (!content.includes('drawHunterRouteBlocks()')) {
    const insert = `\n  drawHunterRouteBlocks() {\n    const blocks = this.hunterSystem?.routeBlocks || [];\n    for (const block of blocks) {\n      if (block.layer !== this.currentLayer) continue;\n      this.routeGraphics.lineStyle(2, 0xff9d35, 0.92).strokeCircle(block.x, block.y, 22);\n      this.routeGraphics.fillStyle(0xff9d35, 0.14).fillCircle(block.x, block.y, 22);\n      this.addMapLabel(\"HUNTER BLOCK\", block.x + 14, block.y - 18, 0xff9d35);\n    }\n  }\n`;
    content = replaceOnce(
      content,
      '\n  drawRouteMarker(x, y, label, color) {',
      insert + '\n  drawRouteMarker(x, y, label, color) {',
      'drawHunterRouteBlocks method'
    );
  }

  write(files.game, content);
}

function patchUIScene() {
  let content = read(files.ui);

  if (!content.includes('this.hunter = this.add.text')) {
    content = content.replace(
      '    this.evidence = this.add.text(26, 131, "Evidence: loading", {',
      '    this.hunter = this.add.text(26, 131, "Hunters: dormant", {\n      fontFamily: "monospace",\n      fontSize: "10px",\n      color: "#ff9d35"\n    }).setScrollFactor(0);\n\n    this.evidence = this.add.text(26, 148, "Evidence: loading", {'
    );
    content = content.replace(
      '    this.npcs = this.add.text(26, 148, "NPCs: loading", {',
      '    this.npcs = this.add.text(26, 165, "NPCs: loading", {'
    );
    content = content.replace(
      '    this.hunger = this.add.text(26, 165, "Hunger: loading", {',
      '    this.hunger = this.add.text(26, 182, "Hunger: loading", {'
    );
    content = content.replace(
      '    this.prompt = this.add.text(26, 182, "", {',
      '    this.prompt = this.add.text(26, 199, "", {'
    );
    content = content.replace(
      '    this.lastAction = this.add.text(26, 197, "", {',
      '    this.lastAction = this.add.text(26, 214, "", {'
    );
    content = content.replace(
      '    this.panel = this.add.rectangle(14, 14, 690, 208, 0x05060b, 0.78)',
      '    this.panel = this.add.rectangle(14, 14, 700, 226, 0x05060b, 0.78)'
    );
  }

  content = content.replace(
    /this\.phase = this\.add\.text\(14, 606, "PHASE [^"]+"/,
    'this.phase = this.add.text(14, 606, "PHASE 10: hunters + route blocking"'
  );

  if (!content.includes('const hunterText = this.registry.get("hunterText")')) {
    content = content.replace(
      '    const evidenceText = this.registry.get("evidenceText") || "Evidence unavailable";\n',
      '    const hunterText = this.registry.get("hunterText") || "Hunters dormant";\n    const evidenceText = this.registry.get("evidenceText") || "Evidence unavailable";\n'
    );
  }

  if (!content.includes('this.hunter.setText')) {
    content = content.replace(
      '    this.witness.setText(witnessText);\n',
      '    this.witness.setText(witnessText);\n    this.hunter.setText(hunterText);\n'
    );
  }

  write(files.ui, content);
}

function patchPages() {
  for (const path of [files.rootIndex, files.phaserIndex]) {
    let content = read(path);
    content = content.replace(/<b>Phase \d+:<\/b>[^\n]+/,
      '<b>Phase 10:</b> Hunters build. Hunters emerge from the church at high exposure, react to blood, and can block escape routes. Legacy remains under <a href="legacy/">/legacy/</a>.');
    if (path === files.phaserIndex) {
      content = content.replace('href="legacy/"', 'href="../legacy/"');
    }
    content = content.replace(/<span>[^<]*<\/span>/,
      '<span>WASD / arrows move · Shift sprint · E interact/feed/body/hide/intercept/routes · hunters appear at high exposure</span>');
    write(path, content);
  }
}

function createHunterSystem() {
  if (fs.existsSync(files.hunter)) return;
  const content = `import { LAYERS } from "../data/district.js";\nimport { NPC_TYPES } from "../data/npcs.js";\n\nconst CHURCH_ANCHOR = Object.freeze({ x: 742, y: 474 });\n\nconst ROUTE_BLOCK_POINTS = Object.freeze([\n  { id: "church_gate", name: "church gate", x: 742, y: 474, layer: LAYERS.STREET },\n  { id: "club_alley", name: "club rear alley", x: 676, y: 502, layer: LAYERS.STREET },\n  { id: "cross_manhole", name: "crossroad manhole", x: 472, y: 326, layer: LAYERS.STREET },\n  { id: "refuge_escape", name: "refuge fire escape", x: 176, y: 244, layer: LAYERS.STREET }\n]);\n\nexport class HunterSystem {\n  constructor(scene) {\n    this.scene = scene;\n    this.spawned = 0;\n    this.revealed = false;\n    this.routeBlocks = [];\n    this.nextBlockAt = 0;\n  }\n\n  update(dt) {\n    this.maybeReveal();\n    this.updateRouteBlocks(dt);\n    this.updateHunters(dt);\n  }\n\n  maybeReveal() {\n    if (this.revealed) return;\n    const level = this.scene.exposureSystem.level();\n    const bloodTrigger = this.scene.evidenceSystem?.bloodStains?.some(stain => stain.layer === LAYERS.STREET && !stain.cleaned) || false;\n    const bodyTrigger = this.scene.evidenceSystem?.bodies?.some(body => !body.hidden && body.layer === LAYERS.STREET) || false;\n    if (level < 4 && !bloodTrigger && !bodyTrigger) return;\n\n    this.revealed = true;\n    this.spawnHunter();\n    this.scene.lastActionText = bloodTrigger\n      ? "A hunter steps out from the church quarter, following the smell of blood."\n      : "Exposure is too high. A hunter notices the pattern behind the crimes.";\n  }\n\n  spawnHunter() {\n    this.spawned++;\n    const hunter = this.scene.npcSystem.createNpc({\n      id: \`hunter_\${this.spawned}\`,\n      type: NPC_TYPES.HUNTER,\n      x: CHURCH_ANCHOR.x + (Math.random() - 0.5) * 44,\n      y: CHURCH_ANCHOR.y + (Math.random() - 0.5) * 34,\n      layer: LAYERS.STREET,\n      behavior: "hunter",\n      speed: 42\n    });\n    hunter.active = true;\n    hunter.hunterIntent = "hunt";\n    this.scene.npcSystem.npcs.push(hunter);\n  }\n\n  updateRouteBlocks(dt) {\n    this.nextBlockAt = Math.max(0, this.nextBlockAt - dt);\n    for (const block of this.routeBlocks) block.life -= dt;\n    this.routeBlocks = this.routeBlocks.filter(block => block.life > 0);\n\n    if (!this.revealed || this.nextBlockAt > 0) return;\n    if (this.scene.exposureSystem.level() < 4) return;\n    this.nextBlockAt = 7.5;\n\n    const candidates = ROUTE_BLOCK_POINTS\n      .filter(point => !this.routeBlocks.some(block => block.id === point.id))\n      .map(point => ({ point, score: Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, point.x, point.y) + Math.random() * 80 }))\n      .sort((a, b) => a.score - b.score);\n\n    if (!candidates.length) return;\n    const point = candidates[0].point;\n    this.routeBlocks.push({ ...point, life: 8.5 });\n    this.scene.lastActionText = \`A hunter tries to cut off \${point.name}.\`;\n  }\n\n  updateHunters(dt) {\n    for (const hunter of this.hunters()) {\n      let target = null;\n      const blood = this.nearestBlood(hunter);\n      if (blood) target = { x: blood.x, y: blood.y, kind: "blood" };\n      if (!target && this.scene.currentLayer === LAYERS.STREET && !this.scene.currentShadow()) {\n        const d = Phaser.Math.Distance.Between(hunter.x, hunter.y, this.scene.player.x, this.scene.player.y);\n        if (d < 260 || this.scene.exposureSystem.level() >= 4) target = { x: this.scene.player.x, y: this.scene.player.y, kind: "player" };\n      }\n      if (!target && this.routeBlocks.length) {\n        const block = this.routeBlocks[0];\n        target = { x: block.x, y: block.y, kind: "block" };\n      }\n      if (!target) target = CHURCH_ANCHOR;\n\n      this.moveNpcToward(hunter, target.x, target.y, dt, target.kind === "player" ? 1.12 : 0.82);\n      if (target.kind === "player" && Phaser.Math.Distance.Between(hunter.x, hunter.y, this.scene.player.x, this.scene.player.y) < 18) {\n        this.scene.exposureSystem.add(7, "A hunter almost pins you down.");\n      }\n    }\n  }\n\n  nearestBlood(hunter) {\n    const stains = this.scene.evidenceSystem?.bloodStains || [];\n    let best = null;\n    let bestD = Infinity;\n    for (const stain of stains) {\n      if (stain.cleaned || stain.layer !== hunter.layer) continue;\n      const d = Phaser.Math.Distance.Between(hunter.x, hunter.y, stain.x, stain.y);\n      if (d < 220 && d < bestD) { best = stain; bestD = d; }\n    }\n    return best;\n  }\n\n  moveNpcToward(npc, x, y, dt, speedMul = 1) {\n    const dx = x - npc.x;\n    const dy = y - npc.y;\n    const len = Math.hypot(dx, dy) || 1;\n    const speed = (npc.speed || 42) * speedMul;\n    npc.x += (dx / len) * speed * dt;\n    npc.y += (dy / len) * speed * dt;\n    npc.container.setPosition(npc.x, npc.y);\n  }\n\n  hunters() {\n    return this.scene.npcSystem.npcs.filter(npc => npc.type === NPC_TYPES.HUNTER && !npc.inactive && !npc.dead);\n  }\n\n  summary() {\n    if (!this.revealed) return "Hunters dormant";\n    const blocks = this.routeBlocks.length ? \` · blocks \${this.routeBlocks.length}\` : "";\n    return \`Hunters \${this.hunters().length}\${blocks}\`;\n  }\n}\n`;
  write(files.hunter, content);
}

createHunterSystem();
patchGameScene();
patchUIScene();
patchPages();

console.log('Applied Phaser hunters patch.');
