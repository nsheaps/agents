router to have a standard interface to query files using jq like syntax without knowing the file type.
Useful for running a query across multiple file of different types (likely generated using `find . -type f -ext js -ext ts` (or whatever the correct thing is)), though generally used to directly query a single file like jq would be.

Also acts as a parent level service controller for the various LSP services from the other xxxq libraries to automatically generate excerpts, summaries, embeddings, etc, so the universal interface also supports similarity or related semantic meaning search. See [mdq-cli/README.md](../mdq-cli/README.md) for details on the language server and query ideas and utilizing summarys and extracts.
