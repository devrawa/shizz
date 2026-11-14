from typing import Literal
from pydantic import BaseModel, Field, model_validator

Provider = Literal["auto", "openai", "anthropic", "gemini", "compatible"]


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=16000)


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=40)
    provider: Provider = "auto"
    model: str = Field(default="", max_length=160, pattern=r"^[a-zA-Z0-9._:/@+-]*$")
    profile: Literal["fast", "balanced", "deep"] = "balanced"
    language: Literal["ckb", "en", "match"] = "ckb"
    research: bool = False
    glossary: str = Field(default="", max_length=3000)

    @model_validator(mode="after")
    def bounded(self):
        if sum(len(m.content) for m in self.messages) > 60000:
            raise ValueError("Conversation too long; start a new chat.")
        if self.messages[-1].role != "user":
            raise ValueError("The last message must be from the user.")
        return self


class SearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=500)


class ReadRequest(BaseModel):
    url: str = Field(min_length=8, max_length=2048)


class HeaderRequest(ReadRequest):
    authorized: bool = False
    scope_host: str = Field(min_length=1, max_length=253)


class ScanRequest(BaseModel):
    text: str = Field(min_length=1, max_length=80000)


class ProposalRequest(BaseModel):
    client: str = Field(min_length=1, max_length=120)
    service: str = Field(min_length=2, max_length=200)
    deliverables: str = Field(min_length=2, max_length=2500)
    hours: float = Field(ge=0.25, le=500)
    rate: float = Field(ge=1, le=10000)
    currency: Literal["USD", "IQD", "EUR"] = "USD"
    language: Literal["en", "ckb"] = "en"


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=3500)
    language: Literal["ckb", "en"] = "ckb"


class VoiceToolRequest(BaseModel):
    name: Literal["web_search", "read_page"]
    query: str = Field(default="", max_length=500)
    url: str = Field(default="", max_length=2048)
