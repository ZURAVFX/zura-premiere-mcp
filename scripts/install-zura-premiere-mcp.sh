#!/bin/bash
set -euo pipefail

REGISTER_CODEX=true
for arg in "$@"; do
  case "$arg" in
    --skip-codex|--plugin-managed) REGISTER_CODEX=false ;;
    --help|-h)
      echo "Usage: bash INSTALL-ZURA-PREMIERE-MCP.command [--skip-codex|--plugin-managed]"
      echo "Build and install Zura Premiere MCP and its Premiere panel for the current macOS user."
      echo "--skip-codex / --plugin-managed: leave Codex registration to your client or plugin."
      exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This installer supports macOS only. On Windows, use INSTALL-ZURA-PREMIERE-MCP.ps1." >&2
  exit 1
fi
if [[ -z "${HOME:-}" || "$HOME" != /* ]]; then
  echo "HOME must be an absolute path to the current user's home directory." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js 20.19 or newer and npm are required. Install Node.js LTS, then run setup again." >&2
  exit 1
fi
node -e '
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 20 || (major === 20 && minor < 19)) {
    console.error("Node.js " + process.versions.node + " is too old. Install Node.js 20.19 or newer, then run setup again.");
    process.exit(1);
  }
'
if [[ "$REGISTER_CODEX" == true ]] && ! command -v codex >/dev/null 2>&1; then
  echo "The Codex CLI was not found on PATH. Install it, or use --skip-codex for another MCP client." >&2
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const root = process.argv[1];
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  if (pkg.name !== "zura-premiere-mcp" || !fs.existsSync(path.join(root, "src/index.ts"))) {
    console.error("Setup must run from the Zura Premiere MCP source checkout.");
    process.exit(1);
  }
' "$PROJECT_DIR"

NODE_EXECUTABLE="$(node -p 'process.execPath')"
INSTALL_DIR="$HOME/Library/Application Support/Adobe/ZuraPremiereMCP"
SERVER_ENTRYPOINT="$INSTALL_DIR/lib/node_modules/zura-premiere-mcp/dist/index.js"

cd "$PROJECT_DIR"
npm ci
npm run build
# An explicit user prefix avoids sudo and works with either Intel or Apple Silicon Node.
npm install --global --prefix "$INSTALL_DIR" --install-links "$PROJECT_DIR"
if [[ ! -f "$SERVER_ENTRYPOINT" ]]; then
  echo "The installed MCP entrypoint was not found: $SERVER_ENTRYPOINT" >&2
  exit 1
fi
"$NODE_EXECUTABLE" "$SERVER_ENTRYPOINT" --install-cep
"$NODE_EXECUTABLE" "$SERVER_ENTRYPOINT" --diagnose-cep

if [[ "$REGISTER_CODEX" == true ]]; then
  # Desktop clients need absolute paths because they may not inherit the shell's PATH.
  codex mcp add zura-premiere-mcp -- "$NODE_EXECUTABLE" "$SERVER_ENTRYPOINT"
else
  echo "Client configuration for this installation:"
  "$NODE_EXECUTABLE" "$SERVER_ENTRYPOINT" --print-client-config codex
fi

printf '%s\n' "$PROJECT_DIR" > "$INSTALL_DIR/source-root.txt"
echo "Zura Premiere MCP and the Premiere panel are installed."
echo "Restart Premiere Pro if it was already open, then choose Window > Extensions > Zura Premiere MCP."
if [[ "$REGISTER_CODEX" == true ]]; then
  echo "Open a new Codex chat to load the MCP tools."
else
  echo "Configure your MCP client with the absolute paths above, then reload its MCP connection."
fi
echo "Local installation checks do not verify a live Premiere connection."
