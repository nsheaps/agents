Treat markdown documents as structured data and provide a jq-like interface to query their contents rather than scan for them.

Headings become keys
Content becomes bodies
URLs are autoextracted into metadata

Query frontmatter too! frontmatter automatically becomes \_metadata on the returned object

can be used to easily generate TOCs

any list inside the markdown instantly becomes queryable as if it were yaml, including structure...like yaml. Supports -/\*/1./<ul>/<ol>
any table too?
any extractable pairs (like this, when it exists on the line only: - `**thing**: definition` - `other thing with a space = equals something else` -

matching works by raw text as well as formatting-extracted (different stages, removing **B**/_I_/_I_/**U**/~~S~~/<sup>/<sub>) text

AI can be integrated for querying (agentic stuff using abstracted agent harness library within the agents monorepo, with support for multiple agent harness SDKs, like openai, langchain, claude, etc. Start with support for only claude and anthropic embeddings APIs):

<!-- Figure out if SDK or `claude -p` usage can use user oauth or agent key (if claude.ai oauth) so (a) user doesn't need to provide auth, it just works if the auth is set up on the machine, (b) auto detected auth is scoped properly to the user using the tool (eg if the agent uses it, use the agent's token), (c) if using claude.ai coding plan oauth keys allows you to generate embeddings or if you must pay for ai -->

- generate embeddings and do similarity search
  <!-- TODO: figure out if there's a local only similarity search option (like BM25 or whatever), likely need to host a db locally, even if temporary, but better if there's a persistent one. -->
