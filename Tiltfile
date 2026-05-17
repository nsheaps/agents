# basic setup
analytics_settings(False)

watch_file('./mise.toml')


# tilt docs: https://docs.tilt.dev/api.html

# Run postgres in docker (needed for litellm, TODO, move definition to services/dev-postgres)
# docker_compose('./services/dev-postgres/docker-compose.yaml')
docker_compose(
  './services/dev-litellm/docker-compose.yaml'
)
# # Run a litellm proxy - native, not in docker (TODO, move definition to services/dev-litellm)
# # https://docs.litellm.ai/
# local_resource('litellm',
#   # build
#   # cmd='mise use \'pipx:litellm[proxy]\'',
#   # serve
#   serve_cmd='mise exec -- echo "\n\nstarting litellm" && litellm --config ./litellm_config.yaml --detailed_debug',
#   serve_env={
#     "MISE_DEBUG": "true",
#     "MISE_VERBOSE": "true",
#     # port 4000 is default but some other services use that by default
#     "PORT": "14000",
#   },
#   # start when 'tilt up'
#   auto_init=True,
#   # auto-restart when changes detected
#   trigger_mode=TRIGGER_MODE_AUTO,
#   # run alongside other resources
#   allow_parallel=True,
#   # add links to tilt UI to get to the service UI
#   links=[
#     link('http://localhost:14000/ui', 'ui')
#   ],
#   readiness_probe=probe(
#       period_secs=15,
#       # https://docs.litellm.ai/docs/proxy/health
#       http_get=http_get_action(port=14000, path="/health/readiness")
#    ),
#   labels=['99_infra'],
#   deps=[
#     # if this file changes, restart the litellm resource
#     './litellm_config.yaml',
#   ]
# )
