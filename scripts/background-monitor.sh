#!/bin/bash

# Background Monitor Service
# Keeps the enhanced monitoring system running continuously

MONITOR_SCRIPT="scripts/enhanced-monitoring-system.ts"
LOG_FILE="logs/background-monitor.log"
PID_FILE="logs/monitor.pid"

# Create logs directory if it doesn't exist
mkdir -p logs

# Function to start the monitor
start_monitor() {
    echo "🚀 Starting Enhanced Monitoring System in background..."
    echo "📝 Logs will be written to: $LOG_FILE"
    echo "🆔 Process ID will be stored in: $PID_FILE"
    
    # Start the monitoring system in background
    npx tsx $MONITOR_SCRIPT start > $LOG_FILE 2>&1 &
    
    # Save the process ID
    echo $! > $PID_FILE
    
    echo "✅ Monitor started with PID: $(cat $PID_FILE)"
    echo "📊 Monitor is now running in the background"
    echo "🛑 To stop: ./scripts/background-monitor.sh stop"
}

# Function to stop the monitor
stop_monitor() {
    if [ -f $PID_FILE ]; then
        PID=$(cat $PID_FILE)
        echo "🛑 Stopping monitor with PID: $PID"
        
        # Try graceful shutdown first
        kill $PID 2>/dev/null
        
        # Wait a bit for graceful shutdown
        sleep 2
        
        # Force kill if still running
        if kill -0 $PID 2>/dev/null; then
            echo "⚠️ Force killing monitor..."
            kill -9 $PID 2>/dev/null
        fi
        
        rm -f $PID_FILE
        echo "✅ Monitor stopped"
    else
        echo "❌ No monitor PID file found"
    fi
}

# Function to check monitor status
status_monitor() {
    if [ -f $PID_FILE ]; then
        PID=$(cat $PID_FILE)
        if kill -0 $PID 2>/dev/null; then
            echo "✅ Monitor is running (PID: $PID)"
            echo "📝 Recent logs:"
            tail -10 $LOG_FILE
        else
            echo "❌ Monitor PID file exists but process is not running"
            rm -f $PID_FILE
        fi
    else
        echo "❌ Monitor is not running"
    fi
}

# Function to restart the monitor
restart_monitor() {
    echo "🔄 Restarting monitor..."
    stop_monitor
    sleep 2
    start_monitor
}

# Function to show logs
show_logs() {
    if [ -f $LOG_FILE ]; then
        echo "📝 Monitor logs:"
        tail -50 $LOG_FILE
    else
        echo "❌ No log file found"
    fi
}

# Function to run a one-time check
run_check() {
    echo "🔍 Running one-time system check..."
    npx tsx $MONITOR_SCRIPT check
}

# Function to fix issues
fix_issues() {
    echo "🔧 Running issue fixes..."
    npx tsx $MONITOR_SCRIPT fix
}

# Main script logic
case "$1" in
    start)
        start_monitor
        ;;
    stop)
        stop_monitor
        ;;
    restart)
        restart_monitor
        ;;
    status)
        status_monitor
        ;;
    logs)
        show_logs
        ;;
    check)
        run_check
        ;;
    fix)
        fix_issues
        ;;
    *)
        echo "Background Monitor Service"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|logs|check|fix}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the monitoring system in background"
        echo "  stop    - Stop the monitoring system"
        echo "  restart - Restart the monitoring system"
        echo "  status  - Check if monitor is running"
        echo "  logs    - Show recent monitor logs"
        echo "  check   - Run a one-time system check"
        echo "  fix     - Fix detected issues"
        echo ""
        echo "The monitor will automatically:"
        echo "  - Check markdown links every 30 seconds"
        echo "  - Fix broken links automatically"
        echo "  - Update script references"
        echo "  - Maintain file mappings"
        echo "  - Log all activities to logs/background-monitor.log"
        ;;
esac