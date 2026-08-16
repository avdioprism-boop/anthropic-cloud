#!/usr/bin/env python3
import sys
import json
from anthropic import Anthropic

def handle_api_request(request_body):
    """Handle Claude API request using authenticated Anthropic SDK."""
    try:
        data = json.loads(request_body)

        client = Anthropic()

        response = client.messages.create(
            model=data.get("model", "claude-sonnet-5"),
            max_tokens=data.get("max_tokens", 1024),
            messages=data.get("messages", []),
        )

        return {
            "content": [{"type": "text", "text": response.content[0].text}],
            "model": response.model,
        }
    except Exception as e:
        return {
            "error": {
                "type": "error",
                "message": str(e)
            }
        }

if __name__ == "__main__":
    request_body = sys.stdin.read()
    result = handle_api_request(request_body)
    print(json.dumps(result))
