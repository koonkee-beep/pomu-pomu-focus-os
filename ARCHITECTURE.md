# POMU POMU Focus OS — system architecture and behavioural rules

**POMU POMU · Do One Thing**

## Core principle

The system is not just a task database. It is an **attention-management loop**:

**Capture → Clarify → Prioritise → Focus → Park interruptions → Review → Shutdown**

## Data model

### Task
- id
- title
- project
- priority (P1/P2/P3)
- estimate_min
- due_date
- status (todo / doing / waiting / done)
- created_at
- completed_at
- source
- notes

### Inbox item
- id
- raw_text
- captured_at
- classification (task / idea / waiting / note / distraction)
- processed
- linked_task_id

### Focus session
- id
- task_id
- started_at
- ended_at
- duration_min
- interruptions_count

### Daily review
- date
- tomorrow_anchor
- unfinished_carryover
- waiting_followups
- shutdown_at

## Suggested AI actions

1. Convert raw capture into one of: task, note, idea, waiting-for.
2. Extract project, owner, due date, urgency, and next physical action.
3. Detect duplicate tasks.
4. Recommend today's top 1 + next 3 based on deadline, impact, effort, and blocked status.
5. Summarise unfinished loops at shutdown.
6. Draft follow-up messages for waiting items when due.
7. Weekly review: cluster tasks by project and surface stalled work.

## Guardrails

- AI may suggest priority, but the user controls final priority.
- Never auto-send messages or close tasks without explicit confirmation.
- Keep raw user capture alongside AI-parsed fields.
- Every AI change should be reversible.
