these are things we build/package/distribute to people which then run and exit, things like cli tools.

These things run and exit, and are not persistent services, but they can manage the service state (eg start/stop) and delegate to them through IPC, (eg when running `agent-team enable jack` = `agent-team-cli` ensuring `agent-team-controller` is started, and that the agent team controller has the `jack` agent enabled, before exiting, eventually consistent, like k8s).
