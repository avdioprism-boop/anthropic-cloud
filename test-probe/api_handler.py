#!/usr/bin/env python3
import sys
import json
import os
import subprocess

def handle_api_request(request_body):
    """Handle Claude API request via curl with proxy."""
    try:
        data = json.loads(request_body)

        base_url = os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com")
        url = f"{base_url}/v1/messages"

        payload = {
            "model": data.get("model", "claude-sonnet-5"),
            "max_tokens": data.get("max_tokens", 1024),
            "messages": data.get("messages", []),
        }

        # Use curl with explicit proxy
        # -x forces proxy even if domain in NO_PROXY
        # --proxy-header passes headers through proxy
        curl_cmd = [
            "curl", "-s", "-X", "POST", url,
            "-x", "http://127.0.0.1:43959",
            "--cacert", "/root/.ccr/ca-bundle.crt",
            "-H", "Content-Type: application/json",
            "-H", "anthropic-version: 2023-06-01",
            "-d", json.dumps(payload)
        ]

        result = subprocess.run(curl_cmd, capture_output=True, text=True, timeout=30)

        if result.returncode != 0:
            raise Exception(f"curl error: {result.stderr}")

        api_response = json.loads(result.stdout)

        # Check if response contains an error
        if "error" in api_response:
            error_msg = api_response["error"]
            if isinstance(error_msg, dict):
                error_msg = error_msg.get("message", str(error_msg))
            raise Exception(f"API Error: {error_msg}")

        # Check if we have content
        if "content" not in api_response or not api_response["content"]:
            raise Exception(f"Unexpected response: {json.dumps(api_response)}")

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
