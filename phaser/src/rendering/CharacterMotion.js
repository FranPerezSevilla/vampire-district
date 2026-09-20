const TAU = Math.PI * 2;
export const characterAngleDelta = (from, to) => ((to - from + Math.PI) % TAU + TAU) % TAU - Math.PI;
const heading = direction => Math.atan2(direction.y, direction.x) + Math.PI / 2;
const hasDirection = d => Math.hypot(d?.x || 0, d?.y || 0) > .001;

// Presentation only. One instance per view, ticked by the existing scene chain.
// An accumulated stride clock avoids jumping to an arbitrary animation frame
// whenever a pedestrian starts walking or switches from a walk to a run.
export class CharacterMotion {
  constructor(phase = 0) {
    this.phase = phase;
    this.lastTime = null;
    this.rotation = 0;
    this.feetRotation = 0;
    this.moveBlend = 0;
    this.runBlend = 0;
    this.targetRotation = 0;
  }

  update({timeMs = 0, movementDirection, aimDirection, moving = false,
    hasMovementIntent = moving, running = false, jumping = false,
    actionFacing = false, incapacitated = false} = {}) {
    const dt = this.lastTime == null ? 1 / 60 : Math.max(0, Math.min(.1, (timeMs - this.lastTime) / 1000));
    this.lastTime = timeMs;
    const ease = 1 - Math.exp(-dt * 18);
    this.moveBlend += ((moving && !incapacitated ? 1 : 0) - this.moveBlend) * ease;
    this.runBlend += ((running ? 1 : 0) - this.runBlend) * (1 - Math.exp(-dt * 10));
    this.phase = (this.phase + dt * (14 + this.runBlend * 7) * this.moveBlend) % TAU;

    if (!incapacitated) {
      if (actionFacing && hasDirection(aimDirection)) {
        this.targetRotation = heading(aimDirection);
        // The impact and muzzle must agree with the accepted combat direction.
        this.rotation = this.targetRotation;
      } else {
        if ((hasMovementIntent || jumping) && hasDirection(movementDirection)) this.targetRotation = heading(movementDirection);
        this.rotation += characterAngleDelta(this.rotation, this.targetRotation) * (1 - Math.exp(-dt * 24));
      }
      const legTarget = actionFacing && moving && hasDirection(movementDirection) ? heading(movementDirection) : this.rotation;
      this.feetRotation += characterAngleDelta(this.feetRotation, legTarget) * (1 - Math.exp(-dt * 20));
      // Hips can twist for a shot, never swivel 180 degrees away from the spine.
      const twist = Math.max(-.45, Math.min(.45, characterAngleDelta(this.rotation, this.feetRotation)));
      this.feetRotation = this.rotation + twist;
      if (!actionFacing) this.feetRotation = this.rotation;
    }
    return this;
  }
}
