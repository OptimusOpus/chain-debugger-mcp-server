#!/bin/bash

# Quick start script for HTTPS mode
echo "🚀 Starting MCP Server with HTTPS..."

# Check if certificates exist
if [ ! -f "./certs/server.crt" ] || [ ! -f "./certs/server.key" ]; then
    echo "⚠️  SSL certificates not found!"
    echo "🔐 Generating certificates..."
    ./generate-certs.sh
fi

echo "🌐 Starting server on https://localhost:3000/mcp"
MCP_TRANSPORT=http HTTPS_ENABLED=true pnpm start