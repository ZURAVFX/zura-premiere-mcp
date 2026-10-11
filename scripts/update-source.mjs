#!/usr/bin/env node

const action = process.argv.includes("--check") ? "check" : "update";
console.log("Zura Premiere Reels updates are delivered through the Codex plugin marketplace.");
console.log(action === "check"
  ? "In Codex, check for a plugin update. This command does not contact npm or GitHub."
  : "Update the zura-premiere-reels plugin in Codex, then run its setup skill to refresh the local MCP and Premiere panel.");
console.log("No source files, Git branches, npm packages, or Premiere projects were changed.");
