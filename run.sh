#!/usr/bin/env bash
# Launcher script for macOS and Linux
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo " Starting Batch QR & Template PDF Generator (macOS/Linux)"
echo "=========================================================="

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3 from https://python.org"
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment (.venv)..."
    python3 -m venv .venv
fi

# Activate virtual environment
source .venv/bin/activate

# Install / update requirements
echo "📦 Verifying dependencies..."
pip install -q -r requirements.txt

# Launch Streamlit app
echo "🚀 Launching application in your browser..."
streamlit run app.py
