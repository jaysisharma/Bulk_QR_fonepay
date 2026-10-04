"""
Desktop App Wrapper for QR Studio
Runs the Python Streamlit engine in a native macOS standalone application window via pywebview.
"""

import os
import sys
import time
import socket
import subprocess
import urllib.request
import webview


def find_free_port(start_port=8501, max_tries=50):
    """Find an available TCP port for the local server."""
    for port in range(start_port, start_port + max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    return start_port


def wait_for_server(url, timeout=20):
    """Wait until Streamlit server responds."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with urllib.request.urlopen(url, timeout=1) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.3)
    return False


def main():
    port = find_free_port(8501)
    url = f"http://127.0.0.1:{port}"
    proc = None

    if getattr(sys, "frozen", False):
        # Running as standalone compiled executable (PyInstaller)
        base_dir = getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
        app_py_path = os.path.join(base_dir, "app.py")

        if not os.path.exists(app_py_path):
            print(f"Error: Could not find app.py at {app_py_path}")
            sys.exit(1)

        print(f"Starting embedded QR Studio engine on port {port}...")
        import threading
        from streamlit.web import cli as stcli

        sys.argv = [
            "streamlit",
            "run",
            app_py_path,
            "--server.port",
            str(port),
            "--server.headless=true",
            "--server.maxMessageSize=1024",
            "--server.maxUploadSize=1024",
            "--browser.serverAddress=127.0.0.1",
            "--browser.gatherUsageStats=false",
            "--global.developmentMode=false",
            "--theme.base=dark",
            "--theme.primaryColor=#0068c9",
            "--theme.backgroundColor=#0e1117",
            "--theme.secondaryBackgroundColor=#262730",
            "--theme.textColor=#fafafa",
        ]
        server_thread = threading.Thread(target=stcli.main, daemon=True)
        server_thread.start()
    else:
        # Running via standard Python interpreter (.venv)
        base_dir = os.path.dirname(os.path.abspath(__file__))
        app_py_path = os.path.join(base_dir, "app.py")

        if not os.path.exists(app_py_path):
            print(f"Error: Could not find app.py at {app_py_path}")
            sys.exit(1)

        streamlit_cmd = [
            sys.executable,
            "-m",
            "streamlit",
            "run",
            app_py_path,
            "--server.port",
            str(port),
            "--server.headless=true",
            "--server.maxMessageSize=1024",
            "--server.maxUploadSize=1024",
            "--browser.serverAddress=127.0.0.1",
            "--browser.gatherUsageStats=false",
            "--global.developmentMode=false",
            "--theme.base=dark",
            "--theme.primaryColor=#0068c9",
            "--theme.backgroundColor=#0e1117",
            "--theme.secondaryBackgroundColor=#262730",
            "--theme.textColor=#fafafa",
        ]

        print(f"Starting QR Studio backend on port {port}...")
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"

        proc = subprocess.Popen(
            streamlit_cmd,
            cwd=base_dir,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

    try:
        print("Waiting for application to initialize...")
        ready = wait_for_server(url, timeout=25)
        if not ready:
            print("Warning: Server took longer than expected to initialize.")

        print(f"Launching desktop window at {url}...")
        # Create native Mac desktop window
        window = webview.create_window(
            title="QR Studio — Print Layout",
            url=url,
            width=1320,
            height=880,
            min_size=(950, 650),
            text_select=True,
        )

        # Start pywebview main event loop (blocks until window is closed)
        webview.start(debug=False)

    finally:
        print("Closing application and terminating background engine...")
        if proc is not None:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()
        print("Done.")


if __name__ == "__main__":
    main()
