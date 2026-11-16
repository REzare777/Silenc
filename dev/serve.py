import http.server, socketserver, os
os.chdir('/workspace/village/dist')

class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

class S(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

S(('127.0.0.1', 4205), H).serve_forever()
