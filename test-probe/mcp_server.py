#!/usr/bin/env python3
"""MCP server for Anthropic Claude API calls with session auth."""

import json
import sys
from anthropic import Anthropic

async def handle_call_claude(model: str, max_tokens: int, messages: list) -> dict:
    """Call Claude API with session authentication."""
    try:
        client = Anthropic(api_key="dummy")  # SDK will use session auth

        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            messages=messages,
        )

        return {
            "content": response.content[0].text,
            "model": response.model,
        }
    except Exception as e:
        return {
            "error": str(e)
        }


def main():
    """Simple stdio-based MCP server."""
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break

            request = json.loads(line)

            if request.get("method") == "call_claude":
                result = handle_call_claude(
                    request["params"]["model"],
                    request["params"]["max_tokens"],
                    request["params"]["messages"],
                )
                response = {"id": request["id"], "result": result}
            else:
                response = {"id": request["id"], "error": "Unknown method"}

            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()
        except Exception as e:
            sys.stderr.write(f"Error: {e}\n")
            sys.stderr.flush()


if __name__ == "__main__":
    main()
