# Welding-Robot-Vision-Intelligence-System

焊接机器人视觉智能系统，展示焊缝识别功能

## Next.js 动态前端

源码位于 [frontend/](frontend/)，完整开发与接口说明见 [frontend/README.md](frontend/README.md)。

### 用 main 更新并运行（推荐）

安装 Git 和 Node.js 24 LTS，在仓库根目录执行：

```cmd
git pull origin main
npm run dev
```

`npm run dev` 会自动检查并安装 `frontend` 依赖，依赖未变化时跳过安装，随后启动最新源码。打开窗口打印的 Local 地址（默认 http://localhost:3000）。更新前在旧运行窗口按 Ctrl+C 停止服务。

首次没有 Git 仓库时：

```cmd
git clone https://github.com/Blin921/Welding-Robot-Vision-Intelligence-System.git
cd Welding-Robot-Vision-Intelligence-System
npm run dev
```

不要在 ZIP 解压目录执行 Git 更新；在含 `.git` 和根目录 `package.json` 的克隆目录执行。首次依赖下载慢可先设置 `npm config set registry https://registry.npmmirror.com`。根目录也支持 `npm run build`、`npm start`。

旧的 `Update-And-Start.cmd` 和 `Start-From-Git.cmd` 仍可用，主流程不再依赖这两个脚本。后续更新直接推送 main。

## 当前需求书版

七个入口保留。全屏流式布局，三维视口深色；宽屏三栏，窄于 1200px 时右栏并入左栏页签，视口最少 600px。数据采集页已从零重做，不再使用参考图控件或固定画布缩放；原三维渲染调度和预演速度保留。

默认打开离线示例；接后端时在设置切换真实后端，或配置 NEXT_PUBLIC_DATA_MODE=live。说明书的离线流程是后端 `WEBAPP_NO_MODEL=1` 配合真实 `sw2_e30` 历史产物及复用开关；没有后端时可在设置手动切换「浏览器自测」，两者不混淆。此仓库不包含后端、历史产物或设备。

需求实现与检查见 [frontend/README.md](frontend/README.md)，现场部署见 [DEPLOYMENT.md](DEPLOYMENT.md)。最新截图以 `frontend/screenshots/requirements-` 开头。源码更新直接推 main，旧运行压缩包不再维护。
