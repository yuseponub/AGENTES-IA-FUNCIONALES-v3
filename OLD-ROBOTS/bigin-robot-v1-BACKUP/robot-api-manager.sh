#!/bin/bash
# Robot API Manager - Control script for bigin-robot API
# Location: /root/v3dsl-bot/bigin-robot/robot-api-manager.sh

ROBOT_DIR="/root/v3dsl-bot/bigin-robot/packages/robot-api"
LOG_FILE="/tmp/robot-api.log"
PID_FILE="/tmp/robot-api.pid"

case "$1" in
  start)
    echo "🚀 Starting Robot API from GitHub repository..."

    # Kill any existing robot-api processes
    lsof -ti :3000 | xargs kill -9 2>/dev/null
    sleep 2

    # Start robot
    cd "$ROBOT_DIR" || exit 1
    nohup npm run start > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"

    sleep 5

    # Check if started successfully
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
      echo "✅ Robot API started successfully!"
      echo "📊 PID: $(cat $PID_FILE)"
      echo "📄 Log: $LOG_FILE"
    else
      echo "❌ Failed to start Robot API. Check logs: $LOG_FILE"
      exit 1
    fi
    ;;

  stop)
    echo "🛑 Stopping Robot API..."

    if [ -f "$PID_FILE" ]; then
      PID=$(cat "$PID_FILE")
      kill -9 "$PID" 2>/dev/null
      rm -f "$PID_FILE"
      echo "✅ Robot API stopped (PID: $PID)"
    fi

    # Also kill any process on port 3000
    lsof -ti :3000 | xargs kill -9 2>/dev/null
    echo "✅ Port 3000 freed"
    ;;

  restart)
    echo "🔄 Restarting Robot API..."
    $0 stop
    sleep 2
    $0 start
    ;;

  status)
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
      echo "✅ Robot API is running"
      curl -s http://localhost:3000/health | jq '.' 2>/dev/null || curl -s http://localhost:3000/health
    else
      echo "❌ Robot API is not running"
      exit 1
    fi
    ;;

  logs)
    echo "📄 Showing Robot API logs (Ctrl+C to exit)..."
    tail -f "$LOG_FILE"
    ;;

  build)
    echo "🔨 Building Robot API..."
    cd /root/v3dsl-bot/bigin-robot || exit 1
    npm run build
    echo "✅ Build completed"
    ;;

  *)
    echo "Robot API Manager"
    echo "Usage: $0 {start|stop|restart|status|logs|build}"
    echo ""
    echo "Commands:"
    echo "  start   - Start the Robot API"
    echo "  stop    - Stop the Robot API"
    echo "  restart - Restart the Robot API"
    echo "  status  - Check if Robot API is running"
    echo "  logs    - Show Robot API logs (tail -f)"
    echo "  build   - Build TypeScript code"
    exit 1
    ;;
esac

exit 0
