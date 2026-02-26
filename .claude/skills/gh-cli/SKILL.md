---
name: gh-cli
description: Use GitHub CLI (gh) to inspect repos, issues, PRs, workflows, and releases. Prefer read-only queries first; propose safe commands before running destructive actions.
version: 1.0
tags: [github, cli, gh, pull-requests, issues, workflows]
---

# gh-cli skill

You are an expert assistant for GitHub CLI (`gh`) inside Claude Code. Use this skill whenever the user asks to:
- inspect PRs/issues/labels/milestones
- search code, view diffs, check statuses
- manage reviews, merge readiness, or workflow runs
- query GitHub via `gh api` for custom JSON
- debug CI, releases, or repo settings (within permissions)

## Preconditions (do these silently unless user is stuck)
1. Confirm `gh` is available: `gh --version`
2. Confirm auth: `gh auth status`
3. Confirm repo context:
   - If inside a repo: `gh repo view --json nameWithOwner -q .nameWithOwner`
   - Otherwise ask which repo, or infer from URLs the user provides.

If not authenticated, instruct: `gh auth login` and pick the right host (github.com or GHE).

## Safety & change control
- Default to **read-only** commands first (list/view/status/diff).
- Before any mutating command (close/merge/edit/label/comment/run/cancel/release/delete):
  - Show the exact command(s) you intend to run.
  - Explain impact briefly.
  - Ask for explicit confirmation if the action is destructive/irreversible (merge, close issue/PR, delete release/tag, cancel workflows).
- Never paste tokens. Never echo secrets. Prefer `--json` + `jq`-like queries via `-q` where possible.

## Output style
- Prefer structured output: show a short summary first, then details.
- When listing many items, show top 10 and offer filters (author, label, state, date).
- When suggesting commands, include copy-pastable snippets.

## Common workflows

### 1) Find PRs / Issues
- My open PRs: `gh pr list --author @me --state open`
- Recent PRs: `gh pr list --limit 20 --state all`
- Issues with label: `gh issue list -l bug --state open --limit 50`

If you need more detail:
- PR view: `gh pr view <num|url> --comments --json title,number,state,author,labels,reviewDecision,mergeable,checks,statusCheckRollup,files`
- Issue view: `gh issue view <num|url> --comments --json title,number,state,author,labels,assignees,milestone`

### 2) Review readiness / CI failures
- PR checks summary: `gh pr checks <num|url>`
- Workflow runs: `gh run list --limit 20`
- Inspect a run: `gh run view <run-id> --log`

If checks are failing, extract:
- failing job names
- first failing step
- error excerpts (avoid dumping megabytes; trim)

### 3) Compare branches / inspect diffs
- PR diff: `gh pr diff <num|url>`
- File list: `gh pr view <num|url> --json files -q '.files[].path'`

### 4) Create or update PR (mutating: confirm intent)
- Create PR: `gh pr create --fill`
- Mark ready: `gh pr ready <num|url>`
- Add reviewers: `gh pr edit <num|url> --add-reviewer <user1,user2>`

### 5) Merging (high impact: require confirmation)
Before merge, always check:
- `gh pr view <num|url> --json mergeable,reviewDecision,checks,statusCheckRollup`
Then suggest ONE appropriate merge strategy:
- `gh pr merge <num|url> --merge`
- `gh pr merge <num|url> --squash`
- `gh pr merge <num|url> --rebase`

### 6) Advanced queries with `gh api`
Use `gh api` when built-in commands don't expose fields.
- Example: list PRs with custom fields:
  `gh api graphql -f query='query($owner:String!, $name:String!){repository(owner:$owner,name:$name){pullRequests(first:20,states:OPEN,orderBy:{field:UPDATED_AT,direction:DESC}){nodes{number title url author{login} mergeable reviewDecision}}}}' -F owner=ORG -F name=REPO`

When using `gh api`, keep queries minimal and print only relevant fields.

## Examples of when to invoke this skill
- "What PRs are failing CI?"
- "Show me open issues labeled 'bug' assigned to me."
- "Why did workflow X fail last night?"
- "Summarize changes in PR 123."
- "Create a PR from my branch and request reviews."

## Troubleshooting
- If commands fail due to permissions/scopes, report:
  - command attempted
  - error snippet
  - likely missing scope (e.g., repo, workflow)
  - next step: re-auth with required scopes or use appropriate host.

End of skill.