#!/usr/bin/env bash
set -e

repo_name="$(basename "$PWD")"

printf '\n========================================\n'
printf 'MoMo GetPaid SDK - Codespace quick start\n'
printf '========================================\n\n'
printf 'Run these commands in the terminal:\n\n'
printf 'cd "/workspaces/%s/API SDK"\n' "$repo_name"
printf 'npm install\n'
printf 'npm run build\n'
printf 'npm run start:shop\n'
