# Upstream provenance

This repository is the ZURAVFX-maintained [Zura Premiere MCP source](https://github.com/ZURAVFX/zura-premiere-mcp), derived from [leancoderkavy/premiere-pro-mcp](https://github.com/leancoderkavy/premiere-pro-mcp), based on commit `3b433ad34daaad66a03bacd846d92feb18187916` (the upstream `main` snapshot used for this work).

The upstream repository's MIT licence and copyright notice are retained in [LICENSE](LICENSE). Upstream tool code and documentation remain subject to that licence. This fork adds a Windows per-user bridge default with migration from the old Temp default, plus a local installer for the server and Premiere connector.

The local setup installs this checkout's built MCP and CEP connector, then registers the server with the selected client. The upstream npm package and upstream GitHub repository are not modified by this fork.
