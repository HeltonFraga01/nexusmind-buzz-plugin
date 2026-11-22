#!/usr/bin/env python3
import os
import sys
import json
import ssl
import time
import base64
import hashlib
import secrets
import threading
import urllib.parse
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler

SESSION_FILE = os.path.expanduser("~/.buzz/.nexusmind_auth_session.json")
MCP_HOST = "https://nexusmind.digital"
MCP_RESOURCE = f"{MCP_HOST}/api/v1/mcp"

def _write_session_secure(data):
    os.makedirs(os.path.dirname(SESSION_FILE), exist_ok=True)
    fd = os.open(SESSION_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    os.chmod(SESSION_FILE, 0o600)

def get_ssl_context():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx

def run_oauth_flow():
    ctx = get_ssl_context()
    
    # 1. Start ephemeral HTTP server
    received_code = {}
    auth_event = threading.Event()

    class CallbackHandler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            pass # Silent

        def do_GET(self):
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path == "/callback":
                qs = urllib.parse.parse_qs(parsed.query)
                code = qs.get("code", [None])[0]
                state = qs.get("state", [None])[0]
                error = qs.get("error", [None])[0]

                if error:
                    received_code["error"] = error
                    self.send_response(400)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(f"<h1>Erro na autorização: {error}</h1>".encode("utf-8"))
                elif code:
                    received_code["code"] = code
                    received_code["state"] = state
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.end_headers()
                    html = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>NexusMind Autorizado</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f17; color: #f1f5f9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #131c2e; border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 20px; padding: 40px; text-align: center; max-width: 440px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
    h1 { color: #10b981; margin: 0 0 12px; font-size: 24px; font-weight: 700; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 0 0 16px; }
    .badge { display: inline-block; background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size: 48px; margin-bottom: 16px;">⚡</div>
    <h1>Conexão Autorizada!</h1>
    <p>O NexusMind Gateway foi conectado com sucesso ao <strong>Buzz Desktop</strong>.</p>
    <div class="badge">Sessão MCP Ativa</div>
    <p style="margin-top: 20px; font-size: 12px; color: #64748b;">Você já pode fechar esta aba e retornar ao aplicativo.</p>
  </div>
</body>
</html>"""
                    self.wfile.write(html.encode("utf-8"))
                auth_event.set()
            else:
                self.send_response(404)
                self.end_headers()

    httpd = HTTPServer(("127.0.0.1", 0), CallbackHandler)
    port = httpd.server_address[1]
    redirect_uri = f"http://127.0.0.1:{port}/callback"

    # 2. Dynamic Client Registration (RFC 7591)
    reg_payload = json.dumps({
        "client_name": "Buzz Desktop",
        "token_endpoint_auth_method": "none",
        "redirect_uris": [redirect_uri],
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"]
    }).encode("utf-8")

    reg_req = urllib.request.Request(
        f"{MCP_HOST}/api/v1/mcp/oauth/register",
        data=reg_payload,
        headers={"Content-Type": "application/json", "User-Agent": "BuzzDesktop/1.0"}
    )
    with urllib.request.urlopen(reg_req, context=ctx, timeout=15) as resp:
        reg_info = json.loads(resp.read().decode())

    client_id = reg_info["client_id"]

    # 3. PKCE S256 Challenge
    verifier = secrets.token_urlsafe(32)
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    state = secrets.token_urlsafe(16)

    # 4. Form Complete Auth URL
    auth_params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": "mcp",
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "resource": MCP_RESOURCE
    }
    auth_url = f"{MCP_HOST}/oauth/mcp/authorize?" + urllib.parse.urlencode(auth_params)

    # Save session state so UI can read it
    session_data = {
        "status": "pending",
        "port": port,
        "client_id": client_id,
        "auth_url": auth_url,
        "redirect_uri": redirect_uri,
        "started_at": int(time.time())
    }
    _write_session_secure(session_data)

    # Print to stdout
    print(json.dumps({"type": "auth_url_ready", "auth_url": auth_url, "port": port}))
    sys.stdout.flush()

    # 5. Open browser on macOS
    os.system(f'open "{auth_url}"')

    # 6. Start server thread
    server_thread = threading.Thread(target=httpd.serve_forever)
    server_thread.daemon = True
    server_thread.start()

    # Wait for callback or timeout (120s)
    auth_event.wait(timeout=120)
    httpd.shutdown()

    if "error" in received_code:
        session_data["status"] = "error"
        session_data["error"] = received_code["error"]
        _write_session_secure(session_data)
        print(json.dumps({"type": "error", "error": received_code["error"]}))
        return

    code = received_code.get("code")
    ret_state = received_code.get("state")

    if not code:
        session_data["status"] = "timeout"
        _write_session_secure(session_data)
        print(json.dumps({"type": "timeout", "error": "Timeout aguardando autorização no navegador"}))
        return

    if ret_state != state:
        session_data["status"] = "state_mismatch"
        _write_session_secure(session_data)
        print(json.dumps({"type": "error", "error": "State mismatch na resposta OAuth"}))
        return

    # 7. Exchange Code for Access Token (RFC 6749)
    token_params = urllib.parse.urlencode({
        "grant_type": "authorization_code",
        "client_id": client_id,
        "code": code,
        "redirect_uri": redirect_uri,
        "code_verifier": verifier,
        "resource": MCP_RESOURCE
    }).encode("utf-8")

    token_req = urllib.request.Request(
        f"{MCP_HOST}/api/v1/mcp/oauth/token",
        data=token_params,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "BuzzDesktop/1.0"
        }
    )

    with urllib.request.urlopen(token_req, context=ctx, timeout=15) as resp:
        token_info = json.loads(resp.read().decode())

    session_data["status"] = "authorized"
    session_data["token_data"] = token_info
    session_data["access_token"] = token_info.get("access_token")
    _write_session_secure(session_data)

    print(json.dumps({"type": "authorized", "token": token_info.get("access_token")}))
    sys.stdout.flush()

if __name__ == "__main__":
    run_oauth_flow()
