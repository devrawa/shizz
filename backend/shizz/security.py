import asyncio
import json
import os
from pathlib import Path
from .fetcher import FetchError, fetch_public, parse_url, worker_env

PREFIXES = {
    "ghp_": (36, "GitHub token"),
    "github_pat_": (40, "GitHub fine-grained token"),
    "AKIA": (16, "AWS access key ID"),
    "sk_live_": (16, "Live service key"),
    "xoxb-": (16, "Slack bot token"),
}
PRIVATE = (
    "-----BEGIN PRIVATE KEY-----",
    "-----BEGIN RSA PRIVATE KEY-----",
    "-----BEGIN EC PRIVATE KEY-----",
    "-----BEGIN OPENSSH PRIVATE KEY-----",
)


def scan_python(text):
    findings = []
    for number, line in enumerate(text.splitlines(), 1):
        for prefix, (minimum, kind) in PREFIXES.items():
            pos = line.find(prefix)
            if pos >= 0:
                tail = line[pos + len(prefix) :]
                count = 0
                for char in tail:
                    if char.isascii() and (char.isalnum() or char in "_-"):
                        count += 1
                    else:
                        break
                if count >= minimum:
                    findings.append({"line": number, "kind": kind, "severity": "high"})
        if any(marker in line for marker in PRIVATE):
            findings.append({"line": number, "kind": "Private key material", "severity": "critical"})
        if len(findings) >= 200:
            break
    return {
        "findings": findings[:200],
        "scanner": "python",
        "note": "Pattern hints only, not a complete secret detector. Values are never returned. Rotate any real exposed secret.",
    }


async def scan_text(text, binary=""):
    if binary and Path(binary).is_file() and os.access(binary, os.X_OK):
        proc = await asyncio.create_subprocess_exec(
            binary,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=worker_env(),
        )
        try:
            out, _ = await asyncio.wait_for(proc.communicate(text.encode()), 5)
        except (TimeoutError, asyncio.CancelledError):
            proc.kill()
            await proc.wait()
            raise
        if proc.returncode:
            raise ValueError("Secretguard failed; no user code was executed.")
        result = json.loads(out)
        result["note"] = (
            "Pattern hints only, not a complete secret detector. Values are never returned. Rotate real exposed secrets."
        )
        return result
    return scan_python(text)


async def audit_headers(settings, request):
    _, host, _ = parse_url(request.url)
    scope = request.scope_host.lower().encode("idna").decode()
    if not request.authorized:
        raise PermissionError("Confirm you own this system or have written authorization.")
    if host != scope or host not in settings.security_hosts:
        raise PermissionError(
            "Exact host must match both the declared scope and SECURITY_ALLOWED_HOSTS on the server. No wildcards."
        )
    result = await fetch_public(request.url, settings.fetch_binary, redirects=False)
    if 300 <= result["status"] < 400:
        raise FetchError(
            "Redirect not followed during security checks. Review its destination and authorize it separately."
        )
    headers = {k.lower(): v for k, v in result["headers"].items()}
    checks = [
        ("content-security-policy", "Consider a tested Content-Security-Policy appropriate to the application."),
        ("strict-transport-security", "For HTTPS, consider HSTS after verifying all required hosts support TLS."),
        ("x-content-type-options", "Consider X-Content-Type-Options: nosniff."),
        ("referrer-policy", "Consider Referrer-Policy: strict-origin-when-cross-origin."),
        ("permissions-policy", "Restrict browser capabilities the application does not need."),
    ]
    findings = [
        {"header": name, "state": "present" if name in headers else "review", "recommendation": advice}
        for name, advice in checks
    ]
    if "x-frame-options" not in headers and "frame-ancestors" not in headers.get("content-security-policy", ""):
        findings.append(
            {
                "header": "framing protection",
                "state": "review",
                "recommendation": "Consider CSP frame-ancestors to reduce unintended embedding.",
            }
        )
    return {
        "url": result["url"],
        "status": result["status"],
        "engine": result["engine"],
        "findings": findings,
        "note": "One read-only GET. Missing headers are review hints, not proof of exploitability or a complete audit. No cookies or credentials were sent.",
    }
