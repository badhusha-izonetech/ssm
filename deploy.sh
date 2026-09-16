#!/bin/bash

set -e

PROJECT_DIR="/var/www/success-solar"

echo "======================================"
echo "Starting Success Solar deployment"
echo "======================================"

cd "$PROJECT_DIR"

echo "Pulling latest code..."
git pull origin backend

# ==============================
# BACKEND
# ==============================

echo "Updating backend..."

cd "$PROJECT_DIR/backend"

source venv/bin/activate

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Running database migrations..."
alembic upgrade head

echo "Restarting backend..."
systemctl restart success-solar

echo "Checking backend..."
systemctl is-active --quiet success-solar

# ==============================
# FRONTEND
# ==============================

echo "Updating frontend..."

cd "$PROJECT_DIR/frontend"

echo "Installing frontend dependencies..."
npm ci

echo "Building frontend..."
npm run build

echo "======================================"
echo "Deployment completed successfully!"
echo "======================================"
