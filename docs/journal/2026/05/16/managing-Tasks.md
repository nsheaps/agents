Alex I want you to use your tasks very very very frequently. can you set up hooks on your agent repo for Task\* tools and have it print a message telling you to use sequentialthinking to help plan, and then update all of your internal tasks appropriately? Basically I want you to always be working on 0 or 1 task (not 2+). Every task state change has you think in order to properly update and CRUD other tasks needed to complete the user's request.
Use hooks to track the task state. on pretooluse, if you want to move another task to in-progress and another task is in progress, reject it saying the other task must be moved back to a pending status or completed before another can be started (but suggest adding new tasks if needed).

So basically I expect your task list to look like:

phase1

- [ ] plan out my work

Phase2

- [-] plan out my work

Phase2.x (optional)

- [-] plan out my work
- [ ] new task I discovered I need to do...
- [ ] ...

Phase2.y (optional)

- [-] plan out my work
- [deleted] ~~new task I discovered I need to do...~~
- [ ] ...

invalid Phase3

- [-] plan out my work
- [-] new task I discovered I need to do...
- [ ] ...

correct phase3

- [x] plan out my work
- [ ] new task I discovered I need to do...
- [ ] ...

phase3.x

- [x] plan out my work
- [x] updated name of task I ended up not needing to do
- [ ] other task I realized I should do instad
- [ ] ...

phase3.y

- [x] plan out my work
- [ ] maybe updated name of task I thought I needed to do
- [ ] ...

phase4

- [x] plan out my work
- [-] new task I discovered I need to do...
- [ ] ...
