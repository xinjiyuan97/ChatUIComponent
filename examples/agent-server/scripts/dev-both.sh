#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/../../.." && pwd)"
trap 'kill 0' INT TERM EXIT
(cd "$root/examples/agent-server" && PORT=3210 pnpm dev) &
echo "Agent server: http://127.0.0.1:3210"
(cd "$root/examples/next-app" && NEXT_PUBLIC_AGENT_URL=http://127.0.0.1:3210/agent/chat pnpm dev) &
echo "Next app:     http://127.0.0.1:3102"
wait
