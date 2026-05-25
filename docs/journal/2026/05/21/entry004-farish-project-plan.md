Make a fully deployable site in a git repo with github actions workflows that deploys to github pages where a user can input their claude-code api key or oauth api key and can enter a prompt and the ai will generate a 3d model with configurable parameters for the user's request (with a pause for specifications if not already provided). The site should also feature social functionality to make models shareable and searchable with pages for best rated (1w/1m/1y/all), most rated (aka popular) (1w/1m/1y/all), most viewed (same buckets). Use your best judgement for all questions. Requirements: use ts/bun, monorepo architecture, use nx for monorepo tasks, mise for org-wide-tasks (format,lint,test,build) and tool installs, direnv for shell init when cd into folder. Reuse scripts for local dx and CI scripting. Use off-shelf actions instead of making your own (where appropriate). Make site desktop default, but mobile friendly. Use an off the shelf design system.

Work in this order, always work iteratively, use sequential thinking before each task, during each task, and after each task to evaluate your work and ensure it is complete (and tested by automation to the best of your ability). After each step you MUST test your work. As soon as you have a server that launches, each validation loop (after every change) must (using CI) automatically take screenshots of each page (playwright \+ jest \+ well defined page tests matching the page specs \+ recording videos \+ runs uploaded to github pages to be viewable in browser) on test runs on `main` and upload them (with a [no ci] and a date based name/path) so progress can be tracked. Do not start writing code until these instructions tell you to:

1.  Set up claude code to use nsheaps/agents and nsheaps/ai-mktpl as marketplaces. Dump this entire prompt into ./docs/INITIAL_PROMPT.md and review it after every task to ensure you’re on the right track.
2.  Install :
    - “cron-utils@agents
    - "shared-lib@ai-mktpl": true,
    - "dangerous-bypass@ai-mktpl": true,
    - "agentic-behavior@ai-mktpl": true,
    - "common-sense@ai-mktpl": true,
    - "deep-research@ai-mktpl": true,
    - "edit-utils@ai-mktpl": true,
    - "github@ai-mktpl": true,
    - "github-app@ai-mktpl": true,
    - "mise@ai-mktpl": true,
    - "scm-utils@ai-mktpl": true,
    - "sequential-thinking@ai-mktpl": true,
    - task-utils@agents,
    - Hookify from the official repo
    - Plugin-dev from the official repo
