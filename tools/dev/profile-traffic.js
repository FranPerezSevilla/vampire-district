import { Session } from "node:inspector";
import { writeFileSync } from "node:fs";
import { createTrafficDensityRuntime } from "../../tests/helpers/traffic-density-runtime.js";

// Native CPU evidence only: the helper substitutes rendering/file transport.
// Run sequentially on the same machine; do not interpret these numbers as FPS.
const args = process.argv.slice(2);
function option(name, fallback) { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; }
const hz = Number(option("hz", 20)), seconds = Number(option("seconds", 60));
const warmup = Number(option("warmup", 10)), profilePath = option("cpu", null);
if (![hz, seconds].every(n => Number.isFinite(n) && n > 0) || !Number.isFinite(warmup) || warmup < 0) throw new Error("Invalid benchmark duration/rate.");
const center = { x: 2250, y: 3250 }, start = performance.now();
const system = await createTrafficDensityRuntime({ center, transit: true });
const setupMs = performance.now() - start;
const session = profilePath ? new Session() : null;
const post = (method, params = {}) => new Promise((resolve, reject) => session.post(method, params, (err, result) => err ? reject(err) : resolve(result)));
try {
  system.step(Math.round(warmup * hz), 1 / hz);
  if (session) { session.connect(); await post("Profiler.enable"); await post("Profiler.setSamplingInterval", { interval: 1000 }); await post("Profiler.start"); }
  system.step(Math.round(seconds * hz), 1 / hz);
  if (session) { const { profile } = await post("Profiler.stop"); writeFileSync(profilePath, JSON.stringify(profile)); }
  console.log(JSON.stringify({ center, hz, warmup, sampledSeconds: seconds, setupMs, ...system.metrics({ recoveryGrace: 60 }),
    driverWork: system.route.runtime().snapshot().performance }));
} finally { session?.disconnect(); system.destroy(); }
