# Tiltfile — root orchestration entry point
#
# Usage:
#   tilt up                   # start Tilt daemon; reads agents.yaml
#   tilt down                 # stop all resources
#
# Agent lifecycle is controlled via agents.yaml (enable/disable agents there).
# See docs/specs/tilt-orchestration.md for architecture overview.

load('./tilt/agents.tiltfile', 'register_agents')
load('./tilt/logs.tiltfile', 'register_logs')

register_agents()
register_logs()