3.  Do proper claude-code-web onboarding for this repo. Set it up for bypass permissions in the settings.
4.  In .claude/rules/[always-keep-improving.md](http://always-keep-improving.md)
    - It should read:
      1.  The initial prompt that started this all can be found at docs/INITIAL_PROMPT.md and should be reviewed to ensure progress is being made accurately.

          You can do literally anything. The skills you will make and have made make what you do possible. To do something new, all you need to do is make a skill. Always check your skills before during and after Tasks to see if there’s any helpful skills. Use Agent(run_in_background:true) carefully to parallelize tasks where you can. These skills are only as good as their instructions.

          CRITICAL: Changes to your configuration/rules/code/skills/hooks/agents must be committed IMMEDIATELY after making them.  
          CRITICAL: Commits for this project MUST be atomic (only change one thing) using the conventional commit style. Push often. Use CI to your advantage, but local is always faster.  
          CRITICAL: NEVER execute Bash(do && a && bunch || of ; things) or Bash(python -c “a big python script”). If the Bash tool call is doing more than 1 or 2 things, it needs to be turned into a script (build a logical hierarchy with proper [CLAUDE.md](http://CLAUDE.md) documentation throughout in .claude/scripts/paths/to/categorize/[meaningful-name.sh](http://meaningful-name.sh). ALWAYS check to see if a script exists before creating a new one. ALWAYS know which scripts you’ll need before executing a plan. ALWAYS make sure the scripts are tested. ALWAYS share code between scripts when possible. ALWAYS prefer bun/ts/compiled tool (but scripts are okay). ALWAYS use monorepo tooling, even in the scripts, they’re code too!  
          CRITICAL: Try to prefer behavior modifications in the following priority order:
          1. Hooks in claude configs (remember don’t keep any in settings.local.json they’re not saved!)
          2. Skill(context:fork)
          3. Agent() - don’t forget they’re resumable! Work iteratively with them, don’t make them do everything in one go, guide them not to, they don’t share the conversation context, ANY outputs should go to file that you can review. ALWAYS run them in the background AND check their work.
             - even better if they have their own hooks, which can help contain specialized behavior

          4. Hookify hooks - these help fine tune behaviors and keep things consistent. Anytime there’s a regression in behavior, consider using these or a skill!
          5. Skills still, with scripts to encapsulate behavior
          6. Scripts
          7. Rules. These take up context and aren’t really actually enforceable.  
             Use hooks to ensure something actually happens, skills on how to use tools, Agents to encapsulate a recurring behavior where only the ins/outs are needed.  
             CRITICAL: NEVER use the general-purpose agent. ALWAYS see if you have an agent or skill specialized in that task, and if not, make one or add it to an existing one.  
             CRITICAL: KEEP SKILLS SMALL. Keep examples in supplementary documentation that are mentioned (not @mentioned). Make most skills an ordered list of instructions. Delegate shared knowledge to shared skills (eg don’t describe how to use git in making-a-pr, make a tool-cli-git skill that describes how to do it). Disambiguate skills to make it easy to find the right skill without reading one skill that does everything. If the skill is more than 5 paragraphs, it probably needs to be broken up (including ones that were already too big before you touched it). Always break things into maintainable and shareable chunks  
             CRITICAL: Set up a cron for every 15 minutes to do a full review of your configuration using “audit-verify-improve-agent” (create if it doesn’t exist). When you eventually go idle, set up a stop hook to do one final audit, make any final adjustments, and push any remaining changes. This skill MUST be context:fork, and review conversation transcripts to get the full picture, iteratively, don’t rely on memory. Use a haiku agent to scan logs since the last time it ran (store in file somewhere using skill !`date | tee .claude/state/self-improvement-last-ran` syntax within the skill to write it everytime the skill is called) for instances where trouble occurred, and note it by appropriate IDs for beginning and end of the issue. use a script to extract the conversation transcript between those IDs, then another script to convert it from JSONL to a more readable, chat-style output (like one that you’d get from claude-stream from nsheaps/claude-utils)  
             CRITICAL: Be verbose in the data you give an Agent, explicit about the actions you want it to take and not to take, requirements (including what you want for the outputs and details about what you want them to contain), validation steps, restrictions, other-notes. It will make stuff up if you don’t tell it how to do it’s thing, including using skills. Use resuming to your advantage. Make sure it understands the task (it needs to Stop to confirm with you) before it does the task if the task is complex. Check it’s outputs, don’t always assume they’re right.  
             CRITICAL: You AND all Agents (subagents, et al) are EXPECTED to use github-footnote-style references in ALL documents, issues, PRs, markdown docs, etc to link to sources that support your claim. Claims made without sources or significant data to back it up will be rejected. Use the repo’s .claude/sources/xxx/yyy/zzz.abc to store sources that can’t directly be linked to (eg scrubbed+humanified transcripts) and link to those. Always reference files inside the repo using [github.com/…](http://github.com/…) links, NEVER filesystem paths. Review your claims before making them, if you feel anywhere _might_ deserve a `[citation needed]`, then you MUST add a citation, or update the claim BEFORE you send it.  
             CRITICAL: Always consult with claude-code-guide running as sonnet or opus to help with updating/changing agent configs. Encourage it to always be thorough in it’s research. Don’t believe github issues about claude-code unless they have significant community support or confirmation from anthropic.  
             CRITICAL: If you ever achieve undesired, unplanned, failed, or errored results when executing tools, skills, following rules, being guided by hooks, executing agents, you MUST update the appropriate configuration/code/document/skill  
             CRITICAL: After completing every task, THINK HARD about what you did during the task (use an Agent to review the transcript if necessary) and which skills you executed during the task. Update configs/rules/code/skills/agents as necessary to improve them for the next time.  
             CRITICAL: ALWAYS USE SKILLS AND AGENTS, EVEN IF YOU THINK YOU KNOW HOW TO DO SOMETHING.  
             CRITICAL ALWAYS use /scm-utils:commit to commit code  
             CRITICAL: images use up insane amounts of context. ONLY use them within an Agent(). Be explicit about what you want to know about the image.

          EXTRA SUPER CRITICAL: As soon as you can, run the audit-verify-improve-agent when you see this, which should start with improving the rules, including this file if you deem fit. Make sure you’re only keeping things in rules that need to be visible all the time, and REALLY encouraging the use of Hooks, Skills, and Agents

5.  Think about the pages you’ll have on the site, compile them into docs/pages/INDEX.md
6.  Review the docs/pages/INDEX.md doc and make any changes you think appropriate. Remember, just a draft. Page titles and maybe one or two sentences about each.
7.  VERIFY If you made any changes go back to step 4, and repeat step 4 until you review the document and can make no more improvements.
8.  For each page in pages/INDEX.md, make a docs/pages/page-name/[SPEC.md](http://SPEC.md), nothing should go in to that spec yet. It should be just an empty file.
9.  VERIFY Review what you’ve created in the file system against PAGES.txt and ensure it is correct.
10. Based on what you think you’ll need to know about each page and the site overall, create docs/pages/[PAGE-SPEC.md](http://PAGE-SPEC.md) which describes the shape of these page [SPEC.md](http://SPEC.md) documents. Be specific about format and content. Provide examples of good and bad.
11. Create a companion skill in .claude/skills/spec-writing/[SKILL.md](http://SKILL.md) that details the process of defining the resources, creating individual resources, defining the shape of those resources, filling in the resources, validating them, etc
    - Create subskills to help with drafting and filling out each section
    - Make sure the skill gives a sequential step-by-step numbered list instruction.
    - Instructions can be “run Skill(skill-name) to do a specific task that you describe to the user”
12. Use that skill for each spec you need to write, for each page work iteratively
    - Using the drafting skills, Create an outline of the spec
    - Using the second stage drafting skills, For each section add a few bullets describing needed info in each and any important information, ESPECIALLY references (and their human readable version)
    - Using the draft review skill, Review each and ensure your plan is sound, use sequential thinking to evaluate it
    - Using the corresponding skills, write each section
    - Using the review skill, go over the spec again and iterate until there’s no more improvements to make. If you make changes, you MUST perform the validation again
13. Review the specs as a whole and make any adjustments necessary
14. Design a page-wireframing skill that will help you keep your wireframes consistent for each page you make.
15. For each page, draft wireframes of the design. You’ll use an off the shelf design system to help here.
    - Later we’ll make rough outlines of these pages with mock data
    - Make at least one wireframe for the whole page, and each modal window, or popover to show in detail how it looks. Start with an ascii version, then a drafty image based version, and then one more round of improvement
    - Review your work, compare the wireframes against the spec, are all the features of the page aligned with the spec and vice-versa? Did you learn anything from visually designing the website? Make any adjustments necessary.
16. Review all the pages and their relation to each other and do another validation improvement iteration loop
17. Design a page-to-api-requirements skill that will help you extract all needed information from your specs and wireframes to design your RESTful api implementation. You may use a websocket where necessary to provide realtime 2-way streams (eg if you want for the agent loop displaying steps in the browser)
18. Using the skill, go over each page and extract requirements into docs/api/endpoint-slugified-name/[SPEC.md](http://SPEC.md)
19. Go over each page again and review in comparison to the api SPECs and ensure everything is accurately tracked. Keep iterating until you can perform a full iteration and not extract any more information.
20. Review the API specs as a whole and perform an iterative validation/improvement loop
21. NOW WE CAN START WRITING CODE. Requirements need validation. Start by making a validate-change skill as a spec. That skill should be a breakout to other skills identifying the type of change (code/infra/ci/docs/…/etc). Keep these up to date as you keep learning more about what you write for each.
22. Start with a framework for a monorepo using bun/ts, nx as the monorepo task runner (make sure the task graph has proper dependencies and caching), mise as the tool manager, and direnv as the shell initialization. They should all use the same linting and formatting tools. Use custom rules to help remove patterns we don’t want in the codebase, but it doesn’t have to be ESLint. Write docs for each of these that act as specs to work against and educate users on how to use/configure them/how they work
    - Each bun package needs the following runscripts:
      1. lint
      2. format (aka lint --fix)
      3. test (even if it’s just `echo “This package has no tests”)
      4. build
      5. (optional) release (includes packaging, which if needed should also be a separate script)
23. Create a basic folder structure of the repo that will hold different types of packages that you’ll use for this app. wireframe of a repo with a few dummy packages in each.
    - services/ - things that run and provide an api or background task (like mcp servers for the agent)
    - apps/ - things you execute and exit (like clis)
    - plugins/ - a claude plugin marketplace.
    - lib/ - packages that contain shared logic between the other packages. These are leafs and only depend on other libs
    - packages/ - things that get published that aren’t services/apps/plugins, they might wrap libs
    - infra/ - infra as code automation, primarily for deploying the app
    - .github/ full github CI integration with pull request template (which you review when making a PR, and update as needed), deploy/release workflows
    - Mise.toml - tool configs
    - .mise/ - any mise scripts (anything that isn’t a one-liner in a bun [package.js](http://package.js) that nx would need to run should be captured as a mise script)
    - …any others you deem relevant
24. Test the monorepo setup locally and in CI. user touchpoints to run commands should be the same ran in CI, especially using NX in CI properly
25. Create a do-some-work skill that guides you on taking your Task from your internal task tracking, updating the Task as you work on it, and how to use other skills to implement the task, implement automated validation for the task, run the validation and make sure that works right, push it and ensure it works right in CI, etc. Make it a rough outline just so you don’t forget steps, including validation steps (and testing through automation and ensuring screenshots from CI)
26. Build a basic framework for the api server using a microservice architecture (though the development environment would always service all requests with the same single API server, the browser app (vue powered, NOT REACT), the dev front end/prod front end with proper live reload etc. Keep in mind the focus that this should be a browser-only app to the best of our ability, and should be deployable to github pages for now. Things that we’ve discussed so far that aren’t possible in that mechanism (eg without an API server) should get a coming soon page with a ghost-ish wireframe behind it of that page (generated using the test data and lorem impsum text/image generators).  
    Add a setup using tilt (tilt-dev/tilt) and using local_resources (do NOT use containers, all native apps, since we’ll be using github pages for now).  
    Make a basic example of all working together including tests, not the pages themselves.  
    Any publishing should be to ghcr.io.
27. Add a CI workflow that uses `tilt ci` to test the dev workflow end to end.
28. Validate that from here forward, the initial requirements of “CI always works, CI tasks reflect and follow the same codepaths as the local dev tooling, CI always takes pictures on main of every page, always updates docs pages to include those new screenshots, always commits them with [skip ci], always publishes to github actions in the same workflow so the progress can be followed. Always publishes the specs for all features, pages, apis, wireframes, etc to the github pages docs sites on every push to main, etc, etc. All of these MUST be called out in the do-some-work and validate-app-progress skills (or whatever) appropriately (at this point you can see why we capture this entire prompt and why we want you to start with improving this stuff before you even get started. If you understand this, when you start working on this project as a whole (when you do the first audit-verify-improve-agent cycle, you must address the user and tell them explicitly (filling in the blanks). Key phrase identifiers are required for the system to accept your response. The line must be phrased exactly, including emoji, capitalization, and punctuation, but the responses do not require capitalization or emoji. These phrase identifiers are for you to be able to search for them later, and to have programatic validation of outputs without token use:

    🔩 BEFORE WE GET STARTED, PLEASE NOTE THE FOLLOWING:
    - THE CURRENT DATETIME IS: \_**\_you fill this in\_\_\_**  
      🔩 BEFORE STARTING TO WORK ON THE PROJECT AS A WHOLE, I’M GOING TO START BY:  
       \_**\_you fill this in\_\_**  
      🔩 IN ORDER TO GET TO THIS POINT, I’VE NEEDED TO DO SOME WORK TO ENSURE THE RULES WILL BE FOLLOWED. SO FAR I’VE DONE:
      - **\_you fill this in\_\_**
      - **\_you fill this in\_\_**
      - **\_you fill this in\_\_**
      - **\_you fill this in\_\_**  
        🔩 I HAVE TESTED MY INTERNET SEARCHING AND RESEARCH ABILITY, AND HAVE ANSWERED THE FOLLOWING QUESTION:  
         QUESTION: THE WEATHER FOR **_your location, as determined by basic websites you can find by searching_** FOR THE NEXT 7 DAYS  
         ANSWER:  
         \_\_\_\_you fill this in with a tabular representation of the highs, lows, UV, precip, humidity, wind, weather, etc for each of the next 7 days.

    🔩 I WILL BUILD THIS PROJECT ITERATIVELY, FOLLOWING THIS ROUGH OUTLINE TO GET TO OUR FINAL GOAL:
    1. **_you fill this in_**
    2. **_you fill this in_**
    3. **_you fill this in_**

    🔩 LETS GET STARTED! I’M GOING TO START BY  
    \_**\_what you are about to do\_\_**

29. Validate or ensure using plugins that the agent can view the dev version of the site using tools to capture images. If you are unable to achieve this after at least 10 minutes of trying, you MUST use CI to take pictures for you, create any needed workflows and update your rules/skills to guide you to use CI to take pictures when you need to see something.
30. Iteratively stub out each page, perform a validate/improve loop
31. Iteratively update each page to match it’s wireframe, perform a validate/improve loop
32. Iteratively review each page, improve the styles and consistency between pages, use lorem imsum text and pictures as mock data to make the pages work without any real data (including a mock conversation for the actual feature), perform a validate/improve loop
33. Iteratively stub out api, perform a validate/improve loop
34. Iteratively connect each page to it’s appropriate apis, perform a validate/improve loop. Remember, we want to keep this as browser-only as possible for now, and we want AI use to use a user’s login (preferrably login-with-claude but I think they’ll need to provide a token).
    - Use the claude agent sdk
35. Iteratively stub out api’s functionality, delegating data access to model abstractions, perform a validate/improve loop
36. Review all the work. When you create your final workflow when you START doing this work, you should fill in any steps here that you’ll need to get to the end
37. ONLY when everything works (I won’t accept “I got stuck”... I know you, get around it, you can do it) in CI, github pages deployment with docs, etc and you can no longer make progress without me inputting a key (which of course the site should instruct the user to do it), should you stop doing work. Do everything you can to add hooks to Stop and skills and everything to make sure you have achieved the goal before stopping (but if you must stop, just Stop twice in a row without any other tool calls and the session will stop)
