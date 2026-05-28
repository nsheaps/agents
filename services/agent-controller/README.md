the controller of the agent's terminal sessions and launch of its agent harness(es) on this machine.

- is the "only" way for the agent to communicate to the rest of the agent cluster (via agent use of agent-mcp-service)
- communicates directly with agent-cluster-controller to communicate with other agents, never directly
- if not running when agent runs (eg claude code web), it is run by the mcp service and daemonized.
  - Runs with a similar mechanism to `mcp daemonize` to run a single copy on the host, which then exits when all of it's clients exit.
    - `mcp daemonize` would handle the launch and exit of the agent-controller (through agent-mcp-service, just using shared code, utilizing `mcp daemonize` programatically)
  - If run outside of the agent, it continuously runs and tries to ensure the agent is always up and running. If the agent is not running, this communicates the health to other relevant services
    - agent-controller would either be run by:
      - systemd - with the service being managed/started by agent-system-controller
      - k8s Service - with the service being managed/started by agent-k8s-controller
      - a directly spawned/daemonized service launched by agent-system-controller.
- only one per agent per host. Sub-agents and teammates launched by the agent only get their own mcp service, not the agent-controller itself
- helps with being a central point to collate logs for export or writing to disk to help limit file contention
- responsible for ensuring the agent harness is always running, and a tmux session is available to launch shells in. If the agent harness (like claude-code) is not already running, it is launched inside the tmux session. The tmux session gives the agent access to interactive shells (through agent-mcp-service tool launch_shell() which creates one that expires), as well as the ability to launch teammates (currently in claude's agent-team mode, but will be abstracted later).

consider:

- This is what's used in the agent cli to run the agent and configure it
- this could also run as a service before the agent harness is run, and the agent can connect over https for channel notifications
  - it could also be used as a proxy/to set up litellm for each agent [^reason-needed compared to central instance] (eg to mutate messages being passed back to the agent).

- always try to wrap the agent execution when in a controlled environment by forcing agent-controller to control the agent harness itself, allowing for more direct access into the controlling of the agent environment
  - however, if this isn't possible (eg running in claude code web)
