I see very few tasks committed to your repo. That could mean:

1. the auto-commit isn't working
2. you aren't breaking down the tasks like the task-utils plugin tries to force you to do
3. The blocking mechanism that forces you to use a task before you can use any MCP tools or any write/edit tools isn't stopping you
4. the scope of each Task is growing and growing rather than you making new tasks for new scope

In addition to fixing that before you continue further in the project, please also:

1. convert the existing tasks from json to yaml and update in the repo
2. update the mcp server to write them in yaml instead of json
3. if there's no plugin-dev plugin in agents, make it
4. add this to plugins/plugin-dev/skills/data-storage-using-filesystem/SKILL.md (usable for mcp, hook, and skill development, and also relevant to the nsheaps/agents ecosystem):
   1. When storing data in the file system, prioritize these things:
      1. keep files small. Smaller files are easier to grep, easier to generate embeddings for, smaller in context when they get read, and suffer less from many agents trying to write to the same file at the same time (agents must read before writing and if another agent updates it between, they have to reread again)
      2. always store metadata using yaml in frontmatter
         - If the file isn't a markdown file, use that file's relevant comment block or single-line comment to store frontmatter at the head of the file (after the shebang if one exists)
         - If the file already has header info at the top, convert it to frontmatter
         - always define the schema of your frontmatter document to keep the fields consistent
           - don't be afraid to add other fields to the frontmatter that might help, but note that if it's not declared in the schema, it's likely to not be queryable and only seen when fetching the document
      3. Whenever possible, store data as structured data, even if the values are freeform
         - structured data is easier to query using tools like yq and jq
         - always prefer:
           - for storing data:
             - YAML
               - supports comments
               - is generally human readable, parseable and mutable by programmatic interface using ast tools
               - Can contain multiple documents in same file
               - Supports references to shared elements in the document
               - YAML is an extension of json, so JSON can be directly used in yaml
               - Diffs are much easier to read, even more so with whitespace support.
               - Supports cyclical references? Maybe not a good thing
               - potential cons:
                 - whitespace can take up tokens
                   - should be programmatically queried anyway
                 - "safe" updating involves copying the file, making the change, then replacing it, which doesn’t work well for multiple agents editing it
                   - Use lots of smaller files
                   - Use ast find replace in-file with edit confirmation, edit in-place, check diff correct. Don’t use jq/yq/”safe” mechanism, instead write and validate write with retry mechanism, or a lock, or use lsp server to orchestrate writes based in queries submitted via api
                 - For APIs or file data storage schemas that use a line return to separate RPC calls (such as MCP), yaml must be converted to JSONL first
                   - Consider writing our own data store in our own file format, separate from the other store (either scan the other store for updates using a cursor to prevent an entire re-scan, or hook into the same events and write our own files)
               - If source type is JSONL, consider yaml file to be a list of items, with no key, like:  
                 \`\`\`  
                 \- item:  
                  thing: true  
                 \- item2…  
                 \`\`\`
               - If source type is JSONL consider whether to store each item as a single row (closer to JSONL formatting, better for streaming message by message, since a fully formatted yaml doc line returns don’t delimit objects, but at that point maybe just dual write jsonl, no point in the yaml doc just being the jsonl doc with \`- \` prefixes on each line) versus formatted (easier to read the file directly)
             - JSON5 with proper formatting
               - Also supports comments and ast parseable
               - Cons:
                 - Comes with syntax overhead for data structure (but spacing matters less)
                 - Less readable
                 - String escaping is confusing, especially with regular expressions, and doesn’t match JS.
             - CSV or TSV
               - Can be useful in log-streaming style applications, though is quite similar to toon/tron, which support more complex data structures and classes
             - Markdown with frontmatter
               - Document allows for freeform text data
               - Frontmatter allows for structured yaml to define programmatic access
               - Markdown (as well as others) is convertible to other structured data using tools from nsheaps/agents (tbd)
             - JSON
               - Sometimes required for support… but isn’t very free form or expressive for notes
             - RARELY
               - [TOON](https://toonformat.dev/)/[TRON](https://tron-format.github.io/) (not wide enough support)
               - XML/HTML (except sources)
               - Sqlite db
           - For streaming data, consider having tool outputs to agents and their mechanism for querying and writing data to accept the [TOON](https://toonformat.dev/)/[TRON](https://tron-format.github.io/) serialization format
             - Most data serialization types that are readable have some overhead on token usage
             - Most that focus on size are not readable
             - Most that focus on explicit structure are not readable and have higher token usage (to account for the syntax)
             - Most lose typing beyond the builtin primitive types and rely on data structure rather than classes
      4. Whenever possible, store the data in known paths on the filesystem, or paths that are built using well-known environment variables. Avoid variability unless necessary, and if it is, make sure it is easy to find the right data.
      5. Keep data storage in sync with remotes (caches/persistent storage)
         - Always keep fetching upstream storage for files, so your edits are always made with edits from other sessions in mind
         - As soon as possible, after edits are made (individually), be sure to sync the files to shared storage if applicable, handling conflicts immediately as they come up using a sub agent (which should be baked into the plugin you make, not plugin-dev, so the plugin works properly without knowing how to make the plugin).
         - Consider using network file storage instead of synced storage
         - If possible, prefer a daemon running as an mcp to (a) write changes as soon as they’re made, (b) sync in background rather than making it a responsibility of the agent changing the data
         - Data syncing should be transparent to the agent, and if possible not managed by claude at all (eg use k8s volume mounted on container rather than agent setting up the nfs mount themselves)
           - Data storage plugins for non-fs-based storage may directly use APIs on updates rather than storing locally, but must provide a good mechanism for agents to grep through all documents and excerpts on the remote (eg a central hosted doc store). For this reason, perhaps let the agent query docs using mcp as well. nsheaps/agents will have a universal query interface for jq like queries on any structured data file type (including markdown)
      6. Should ALWAYS be updated programmatically if possible. Update using hooks, a background server that’s watching something/polling for something, etc. You should almost never use an agent to update the data storage, and if you do, it should be through tools rather than direct file access. Agents should \_ONLY\_ be used if the data writing mechanism auto-retried a configurable number of times and failed every single time, though failures (of the whole attempt and each retry) should be echo’d back to the agent so they understand why it fails and if launching an agent would even be helpful to resolve (eg writing the data but failing to commit \+ push is an access/config issue, not resolveable by the agent by themselves)
5. Use the skill to help you make changes to task-utils to ensure tasks are written to file and instantly synced to github, and a throttled pre-tool-use hook pulls down any changes (rejecting the tool call if there’s conflicts such as two tasks with the same number)
6. Push those changes to the branch and validate the plugin yourself (restart if necessary, fix if validation fails and re-validate, fix each item iteratively, validate it’s fixed before moving on) by making some tasks and verifying they show up on github (use git to see that they were auto committed and pushed, and gh to query the api to see them on the remote, without you lifting a finger). Make any adjustments/improvements to it, like better commit messaging (no agentic commit message generation, only programmatic), revalidate, iterate until it works well, make sure all tasks in your folder are tracked and pushed and stored in yaml and no json tasks exist anymore
7. Keep going with the project once you are in this state. If you need to restart, go idle and I’ll re-trigger you (your last message should say why you’re going idle)
