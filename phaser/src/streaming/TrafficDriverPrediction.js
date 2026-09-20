import { stepVehicleKinematics } from "../vehicles/VehicleModel.js";
import { projectJourney } from "./TrafficJourneyPlanner.js";
import { driverControls, journeyDrivingTarget } from "./TrafficDriverController.js";

// Cache only the driver's proposed geometry, never obstacle positions or a
// clearance result. Moving obstacles are tested again on every physical step.
export function predictDriverClearance(driver, world, objects, clock, stats) {
  const start = driver.pose;
  const horizon = Math.max(driver.wait > 4 ? 150 : 30,
    start.speed ** 2 / (2 * driver.archetype.brake) + Math.abs(start.speed) * 0.55 + 16);
  const cached = driver.pathPrediction;
  const reusable = cached && clock < cached.until
    && cached.journey === driver.journey && cached.impacts === driver.adoptedImpacts
    && cached.width === driver.archetype.width && cached.height === driver.archetype.height
    && cached.cruiseSpeed === driver.cruiseSpeed && (!cached.complete || cached.coverage >= horizon)
    && Math.hypot(start.x - cached.x, start.y - cached.y) < 8
    && Math.abs(start.angle - cached.angle) < 0.01 && Math.abs(start.speed - cached.speed) < 8
    && objects.length === cached.objects.length && objects.every((object, i) => object === cached.objects[i]);
  if (reusable) {
    for (const point of cached.points) {
      if (point.travelled >= horizon) break;
      const blocker = world.blocker(driver, { x: start.x + point.x, y: start.y + point.y, angle: point.angle }, objects, 3);
      if (blocker) { stats.predictionReuses++; return { blocker, travelled: point.travelled }; }
    }
    if (cached.complete) { stats.predictionReuses++; return { blocker: null, travelled: 0 }; }
    // A former blocker moved away. Extend from the current physical pose;
    // never assume the unexamined remainder of a cached path is clear.
  }
  stats.predictionBuilds++;
  const result = { until: clock + 0.1, x: start.x, y: start.y, angle: start.angle, speed: start.speed,
    width: driver.archetype.width, height: driver.archetype.height, cruiseSpeed: driver.cruiseSpeed,
    journey: driver.journey, impacts: driver.adoptedImpacts, horizon, objects: objects.slice(), points: [], complete: false };
  driver.pathPrediction = result;
  let predicted = start, progress = driver.progress, travelled = 0;
  for (let i = 0; i < 40 && travelled < horizon; i++) {
    const aim = journeyDrivingTarget({ journey: driver.journey, pose: predicted, progress }, driver.cruiseSpeed);
    const frame = driverControls(predicted, aim.target, aim.speed, driver.archetype, 0.1);
    const next = stepVehicleKinematics(predicted, frame, 0.1, driver.archetype);
    result.points.push({ x: next.x - start.x, y: next.y - start.y, angle: next.angle, travelled });
    const blocker = world.blocker(driver, next, objects, 3);
    if (blocker) return { blocker, travelled };
    travelled += Math.hypot(next.x - predicted.x, next.y - predicted.y);
    predicted = next;
    progress = projectJourney(driver.journey, predicted, progress).progress;
  }
  result.complete = true;
  result.coverage = travelled;
  return { blocker: null, travelled: 0 };
}
