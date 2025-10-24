#!/bin/bash

# Wait for MySQL to be ready using Python
echo "Waiting for MySQL..."
python3 -c "
import time
import os
import sys
from sqlalchemy import create_engine, text

mysql_host = os.getenv('MYSQL_HOST', 'glowworm-mysql')
mysql_port = int(os.getenv('MYSQL_PORT', '3306'))
mysql_user = os.getenv('MYSQL_USER', 'glowworm')
mysql_password = os.getenv('MYSQL_PASSWORD', '')
mysql_database = os.getenv('MYSQL_DATABASE', 'glowworm')

database_url = f'mysql+pymysql://{mysql_user}:{mysql_password}@{mysql_host}:{mysql_port}/{mysql_database}'

while True:
    try:
        engine = create_engine(database_url, connect_args={'connect_timeout': 5})
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        print('MySQL is ready!')
        break
    except Exception as e:
        print('Waiting for MySQL...')
        time.sleep(2)
"

# Run database migrations
echo "🔄 Running database migrations..."
python -m alembic upgrade head

# Start the backend server
echo "🚀 Starting backend server..."
python -m uvicorn main:app --host 0.0.0.0 --port 8001
