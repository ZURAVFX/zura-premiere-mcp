#!/usr/bin/env node

const action = process.argv.includes("--check") ? "check" : "update";
console.log("Zura Premiere MCP source and releases are maintained at https://github.com/ZURAVFX/zura-premiere-mcp.");
console.log(action === "check"
  ? "Review the latest GitHub release, then rerun INSTALL-ZURA-PREMIERE-MCP.ps1 if an update is available."
  : "Pull the latest source and rerun INSTALL-ZURA-PREMIERE-MCP.ps1 to update the local MCP and Premiere panel.");
console.log("This command does not contact GitHub or make changes automatically.");
