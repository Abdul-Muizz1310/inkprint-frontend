#!/usr/bin/env bash
# Local development helper.
set -euo pipefail

if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "created .env.local from .env.example"
fi

pnpm install
pnpm dev
