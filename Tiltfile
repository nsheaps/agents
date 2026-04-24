# Tiltfile — root orchestration entry point
#
# Usage:
#   tilt up                   # start all agents
#   tilt up alex              # start only Alex
#   tilt up jack henry        # start Jack and Henry
#   tilt down alex            # stop only Alex
#
# See docs/specs/tilt-orchestration.md for architecture overview.

load('./tilt/agents.tiltfile', 'register_agents')
load('./tilt/logs.tiltfile', 'register_logs')

register_agents()
register_logs()
