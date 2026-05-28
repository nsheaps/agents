a tool for everything mcp

- `mcp dummy-exec -- ...` - a `mcp-dummy-service` launcher designed to run the specified process at start (either exit or continue running), that handles graceful termination of the script when signals are recieved
- `mcp daemon -- ...` - a `mcp-proxy-cli` (service?) launcher that acts as a stdio mcp server proxying to a single-instance, started-when-needed, exited-when-not, mcp server, daemonized by `mcp-daemon-service`, which uses shared code with the `daemonize-service` but instead of just making sure it runs, it proxies the mcp server back to the mcp client (including multiple clients). Expects an stdio interface for the mcp server it runs
  - basically mcp-daemon-service turns the mcp server into a streamablehttp service and mcp-proxy to provide the stdio interface to the client and proxy to the single instance streamable https instance
- Useful for
  - heavy mcp servers where you only want one instance to run
  - re-using mcp servers across plugins without running them multiple times, even if their mcp server name is different
    - The mcp server gets de-duped by name within the same session, but across sessions on the same instance you'd have multiple, which would definitely be bad for things like a discord plugin where messages only get sent to one websocket consumer
      - Note if you scale your agent horizontally across systems, you'll need to set up an `agent-event-service` to recieve your webhooks and proxy them to the agent. Services like smee.io allow a single webhook endpoint and multiple clients to connect to it and recieve the same messages
        - OR.....maybe mcp server is a smee.io client instead of a websocket client anyway and we don't run the webhook reciever at all
          - or we run our own smee instance and we continue the smee pattern without public infra
- Re-use the same mcp server name between plugins to ensure the proxy also doesn't get duplicated
- Use the agent-name in the name of the service to have one per agent with agent-specific configs (pass env file to source)

need to find out

- channel behavior when multiple clients