- use llm to generate summaries and semantic meanings, do embeddings on those as well (if graphed, summaries + semantic meanings should be similar to the document they're from as well as other tasks)
- Generate embeddings for doc/excerpts based on hash of doc/excerpt as cache key
- Extract pieces of docs + generated summaries into excerpts
  - if doc is called path/to/myDoc.md, create path/to/myDoc.md.excerpts/
  - Extract each section like so in the naming ($d = doc name without the path, so in this case mydoc, replacing . with - since . is used for pathing when querying, $t = file type suffix, in this case .md). Use html element like names to reference. file names should be legal file names, but [] may be in the name to indicate the array-like-query used to fetch the extracted data. Use frontmatter in all of the generated excerpts to hold metadata that you would query the element by (since the excerpt only contains the contents, if we converted the markdown to html you might have metadata like the xpath to that element, the type of the element, etc. It is somewhat complicated by how headings are treated, since the heading itself is an element, but we also extract the contents within that heading, see examples). Frontmatter for each extract should also provide a tree view of where the exerpt exists in the parent document, essentially a focused table of contents:
    CRITICAL: langchain has tools for breaking down documents into excerpts
    <!-- TODO: needs more work and examples. Spec should be written with exhaustive list of excerpts, and example queries and automated tests to fetch data before implementation begins -->
    - path/to/doc/myDoc.md.excerpts/\_toc.$t - generated table of contents that you'd see, using markdown links to reference the other excerpts
    - path/to/doc/myDoc.md.excerpts/\_toc.$t.sha256 - the hash of this excerpt
      - This should be used as a mechanism for avoiding regeneration of excerpts that are already generated
      - Extracting the bits in memory is fast but slows down at IO, and deleting and recreating is unnecessary
        - instead extract them all in memory and compare the list of what you have vs what you made. If hashes are different, overwrite the hash and excerpt. If generated exists but prev does not, add it. if prev exists but gen does not, then remove prev and it's hash.
        - Hook for claude plugin can run mdq sync or a language server of sorts that is aware of markdown docs getting changed and re-syncs the excerpts.
          - Implementation without language server may launch the language server, load it into memory, make the query then exit
            - Would perf be improved if it was daemonized and shared between background queries? maybe with an idle shutdown and cache timeout (for memory cleanup)?
        - excerpts are duplicative to their sources. They should not be committed to source control, but to put in shared storage (network drive, cache, etc) would be a good idea for all agents to be able to search. Compression would likely make it fast to compress and download, but a direct network access (or background sync with graceful exit to ensure fully synced before shutdown) might be better.
    - path/to/doc/myDoc.md.excerpts/h1[0].$t - all text (raw, explicitly) in the first h1 in the doc (markdown would be `# heading`)
    - path/to/doc/myDoc.md.excerpts/p[5].$t - all raw text from the 5th top level paragraph (text with two blank lines surrounding it, except if the paragraph is an unordered or ordered list)
    - path/to/doc/myDoc.md.excerpts/h1[].$t - all of the top level h1s, with a yaml doc separator between each `---`
    - path/to/doc/myDoc.md.excerpts/h[].$t - any heading element of any level (<h1>..<h5>) at the top level of the document
    - path/to/doc/myDoc.md.excerpts/\*h[].$t - any heading element of any level (<h1>..<h5>) at any level of the document
    - path/to/doc/myDoc.md.excerpts/\*img[].$t - any image element at any level of the document.
      - Except the pathed excerpt to the image element themselves, none contain the image data itself (same would be true for any large sections of data).
        - If the pathed excerpt contains a remote image referenced by URL, it downloads it into the excerpts folder
          - download to path/to/doc/myDoc.md.excerpts/h[5].img[0].image.$i ($i is image file type)
          - If the image changes, the image is overwritten
            - Note: images are binary data. if stored in a repo, this ends up taking quite a bit of space if the image is large, or it changes frequently, even if the image is removed in the most recent version of the codebase. Try to use LFS (not set up by mdq) to store those files.
        - The contents of the excerpt is an `@reference/to/file/on/disk.png` to not duplicate the image. It references the local file path if the image was a local reference, or the path to the downloaded image in the excerpts folder
  - example queries that use the excerpts
    - path/to/doc/myDoc.md.excerpts/\*[].$t - invalid, would return the doc very duplicatively (basically replace `\n` with `\n---\n\n`)
    - path/to/doc/myDoc.md.excerpts/h[2].children.$t - gets path/to/doc/myDoc.md.excerpts/h[2].$t and returns just the child elements, not the text within the h2 not wrapped in another element
    - path/to/doc/myDoc.md.excerpts/\*h[].only.$t - any heading element of any level at the any level of the document
    - path/to/doc/myDoc.md.excerpts/h[.heading.contains('build', caseSensitive=false)].$t - all raw text from within the headings (including it's children) where the heading contains 'build' with any capitalization
    - path/to/doc/myDoc.md.excerpts/h[.body.contains('build', caseSensitive=true)].$t - all raw text from within headings where the body text contains 'build' with explicit capitalization
    - path/to/doc/myDoc.md.excerpts/h[.body.contains('build', caseSensitive=true)].only.$t - same as the above, but don't include children
- Summaries generated in different levels, most performing the previous level to power the summary for the next (aka summarize sentences before summarizing a whole paragraph, summarized from the summarized sentences):
  <!-- TODO: consider providing the summary AND the source (or every layer above it) for the agent to make the best decision) -->
  <!-- TODO: parallelize the crap out of this as much as possible using an Agent() -->
  - summarize S[] sentence(s) - typically used if paragraphs are large
  - summarize P paragraph
  - summarize P[] paragraphs
  - summarize P'[] paragraphs
  - summarize D document
  - summarize D[] documents
- Store summaries in the excerpts with the appropriate naming, but instead of ending `abcd.$t` end with `abcd.summary.$t`
  - Basically every excerpt of every size gets a summary
- embeddings generated for:
  - Doc as whole
  - each excerpt
  - each summary
- xxxq tool should use ripgrep to find mentions (if multi-word or punctuation also break apart into individual terms, pairs, and triplets, and if possible use a synonymish-friendly search (like if searching for classes, also search for class, or if searching for job, also search for career. I think postgres has a feature for something like this with a mapping for the english language? That would give us some similarity/grep fusion search that doesn't require embeddings.))

tldr, parse a markdown doc into a toc like structure but maintain contents of each section (the document is one big nested list, with care taken )
