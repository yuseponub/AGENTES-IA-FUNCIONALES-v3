#!/bin/bash

# Robot API v2 Manager Script
# Uso: ./robot-manager.sh [start|stop|restart|status|logs|build]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_NAME="robot-api-v2"
LOG_FILE="/tmp/robot-api-v2.log"

case "$1" in
  start)
    echo "🚀 Iniciando Robot API v2..."
    cd "$SCRIPT_DIR"
    nohup node dist/index.js > "$LOG_FILE" 2>&1 &
    echo $! > /tmp/robot-api-v2.pid
    echo "✅ Robot iniciado (PID: $(cat /tmp/robot-api-v2.pid))"
    echo "📋 Logs: tail -f $LOG_FILE"
    ;;

  stop)
    echo "🛑 Deteniendo Robot API v2..."
    if [ -f /tmp/robot-api-v2.pid ]; then
      kill $(cat /tmp/robot-api-v2.pid) 2>/dev/null
      rm /tmp/robot-api-v2.pid
      echo "✅ Robot detenido"
    else
      echo "⚠️ No se encontró PID, intentando pkill..."
      pkill -f "node.*robot-api-v2" || echo "No hay proceso corriendo"
    fi
    ;;

  restart)
    $0 stop
    sleep 2
    $0 start
    ;;

  status)
    if [ -f /tmp/robot-api-v2.pid ] && kill -0 $(cat /tmp/robot-api-v2.pid) 2>/dev/null; then
      echo "✅ Robot API v2 está corriendo (PID: $(cat /tmp/robot-api-v2.pid))"
      curl -s http://localhost:3000/health | head -c 200
      echo ""
    else
      echo "❌ Robot API v2 no está corriendo"
    fi
    ;;

  logs)
    echo "📋 Mostrando logs (Ctrl+C para salir)..."
    tail -f "$LOG_FILE"
    ;;

  build)
    echo "🔨 Compilando TypeScript..."
    cd "$SCRIPT_DIR"
    npm run build
    echo "✅ Compilación completada"
    ;;

  *)
    echo "Uso: $0 {start|stop|restart|status|logs|build}"
    echo ""
    echo "Comandos:"
    echo "  start   - Iniciar el robot"
    echo "  stop    - Detener el robot"
    echo "  restart - Reiniciar el robot"
    echo "  status  - Ver estado del robot"
    echo "  logs    - Ver logs en tiempo real"
    echo "  build   - Recompilar TypeScript"
    exit 1
    ;;
esac
