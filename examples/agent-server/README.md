# Reference agent server

This is an offline, deterministic `agent-chat/1` reference implementation. It uses only
Node's `node:http` and runs TypeScript directly on Node 22.

## Run

```bash
PORT=3210 pnpm dev
# or
node --experimental-strip-types src/index.ts
```

The server listens on `127.0.0.1`; `PORT` defaults to `3210`. A friendly error is printed if
the port is already occupied. Start both processes with `./scripts/dev-both.sh`: the agent is
at `http://127.0.0.1:3210`, and the Next example is at `http://127.0.0.1:3102`.

To point the browser directly at the agent, set `NEXT_PUBLIC_AGENT_URL` before starting Next:

```bash
NEXT_PUBLIC_AGENT_URL=http://127.0.0.1:3210/agent/chat pnpm --dir ../next-app dev
```

Without that variable the existing `/api/chat` route remains unchanged. The agent uses a
development-only permissive CORS policy (`*` origin and the protocol headers).

## Scenarios

Send `metadata.scenario` in the request body, or use `GET /agent/scenario/:name` to inspect the
registry. The curl shape is:

```bash
curl -N -H 'content-type: application/json' -d '{"metadata":{"scenario":"stop"},"messages":[],"input":[{"type":"message","inputId":"i1","parts":[{"type":"text","text":"hi"}]}]}' http://127.0.0.1:3210/agent/chat
```

| Scenario                                                       | Trigger                                                              |
| -------------------------------------------------------------- | -------------------------------------------------------------------- |
| `stop`, `length`, `tool-calls`, `awaiting-permission`, `error` | `metadata.scenario` with the same name                               |
| `cancel`                                                       | Start a stream, then POST a `cancel` input with its `turnId`/`runId` |
| `cancelled`                                                    | `metadata.scenario=cancelled` (normal terminal fixture)              |
| `disconnect`                                                   | `metadata.scenario=disconnect`                                       |
| `duplicate-out-of-order`                                       | `metadata.scenario=duplicate-out-of-order`                           |
| `structured-error`                                             | `metadata.scenario=structured-error`                                 |
| `unknown-event`                                                | `metadata.scenario=unknown-event`                                    |
| `block-ids`                                                    | `metadata.scenario=block-ids`                                        |
| `client-tool`                                                  | First request emits client tool; post `tool-result` on same turn     |
| `permission`                                                   | First request waits; post `permission-decision` on same turn         |
| `minimal-capabilities`                                         | `metadata.scenario=minimal-capabilities`                             |
| `usage`                                                        | `metadata.scenario=usage`                                            |
| `attachment-limit`                                             | Send a file part with `size > 1024`                                  |

## Stop

Press `Ctrl-C` for one process, or `Ctrl-C` for `dev-both.sh` (its trap closes both children).

## Limits

This is a reference and conformance server, not a production agent: it has no LLM, no
persistence, no authentication, and no production CORS policy. Scenario `cancelled` is a
deterministic terminal fixture; `cancel` tests cancellation of an active run.
