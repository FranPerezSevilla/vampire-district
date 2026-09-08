import { angleDelta, clamp, stepVehicleKinematics } from "../vehicles/VehicleModel.js";
import { journeyPoint } from "./TrafficJourneyPlanner.js";

export function driverControls(state, target, targetSpeed, archetype, dt = 0.05) {
  const speed = state.speed || 0;
  const direction = targetSpeed < 0 ? -1 : 1;
  const bearing = Math.atan2(target.y - state.y, target.x - state.x);
  const error = angleDelta(state.angle + (direction < 0 ? Math.PI : 0), bearing);
  const distance = Math.max(8, Math.hypot(target.x - state.x, target.y - state.y));
  const desiredRate = 2 * Math.max(18, Math.abs(speed)) * Math.sin(error) / distance;
  const authority = Math.max(Math.abs(speed) / archetype.maxSpeed, 0.16);
  const rate = Math.min(2.55 - Math.abs(speed) / archetype.maxSpeed * 0.45,
    archetype.steerRate * (0.24 + Math.sqrt(authority) * 0.76));
  const steer = clamp(desiredRate / rate * direction, -1, 1);
  let throttle;
  if (targetSpeed === 0) {
    // A brake frame may bring speed exactly to zero but must not engage reverse.
    throttle = Math.abs(speed) > 0.01 ? -Math.sign(speed) * Math.min(1, Math.abs(speed) / (archetype.brake * dt)) : 0;
  } else if (speed * direction < -0.01) throttle = direction;
  else if (Math.abs(speed) > Math.abs(targetSpeed) + 0.5) {
    throttle = -direction * Math.min(1, (Math.abs(speed) - Math.abs(targetSpeed)) / (archetype.brake * dt));
  } else {
    // Match the shared model's actual acceleration, gearbox and drag. A bounded
    // scalar search avoids a throttle/coast oscillation at civilian cruise speed.
    let low = 0.051, high = 1;
    for (let i = 0; i < 7; i++) {
      const middle = (low + high) / 2;
      const next = stepVehicleKinematics(state, { move: { x: steer, y: -direction * middle } }, dt, archetype);
      if (Math.abs(next.speed) > Math.abs(targetSpeed)) high = middle;
      else low = middle;
    }
    throttle = direction * (low + high) / 2;
  }
  return { move: { x: Math.abs(speed) < 0.25 && !throttle ? 0 : steer, y: -throttle }, handbrakeHeld: false };
}

export function journeyDrivingTarget(driver, cruiseSpeed) {
  const lookAhead = clamp(14 + Math.abs(driver.pose.speed) * 0.24, 14, 40);
  const target = journeyPoint(driver.journey, driver.progress + lookAhead);
  const near = journeyPoint(driver.journey, driver.progress + 5);
  const far = journeyPoint(driver.journey, driver.progress + 52);
  const bend = Math.abs(angleDelta(near.angle, far.angle));
  const headingError = Math.abs(angleDelta(driver.pose.angle, target.angle));
  return { target, speed: Math.min(cruiseSpeed, 100 / (1 + bend * 2.8), 110 / (1 + headingError * 2)) };
}

// Hybrid search nodes are reachable vehicle poses, never lateral offsets. Each
// edge records the exact controls consumed by VehicleModel at 50 ms intervals.
// Reverse is another gear/control choice and gets a cost so normal driving wins.
export function planDriverManeuver({ pose, archetype, goal, safe, maxNodes = 600 }) {
  const distance = state => Math.hypot(state.x - goal.x, state.y - goal.y);
  const heuristic = state => distance(state) + Math.abs(angleDelta(state.angle, goal.angle)) * 18;
  const key = state => `${Math.round(state.x / 5)},${Math.round(state.y / 5)},${Math.round(state.angle / 0.2)},${Math.sign(state.speed)}`;
  const open = [{ pose: { ...pose }, cost: 0, score: heuristic(pose), parent: null, frames: [] }];
  const costs = new Map();
  let expanded = 0;
  while (open.length && expanded++ < maxNodes) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].score < open[best].score) best = i;
    const current = open.splice(best, 1)[0];
    if (distance(current.pose) < 13 && Math.abs(angleDelta(current.pose.angle, goal.angle)) < 0.4 && current.pose.speed > 0) {
      const frames = [];
      for (let node = current; node.parent; node = node.parent) frames.unshift(...node.frames);
      return { frames, goal, expanded };
    }
    for (const direction of [1, -1]) for (const steer of [0, -0.5, 0.5, -1, 1]) {
      let next = current.pose;
      const frames = [];
      let clear = true;
      for (let tick = 0; tick < 8; tick++) {
        const signedSpeed = next.speed * direction;
        const throttle = signedSpeed < 27 ? direction : -direction * Math.min(1, (signedSpeed - 26) / (archetype.brake * 0.05));
        const frame = { move: { x: steer, y: -throttle }, handbrakeHeld: false };
        const candidate = stepVehicleKinematics(next, frame, 0.05, archetype);
        if (!safe(candidate, next)) { clear = false; break; }
        frames.push(frame); next = candidate;
      }
      if (!clear) continue;
      const cost = current.cost + Math.hypot(next.x - current.pose.x, next.y - current.pose.y)
        + 1 + (direction < 0 ? 7 : 0) + Math.abs(steer) * 0.5;
      const id = key(next);
      if ((costs.get(id) ?? Infinity) <= cost) continue;
      costs.set(id, cost);
      open.push({ pose: next, cost, score: cost + heuristic(next) * 1.6, parent: current, frames });
    }
  }
  return null;
}
