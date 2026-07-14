import fs from 'node:fs';

const file = 'phaser/src/scenes/GameScene.js';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('this.drawHunterRouteBlocks();')) {
  throw new Error('Expected redrawLayer to call drawHunterRouteBlocks, but call was not found.');
}

if (!content.includes('drawHunterRouteBlocks()')) {
  const method = `
  drawHunterRouteBlocks() {
    const blocks = this.hunterSystem?.routeBlocks || [];
    for (const block of blocks) {
      if (block.layer !== this.currentLayer) continue;
      this.routeGraphics.lineStyle(2, 0xff9d35, 0.92).strokeCircle(block.x, block.y, 22);
      this.routeGraphics.fillStyle(0xff9d35, 0.14).fillCircle(block.x, block.y, 22);
      this.addMapLabel("HUNTER BLOCK", block.x + 14, block.y - 18, 0xff9d35);
    }
  }
`;

  const anchor = '\n  drawRouteMarker(x, y, label, color) {';
  if (!content.includes(anchor)) {
    throw new Error('Could not find drawRouteMarker anchor for inserting drawHunterRouteBlocks.');
  }
  content = content.replace(anchor, `${method}${anchor}`);
  fs.writeFileSync(file, content);
  console.log('Inserted drawHunterRouteBlocks method.');
} else {
  console.log('drawHunterRouteBlocks already exists.');
}

console.log('Hunter route blocks patch checked at', new Date().toISOString());
