## Review Formatting

### Emoji legend

- ✅ Correct / works as intended
- ❔ Requires clarification before approval
- ⚠️ Potential problem
- ❌ Definite problem (triggers "Some changes need to be made" header)

### Shields.io badges (required)

Use shields.io badges for high-level metrics. Format:
`https://img.shields.io/badge/<SCORE>%20-%20?style=for-the-badge&label=<LABEL>&labelColor=%23444&color=<COLOR>`

Required badges (all 0-100% or N/A):

- **Quality** - code quality assessment
- **Security** - security assessment (N/A if not applicable)
- **Simplicity** - complexity assessment (if <90%, suggest simplification)
- **Confidence** - confidence in your assessment

Colors: 85+ `#60A060` (green), 65+ `#C0C040` (yellow), <65 `#D07070` (red), N/A `#444444` (gray).
Scores below 65% are failures. Consider previous review scores for consistency.

### Review structure template

```markdown
<details>
<summary>
### <approval/disapproval statement with needed changes>
<!-- All badges on one line -->
![](badge1) ![](badge2) ![](badge3) ![](badge4)

<concise summary list, most important first: Critical > Warnings > Questions > Checked>
_Click to expand for full details_

</summary>

<detailed findings with L3+ headings>

</details>

**Follow-ups:**

- **P0**: [Critical — must fix before merge]
- **P1**: [Important — should fix before merge]
- **P2**: [Nice-to-have — can be a follow-up PR]

<footnotes and references>
```

### References and footnotes (required)

Your review MUST end with reference links including:

1. Link to the workflow run html_url
2. External sources used to validate findings

Do NOT include: CDATA wrappers, links to previous reviews, or inline comment links (those go in the details section).
