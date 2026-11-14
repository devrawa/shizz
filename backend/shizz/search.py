import asyncio
import httpx
from .fetcher import extract_page, fetch_public


async def search_web(settings, query: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=18, trust_env=False) as client:
        if settings.search_key:
            r = await client.get(
                "https://api.search.brave.com/res/v1/web/search",
                headers={"X-Subscription-Token": settings.search_key},
                params={"q": query, "count": 5, "safesearch": "moderate"},
            )
            r.raise_for_status()
            raw = r.json().get("web", {}).get("results", [])
            return [
                {
                    "id": i + 1,
                    "title": v.get("title", ""),
                    "url": v.get("url", ""),
                    "snippet": v.get("description", "")[:2500],
                }
                for i, v in enumerate(raw[:5])
            ]
        if settings.tavily_key:
            r = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": settings.tavily_key,
                    "query": query,
                    "max_results": 5,
                    "search_depth": "basic",
                    "include_answer": False,
                },
            )
            r.raise_for_status()
            return [
                {
                    "id": i + 1,
                    "title": v.get("title", ""),
                    "url": v.get("url", ""),
                    "snippet": v.get("content", "")[:2500],
                }
                for i, v in enumerate(r.json().get("results", [])[:5])
            ]
    raise ValueError("Configure BRAVE_SEARCH_API_KEY or TAVILY_API_KEY on the server.")


async def research(settings, query: str):
    sources = await search_web(settings, query)

    async def read(source):
        try:
            raw = await fetch_public(source["url"], settings.fetch_binary)
            if not 200 <= raw["status"] < 300:
                raise ValueError("Source page did not return success.")
            page = extract_page(raw)
            source["excerpt"] = page["text"][:6000]
            source["read_status"] = "read"
        except Exception:
            source["read_status"] = "snippet_only"
        return source

    # Bounded fan-out: at most three source-page reads per chat turn.
    sources[:3] = await asyncio.gather(*(read(s.copy()) for s in sources[:3]))
    return sources
