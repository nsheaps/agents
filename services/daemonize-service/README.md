Runs a script specified in the args (and relaunches if exits) once and only once, even if multiple instances of this service are running.

Useful for agents to run a service using `mcp daemonize` to have just one running and get results to all sessions

Expected to be ran itself as a daemon (not a child process of the process that launched it), else it and it's children will exit when its parent process dies.
`daemonize` cli is the cli component to it. When `daemonize --name="my-shared-service" -- ...` is called, it ensures `daemonize-service` is started and forked properly, and stays up as long as the caller of `daemonize` is up, but `daemonize-service` may continue running if there's other `daemonize` cli clients still asking for my shared service.
