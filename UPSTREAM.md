# Upstream provenance

This repository is the ZURAVFX-maintained [Zura Premiere Reels source](https://github.com/ZURAVFX/zura-premiere-reels), derived from [leancoderkavy/premiere-pro-mcp](https://github.com/leancoderkavy/premiere-pro-mcp), based on commit `3b433ad34daaad66a03bacd846d92feb18187916` (the upstream `main` snapshot used for this work).

The upstream repository's MIT licence and copyright notice are retained in [LICENSE](LICENSE). Upstream tool code and documentation remain subject to that licence. This fork adds a Windows per-user bridge default with migration from the old Temp default, plus the `premiere-reels` Codex skill and installer.

The local setup installs this checkout's built MCP and CEP connector, then registers the server with Codex. The upstream npm package and upstream GitHub repository are not modified by this fork.
