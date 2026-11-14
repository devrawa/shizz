"""Read-only public-web fetcher. Resolve once, pin the socket, verify TLS for the original hostname."""

import asyncio
import ipaddress
import json
import os
import socket
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit
import httpx
from bs4 import BeautifulSoup

MAX_BYTES = 1_500_000
BLOCKED_V6 = tuple(
    ipaddress.ip_network(v) for v in ("64:ff9b::/96", "64:ff9b:1::/48", "2001::/23", "2002::/16", "3fff::/20")
)


class FetchError(ValueError):
    pass


def public_ip(value: str) -> bool:
    try:
        ip = ipaddress.ip_address(value)
        return (
            ip.is_global
            and not ip.is_multicast
            and not (
                ip.version == 6
                and (
                    ip.ipv4_mapped is not None
                    or ip.sixtofour is not None
                    or ip.teredo is not None
                    or any(ip in n for n in BLOCKED_V6)
                )
            )
        )
    except ValueError:
        return False


def parse_url(url: str):
    if any(c.isspace() or ord(c) < 32 or c == "\\" for c in url):
        raise FetchError("Whitespace, controls and backslashes are not allowed in URLs.")
    try:
        p = urlsplit(url)
        host = (p.hostname or "").encode("idna").decode().lower()
        port = p.port or (443 if p.scheme == "https" else 80)
    except (ValueError, UnicodeError) as exc:
        raise FetchError("Invalid URL.") from exc
    if p.scheme not in {"http", "https"} or not host or p.username is not None or p.password is not None:
        raise FetchError("Only HTTP(S) URLs without credentials are allowed.")
    if (p.scheme == "https" and port != 443) or (p.scheme == "http" and port != 80):
        raise FetchError("Only standard HTTP(S) ports are allowed.")
    if host == "localhost" or host.endswith((".localhost", ".local", ".internal")) or "%" in host:
        raise FetchError("Private/local targets are blocked.")
    netloc = f"[{host}]" if ":" in host else host
    canonical = urlunsplit((p.scheme, netloc, p.path or "/", p.query, ""))
    return canonical, host, port


async def resolve_public(host: str, port: int) -> list[str]:
    loop = asyncio.get_running_loop()
    try:
        infos = await asyncio.wait_for(loop.getaddrinfo(host, port, type=socket.SOCK_STREAM), 5)
    except (OSError, TimeoutError) as exc:
        raise FetchError("Could not resolve target host.") from exc
    ips = list(dict.fromkeys(i[4][0] for i in infos))
    if not ips or not all(public_ip(ip) for ip in ips):
        raise FetchError("DNS returned a private, reserved or non-public address.")
    return ips


async def _python_fetch(url: str, redirects: bool):
    for _ in range(4):
        canonical, host, port = parse_url(url)
        ips = await resolve_public(host, port)
        # Connect to the validated IP, not the hostname (avoids a DNS rebinding TOCTOU).
        pinned = httpx.URL(canonical).copy_with(host=ips[0])
        async with httpx.AsyncClient(trust_env=False, follow_redirects=False, timeout=15) as client:
            async with client.stream(
                "GET",
                pinned,
                headers={
                    "Host": f"[{host}]" if ":" in host else host,
                    "User-Agent": "shizz-ai-agent/0.1 read-only-research",
                    "Accept-Encoding": "identity",
                },
                extensions={"sni_hostname": host},
            ) as response:
                headers = dict(response.headers)
                if 300 <= response.status_code < 400 and redirects and headers.get("location"):
                    url = urljoin(canonical, headers["location"])
                    continue
                allowed = ("text/", "application/json", "application/xhtml+xml")
                if not headers.get("content-type", "").lower().startswith(allowed):
                    raise FetchError("Only textual pages are supported; no downloads or scripts are executed.")
                data = bytearray()
                async for chunk in response.aiter_bytes():
                    data.extend(chunk)
                    if len(data) > MAX_BYTES:
                        raise FetchError("Page exceeds the 1.5 MB reading limit.")
                return {
                    "url": canonical,
                    "status": response.status_code,
                    "headers": headers,
                    "body": data.decode("utf-8", errors="replace"),
                    "engine": "python-pinned",
                }
    raise FetchError("Too many redirects.")


def worker_env():
    return {k: v for k, v in os.environ.items() if k in {"PATH", "SYSTEMROOT", "SSL_CERT_FILE", "SSL_CERT_DIR"}}


async def fetch_public(url: str, binary: str = "", redirects: bool = True):
    parse_url(url)
    if binary and Path(binary).is_file() and os.access(binary, os.X_OK):
        proc = await asyncio.create_subprocess_exec(
            binary,
            url,
            "follow" if redirects else "nofollow",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=worker_env(),
        )
        try:
            out, _ = await asyncio.wait_for(proc.communicate(), timeout=25)
        except (TimeoutError, asyncio.CancelledError):
            proc.kill()
            await proc.wait()
            raise
        if proc.returncode != 0:
            # Fail closed; never bypass a native worker rejection through a second engine.
            raise FetchError("Fetchguard blocked or could not read this public page.")
        if len(out) > MAX_BYTES * 7:
            raise FetchError("Worker output limit exceeded.")
        result = json.loads(out)
        result["engine"] = "go-fetchguard"
        return result
    return await _python_fetch(url, redirects)


def extract_page(result: dict):
    soup = BeautifulSoup(result["body"], "html.parser")
    title = soup.title.get_text(" ", strip=True)[:250] if soup.title else result["url"]
    for item in soup(["script", "style", "noscript", "nav", "footer", "form", "iframe", "svg"]):
        item.decompose()
    root = soup.find("article") or soup.find("main") or soup
    text = "\n".join(line.strip() for line in root.get_text("\n").splitlines() if line.strip())
    return {
        "url": result["url"],
        "title": title,
        "text": text[:28000],
        "status": result["status"],
        "truncated": len(text) > 28000,
        "engine": result["engine"],
        "untrusted": True,
    }
