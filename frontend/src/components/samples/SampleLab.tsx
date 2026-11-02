"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ArrowLeft, ArrowRight, Box, Check, ChevronDown, Crosshair, Database, FileCode2, Focus, Grid2X2, Layers3, Moon, Pause, Play, Radio, RotateCcw, ScanLine, Send, Settings2, Sun, Workflow } from "lucide-react";
import BrandMark from "../BrandMark";
import { STAGES } from "./stages";
const Cloud = dynamic(() => import("./SampleCloud"), { ssr: false, loading: () => <div className="sample-loading">正在准备三维样板…</div> });
const icons = [Box, Database, ScanLine, Crosshair, Layers3, Workflow, Send];
const materials = [["#4682e6", "钢管"], ["#32c850", "钢筋"], ["#b432b4", "扁钢"], ["#97a2ad", "背景"]];
export default function SampleLab() {
  const [selected, setSelected] = useState(1);
  const [light, setLight] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [size, setSize] = useState(2);
  const [grid, setGrid] = useState(true);
  const [reset, setReset] = useState(0);
  const [drawer, setDrawer] = useState(true);
  const stage = STAGES[selected];
  const phase = Math.min(stage.phases.length - 1, Math.floor(progress * stage.phases.length));
  const running = playing && progress < 1;
  useEffect(() => {
    if (!running) return;
    let frame = 0, last = 0, lastCommit = 0;
    const visibility = () => { last = 0; };
    document.addEventListener("visibilitychange", visibility);
    const tick = (time: number) => {
      if (document.hidden) { last = 0; frame = requestAnimationFrame(tick); return; }
      if (!last) last = time;
      if (time - lastCommit >= 40) {
        const delta = Math.min(0.25, (time - last) / 1000) * speed / stage.duration;
        setProgress(previous => Math.min(1, previous + delta));last = time;lastCommit = time;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", visibility); };
  }, [running, speed, stage.duration]);
  function choose(index: number) { setSelected(index); setPlaying(false); setProgress(0); }
  function start() { if (progress >= 1) setProgress(0); setPlaying(true); }
  const values = selected === 1 ? [Math.round(progress * 40000).toLocaleString(), "模拟扫描", "9", "mm"]
    : selected === 2 ? [String(Math.round(progress * 9)), String(Math.round(progress * 4)), progress >= 1 ? "已完成" : "演示中", "4 类"]
    : selected === 3 ? [String(Math.min(3, Math.ceil(progress * 3))), "刚体变换", progress > 0.8 ? "0.46" : "—", "mm"]
    : selected === 5 ? [Math.round(Math.max(0, progress - 0.12) / 0.88 * 570).toString(), "570", "100", "mm/s"]
    : selected === 6 ? [Math.round(progress * 100) + "%", "DEMO.LS", "虚拟目标", "未连接设备"]
    : ["40,000", "4", "9", "相机系"];
  const metricLabels = selected === 1 ? ["累计点数（示意）", "采集方式", "实例总数", "坐标单位"]
    : selected === 2 ? ["实例示意", "候选焊缝", "阶段状态", "语义类别"]
    : selected === 3 ? ["对应点组", "变换方式", "示例残差", "单位"]
    : selected === 5 ? ["已走长度 mm", "总长 mm", "示例速度", "速度单位"]
    : selected === 6 ? ["演示进度", "程序文件", "传输目标", "设备状态"]
    : ["显示点数", "示例焊缝", "实例数量", "坐标系"];
  const Icon = icons[selected];
  return <div className={`sample-lab ${light ? "sample-light" : "sample-dark"}`}>
    <header className="sample-header">
      <Link className="sample-brand" href="/"><BrandMark /><span>焊接机器人视觉识别系统<small>VISUAL WORKFLOW LAB</small></span></Link>
      <nav aria-label="样板页面">{STAGES.map((item, index) => { const ItemIcon = icons[index]; return <button key={item.key} className={index === selected ? "active" : ""} aria-current={index === selected ? "page" : undefined} onClick={() => choose(index)}><ItemIcon size={15} />{item.label}</button>; })}</nav>
      <div className="sample-header-tools"><span className="sample-prototype"><i />交互样板</span><button aria-label="切换样板明暗主题" className="sample-theme" onClick={() => setLight(!light)}>{light ? <Moon size={16} /> : <Sun size={16} />}{light ? "暗色版" : "浅色版"}</button><Link href="/" className="sample-return" title="返回正式工作台"><ArrowLeft size={16} /></Link></div>
    </header>
    <div className="sample-main">
      <aside className="sample-sidebar">
        <section className="sample-panel"><div className="sample-panel-title"><Database size={16} /><strong>点云数据管理</strong><span className="sample-count">03</span></div>
          <div className="sample-panel-content"><div className="sample-upload"><Database size={16} />内置演示点云<span>PCD</span></div>
            <div className="sample-files">{["frame_001.pcd", "frame_002.pcd", "frame_003.pcd"].map((name, i) => <div key={name} className={i === 0 ? "selected" : ""}><i /><div><strong>{name}</strong><small>{i === 0 ? "当前演示帧" : "参考帧 · 样板中不加载"}</small></div><span>{i === 0 ? "已选择" : "示例"}</span></div>)}</div>
          </div>
        </section>
        <section className="sample-panel"><div className="sample-panel-title"><Settings2 size={16} /><strong>{selected === 0 ? "流程设置" : stage.label + "设置"}</strong><ChevronDown size={14} /></div><div className="sample-parameters">{stage.parameters.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>
        <section className="sample-panel sample-flow-panel"><div className="sample-panel-title"><Activity size={16} /><strong>过程步骤</strong><span className="sample-muted">{phase + 1} / {stage.phases.length}</span></div><ol className="sample-step-list">{stage.phases.map((label, index) => <li key={label} className={index < phase || progress >= 1 ? "done" : index === phase ? "current" : ""}><span>{index < phase || progress >= 1 ? <Check size={12} /> : String(index + 1).padStart(2, "0")}</span><div>{label}<small>{index < phase || progress >= 1 ? "演示完成" : index === phase ? running ? "正在展示" : "待播放" : "等待前一步"}</small></div></li>)}</ol><div className="sample-flow-action"><button className="sample-primary" onClick={running ? () => setPlaying(false) : start}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? "暂停演示" : progress >= 1 ? "重新演示" : stage.action}</button><small>仅演示过程，不调用真实设备或算法</small></div></section>
      </aside>
      <section className="sample-viewport sample-panel">
        <div className="sample-viewport-heading"><div><Box size={18} /><strong>三维点云预览</strong><span className="sample-outline-badge">{light ? "浅色样板 B" : "暗色样板 A"}</span></div><span className="sample-live"><i className={running ? "running" : ""} />{running ? "演示播放中" : "可交互视图"}</span></div>
        <div className="sample-toolbar"><div className="sample-segment"><button className="active"><Layers3 size={14} />语义点云</button><span>过程叠加</span></div><label>点大小<input aria-label="样板点大小" type="range" min={1} max={4} step={0.5} value={size} onChange={event => setSize(Number(event.target.value))} /><output>{size}</output></label><button aria-pressed={grid} onClick={() => setGrid(!grid)}><Grid2X2 size={14} />网格</button><button onClick={() => setReset(v => v + 1)}><Focus size={14} />适配视角</button></div>
        <div className="sample-canvas-wrap"><Cloud kind={stage.key} progress={progress} light={light} pointSize={size} grid={grid} reset={reset} />
          <div className="sample-stage-hud"><span className="sample-eyebrow">PROCESS VISUALIZATION</span><h1><Icon size={20} />{stage.title}</h1><p>{stage.description}</p><div><i className={running ? "running" : ""} />{stage.phases[phase]}<strong>{Math.round(progress * 100)}%</strong></div></div>
          <div className="sample-legend"><strong>语义标签</strong>{materials.map(([color, label]) => <span key={label}><i style={{ background: color }} />{label}</span>)}<span><b />当前路径</span></div>
          <div className="sample-canvas-note">拖动旋转 · 滚轮缩放<span>演示数据 · 非实时计算结果</span></div>
        </div>
        <div className="sample-playback"><button aria-label={running ? "暂停过程动画" : "播放过程动画"} className="sample-play" onClick={running ? () => setPlaying(false) : start}>{running ? <Pause size={17} /> : <Play size={17} />}</button><button aria-label="重置过程动画" onClick={() => { setPlaying(false); setProgress(0); }}><RotateCcw size={16} /></button><input aria-label="过程动画进度" type="range" min={0} max={1} step={0.001} value={progress} onChange={event => { setProgress(Number(event.target.value)); setPlaying(false); }} /><span>{Math.round(progress * 100)}%</span><select aria-label="过程动画速度" value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select></div>
        <div className="sample-viewport-status"><span><i />frame_001.pcd</span><span>显示 40,000 / 200,000 点</span><span>实例 9</span><span className="sample-units">mm · 相机系</span></div>
      </section>
      <aside className="sample-context">
        <section className="sample-panel"><div className="sample-panel-title"><Activity size={16} /><strong>{stage.label}演示指标</strong><span className="sample-muted">示例</span></div><div className="sample-metrics">{metricLabels.map((label, i) => <div key={label}><small>{label}</small><strong>{values[i]}</strong></div>)}</div></section>
        <section className="sample-panel"><div className="sample-panel-title"><Layers3 size={16} /><strong>焊缝选择与属性</strong><span className="sample-status-badge">W001</span></div><div className="sample-seam-preview"><div className="sample-mini-cloud"><span /><span /><span /><i /></div><div><strong>钢管 · 扁钢</strong><span>相切交界 · 示例焊缝</span><b>570.0 <small>mm</small></b></div></div><div className="sample-seam-actions"><span><Check size={13} />已选中</span><button onClick={() => choose(4)}>查看提取过程<ArrowRight size={13} /></button></div></section>
        <section className="sample-panel sample-explanation"><div className="sample-panel-title"><FileCode2 size={16} /><strong>当前过程说明</strong></div><div><span className="sample-phase-tag">STEP {String(phase + 1).padStart(2, "0")}</span><h2>{stage.phases[phase]}</h2><p>在三维区查看「{stage.phases[phase]}」。</p><div className="sample-progress-track"><i style={{ width: `${progress * 100}%` }} /></div></div><footer><Radio size={14} />当前未连接相机、模型和控制器</footer></section>
      </aside>
    </div>
    <section className={`sample-event-panel sample-panel ${drawer ? "" : "collapsed"}`}><button className="sample-event-title" aria-expanded={drawer} onClick={() => setDrawer(!drawer)}><Activity size={15} /><strong>演示事件</strong><span>{running ? "进行中" : progress >= 1 ? "已完成" : "待播放"}</span><ChevronDown size={14} /></button>{drawer&&<div className="sample-events"><div>{stage.phases.map((item, i) => <p key={item} className={i <= phase ? "seen" : ""}><i /><span>{String(i + 1).padStart(2, "0")}</span><strong>{item}</strong><small>{i < phase || progress >= 1 ? "演示完成" : i === phase ? running ? "播放中" : "已就绪" : "等待"}</small></p>)}</div><div className="sample-event-summary"><span className="sample-outline-badge">独立交互样板</span><p>此处展示动画与主题方案，正式业务入口仍在原工作台。</p><small>不发起采集、识别、FTP 或机器人启动请求。</small></div></div>}</section>
  </div>;
}
