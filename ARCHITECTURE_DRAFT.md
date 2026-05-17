NOTICE TO AGENTS: KEEP THIS UP TO DATE! AS STUFF GETS BUILT OUT KEEP SPECS IN THE RESPECTIVE SERVICES AND USE THIS AS A TABLE OF CONTENTS/INDEX/GLOSSARY

# naming

**agents** was the first name but maybe that's too generic to be used in casual conversation. Other options:

- agntq (agentic)
- ...add more...
  previously was also called:
- **aitkit** (like ettiquite)

**ai-mktpl** was the first marketplace for sharing plugins publicly. The agents project quickly spawned other repos and eventually was morphed into this monorepo for simplicity. It may come back later to share public plugins that are usable outside of this agent system.

# suffixes

**-controller**:

- this service is purely something programatic, not agent based.
- manages an interface between the thing it describes in its name, and the thing it is responsible for (running)

**-service**

- this provides an interface between the system and the outside world
- typically used for things you'd fetch as an end user, like webpages or APIs
- typically interacts with other controllers

**-cli**:

- an application (typically distributed) that may perform some work and exit, or provide a tui management interface to running controllers
- may continue running if acting as a tui tool and streaming output but does not handle stdio like an mcp server
- eg `agent start --agent=alex` might:
  1. If running on a vm
     1. If the default cluster is selected (the host machine)
        1. it might check for (and start if not started) the agent system controller
        2. Ask the system controller to check for (and start if not started) the agent-controller for the `alex` agent.
     2. If configured for a remote cluster (like k8s)
        1. it would use the configured api endpoint <!-- TODO: should the system controller have the same interface? should the system controller run a cluster controller? --> to ask to ensure the `alex` agent is started.

**-manager** - an agentic implementation that helps with the maintenance

# general architecture mantras

- always prefer programatic execution over agentic execution
  - agentic execution should prefer agentic-development-of-static-programatic-execution-scripts-then-programatic-execution style, rather than the agent always doing work itself manually and with different scripts each time
- controllers work towards a defined state (X-as-code) in an eventually consistent model, like (and later to be used as) kubernetes controllers
- controllers have a reconciliation process that detects and fixes issues to the best of it's ability
- controllers have apis that enable CRUD of the resources
  - When a resource is changed, the state defining the intended state is changed first, then the change is immediately made
  - if reconciliation later runs and finds the system to not be in the desired state it uses the same logic for achiving the state as it did when the crud method was called
- controllers have APIs for querying the state from other services. Those services should use the APIs to get the state, rather than reading the shared resources.
- always provide interfaces. Don't let one thing directly mess with each other without a defined interface. This means:
  - All data is fetched from controllers/services using apis, except those that are sources of truth which directly access data stores
  - agents do not directly mess with each others consoles
- mcp servers provide the tools but skills tell you how to use them and agents encapsulate their use
- background processes:
  - you can do things on hooks, but they get fired extremely frequently, so they need to be throttled/debounced
  - Use `mcp-daemon-dummy-service` to run a process while an agent is running (via `mcp daemonize --dummy -- ...`)
- on VMs, the system controller can either (a) run the cluster controller and run everything, (b) run just a subset of services (eg web service lives elsewhere, this vm is just for an agent)
  - (?) should the controller "run other services" in a process tree or just manage the systemd services (preferred)
- All configs should be preferred in yaml
  - but overwriteable with env vars
    - env vars are well documented in a page specific for just the vars and how they should be used
      - each env var should link to at least one other help doc talking about this
        - this should be programatically validateable
