"""后台启动 FastAPI 服务（无窗口模式）"""
import threading
import time
import sys
import os

# 重定向输出到空设备（无日志）
if sys.platform == 'win32':
    sys.stdout = open('nul', 'w')
    sys.stderr = open('nul', 'w')
else:
    sys.stdout = open('/dev/null', 'w')
    sys.stderr = open('/dev/null', 'w')

# 初始化数据库
from services.db import init_database
init_database()

# 启动服务
def start_server():
    import uvicorn
    from api_server import app
    uvicorn.run(app, host='127.0.0.1', port=8765, log_level='error', access_log=False)

server_thread = threading.Thread(target=start_server, daemon=True)
server_thread.start()

# 保持运行
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    pass
