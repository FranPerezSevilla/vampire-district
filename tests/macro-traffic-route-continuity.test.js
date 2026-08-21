import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceTrafficAgent,
  chooseTrafficContinuation,
  trafficDirectionForEdge
} from "../phaser/src/streaming/MacroTrafficRouteContinuityPolicy.js";

const graph = {
  nodeIds: ["a", "b", "c", "d"],
  edgeIds: ["ab", "bc", "bd"],
  nodes: {
    a: { neighbours: ["b"] },
    b: { neighbours: ["a", "c", "d"] },
    c: { neighbours: ["b"] },
    d: { neighbours: ["b"] }
  },
  edges: {
    ab: { id: "ab", a: "a", b: "b", travelSeconds: 10 },
    bc: { id: "bc", a: "b", b: "c", travelSeconds: 10 },
    bd: { id: "bd", a: "b", b: "d", travelSeconds: 10 }
  }
};

test("edge direction resolves from the actual junction path", () => {
  assert.equal(trafficDirectionForEdge(graph.edges.ab, "a", "b"), "forward");
  assert.equal(trafficDirectionForEdge(graph.edges.ab, "b", "a"), "reverse");
});

test("continuation avoids an immediate U-turn when another street exists", () => {
  const continuation = chooseTrafficContinuation(graph, graph.edges.ab, "forward", "car-17", 0);
  assert.ok(continuation);
  assert.equal(continuation.fromId, "b");
  assert.notEqual(continuation.toId, "a");
  assert.ok(["bc", "bd"].includes(continuation.edgeId));
});

test("a traffic identity crosses onto another edge instead of wrapping to its original edge", () => {
  const start = {
    tokenId: "ab#0",
    tokenIndex: 0,
    edgeId: "ab",
    direction: "forward",
    phase: 0.96,
    hop: 0
  };
  const result = advanceTrafficAgent(start, 1.2, graph, 1);
  assert.equal(result.transitions, 1);
  assert.equal(result.agent.tokenId, "ab#0");
  assert.notEqual(result.agent.edgeId, "ab");
  assert.ok(result.agent.phase > 0);
  assert.equal(result.agent.hop, 1);
});

test("route advancement can consume leftover time after crossing the junction", () => {
  const start = {
    tokenId: "ab#1",
    tokenIndex: 1,
    edgeId: "ab",
    direction: "forward",
    phase: 0.9,
    hop: 0
  };
  const result = advanceTrafficAgent(start, 3, graph, 1);
  assert.equal(result.transitions, 1);
  assert.ok(result.agent.phase > 0.15);
  assert.equal(result.remainingSeconds, 0);
});
