"""Direct HTTP adapters, preserving server-side credentials. No model-strength claims."""

import json
from urllib.parse import quote
import httpx

BASES = {
    "openai": "https://api.openai.com/v1",
    "anthropic": "https://api.anthropic.com/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta",
}


def route(settings, request):
    provider = request.provider
    model = request.model
    if provider == "auto":
        provider, configured = settings.routes[request.profile]
        model = model or configured or settings.models.get(provider, "")
    else:
        model = model or settings.models.get(provider, "")
    if provider not in settings.keys() or not settings.ready(provider):
        raise ValueError("The selected provider is not configured. Add its API key on the backend.")
    if not model:
        raise ValueError("Select a model ID in Settings, or configure a default model on the server.")
    return provider, model


def headers(settings, provider):
    if provider == "anthropic":
        return {"x-api-key": settings.anthropic_key, "anthropic-version": "2023-06-01"}
    if provider == "gemini":
        return {"x-goog-api-key": settings.gemini_key}
    key = settings.keys()[provider]
    return {"Authorization": f"Bearer {key}"} if key else {}


def base(settings, provider):
    url = settings.compatible_base.rstrip("/") if provider == "compatible" else BASES[provider]
    if not url.startswith(("https://", "http://")):
        raise ValueError("Invalid admin-configured provider base URL.")
    return url


async def discover_models(settings, provider: str):
    async with httpx.AsyncClient(timeout=20, trust_env=False) as client:
        # Account-filtered discovery. No arbitrary ranking or automatic expensive-model selection.
        params = {"pageSize": 100} if provider == "gemini" else ({"limit": 100} if provider == "anthropic" else {})
        r = await client.get(base(settings, provider) + "/models", headers=headers(settings, provider), params=params)
        r.raise_for_status()
        data = r.json()
        if provider == "gemini":
            values = [
                {"id": v["name"].removeprefix("models/"), "name": v.get("displayName", v["name"])}
                for v in data.get("models", [])
                if "generateContent" in v.get("supportedGenerationMethods", [])
            ]
            more = bool(data.get("nextPageToken"))
        else:
            values = [
                {"id": v["id"], "name": v.get("display_name") or v.get("name") or v["id"]} for v in data.get("data", [])
            ]
            more = bool(data.get("has_more"))
        return {
            "models": values[:200],
            "has_more": more,
            "note": "Account availability, not a ranking. Some listed IDs are not chat-capable; a manual ID is also supported.",
        }


async def stream_model(settings, provider, model, system, messages):
    h = headers(settings, provider)
    root = base(settings, provider)
    if provider == "anthropic":
        endpoint = root + "/messages"
        payload = {
            "model": model,
            "max_tokens": settings.max_tokens,
            "system": system,
            "messages": messages,
            "stream": True,
        }
    elif provider == "gemini":
        endpoint = root + "/models/" + quote(model.removeprefix("models/"), safe="") + ":streamGenerateContent?alt=sse"
        payload = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [
                {"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
                for m in messages
            ],
            "generationConfig": {"maxOutputTokens": settings.max_tokens},
        }
    elif provider == "openai" and settings.openai_api_mode == "responses":
        endpoint = root + "/responses"
        payload = {
            "model": model,
            "instructions": system,
            "input": messages,
            "max_output_tokens": settings.max_tokens,
            "stream": True,
            "store": False,
        }
    else:
        endpoint = root + "/chat/completions"
        payload = {
            "model": model,
            "messages": [{"role": "system", "content": system}] + messages,
            "max_completion_tokens" if provider == "openai" else "max_tokens": settings.max_tokens,
            "stream": True,
        }
    emitted = False
    async with httpx.AsyncClient(timeout=httpx.Timeout(90, connect=10), trust_env=False) as client:
        async with client.stream("POST", endpoint, headers=h, json=payload) as r:
            r.raise_for_status()
            async for line in r.aiter_lines():
                if not line.startswith("data:"):
                    continue
                text = line[5:].strip()
                if not text or text == "[DONE]":
                    continue
                data = json.loads(text)
                if data.get("error") or data.get("type") in {"error", "response.failed"}:
                    raise ValueError("Provider interrupted the response. Check the model and account quota.")
                if provider == "anthropic":
                    delta = data.get("delta", {})
                    chunk = delta.get("text", "") if delta.get("type") == "text_delta" else ""
                elif provider == "gemini":
                    chunk = "".join(
                        p.get("text", "")
                        for c in data.get("candidates", [])
                        for p in c.get("content", {}).get("parts", [])
                        if not p.get("thought")
                    )
                elif provider == "openai" and settings.openai_api_mode == "responses":
                    chunk = data.get("delta", "") if data.get("type") == "response.output_text.delta" else ""
                else:
                    choices = data.get("choices", [])
                    chunk = choices[0].get("delta", {}).get("content", "") if choices else ""
                    if not isinstance(chunk, str):
                        chunk = ""
                if chunk:
                    emitted = True
                    yield chunk

    if not emitted:
        raise ValueError(
            "The provider returned no text. Check model compatibility, safety status and output-token limits."
        )
