#!/usr/bin/env bash
# Start FindiT on macOS/Linux: Django API on :8000 and the Vite dev server on :5173.
# First run sets everything up (venv, packages, database, demo data).
#   ./run.sh           dev mode (two servers, hot reload)
#   ./run.sh --single  one port: builds the frontend and serves it through Django on :8000
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
if [ -x "$ROOT/backend/venv/bin/python" ]; then PY="$ROOT/backend/venv/bin/python"; else PY="$ROOT/backend/venv/Scripts/python"; fi

if [ ! -x "$PY" ] && [ ! -f "$PY.exe" ]; then
  echo "Creating the Python virtual env..."
  python3 -m venv "$ROOT/backend/venv"
  PY="$ROOT/backend/venv/bin/python"
  "$PY" -m pip install -q -r "$ROOT/backend/requirements.txt"
fi

cd "$ROOT/backend"
"$PY" manage.py migrate -v 0
"$PY" manage.py seed_demo   # safe to repeat: skips data that already exists

cd "$ROOT/frontend"
[ -d node_modules ] || npm install

if [ "$1" = "--single" ]; then
  npm run build
  cd "$ROOT/backend"
  echo "FindiT is running at http://127.0.0.1:8000"
  exec "$PY" manage.py runserver 127.0.0.1:8000
fi

cd "$ROOT/backend"
"$PY" manage.py runserver 127.0.0.1:8000 &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT
echo "API on http://127.0.0.1:8000 - app on http://localhost:5173"
cd "$ROOT/frontend"
npm run dev
