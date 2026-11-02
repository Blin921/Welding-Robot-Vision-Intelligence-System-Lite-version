# 当前单文件离线展示

双击 Welding-Vision-current.html，在 Chrome 或 Edge 打开。不需要 Node.js 或网络。此文件由当前 React 组件导出，内嵌 CSS、Logo、Three.js 与示例数据，默认离线模式。

支持页面导航、主题切换、示例点云、配套 PCD 上传、流程动画及模拟下发。不会提供 FastAPI 服务；真实后端模式仍应使用 Next.js 应用。

重新导出：在项目根目录运行 node frontend/scripts/export-html.cjs。生成中间文件保存在 frontend/.static-export/，不提交 Git。

已检查打包成功和 JavaScript 语法。当前环境未完成浏览器实际打开验证。
