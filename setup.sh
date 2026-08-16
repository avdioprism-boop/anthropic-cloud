#!/usr/bin/env bash
# ONE-TIME SETUP. Run once, save the two IDs, never run this in your request path.
#
# Agents and environments are persistent, versioned resources. Creating a fresh
# agent on every invocation accumulates orphaned objects, pays create latency for
# nothing, and defeats version pinning. Your application only ever calls
# sessions.create() with the IDs this script prints.
set -euo pipefail

# Auth: `ant auth login` stores a profile the CLI and SDKs both read, so
# ANTHROPIC_API_KEY does not need to be set. Check with `ant auth status` —
# note a stale exported ANTHROPIC_API_KEY silently overrides any profile.

AGENT_ID=$(ant beta:agents create < agents/researcher.agent.yaml --transform id -r)
ENVIRONMENT_ID=$(ant beta:environments create < environments/sandbox.environment.yaml --transform id -r)

cat <<EOF
Save these — they are the only inputs your runtime needs:

  export AGENT_ID=$AGENT_ID
  export ENVIRONMENT_ID=$ENVIRONMENT_ID

To change the agent's behavior later, UPDATE it (each update mints a new version;
running sessions keep the version they pinned):

  ant beta:agents update --agent-id "$AGENT_ID" --version 1 < agents/researcher.agent.yaml

Do not archive the agent or environment as cleanup — archive is permanent, has no
undo, and blocks new sessions from referencing the resource.
EOF
