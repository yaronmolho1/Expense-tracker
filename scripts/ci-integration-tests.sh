#!/bin/bash
# CI Integration Test Runner
# Starts server, runs tests, cleans up

set -e  # Exit on error

echo "=== Starting Integration Tests (CI) ==="

# Configuration
SERVER_PORT=3000
SERVER_URL="http://127.0.0.1:${SERVER_PORT}"
MAX_WAIT=30

# Start server in background
echo "Starting dev server..."
npm run dev &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server to be ready..."
npx wait-on "${SERVER_URL}" -t 30000

# Run integration tests
echo "Running integration tests..."
npm run test:integration

# Capture test exit code
TEST_EXIT_CODE=$?

# Kill server
echo "Stopping server..."
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

# Exit with test result
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✓ Integration tests passed"
    exit 0
else
    echo "✗ Integration tests failed"
    exit $TEST_EXIT_CODE
fi
