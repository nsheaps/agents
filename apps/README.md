these are things we build/package/distribute to people, things like cli tools.

These things run and exit, and are not persistent services, but they can delegate to them, (eg when running `agent-team enable jack` = `agent-team-cli` ensuring `agent-team-controller` is started, and that the agent team controller has the `jack` agent enabled, before exiting, eventually consistent, like k8s).
