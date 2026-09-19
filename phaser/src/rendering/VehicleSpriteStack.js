import { viewportPerspectiveLimit } from './WorldScale.js';
import { vehicleStackModel, STACK_FRAME_BOUNDS } from './VehicleStackModels.js';
import { VEHICLE_STACK_SETTINGS, MAX_VEHICLE_STACK_SHEAR, vehicleStackMagnitude } from './VehicleStackSettings.js';

export const VEHICLE_STACK_ATLAS = Object.freeze({
  key: 'vehicle-stack-fleet-v1', cellWidth: 48, cellHeight: 28,
  columns: 4, frames: 40, resolution: 8
});
const PERSPECTIVE = Object.freeze({eastWest: 4, northSouth: 4});
const HIDDEN_MATERIAL = Object.freeze({visible:false});
// Height is measured from the unchanged tyre footprint. Sections share a pivot
// and get a world-space offset, independent of the vehicle's heading.
export function vehicleStackProjection(x, y, camera, out = {}, magnitude = 1) {
  const factor = 4 * viewportPerspectiveLimit(camera, PERSPECTIVE) / 1505;
  const dx = (x - camera.scrollX - camera.width / 2) * factor;
  const dy = (y - camera.scrollY - camera.height / 2) * factor;
  // Smooth bounded projection, without clamp corners or quantised camera cells.
  const limit = 1 / Math.sqrt(1 + (dx * dx + dy * dy) / (VEHICLE_STACK_SETTINGS.radialShear ** 2));
  const gain = vehicleStackMagnitude(magnitude);
  out.x = dx * limit * gain;
  out.y = dy * limit * gain - VEHICLE_STACK_SETTINGS.extraTilt * Math.max(0, gain - 1);
  return out;
}

function material(color, alpha = 1) {
  return {
    fillColor: color, fillAlpha: alpha, visible: true,
    strokeColor: 0x171512, strokeAlpha: .95, lineWidth: 1,
    setFillStyle(color, alpha = 1) { this.fillColor = color; this.fillAlpha = alpha; return this; },
    setStrokeStyle(width, color, alpha = 1) { this.lineWidth = width; this.strokeColor = color; this.strokeAlpha = alpha; return this; },
    setVisible(visible) { this.visible = visible; return this; }
  };
}

export function vehicleStackMaterials(color, trim) {
  return {palette: {color, trim}, body: material(color), cabin: material(0x111522, .96),
    hood: material(trim, .14), nose: material(trim, .24),
    wheels: Array.from({length: 4}, () => material(0x111314)),
    label: null, routeBadge: null, details: []};
}

// Read the existing damage/repair handles, not a parallel damage state machine.
export function stackLayerAppearance(layer, visual) {
  const part = visual[layer.material];
  if (layer.material === 'hood' && part.fillAlpha <= .14) return HIDDEN_MATERIAL;
  if (layer.material === 'wheel') return visual.wheels[layer.wheel];
  if (layer.material === 'wheelFace') return visual.wheels[layer.wheel].visible ? (visual.cabin.fillColor===0x08090c?0x28282a:0x899096) : visual.wheels[layer.wheel];
  if (layer.material === 'glass') {
    // The authored glass has its own reflection; a wreck's near-black glass
    // suppresses that reflection without generating another atlas.
    return (visual.cabin.fillColor === 0x08090c) ? 0x34343a : 0x8898ac;
  }
  if (layer.material === 'trim') return visual.nose.fillAlpha > .5 ? 0x55423d : 0x697687;
  if (layer.material === 'outline') return visual.body;
  return part || 0xffffff;
}

function registerFrames(texture) {
  if (texture.has('slice-0')) return;
  const w = VEHICLE_STACK_ATLAS.cellWidth * VEHICLE_STACK_ATLAS.resolution;
  const h = VEHICLE_STACK_ATLAS.cellHeight * VEHICLE_STACK_ATLAS.resolution;
  for (let i = 0; i < VEHICLE_STACK_ATLAS.frames; i++) {
    const [x, y, width, height] = STACK_FRAME_BOUNDS[i], r = VEHICLE_STACK_ATLAS.resolution;
    texture.add(`slice-${i}`, 0, (i % 4) * w + x * r, Math.floor(i / 4) * h + y * r, width * r, height * r);
  }
}

// One image object, one matrix calculation, one shared texture. The normal
// MultiPipeline batches the sections; no shader, render target or per-car bake.
export class VehicleSpriteStack extends (globalThis.Phaser?.GameObjects?.Image || class {}) {
  constructor(scene, visual, model) {
    const texture = scene.textures.get(VEHICLE_STACK_ATLAS.key);
    registerFrames(texture);
    super(scene, 0, 0, VEHICLE_STACK_ATLAS.key, 'slice-0');
    this.setSize(model.width, model.height);
    this.setOrigin(.5);
    this.visual = visual;
    this.vehicleCullPadding = model.maxHeight * MAX_VEHICLE_STACK_SHEAR;
    this.model = model;
    this.projection = {x: 0, y: 0};
    this.slices = model.slices.map(layer => ({...layer, image: texture.get(`slice-${layer.frame}`)}));
    scene.add.existing(this);
  }

