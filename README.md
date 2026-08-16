# Managed Agent on `claude-mythos-5`

A minimal, runnable scaffold: an agent and environment defined as version-controlled
YAML, plus a session runner. Two layers, deliberately separated —

| Layer | What | Cadence | Lives in |
|---|---|---|---|
| Control plane | agent, environment | once per deploy | `agents/`, `environments/` + `ant` CLI |
| Data plane | sessions, events | every task | `run_session.py` (SDK) |

```
setup.sh   ──once──▶  AGENT_ID, ENVIRONMENT_ID  ──every run──▶  run_session.py
```

## Run it

```bash
ant auth login                 # or export ANTHROPIC_API_KEY
./setup.sh                     # prints AGENT_ID and ENVIRONMENT_ID — save them
export AGENT_ID=... ENVIRONMENT_ID=...
python run_session.py "Research X and write the findings to /mnt/session/outputs/"
```

Prerequisites: `pip install anthropic` (verified against **0.122.0**) and the `ant`
CLI (`brew install anthropics/tap/ant`, or a release binary — not required if you
create the agent and environment through the SDK instead).

**Verification status.** Every SDK binding used by `run_session.py` was checked by
introspection against anthropic 0.122.0 and exists with the parameter names used
here: `sessions.create(agent, environment_id, budget, resources, initial_events,
title, vault_ids)`, `sessions.events.stream(session_id, event_deltas, betas)`
returning a `Stream` that implements the context-manager protocol,
`sessions.events.send(session_id, events, betas)`, `files.list(scope_id, betas)`,
and `files.download(...).write_to_file(path)`. The five event-type string literals
the runner switches on (`agent.message`, `agent.custom_tool_use`,
`session.usage`, `session.status_idle`, `session.status_terminated`) all ship in
the SDK. **No live API call has been made** — network behavior, the Glasswing model
gate, and retention enforcement are still unverified, so treat the first real run as
the final check.

## Before you run it — three gates specific to this model

**1. `claude-mythos-5` is Project Glasswing only.** Enrollment is the only way to
access it. If your org is not enrolled, change one line in
`agents/researcher.agent.yaml` to `claude-fable-5` — identical capabilities,
pricing, limits, and API behavior. Everything else in this scaffold is unchanged.

**2. 30-day data retention is mandatory.** Mythos 5 and Fable 5 are not available
under zero data retention. A ZDR org gets `400 invalid_request_error` on *every*
request with a perfectly valid payload — check the org's retention setting before
debugging the request body.

**3. Budget the session.** At $10/$50 per MTok this is the most expensive tier, and
long-horizon agentic runs are exactly what it's for. `run_session.py` sets a $25 cap.
The cap is **create-only**: you can raise, lower, or remove it later, but you can
never add one to a session that started without it.

## Model-specific notes carried into the config

**Thinking is always on and is not configured.** There is no thinking field on the
agent object, and on the Messages API these models reject both
`{type: "disabled"}` and `{type: "enabled", budget_tokens: N}` with a 400. Depth is
controlled entirely by `model.effort`.

**`effort` is agent-level only.** An `effort` inside a per-session `model` override
is silently ignored — the session runs at the agent's level. To change it you update
the agent (which mints a new version) or point at a different agent. This is the one
override field that fails quietly instead of erroring.

**No server-side refusal fallbacks.** `fallbacks` is a Messages API request
parameter; a Managed Agents session does not expose per-turn Messages params, so the
`fallbacks: "default"` safety net you would use on a direct Mythos/Fable call is not
available through the agent config. Mythos 5 and Fable 5 run safety classifiers that
can decline a request — benign security and life-sciences work occasionally trips
them. Plan for that at the session level rather than assuming a fallback rescues you,
and verify how a decline surfaces on the event stream against your own first run.

**Prompts written for older models are often too prescriptive here** and measurably
reduce output quality. The system prompt in the agent YAML states goals, constraints,
and how to verify — not step-by-step scripts. If you port an existing prompt, A/B it
with the old scaffolding removed before keeping it.

## Mechanics the runner gets right (and are easy to get wrong)

- **Stream-first.** The stream only delivers events emitted after it opens. Sending
  first buffers the early ones into a single batch. On reconnect, list history and
  dedupe by `event.id` — SSE has no replay, and a drop while a tool call is pending
  deadlocks the session.
- **The idle gate is not "break on idle".** Sessions idle transiently. Break on
  `session.status_terminated`, or on `session.status_idle` whose `stop_reason` is
  *not* `requires_action`. `budget_reached` is its own case: not terminal, and no
  event resumes it — only a budget change via `sessions.update()`.
- **Custom tools keep secrets host-side.** The agent emits `agent.custom_tool_use`,
  your runner executes with its own credentials and returns
  `user.custom_tool_result` over the same authenticated stream. Nothing
  unauthenticated is listening; the sandbox never sees the token. Failed tools come
  back with `is_error: true` rather than being dropped.
- **Session outputs need both beta headers.** `files.list(scope_id=...)` is a Files
  endpoint taking a Managed Agents parameter — the SDK adds the Files header, you
  add `managed-agents-2026-04-01`. Expect a 1–3s indexing lag after idle.

## Changing things later

Update the agent, don't create a new one — each update mints a new immutable version,
running sessions keep the version they pinned, and you can roll back by pinning:

```bash
ant beta:agents update --agent-id "$AGENT_ID" --version 1 < agents/researcher.agent.yaml
```

Never archive an agent or environment as routine cleanup: archive is permanent, has
no undo, and blocks new sessions from referencing the resource. Sessions are the
disposable layer.
