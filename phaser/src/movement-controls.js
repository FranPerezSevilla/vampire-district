// Milestone 10 composes gameplay systems directly from GameScene and
// GameplayRuntime. This legacy entry remains in both HTML routes so older cached
// pages do not fail, but it now loads only temporary tutorial/UI bridges that do
// not own the core simulation loop.
import "./input/tutorial-input-adapter.js";
import "./weapons/milestone7-ui.js";
