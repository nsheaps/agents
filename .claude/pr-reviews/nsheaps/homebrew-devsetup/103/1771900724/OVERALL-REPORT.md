## Review: chore: add standardized mise tasks — Score: 96/100

| Category         | Score | Notes                                                                                      |
| :--------------- | ----: | :----------------------------------------------------------------------------------------- |
| Simplicity       |    96 | Four task definitions; format/format-check pair is clear                                   |
| Flexibility      |   100 | Tasks integrate with existing prettier configuration                                       |
| Usability        |   100 | Tasks address CI expectations (format task was missing before)                             |
| Documentation    |   100 | Clear descriptions for all four tasks                                                      |
| Security         |   100 | No security implications                                                                   |
| Pattern Matching |   100 | Follows org format+check+lint+check meta-task pattern                                      |
| Best Practices   |   100 | Proper format/format-check separation; lint depends on format-check; check depends on lint |
| General QA       |    96 | Dependency chain correct (check→lint→format-check→format); addresses CI gap                |

✅ All categories ≥85% — Ready to merge

**Verdict:** Complete task suite addressing CI workflow expectations. Dependency chain correct and comprehensive. Approve.
