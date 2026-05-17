All the runnable things, including docker services and mcp servers, not just web and apis. Also would contain pieces like service worker entry points.

Generally a shell around a package (from the packages/ folder) that actually contains the server logic. Consider this the infra layer.

Service folders that contain a `service.tilt` are enable-able/disable-able for tilt.
