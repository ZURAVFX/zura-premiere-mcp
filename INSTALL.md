# Install Zura Premiere MCP

On Windows, open this repository in Codex and ask it to run `INSTALL-ZURA-PREMIERE-MCP.ps1`. The installer checks for Node.js, installs the local MCP and Premiere panel, and registers the server with Codex. It may install Git or Node.js LTS with WinGet if a prerequisite is missing.

Restart Premiere Pro if it was open during installation, then start a new Codex chat. Premiere Pro must already be installed and licensed.

On macOS (Intel or Apple Silicon), install Node.js 20.19 or newer and the Codex CLI, open Terminal in this repository, and run:

```bash
bash INSTALL-ZURA-PREMIERE-MCP.command
```

This builds and installs the server for the current user, copies the Premiere CEP panel into `~/Library/Application Support/Adobe/CEP/extensions/MCPBridgeCEP`, enables unsigned development extensions, and registers absolute Node.js and server paths with Codex. No administrator access is needed. Restart Premiere if it was already open, then choose **Window > Extensions > Zura Premiere MCP** and open a new Codex chat.

Use `--skip-codex` for another client, or `--plugin-managed` when an integration owns registration. Both leave Codex configuration unchanged and print an absolute-path configuration. Run the installed entrypoint with `--print-client-config <claude|cursor|vscode|codex>` for your client. The terminal commands continue to work when the repository or user name contains spaces.

Installation diagnostics verify local files and CEP settings. A running Premiere panel and a successful connection check are still required before editing.

For manual setup, use [the README](README.md#source-setup). The local MCP command is `zura-premiere-mcp`.
