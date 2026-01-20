#!/bin/bash

# Start Bigin Robot API REST

cd "$(dirname "$0")"

# Matar procesos anteriores
pkill -9 -f "node src/index.js"

# Arrancar robot
echo "🚀 Arrancando Bigin Robot API REST..."
nohup node src/index.js > /tmp/robot-api-rest.log 2>&1 &

PID=$!
echo "✅ Robot arrancado con PID: $PID"
echo "📍 Puerto: 3000"
echo "📋 Log: /tmp/robot-api-rest.log"

sleep 2

# Health check
if curl -s http://localhost:3000/health | grep -q "healthy"; then
  echo "✅ Robot funcionando correctamente"
else
  echo "❌ Error: Robot no responde"
  exit 1
fi
