# Skill: Implement story

Implement story with full workflow.

## Phase 1: Preparation
1. Fetch story details from Azure DevOps
2. If conflicts exist, STOP and report them
3. Move story to "In Progress" state

## Phase 2: Planning
1. Consult the application-architect agent for approach
2. If architecture changes needed, create/update ADRs
3. Present implementation plan
4. WAIT for user approval before proceeding

## Phase 3: Implementation
1. Senior-developer agent shoud implement the feature following the approved plan
2. Add appropriate error handling
3. Write unit tests for new code
4. Ensure all existing tests still pass

## Phase 4: Quality Gates
1. Run senior-developer agent as reviewer of changes
2. Address any Critical or Major issues
3. Run senior-qa agent
4. Run ux-reviewer agent, and use Chrome DevTools to document work with screenshots and store them in the docs folder
5. Fix any blocking issues found

## Phase 5: Completion
1. Create commit with descriptive message
2. Push to feature branch
3. Create pull request in Azure DevOps
4. Provide summary of changes
5. Update any critical changes in README and CLAUDE.md
6. If all goes well, transition story to closed

If any phase fails, STOP and report the issue.