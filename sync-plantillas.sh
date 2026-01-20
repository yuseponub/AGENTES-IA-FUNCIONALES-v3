#!/bin/bash
# Sync plantillas from GitHub to n8n Docker volume
# Usage: Run this after git pull

SOURCE_DIR="/root/v3dsl-bot/plantillas"
DEST_DIR="/opt/n8n/local-files/plantillas"

echo "🔄 Sincronizando plantillas de GitHub → n8n..."
echo "Source: $SOURCE_DIR"
echo "Destination: $DEST_DIR"
echo ""

# Copy ALL files from plantillas/
cp -v "$SOURCE_DIR"/* "$DEST_DIR/" 2>/dev/null

echo ""
echo "✅ Plantillas sincronizadas"
echo ""
echo "Archivos en n8n:"
ls -lh "$DEST_DIR/"
