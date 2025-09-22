#!/bin/bash
# MCP Server runner script to handle Node.js compatibility
cd "$(dirname "$0")"
export NODE_OPTIONS="--no-warnings"
exec node build/index.js "$@"