#!/bin/bash

# Certificate generation script for local HTTPS development
CERTS_DIR="./certs"
CERT_FILE="$CERTS_DIR/server.crt"
KEY_FILE="$CERTS_DIR/server.key"

echo "🔐 Generating self-signed certificates for HTTPS..."

# Create certs directory if it doesn't exist
if [ ! -d "$CERTS_DIR" ]; then
    mkdir -p "$CERTS_DIR"
    echo "📁 Created $CERTS_DIR directory"
fi

# Check if certificates already exist
if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    echo "⚠️  Certificates already exist!"
    read -p "Do you want to regenerate them? (y/N): " response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "✅ Using existing certificates"
        exit 0
    fi
fi

# Generate self-signed certificate and key
openssl req -x509 -newkey rsa:4096 -keyout "$KEY_FILE" -out "$CERT_FILE" \
    -days 365 -nodes \
    -subj "/C=US/ST=Local/L=Local/O=MCP Server/OU=Development/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,DNS:127.0.0.1,IP:127.0.0.1"

if [ $? -eq 0 ]; then
    echo "✅ Self-signed certificates generated successfully!"
    echo "📄 Certificate: $CERT_FILE"
    echo "🔑 Private key: $KEY_FILE"
    echo ""
    echo "🌐 Your MCP server will now support HTTPS at https://localhost:3000/mcp"
    echo "⚠️  Note: You'll need to accept the self-signed certificate warning in your browser/client"

    # Set appropriate permissions
    chmod 600 "$KEY_FILE"
    chmod 644 "$CERT_FILE"

    echo "🔒 File permissions set (key: 600, cert: 644)"
else
    echo "❌ Failed to generate certificates"
    exit 1
fi