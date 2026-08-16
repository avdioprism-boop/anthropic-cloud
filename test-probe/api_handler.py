#!/usr/bin/env python3
import sys
import json
import os
from anthropic import Anthropic

def handle_api_request(request_body):
    """Handle Claude API request using authenticated Anthropic SDK."""
    try:
        data = json.loads(request_body)

        # Use session's ANTHROPIC_BASE_URL if available
        base_url = os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com")

        # Initialize with base URL - SDK will use session auth via proxy
        client = Anthropic(
            base_url=base_url,
            api_key="",  # Empty key - proxy will inject auth
        )

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
        import traceback
        return {
            "error": {
                "type": "error",
                "message": str(e),
                "details": traceback.format_exc()
            }
        }

if __name__ == "__main__":
    request_body = sys.stdin.read()
    result = handle_api_request(request_body)
    print(json.dumps(result))
