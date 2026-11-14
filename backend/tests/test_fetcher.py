import httpx
import pytest
from shizz import fetcher
from shizz.fetcher import FetchError, _python_fetch, resolve_public


async def test_python_fetch_dns_is_pinned_and_tls_sni_preserved(monkeypatch):
    original = httpx.AsyncClient

    async def resolve(host, port):
        assert host == "example.com" and port == 443
        return ["1.1.1.1"]

    def handler(request):
        assert request.url.host == "1.1.1.1"
        assert request.headers["Host"] == "example.com"
        assert request.extensions["sni_hostname"] == "example.com"
        assert "cookie" not in request.headers and "authorization" not in request.headers
        return httpx.Response(200, headers={"content-type": "text/html"}, text="<main>safe</main>")

    monkeypatch.setattr(fetcher, "resolve_public", resolve)
    monkeypatch.setattr(
        fetcher.httpx, "AsyncClient", lambda *a, **kw: original(*a, transport=httpx.MockTransport(handler), **kw)
    )
    result = await _python_fetch("https://example.com", True)
    assert result["url"] == "https://example.com/" and result["status"] == 200


async def test_large_pages_are_rejected(monkeypatch):
    original = httpx.AsyncClient

    async def resolve(*a):
        return ["1.1.1.1"]

    monkeypatch.setattr(fetcher, "resolve_public", resolve)
    monkeypatch.setattr(
        fetcher.httpx,
        "AsyncClient",
        lambda *a, **kw: original(
            *a,
            transport=httpx.MockTransport(
                lambda r: httpx.Response(200, headers={"content-type": "text/html"}, content=b"a" * 1_500_001)
            ),
            **kw,
        ),
    )
    with pytest.raises(FetchError, match="limit"):
        await _python_fetch("https://example.com", True)


async def test_redirect_to_private_host_revalidated(monkeypatch):
    original = httpx.AsyncClient
    calls = []

    async def resolve(host, port):
        calls.append(host)
        if host == "127.0.0.1":
            raise FetchError("private")
        return ["1.1.1.1"]

    monkeypatch.setattr(fetcher, "resolve_public", resolve)
    monkeypatch.setattr(
        fetcher.httpx,
        "AsyncClient",
        lambda *a, **kw: original(
            *a,
            transport=httpx.MockTransport(lambda r: httpx.Response(302, headers={"location": "http://127.0.0.1/"})),
            **kw,
        ),
    )
    with pytest.raises(FetchError):
        await _python_fetch("https://example.com", True)
    assert calls == ["example.com", "127.0.0.1"]


async def test_mixed_public_private_dns_fails_closed(monkeypatch):
    import asyncio
    import socket

    loop = asyncio.get_running_loop()

    async def infos(*a, **kw):
        return [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("1.1.1.1", 443)),
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.1", 443)),
        ]

    monkeypatch.setattr(loop, "getaddrinfo", infos)
    with pytest.raises(FetchError, match="private"):
        await resolve_public("mixed.example", 443)
