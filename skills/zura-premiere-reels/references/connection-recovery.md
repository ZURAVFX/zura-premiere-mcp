# Premiere MCP connection recovery

Read this only when Premiere MCP tools are missing or a live connection check fails. Prefer the MCP diagnostics over UI guesswork.

## Distinguish the three states

- **Tools missing from this chat:** Check `codex plugin list` for the enabled `zura-premiere-reels` plugin. Its server may also appear in `codex mcp list`; do not remove or re-add it with `codex mcp` commands. Plugin tools load when a chat starts. If the plugin is enabled, use a fresh Codex chat. If setup is incomplete, invoke the `setup-zura-premiere-reels` onboarding skill.
- **Tools loaded, connector not live:** Call `verify_premiere_connection`, then use the returned diagnosis and `get_bridge_telemetry` if available. `--doctor`, installer output, or a panel status does not prove the MCP can reach Premiere.
- **Live connection verified:** Continue with `get_capabilities` and the supported project operations. Recheck after any restart or connector change.

## Windows bridge directory

The supported private per-user path is `%LOCALAPPDATA%\Adobe\PremiereProMCP\bridge` (usually `C:\Users\<user>\AppData\Local\Adobe\PremiereProMCP\bridge`). The default `%LOCALAPPDATA%\Temp\premiere-mcp-bridge` was rejected on the observed machine because its ACL granted write access to untrusted identities. This validation is intentional: the CEP panel executes commands from the bridge as the logged-in user.

Use the installer and connector's validated secure path. Never weaken ACL checks, grant broad write access, or manually relax directory permissions. An already-installed CEP panel can retain its old Temp path after the MCP default changes. If diagnostics show this, use the supported connector setting to select the secure per-user path, save it, and start the bridge only if it is stopped. Then verify the connection from the MCP. Do not infer success merely from the field value or “Connector running” status.

If a restart is required to load a newly installed CEP extension, first save the user's Premiere project. Do not restart a session with unsaved work.

## Computer-use limits during recovery

Computer use is a fallback for one essential UI step, not the normal Premiere editing method. Follow the installed Computer Use skill's target selection and observe/act/refresh rules.

- A Windows Firewall or other security prompt must be handled by the user. Do not click Allow, Cancel, or otherwise act on the prompt, and do not bypass it through another tool.
- In one observed session, the CEP panel was exposed as a child `CEPHtmlEngine.exe` window titled `Chrome Legacy Window`, while Computer Use targeted `Adobe Premiere Pro.exe`. A Save-button click failed with a non-target-window error at point `(-105, 558)` even after refreshing and one retry. The connector panel was not separately returned by `list_windows()` in that session. If the same boundary appears, stop UI attempts and report the exact error; do not use repeated coordinates, an improvised driver, shell commands through UI, or DOM injection.
- If this chat lacks Premiere MCP tools but the server is registered, use a fresh chat rather than trying to perform a large edit through the Premiere GUI.

## Recovery checklist

1. Preserve the open project and confirm whether it is unsaved.
2. Determine whether the fault is missing chat tools, a stopped CEP bridge, or a rejected path. Do not treat them as the same failure.
3. Make only the supported correction indicated by the diagnostics. Avoid repeated installs and speculative restarts.
4. Re-run `verify_premiere_connection`; only a successful live result confirms recovery.
5. Record the verified state and remaining blocker in the project handoff.
