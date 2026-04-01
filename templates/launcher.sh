#!/usr/bin/env bash
# __BRAND__ Launcher — macOS/Linux
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 隔离配置目录（避开全局 OAuth token）
export CLAUDE_CONFIG_DIR="$HOME/.__BRAND_LOWER__"
mkdir -p "$CLAUDE_CONFIG_DIR"
[ -f "$SCRIPT_DIR/CLAUDE.md" ] && cp "$SCRIPT_DIR/CLAUDE.md" "$CLAUDE_CONFIG_DIR/CLAUDE.md"

# API 配置（ANTHROPIC_AUTH_TOKEN 优先级高于 OAuth，用于覆盖全局登录态）
export ANTHROPIC_AUTH_TOKEN="__API_KEY__"
export ANTHROPIC_API_KEY=""
export ANTHROPIC_BASE_URL="__API_BASE_URL__"
export ENABLE_TOOL_SEARCH=false
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1

exec node "$SCRIPT_DIR/cli.js" "$@"
