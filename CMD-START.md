# Windows CMD 启动

安装 Node.js 24 或以上。完整解压仓库 ZIP 后，双击根目录 start.cmd（或在 CMD 执行 start.cmd）。首次需联网安装锁定依赖。看到 Ready 后访问 http://localhost:3000。保持 CMD 窗口开启，Ctrl+C 停止。

启动脚本只对当前进程设置 NEXT_PUBLIC_DATA_MODE=demo，不修改 .env.local，默认离线演示，不依赖后端。完整最新前端源码位于 frontend；deliverables 内历史静态页面并非此次源码构建产物。真实后端尚待字段及设备联调。

已完成 npm ci、生产构建、lint、TypeScript、54 项单元测试及模拟接口/页面回归。不能保证所有电脑环境；首次启动要求可访问 npm 且 3000 端口可用。
