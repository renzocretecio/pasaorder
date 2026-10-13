"""Private classifier API. Bind to loopback unless a private network is configured."""

from __future__ import annotations

import hmac
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from thinkless_service import classify_conversation, warmup


def require_internal_key(x_internal_key: str | None = Header(default=None)) -> None:
    expected = os.getenv("INFERENCE_API_KEY", "")
    if not expected or not x_internal_key or not hmac.compare_digest(x_internal_key, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


class Message(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: str = Field(pattern=r"^(customer|store)$")
    content: str = Field(min_length=1, max_length=4000)


class ClassifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    messages: list[Message] = Field(min_length=1, max_length=50)
    has_active_order: bool = False


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if not os.getenv("INFERENCE_API_KEY"):
        raise RuntimeError("INFERENCE_API_KEY must be set")
    warmup()
    yield


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/classify", dependencies=[Depends(require_internal_key)])
def classify(data: ClassifyRequest):
    return classify_conversation(
        [message.model_dump() for message in data.messages], data.has_active_order
    )
