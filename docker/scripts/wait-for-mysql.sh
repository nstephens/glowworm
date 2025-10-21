#!/bin/bash
# Wait for MySQL to be ready

set -e

HOST=${MYSQL_HOST:-glowworm-mysql}
PORT=${MYSQL_PORT:-3306}
TIMEOUT=${TIMEOUT:-60}

echo "Waiting for MySQL at $HOST:$PORT..."

for i in $(seq $TIMEOUT); do
    if nc -z $HOST $PORT; then
        echo "MySQL is ready!"
        exit 0
    fi
    echo "Waiting... ($i/$TIMEOUT)"
    sleep 1
done

echo "MySQL connection timed out after $TIMEOUT seconds"
exit 1