  renderWebGL(renderer, src, camera, parentMatrix) {
    const m = Phaser.GameObjects.GetCalcMatrix(src, camera, parentMatrix).calc;
    const worldX = parentMatrix ? parentMatrix.getX(src.x, src.y) : src.x;
    const worldY = parentMatrix ? parentMatrix.getY(src.x, src.y) : src.y;
    const o = vehicleStackProjection(worldX, worldY, camera, src.projection,
      src.scene?.vehicleStackMagnitude ?? VEHICLE_STACK_SETTINGS.defaultMagnitude);
    const cm = camera.matrix;
    const determinant = parentMatrix ? parentMatrix.a * parentMatrix.d - parentMatrix.b * parentMatrix.c : 1;
    const heightScale = Number.isFinite(determinant) ? Math.sqrt(Math.abs(determinant)) : 1;
    const ox = (cm.a * o.x + cm.c * o.y) * heightScale, oy = (cm.b * o.x + cm.d * o.y) * heightScale;
    const p = renderer.pipelines.set(src.pipeline, src);
    const unit = p.setGameObject(src), texture = src.frame.glTexture;
    const getTint = Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha;
    const alpha = camera.alpha * src.alpha;
    camera.addToRenderList(src);
    p.manager.preBatch(src);
    for (const layer of src.slices) {
      const appearance = stackLayerAppearance(layer, src.visual);
      if (appearance.visible === false) continue;
      const outline = layer.material === 'outline';
      const color = typeof appearance === 'number' ? appearance : outline ? appearance.strokeColor : appearance.fillColor;
      const opacity = typeof appearance === 'number' ? 1 : outline ? appearance.strokeAlpha : appearance.fillAlpha;
      const tint = getTint(color, alpha * opacity), frame = layer.image;
      const {x, y, w: width, h: height} = layer;
      const dx = ox * layer.z, dy = oy * layer.z;
      let ax,ay,bx,by,cx,cy,ex,ey;
      if(layer.corners){
        const [a,b,c,d]=layer.corners;
        ax=m.getX(a[0],a[1])+ox*a[2];ay=m.getY(a[0],a[1])+oy*a[2];
        bx=m.getX(b[0],b[1])+ox*b[2];by=m.getY(b[0],b[1])+oy*b[2];
        cx=m.getX(c[0],c[1])+ox*c[2];cy=m.getY(c[0],c[1])+oy*c[2];
        ex=m.getX(d[0],d[1])+ox*d[2];ey=m.getY(d[0],d[1])+oy*d[2];
        // Hidden faces must not paint over the roof or the opposite side.
        if((bx-ax)*(cy-ay)-(by-ay)*(cx-ax)>=-1e-6)continue;
      }else{
        ax=m.getX(x,y)+dx;ay=m.getY(x,y)+dy;
        bx=m.getX(x,y+height)+dx;by=m.getY(x,y+height)+dy;
        cx=m.getX(x+width,y+height)+dx;cy=m.getY(x+width,y+height)+dy;
        ex=m.getX(x+width,y)+dx;ey=m.getY(x+width,y)+dy;
      }
      p.batchQuad(src,
        ax,ay,bx,by,cx,cy,ex,ey,
        frame.u0, frame.v0, frame.u1, frame.v1, tint, tint, tint, tint, 0, texture, unit);
    }
    p.manager.postBatch(src);
    // Keep the existing bus route Text on its roof. It is a sibling drawn next,
    // so convert the same world-height shift back into the car's local axes.
    const badge = src.visual.routeBadge, anchor = src.model?.badge;
    if (badge && anchor) {
      const det = m.a * m.d - m.b * m.c;
      if (Math.abs(det) > 1e-9) badge.setPosition(anchor.x + (m.d * ox - m.c * oy) * anchor.z / det,
        anchor.y + (m.a * oy - m.b * ox) * anchor.z / det);
    }
  }
}

export function paintStackedVehicle(scene, container, archetype, color, trim, definition = {}) {
  if (!scene.game?.renderer?.gl || !scene.textures?.exists(VEHICLE_STACK_ATLAS.key)) return null;
  const model = vehicleStackModel(archetype);
  if (!model) return null;
  const visual = vehicleStackMaterials(color, trim);
  visual.stack = new VehicleSpriteStack(scene, visual, model);
  container.add(visual.stack);
  if (model.badge) {
    visual.routeBadge = scene.add.text(model.badge.x, model.badge.y, definition.transitLineId || 'BUS', {
      fontFamily:'monospace', fontSize:'4px', fontStyle:'bold', color:'#c9c5a6', backgroundColor:'#202724', resolution:4
    }).setOrigin(.5);
    container.add(visual.routeBadge);
  }
  return visual;
}
