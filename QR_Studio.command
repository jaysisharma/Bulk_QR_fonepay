#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

if [ -f "$DIR/.venv/bin/python" ]; then
    "$DIR/.venv/bin/python" "$DIR/desktop_app.py"
else
    python3 "$DIR/desktop_app.py"
fi
