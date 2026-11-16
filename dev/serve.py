"""Локальный сервер сборки для тестов.

Отдаёт папку `dist` на http://127.0.0.1:4205.

Особенность: у каждого соединения есть таймаут. Без него «брошенное»
соединение от упавшего браузера держит поток сервера, и новые страницы
перестают открываться — тесты начинают падать с таймаутом навигации.
"""

import http.server
import os
import socketserver

os.chdir('/workspace/village/dist')


class H(http.server.SimpleHTTPRequestHandler):
    """Отдача файлов без журнала запросов."""

    def log_message(self, *a):
        pass

    def handle_one_request(self):
        """Одна сделка с таймаутом: зависший клиент не блокирует сервер."""
        self.connection.settimeout(20)
        super().handle_one_request()


class S(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True
    # очередь запросов побольше: браузер открывает сразу несколько соединений
    request_queue_size = 64


S(('127.0.0.1', 4205), H).serve_forever()
