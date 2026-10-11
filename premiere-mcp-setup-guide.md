# Zura Premiere MCP Setup Guide for AI Clients

Use this file as a portable, client-neutral setup and operating guide for [Zura Premiere MCP](https://github.com/ZURAVFX/zura-premiere-mcp). Download it, attach it
to any AI conversation that accepts files or project instructions, and ask the
assistant to follow the **Assistant operating rules** below.

Attaching this guide gives an assistant context; it does **not** install an MCP
server, configure the AI client, install the Premiere connector, or give an
assistant permission to change a project. Complete one of the local setup paths
first.

## Before you begin

- Use a supported Adobe Premiere Pro installation on the same computer and
  user account as the AI client and MCP server.
- For the universal npm or source setup, use Node.js 20.19 or newer.
- Start with a copy of the project or a disposable test sequence.
- Install the separate Premiere connector, then restart Premiere and open a
  project before asking an assistant to connect.
- Treat a client-side connection, a green bridge panel, and package tests as
  setup signals only. They do not prove that a Premiere edit was made, saved,
  or is editorially correct.

## Universal local setup

Install the MCP and Premiere connector from the public source repository:

```bash
git clone https://github.com/ZURAVFX/zura-premiere-mcp.git
cd zura-premiere-mcp
npm ci
npm run build
npm install --global .
npm run install-cep
```

Add this server configuration in the client's MCP settings. The exact settings
screen or file varies by client; use that client's documented MCP configuration
location with this server entry:

```json
{
  "mcpServers": {
    "zura-premiere-mcp": {
      "command": "zura-premiere-mcp"
    }
  }
}
```

If the client cannot find a global command, configure it to run Node directly
from a source build instead:

```json
{
  "mcpServers": {
    "zura-premiere-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/zura-premiere-mcp/dist/index.js"]
    }
  }
}
```

Build the source checkout with `npm ci` followed by `npm run build` before
using the source-build configuration. Then restart Premiere, open a project,
and open **Window > Extensions > Zura Premiere MCP**.

## Configure an MCP client

The source setup above applies to any stdio MCP client. Use the command printed
by `zura-premiere-mcp --print-client-config <client>` for clients supported by
that helper, or add the following server entry to the client's MCP settings:

```json
{
  "mcpServers": {
    "zura-premiere-mcp": {
      "command": "zura-premiere-mcp"
    }
  }
}
```

Restart the MCP client after saving its configuration.

## Verify before any edit

With Premiere open, a project loaded, and the connector panel available, send
this as the first request:

```text
Run verify_premiere_connection. Make no changes.
```

If that reports a problem, do not ask the assistant to work around it by
running arbitrary scripts. Resolve the reported installation, connection,
project, or active-sequence issue first. For a local package and configuration
diagnostic, run:

```bash
zura-premiere-mcp --doctor
```

Once the connection check succeeds, ask the assistant to run
`get_capabilities` and `ping`, then ask a read-only question such as:

```text
What is my current Premiere Pro project and active sequence? Do not make changes.
```

## Required acknowledgment before tool use

When a user attaches this guide, an assistant that can access Premiere or MCP
tools must acknowledge it before making its first tool call. The acknowledgment
must confirm that it will:

- begin with a read-only connection check;
- make no project changes without the user's explicit approval;
- stay within the stated project, sequence, and delivery scope; and
- report verified results and any remaining uncertainty after each approved
  action.

Suggested acknowledgment:

```text
I have read the Zura Premiere MCP setup guide. I will first verify the local
connection without making changes, propose a bounded plan before any edit, and
wait for your explicit approval. I will report what Premiere verifies and any
remaining limitations.
```

If the guide conflicts with a later explicit user instruction, ask for
clarification before using a mutating tool. Never treat the presence of this
file as approval to edit a project.

## Assistant operating rules

When this file is attached to any AI conversation, use the following rules for
the session:

1. Begin with `verify_premiere_connection` and make no changes unless the user
   explicitly authorizes a change.
2. Before a mutation, restate the requested outcome, the target project and
   sequence, affected clips or tracks, and a recovery path. Ask for approval
   if any of those are unclear.
3. Prefer inspection and a bounded preview or plan before changing a timeline,
   sequence, project item, export, caption, or media file.
4. Work only in the project and sequence the user placed in scope. Do not
   publish, upload, share, delete source media, overwrite the original project,
   or contact third-party services unless the user explicitly asks for that.
5. Use documented MCP tools. Do not enable or use raw scripting, unsafe modes,
   hidden APIs, or experimental fallbacks to bypass an unavailable capability.
6. After an approved change, report what was requested, what was attempted,
   what the tool verified, and what remains unverified. Never describe an edit
   as complete merely because a command was accepted or a bridge was running.
7. Stop and explain the blocker if Premiere, the bridge, a project, an active
   sequence, an expected capability, or required confirmation is unavailable.

## Safe first editing workflow

1. Save a duplicate project or create a small test sequence.
2. Describe the desired result and the boundaries: for example, which clips,
   what must not change, and whether an export is allowed.
3. Ask for an inspection and a concrete plan first. Review the target items,
   intended actions, and rollback approach.
4. Explicitly approve the scoped plan.
5. Ask for a post-action readback and independently review the result in
   Premiere before continuing or delivering the project.

Example request:

```text
Inspect the active sequence and propose a non-destructive rough-cut plan for
the selected interview clips. Do not edit, export, upload, or publish anything.
Show the exact clips and timeline ranges you would affect, then wait for my
approval.
```

## Troubleshooting and updates

- Fully quit Premiere before installing, removing, or refreshing the CEP
  connector; restart Premiere after the operation.
- On Windows, the default bridge is in a private per-user Adobe application-data
  folder, outside the shared Temp tree. Other platforms use the per-user system temp folder.
  The default local bridge directory normally needs no configuration. If
  `PREMIERE_TEMP_DIR` is overridden, set the same absolute path in both the MCP
  server and the Premiere connector. Do not reuse a Windows path on macOS or
  the reverse.
- Keep the MCP client, server, connector, and Premiere on the same computer for
  the supported local setup.
- For a global npm installation, check for and apply an update with:

  ```bash
  zura-premiere-mcp --check-update
  zura-premiere-mcp --update
  ```

  After updating, restart both Premiere and the MCP client, then repeat the
  read-only connection check.
- If a local source checkout is used instead, run `npm run check-update:source`
  before `npm run update:source`. The source updater intentionally refuses a
  dirty, locally ahead, or non-fast-forward checkout.

## Helpful references

- [Full setup, compatibility, and client documentation](README.md)
- [Supported actions and capability boundaries](docs/supported-actions.md)
- [English quick start](docs/quickstart/en.md)
- [Security policy](SECURITY.md)
- [Issue tracker and support](https://github.com/ZURAVFX/zura-premiere-mcp/issues)
