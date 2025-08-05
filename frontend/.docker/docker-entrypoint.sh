#!/bin/bash
set -e

# Generate runtime environment configuration
echo "Generating environment configuration..."
envsubst < /usr/share/nginx/html/env.js.template > /usr/share/nginx/html/env.js

# Start nginx
echo "Starting nginx..."
exec "$@" 