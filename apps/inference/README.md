# PasaOrder inference service

This private FastAPI service uses [ThinkLess](https://github.com/inboxpraveen/ThinkLess) to classify chat conversations into `POSSIBLE_ORDER`, `NEEDS_ATTENTION`, or `NORMAL`. Express remains the main API and calls this service after saving a customer message. Gemini extraction stays in Express and runs when an owner reviews a draft.

## Local setup

1. Install [uv](https://docs.astral.sh/uv/), then run `cd apps/inference && uv sync`.
2. Copy `.env.example` to `.env` and set a random `INFERENCE_API_KEY` of at least 32 characters.
3. Set `INFERENCE_URL=http://127.0.0.1:8001` and the same `INFERENCE_API_KEY` in `apps/api/.env`.
4. From the repository root, run `pnpm dev:inference` in one terminal and `pnpm dev` in another.

The default `rules` provider is lightweight and sends questions, greetings, and ambiguous messages to `NEEDS_ATTENTION`; simple thanks and acknowledgements enter `NORMAL`. It uses the real ThinkLess `Engine`, `Choice`, and `Rules` APIs; it does not claim to run a trained model. To try the local Laya decision model, run `uv sync --extra model`, set `THINKLESS_PROVIDER=laya` in `.env`, and restart. Laya downloads weights at startup and needs more memory; its default checkpoint is English, so test Tagalog and Taglish examples before relying on its buckets. The service binds to loopback for local development. On deployment, place it on a private network and do not expose `/classify` publicly.

Check it with `cd apps/inference && uv run pytest`. A direct authenticated request:

```bash
curl -sS http://127.0.0.1:8001/classify \
  -H "Content-Type: application/json" \
  -H "X-Internal-Key: $INFERENCE_API_KEY" \
  -d '{"messages":[{"role":"customer","content":"Boss pa-order 2 burgers"}],"has_active_order":false}'
```

Expected bucket: `POSSIBLE_ORDER`. The response includes the ThinkLess provider, status, and confidence for debugging. Classification never changes an order directly.
