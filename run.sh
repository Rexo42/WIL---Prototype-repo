#!/bin/zsh
# find run.sh path
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# cd to folder with main.py
cd "$SCRIPT_DIR"

# load .env
# if [ -f .env ]; then
#   export $(grep -v '^#' .env | xargs)
# fi

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi



# run main.py
exec /usr/bin/env python3 main.py