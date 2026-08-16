"""RUNTIME. Runs on every invocation.

Loads the agent/environment IDs produced by setup.sh, starts one session, drives
it to completion, and downloads whatever the agent wrote to /mnt/session/outputs/.

Deliberately does NOT create an agent — see setup.sh.
"""

import os
import sys
import time

import anthropic

# Resolves ANTHROPIC_API_KEY, then ANTHROPIC_AUTH_TOKEN, then an `ant auth login` profile.
client = anthropic.Anthropic()

# Console workspace slug. "default" is correct only if your API key lives in the
# org's Default workspace; otherwise a link built with it lands on "Session not found".
WORKSPACE = os.environ.get("ANTHROPIC_WORKSPACE", "default")


def _require(name: str) -> str:
    """Read a required env var, or explain how to get it. Resolved at call time so
    the module stays importable (and testable) without a configured environment."""
    value = os.environ.get(name)
    if not value:
        sys.exit(f"{name} is not set. Run ./setup.sh once, then export the IDs it prints.")
    return value


def lookup_ticket(ticket_id: str) -> str:
    """Executed here, on your infrastructure — the sandbox never sees the credential."""
    # token = os.environ["INTERNAL_API_TOKEN"]   # stays host-side
    return f"{ticket_id}: (stub) wire this to your tracker."


CUSTOM_TOOLS = {"lookup_ticket": lambda inp: lookup_ticket(inp["ticket_id"])}


def start(prompt: str):
    session = client.beta.sessions.create(
        agent=_require("AGENT_ID"),  # string shorthand = latest version; use
        # {"type": "agent", "id": ..., "version": N} to pin for reproducibility
        environment_id=_require("ENVIRONMENT_ID"),
        title="Research run",
        # Hard spend ceiling, priced at public list rates. CREATE-ONLY: a budget can
        # be raised, lowered, or removed later, but never ADDED to a session that
        # started without one. Worth setting on Mythos 5 / Fable 5 at $10/$50 per MTok.
        # amount is minor units (cents) as an integer string: "2500" = $25.00, USD only.
        budget={"type": "limit", "max_list_cost": {"amount": "2500", "currency": "USD"}},
    )
    print(f"session {session.id}")
    print(f"trace   https://platform.claude.com/workspaces/{WORKSPACE}/sessions/{session.id}")
    return session


def drive(session_id: str, prompt: str) -> None:
    kickoff = {"type": "user.message", "content": [{"type": "text", "text": prompt}]}

    while True:
        pending = []

        # Stream-first: open the stream, THEN send. The stream only delivers events
        # that occur after it opens, so sending first buffers the early events into
        # one batch. On reconnect, also call sessions.events.list() and dedupe by
        # event.id — SSE has no replay, and a drop while a tool call is pending
        # deadlocks the session.
        with client.beta.sessions.events.stream(session_id=session_id) as stream:
            if kickoff is not None:
                client.beta.sessions.events.send(session_id=session_id, events=[kickoff])
                kickoff = None

            for event in stream:
                if event.type == "agent.message":
                    for block in event.content:
                        if block.type == "text":
                            print(block.text, end="", flush=True)

                elif event.type == "agent.custom_tool_use":
                    pending.append(event)

                elif event.type == "session.usage":
                    cost = event.list_cost
                    print(f"\n[list cost {cost.amount} {cost.currency} (minor units)]")

                elif event.type == "session.error":
                    print(f"\n[session error] {event.error}", file=sys.stderr)

                elif event.type == "session.status_terminated":
                    return

                elif event.type == "session.status_idle":
                    reason = event.stop_reason.type
                    if reason == "requires_action":
                        break  # waiting on us — answer below, then reconnect
                    if reason == "budget_reached":
                        # Not terminal and not resumable by any event: raise or remove
                        # the budget via sessions.update() to continue. Only "settle"
                        # events (tool results, confirmations, interrupt) are accepted
                        # here — a user.message returns 400.
                        print("\n[paused at budget cap]", file=sys.stderr)
                        return
                    return  # end_turn or retries_exhausted

        if not pending:
            return

        results = []
        for call in pending:
            handler = CUSTOM_TOOLS.get(call.name)
            if handler is None:
                content, is_error = f"Unknown tool: {call.name}", True
            else:
                try:
                    content, is_error = handler(call.input), False
                except Exception as exc:  # surface failures to the agent, don't drop them
                    content, is_error = f"{type(exc).__name__}: {exc}", True
            results.append(
                {
                    "type": "user.custom_tool_result",
                    "custom_tool_use_id": call.id,
                    "content": [{"type": "text", "text": content}],
                    "is_error": is_error,
                }
            )
        client.beta.sessions.events.send(session_id=session_id, events=results)


def collect_outputs(session_id: str, dest: str = "./outputs") -> None:
    os.makedirs(dest, exist_ok=True)

    # files.list needs BOTH betas: the SDK adds files-api-2025-04-14 automatically,
    # but scope_id is a Managed Agents parameter and needs its header passed explicitly.
    # There is a ~1-3s indexing lag after idle, so retry before concluding it's empty.
    for attempt in range(3):
        files = client.beta.files.list(
            scope_id=session_id, betas=["managed-agents-2026-04-01"]
        )
        if files.data:
            break
        time.sleep(2)

    for f in files.data:
        safe = os.path.basename(f.filename)
        if not safe or safe in (".", ".."):
            continue
        client.beta.files.download(f.id).write_to_file(os.path.join(dest, safe))
        print(f"saved {dest}/{safe} ({f.size_bytes} bytes)")


if __name__ == "__main__":
    prompt = " ".join(sys.argv[1:]) or "Summarize what this environment can reach."
    s = start(prompt)
    drive(s.id, prompt)
    collect_outputs(s.id)
