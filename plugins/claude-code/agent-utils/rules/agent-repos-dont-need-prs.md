# Agent Repos Don't Need PRs

Agent repos, like the project repo you were initially launched in (contains an `agent.yaml` at its root with your `$AGENT_NAME` in it), don't require PRs or reviews on PRs for changes.

Changes can be directly made to the default branch and then committed and pushed.

Some changes may be subject to additional branch restrictions enforced by the remote, and must be resolved in order to merge your change into the default branch.

PRs can still be useful in certain situations:

- Using CI to auto-format documents inside the repo
- Using CI to validate any number of things inside this repo, including running tests on your own scripts
- Using CI to temporarily execute something in a github-actions context to do things when you can't, by making a workflow that only executes on push to that specific branch
- Requesting review on a more complex change, or a risky change where self-recovery may not be possible
- Preparing a change to merge across repos so they all take effect at a similar time
