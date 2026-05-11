an mcp server used to inform the agent of system status, and inform the system (and agent-team framework)
also responsible for communicating with agent-team controller( or the api?) to show status on the web UI

consider:

- This is what's used in the agent cli to run the agent and configure it
- this could also run as a service before the agent harness is run, and the agent can connect over https for channel notifications
  - it could also be used as a proxy/to set up litellm for each agent [^reason-needed compared to central instance] (eg to mutate messages being passed back to the agent).
