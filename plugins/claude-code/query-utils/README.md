All sorts of utilities for querying data

This plugin is the primary touchpoint for agents to use \*q cli tools like:

- jq
- yq
- toonq / tronq

Generally the usage is through `sdq`, rather than individual tools, but that's abstract from the agent

Since we want them to use a unified interface, we use hooks to reject the use of the cli tools directly, and enforce their use through mcp tools. This also allows us to generally provide a synchronous interface with a timeout that backgrounds it in the MCP service and notifies of results later via channel
