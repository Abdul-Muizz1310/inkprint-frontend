#!/usr/bin/env bash
# Push required secrets to GitHub Actions for CI.
# Usage: ./scripts/set-secrets.sh
set -euo pipefail

REPO="Abdul-Muizz1310/inkprint-frontend"

# Nothing secret is required for CI today — NEXT_PUBLIC_API_URL and
# NEXT_PUBLIC_SITE_URL are hardcoded in ci.yml. Add more here if that
# changes (e.g. sentry DSN, vercel deploy hooks).

echo "No CI secrets currently required for ${REPO}."
