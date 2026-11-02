export const STAGES = [
  { key: "overview", label: "技术流程", title: "工作流总览", action: "演示完整流程", description: "从点云到程序，查看各环节如何衔接。", phases: ["点云采集", "识别与标定", "轨迹与程序", "文件传输"], duration: 16, parameters: [["数据来源", "内置演示点云"], ["显示点数", "40,000 点"], ["坐标单位", "mm"]] },
  { key: "capture", label: "数据采集", title: "激光扫描采集", action: "开始采集演示", description: "扫描光幕沿工件移动，点云随扫描逐步出现。", phases: ["相机定位", "扫描与点云累积", "生成点云帧"], duration: 10, parameters: [["扫描时长", "2,500 ms"], ["曝光时间", "300 μs"], ["工作距离", "400 – 800 mm"]] },
  { key: "recognize", label: "AI 识别", title: "语义识别过程", action: "播放识别过程", description: "以分块、分类着色和实例框展示识别步骤。", phases: ["体素与分块", "语义分类", "实例分离", "焊缝提取"], duration: 12, parameters: [["体素尺寸", "1.5 mm"], ["分块 / 步进", "200 / 120 mm"], ["类别", "钢管 · 钢筋 · 扁钢"]] },
  { key: "calibrate", label: "坐标标定", title: "坐标对齐过程", action: "播放标定过程", description: "点对连接、坐标轴旋转和对齐，展示变换求解思路。", phases: ["建立对应点", "求解刚体变换", "对齐与残差复核"], duration: 10, parameters: [["对应点", "3 组示例"], ["求解方式", "刚体变换示意"], ["残差", "演示值，不作精度依据"]] },
  { key: "seams", label: "焊缝管理", title: "焊缝提取过程", action: "演示焊缝提取", description: "候选缝逐条显现，突出当前焊缝及端点。", phases: ["搜索构件交界", "生成候选焊缝", "过滤与选中"], duration: 10, parameters: [["最短长度", "50 mm"], ["当前焊缝", "W001"], ["候选数量", "4 条示例"]] },
  { key: "program", label: "程序与预演", title: "路径与焊枪预演", action: "播放焊接预演", description: "路径采样后，放大的铜色头尖沿橙色轨迹移动。", phases: ["路径采样", "生成程序", "TCP 轨迹预演"], duration: 12, parameters: [["基准速度", "100 mm/s"], ["焊枪姿态", "相机系示意"], ["输出", "演示 .LS，不可执行"]] },
  { key: "transfer", label: "程序下发", title: "文件传输过程", action: "演示文件传输", description: "数据包从程序端移动到控制器模型，仅演示文件传输。", phases: ["准备 .LS 文件", "FTP 文件传输", "校验与回执"], duration: 9, parameters: [["程序文件", "DEMO.LS"], ["目标", "虚拟控制器"], ["设备启动", "不发送启动指令"]] },
] as const;
export type StageKey = (typeof STAGES)[number]["key"];
