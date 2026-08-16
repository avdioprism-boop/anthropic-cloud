#!/usr/bin/env python3
import sys
import json
import os
import requests

def handle_api_request(request_body):
    """Handle Claude API request using direct HTTP with proxy auth."""
    try:
        data = json.loads(request_body)

        base_url = os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com")
        url = f"{base_url}/v1/messages"

        headers = {
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
        }

        payload = {
            "model": data.get("model", "claude-sonnet-5"),
            "max_tokens": data.get("max_tokens", 1024),
            "messages": data.get("messages", []),
        }

        # requests will use https_proxy environment variable
        # and the proxy will inject x-api-key header
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()

        api_response = response.json()

        return {
            "content": [{"type": "text", "text": api_response["content"][0]["text"]}],
            "model": api_response.get("model"),
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
