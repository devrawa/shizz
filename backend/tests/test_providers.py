import json
import httpx
import pytest
from shizz.config import Settings
from shizz.providers import stream_model, discover_models
from shizz import providers


@pytest.mark.parametrize(
    "provider,api_mode,frame,expected_path",
    [
        ("openai", "responses", {"type": "response.output_text.delta", "delta": "سڵاو"}, "/v1/responses"),
        ("openai", "chat_completions", {"choices": [{"delta": {"content": "سڵاو"}}]}, "/v1/chat/completions"),
        ("compatible", "responses", {"choices": [{"delta": {"content": "سڵاو"}}]}, "/v1/chat/completions"),
        (
            "anthropic",
            "responses",
            {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "سڵاو"}},
            "/v1/messages",
        ),
        (
            "gemini",
            "responses",
            {"candidates": [{"content": {"parts": [{"text": "سڵاو"}]}}]},
            "/v1beta/models/test-model:streamGenerateContent",
        ),
    ],
)
async def test_adapter_sse_parsing(provider, api_mode, frame, expected_path, monkeypatch):
    original = httpx.AsyncClient

    def handler(request):
        assert request.url.path == expected_path
        payload = json.loads(request.content)
        assert "test-provider-secret" not in request.content.decode()
        if provider == "openai" and api_mode == "responses":
            assert payload["store"] is False
        return httpx.Response(200, text="data: " + json.dumps(frame, ensure_ascii=False) + "\n\ndata: [DONE]\n\n")

    monkeypatch.setattr(
        providers.httpx, "AsyncClient", lambda *a, **kw: original(*a, transport=httpx.MockTransport(handler), **kw)
    )
    s = Settings(
        openai_key="test-provider-secret",
        anthropic_key="test-provider-secret",
        gemini_key="test-provider-secret",
        compatible_key="test-provider-secret",
        compatible_base="https://compatible.example/v1",
        openai_api_mode=api_mode,
    )
    chunks = [
        c async for c in stream_model(s, provider, "test-model", "safe system", [{"role": "user", "content": "hello"}])
    ]
    assert "".join(chunks) == "سڵاو"


@pytest.mark.parametrize(
    "provider,data",
    [
        ("openai", {"data": [{"id": "example-chat"}]}),
        ("anthropic", {"data": [{"id": "example-chat", "display_name": "Example"}], "has_more": False}),
        ("compatible", {"data": [{"id": "example-chat"}]}),
        (
            "gemini",
            {
                "models": [
                    {
                        "name": "models/example-chat",
                        "displayName": "Example",
                        "supportedGenerationMethods": ["generateContent"],
                    },
                    {"name": "models/embedding", "supportedGenerationMethods": ["embedContent"]},
                ]
            },
        ),
    ],
)
async def test_account_model_discovery(provider, data, monkeypatch):
    original = httpx.AsyncClient
    monkeypatch.setattr(
        providers.httpx,
        "AsyncClient",
        lambda *a, **kw: original(*a, transport=httpx.MockTransport(lambda r: httpx.Response(200, json=data)), **kw),
    )
    s = Settings(compatible_base="https://compatible.example/v1")
    result = await discover_models(s, provider)
    assert [m["id"] for m in result["models"]] == ["example-chat"]
    assert "not a ranking" in result["note"]


async def test_provider_does_not_leak_http_error_body(monkeypatch):
    original = httpx.AsyncClient
    monkeypatch.setattr(
        providers.httpx,
        "AsyncClient",
        lambda *a, **kw: original(
            *a, transport=httpx.MockTransport(lambda r: httpx.Response(401, text="sensitive error body")), **kw
        ),
    )
    with pytest.raises(httpx.HTTPStatusError):
        _ = [
            c
            async for c in stream_model(
                Settings(), "openai", "example", "system", [{"role": "user", "content": "hello"}]
            )
        ]


async def test_empty_provider_output_is_not_fake_success(monkeypatch):
    original = httpx.AsyncClient
    monkeypatch.setattr(
        providers.httpx,
        "AsyncClient",
        lambda *a, **kw: original(
            *a,
            transport=httpx.MockTransport(
                lambda r: httpx.Response(200, text='data: {"type":"response.completed"}\n\n')
            ),
            **kw,
        ),
    )
    with pytest.raises(ValueError, match="no text"):
        _ = [
            c
            async for c in stream_model(
                Settings(), "openai", "example", "system", [{"role": "user", "content": "hello"}]
            )
        ]