- (?) is this process structure _too_ hierarchical and verbose?
- crons should launch skills, not contain instructions — the skill is where the logic lives and evolves; the cron line stays a one-liner. (Per handler directive 2026-05-17, after the 45-line inline self-poll prompt was hoisted into [`alex's idle-5-min skill`](https://github.com/nsheaps/.ai-agent-alex/blob/main/.claude/skills/idle-5-min/SKILL.md))

## controller/service run modes

Some controllers/services can be used in multiple ways

- **systemd service**
  - Runs when the machine starts, regardless of user login
  - systemd handles log aggregation/rotation
  - systemd handles ensuring service is restarted on failure
  - when a service is daemonized, it is generally delegated to systemd to handle
- **forked daemon**
  - In some cases (like in dev or a container), a process is launched and disowned to run in the background on systems that do not have systemd
    - (?) in dev, maybe agent-system-controller can handle running services without systemd?
- (logical) **container entry point**
  - 'Logical' as in outside of the typical suggested container init best practices
  - environment is treated as ephemeral, even if data is persisted using volumes
  - When container starts, service is run in the foreground
  - When service exits, container exits. Controllers are responsible for restart if needed
  - General best practice: don't have an additional restart layer inside
- **foreground service**
  - generally only for development or being run inside of a container
  - (?) should we prefer
- **mcp server**
  - should use resources to allow querying of the objects (over mcp tools)
  - should try to sync data locally for querying or at least caching instead of api calls all the time
  - **daemonized** mcp server
    - uses the mcp-daemon-controller to ensure a single copy of the mcp server is running
  - mcp server **with channel**
    - uses channels in the agent harness to inject messages into the agent, even when idle
- **k8s controller**
  - runs as a container in a k8s cluster responsible for using k8s apis to launch other resources (like other controllers)

### agent harnesses

- (default) claude-code
- qwen-code
- opencode
- pi
- hermes
- copilot
- ...

### environment contexts

- **Virtual Machine** (ec2 instance, proxmox vm/lxc, etc)
- **Containerized**
  - **Docker** (via docker-compose)
  - **Kubernetes**

### environment runtimes

- **docker** system daemon
- **docker-desktop**
  - **kubernetes** in docker-desktop
- **native/systemd**
  - When a process dies here, systemd will try to restart it
- **native/tilt**
  - when a process dies here, tilt will restart it
  - (?) should tilt support a mode where it interacts with systemd to launch the service then stream the output?
- **native/foreground**
  - When a process dies here, nothing will restart it

# services

TODO: make a mermaid diagram explaining the layout of these

agent-system-controller:

- for use on VM (or LXC but not container) based environments where agents need to know about
  - only ever one on the system
  - (?) doesn't communicate across systems
- event bus for system events like:
  - updates available, a new agent was launched on the same system
- makes the current system try to achieve the desired state.
- Responsible for running configured services. Generally `agent-cluster-controller` or one specific controller
- Manages it's responsible services and controllers either through direct process management in a reconciliation loop (but event based so things like immediate exits are handled without waiting for reconciliation)

agent-cluster-controller:

- manages the agents themselves, abstract from the system it runs on
  - if running in k8s, uses k8s to manage controllers
  - else uses systemd
- Responsible for running (in the configured environment context):
  - 0.. `agent-web-service`
  - 0.. `agent-api-service`
  - 0.. `agent-controller`
  - 0.. `agent-team-controller`
    - not agents within a team, thats for the team-controller
      - If an agent moves from system level or between teams, it is spun down first, then spun up in the correct context, with coordination from a system or a cluster controller
- can be set up to run their controller children as native processes, systemd services, or as containers
  - containerized environments should be treated as ephemeral, setup must be managed through Dockerfiles and persistance managed through volumes and external services

agent-team-controller:

- responsible for running:
  - 0.. `agent-controller`
- only 1 on a system, but 1 or more in a containerized environment
- uses redis to coordinate across controller instances (potentially in other clusters) to achieve HA
- In rare instances (whether run as a systemd service/native process/container), this controller can launch ephemeral VMs (proxmox, virtualbox, etc), and those vms inside have a system-controller running an agent-controller

agent-controller:

- systemd service/(logical) container entry point/daemonized service/foreground service/daemonized mcp server with channel
  - 'Logical' as in outside of the typical suggested container init best practices
- If host has agent-controller running for that agent already, it fatally exits
- If run as an mcp server
  - it connects to the wrapper to act as a mechanism to pass messages into the agent harness
  - provides the tool interface for managing this agent
  - if role is correct, also provides tool interface for managing other agents (basically same interface as agent-cli)
  - (?)maybe it shouldn't be? maybe the mcp server should be a separate `agent-controller-mcp-service`?
- external controllers use this to query the state of the agent rather than direct inspection or reading a potentially stale state from db
  - for example
    1. browser app page for viewing agent tasks
    2. agent-api-service read tasks for agent
    3. api-service talks to cluster controller
    4. cluster controller talks to agent (does not need to talk to team controller)
    5. agent controller responds with active task list
       - (?) maybe reads tasks from disk, maybe tracks in memory via hooks, maybe intercepts and/or replaces built in task system.
       - decision: service stores state in memory, apis serve dirty cache data. Reconciliation process corrects cache data over time. Api calls correct data in real time
         - Example: counting subagents
           - Reconciliation process: review all subagents for the current session, count the total, and count how many have completed. The difference is the active number
           - real time process: On hook for SubagentStart increment the count and hook for SubagentStop decrement the count (and possibly maintain an in memory map for the active subagents, not just a count)
         - This means that all metrics must be calculable by the reconciliation process _AND_ support realtime updates (realtime updates can just kick off the reconciliation process async, but are encouraged to make minimal, targeted changes, not full recalculations)
- If run as a service (foreground or daemon), it is responsible for running the appropriate agent harness and starting the agent (and exposing a streamable http mcp endpoint for the mcp server to connect to later) - If run as a container entry-point, this is the **SERVICE** not another k8s controller. This runtime would be the agent itself
  mcp-daemon-controller:
- runs as an systemd service/forked daemon (in containers/(?)dev)
- if forked
  - watches pid files, when no pid filex exist, it exits
- if systemd service, stays running even after agent exit (as long as the controller is running)

mcp-daemon-base-service:

- is an mcp server
- when run as an mcp server
  - creates a pid-lockfile
- if the mcp-daemon-controller isn't found, it is started (forked)
  mcp-daemon-stream-service:
- extends mcp-daemon-base-service
- is an STDIO <=> Stremable HTTP proxy to the daemonized MCP server run by the mcp-daemon-controller

mcp-daemon-dummy-service:

- extends mcp-daemon-base-service
- used has no tools or capabilities or resources
- used to wrap around another service that you want to keep running while the agent is running (eg something to constantly refresh auth tokens)

agent-web-service:

- serves the web UI
- in dev, might proxy the api service

agent-api-service:

- serves the api, interfaces with all other controllers through their apis

mcp-cli:

- subcommand `mcp $serverName inspect ...`
- subcommand `mcp $serverName export [tools|...] ...` -- exports all info from the mcp server as structured yaml files, like:
  - Tool info
  - Resources
  - capabilities
  - etc
  - Can be considered for use in a `--bare` session to generate tool info
  - think of it as a run-once, strucutred data export of inspecting
- subcommand `mcp daemonize [--dummy] -- <command to daemonize>`
  - if the mcp-daemon-controller isn't running, it starts it (forked)
  - if `--dummy`, `exec` handoff to `mcp-daemon-dummy-service`
  - else `exec` handoff to `mcp-daemon-stream-service`

agent-cli:

- (?) maybe instead of `--name` the second arg should be the agent's name?
- subcommand `agent $name pull` - pulls changes from agent repo
  - (?) if conflicts, launches agent?
- subcommand `agent $name push` - pushes changes to agent repo
  - (?) optional "launch agent and use `/scm-utils:commit and push`"?
  - (?) should this be needed at all? maybe as a handy utility?
    - changes to agent repos should be almost immediately committed and pushed
    - agent repos should be frequently polled and pulled for updates
- subcommand `agent $name enable` - enables service run at startup
- subcommand `agent $name disable` - disables service run at startup
- subcommand `agent $name start [-f/--foreground] [--auto-start]` - starts the service
  - if `--foreground`, `exec` handoff to `agent-controller`
  - else depending on cluster config:
    - (default) look for agent-system-controller and have it start the agent
      - if not found and `--auto-start`, warn and start agent-system controller
      - elif not found, fatal error
    - (remote) use base api url to ask agent to be started
      - (?) should `agent-api-service` always be used to do the start/stop rather than direct IPC or API call to the system controller?
- subcommand `agent $name restart`
- subcommand `agent $name stop`
- subcommand `agent $name status [$subsystem]`
  - if no subsystem provided gives
- subcommand `agent $name logs [-f/--follow] [-l/--limit=<n=10>]`
  - if following `exec` handoff to ~~`agent-stream`~~ (doesn't exist yet) `claude-stream`
- subcommand `agent $name stream` - alias to `logs -f`
- subcommand `agent $name attach [-n/--no-reconnect]`
  - attach to that agent's tmux console. If it exit, show a spinner waiting to reconnect with status (retrieved from the appropriate controller)
    - except `--no-reconnect`, which would just exit when the agent tmux pane exits.
  - Just like `bin/attach-agent` right now
- subcommand `agent add $name $source`
- subcommand `agent remove $name`

# Open Questions

Q1: should we move the bin/agents script to here then do the ts migration or just directly build the CLI in TS and migrate to that (so we can go back and forth and test till feature parity) — Nate, [Discord 2026-05-17 13:53Z](https://discord.com/channels/1490863845252665415/1497431286661517353/1505568913230921821)
