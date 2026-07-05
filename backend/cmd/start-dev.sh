#!/bin/bash
# Start script for local development

echo ""
echo "============================================="
echo "Starting Express backend..."
echo "If you want to create/change a user,"
echo "use these environment variables:"
echo "  TUDUDI_USER_EMAIL=your_email@example.com"
echo "  TUDUDI_USER_PASSWORD=your_password"
echo "============================================="
echo ""

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
elif [ -f .env.example ]; then
  cp .env.example .env
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
  echo "Created backend/.env from .env.example"
  echo "Update TUDUDI_USER_PASSWORD and TUDUDI_SESSION_SECRET before production use."
fi

NODE_ENV=development PORT=3002 DB_FILE=db/development.sqlite3 ./cmd/start.sh
