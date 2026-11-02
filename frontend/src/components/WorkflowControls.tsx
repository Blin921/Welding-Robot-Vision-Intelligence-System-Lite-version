"use client";
import { useRef, type Dispatch, type SetStateAction } from "react";
import {
  Database,
  FileCode2,
  FileUp,
  Play,
  Send,
  Settings2,
  TriangleAlert,
} from "lucide-react";
import { useWorkspace } from "../stores/provider";
import type {
  FtpSettings,
  PointPair,
  ProgramSettings,
  RecognizeRequest,
  ScanRequest,
} from "../lib/types";
import { validateRecognition, validateScan } from "../lib/validation";
import { Busy, Field, Notice, Panel } from "./ui";
export interface Forms {
  scan: ScanRequest;
  recognize: Omit<RecognizeRequest, "frame">;
  program: ProgramSettings;
  ftp: FtpSettings;
  pairs: PointPair[];
  matrix: string;
  calibMode: "pairs" | "matrix";
}
export const INITIAL_PAIRS: PointPair[] = [
  { cam: [245.671, 132.488, 78.356], base: [1023.445, 567.231, 321.772] },
  { cam: [518.23, 76.442, 203.115], base: [148.662, 802.371, 610.558] },
  { cam: [362.774, 241.663, 156.221], base: [1189.331, 745.208, 492.776] },
];
export default function WorkflowControls({
  tab,
  forms,
  setForms,
  onGenerate,
  onPush,
}: {
  tab: number;
  forms: Forms;
  setForms: Dispatch<SetStateAction<Forms>>;
  onGenerate: () => void;
  onPush: () => void;
  onSeamAction: (
    action: "view" | "preview" | "program" | "push",
    id: number,
  ) => void;
}) {
  const { store, state } = useWorkspace();
  const upload = useRef<HTMLInputElement>(null);
  const numeric = (
    section: "scan" | "recognize" | "program" | "ftp",
    key: string,
    value: string,
  ) =>
    setForms((f) => ({
      ...f,
      [section]: {
        ...f[section],
        [key]: value.trim() === "" ? NaN : Number(value),
      },
    }));
  const field = (
    section: "scan" | "recognize" | "program" | "ftp",
    key: string,
    label: string,
    unit?: string,
    min?: number,
    max?: number,
    step?: number,
  ) => {
    const value = (forms[section] as unknown as Record<string, number>)[key];
    return (
      <Field
        key={key}
        label={label}
        value={value}
        onChange={(v) => numeric(section, key, v)}
        type="number"
        unit={unit}
        min={min}
        max={max}
        step={step}
      />
    );
  };
  const locked = Boolean(state.activeTask),
    pending = Boolean(state.pending);
  const program = store.currentProgram();
  return (
    <>
      {(tab === 1 || tab === 2) && (
        <>
          <Panel
            title={tab === 1 ? "点云数据管理" : "帧选择与识别控制"}
            icon={<Database />}
          >
            {tab === 1 ? (
              <>
                <button
                  className="upload-button"
                  disabled={pending}
                  onClick={() => upload.current?.click()}
                >
                  <FileUp size={17} />
                  <Busy busy={state.pending === "upload"}>上传 PCD 文件</Busy>
                </button>
                <input
                  ref={upload}
                  hidden
                  type="file"
                  accept=".pcd"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void store.upload(file);
                    e.target.value = "";
                  }}
                />
                <p className="hint">支持 .pcd 格式 · 文件上限 300MB</p>
                <div className="subheading">
                  帧列表{" "}
                  <span>{state.frames.length.toString().padStart(2, "0")}</span>
                </div>
                <div className="frame-list">
                  {state.frames.map((frame) => (
                    <button
                      aria-label={`选择帧 ${frame.id}`}
                      aria-pressed={state.frame === frame.id}
                      className={state.frame === frame.id ? "chosen" : ""}
                      key={frame.id}
                      onClick={() => void store.selectFrame(frame.id)}
                    >
                      <span className="radio-dot" />
                      <span>
                        <strong>{frame.id}</strong>
                        <small>
                          {frame.source} <b>·</b>{" "}
                          {(frame.bytes / 1048576).toFixed(1)} MB
                        </small>
                      </span>
                      {frame.has_artifacts ? (
                        <span className="result-badge">有结果</span>
                      ) : (
                        <span className="muted">待识别</span>
                      )}
                    </button>
                  ))}
                </div>
                {!state.frames.length && (
                  <Notice>
                    暂无帧。上传点云或采集第一帧；后端不可用时请检查连接。
                  </Notice>
                )}
              </>
            ) : (
              <>
                <label className="recognition-frame-select">
                  <Database size={17} />
                  <select
                    aria-label="当前帧"
                    value={state.frame}
                    onChange={(event) =>
                      void store.selectFrame(event.target.value)
                    }
                  >
                    {state.frames.map((frame) => (
                      <option key={frame.id} value={frame.id}>
                        {frame.id}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="primary wide"
                  disabled={!state.frame || state.loading}
                  onClick={() => void store.selectFrame(state.frame)}
                >
                  <FileUp size={16} />
                  载入点云
                </button>
              </>
            )}
            {tab === 2 && (
              <div className="recognition-actions">
                <label className="switch-row">
                  <span>
                    复用历史结果<small>离线开发 · 无需模型参与</small>
                  </span>
                  <input
                    type="checkbox"
                    aria-label="复用历史结果"
                    checked={forms.recognize.reuse_artifacts}
                    onChange={(e) =>
                      setForms((f) => ({
                        ...f,
                        recognize: {
                          ...f.recognize,
                          reuse_artifacts: e.target.checked,
                        },
                      }))
                    }
                  />
                </label>
                <button
                  className="primary wide"
                  disabled={locked || pending || !state.frame}
                  onClick={() => {
                    const error = validateRecognition(forms.recognize);
                    if (error) store.notify(error, "error");
                    else
                      void store.run("recognize", {
                        ...forms.recognize,
                        frame: state.frame,
                      });
                  }}
                >
                  {!locked && <Play size={15} />}
                  <Busy busy={state.activeTask?.kind === "recognize"}>
                    {locked ? "任务进行中" : "开始识别"}
                  </Busy>
                </button>
              </div>
            )}
          </Panel>
          {tab === 1 ? (
            <Panel title="扫描采集设置" icon={<Settings2 />}>
              <form noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  const error = validateScan(forms.scan);
                  if (error) store.notify(error, "error");
                  else void store.run("scan", forms.scan);
                }}
              >
                {field("scan", "scan_ms", "扫描时长", "ms", 500, 20000, 1)}
                {field("scan", "exp_us", "曝光时间", "μs", 10, 5000, 1)}
                <label className="distance-field">
                  <span>工作距离 (mm)</span>
                  <div>
                    <input
                      aria-label="最近工作距离"
                      type="number"
                      step="any"
                      value={
                        Number.isFinite(forms.scan.dist[0])
                          ? forms.scan.dist[0]
                          : ""
                      }
                      onChange={(e) =>
                        setForms((f) => ({
                          ...f,
                          scan: {
                            ...f.scan,
                            dist: [
                              e.target.value === ""
                                ? NaN
                                : Number(e.target.value),
                              f.scan.dist[1],
                            ],
                          },
                        }))
                      }
                    />
                    <b>–</b>
                    <input
                      aria-label="最远工作距离"
                      type="number"
                      step="any"
                      value={
                        Number.isFinite(forms.scan.dist[1])
                          ? forms.scan.dist[1]
                          : ""
                      }
                      onChange={(e) =>
                        setForms((f) => ({
                          ...f,
                          scan: {
                            ...f.scan,
                            dist: [
                              f.scan.dist[0],
                              e.target.value === ""
                                ? NaN
                                : Number(e.target.value),
                            ],
                          },
                        }))
                      }
                    />
                  </div>
                </label>
                <label className="switch-row">
                  散点输出 loose
                  <input
                    type="checkbox"
                    checked={forms.scan.loose}
                    onChange={(e) =>
                      setForms((f) => ({
                        ...f,
                        scan: { ...f.scan, loose: e.target.checked },
                      }))
                    }
                  />
                </label>
                {state.mode === "demo" && (
                  <Notice>
                    浏览器演示未接相机，可验证采集失败与日志提示。
                  </Notice>
                )}
                <button className="primary wide" disabled={locked || pending}>
                  <Busy busy={state.activeTask?.kind === "scan"}>
                    {locked ? "任务进行中" : "开始采集"}
                  </Busy>
                </button>
              </form>
            </Panel>
          ) : (
            <>
              <Panel
                title="高级识别参数"
                icon={<Settings2 />}
                collapsible
                defaultOpen={true}
              >
                {field("recognize", "voxel", "voxel 体素", "mm", 0.001)}
                {field("recognize", "tile", "tile 块大小", "mm", 0.001)}
                {field("recognize", "stride", "stride 步长", "mm", 0.001)}
                {field(
                  "recognize",
                  "smooth_k",
                  "smooth_k 邻域",
                  undefined,
                  1,
                  undefined,
                  1,
                )}
                {field("recognize", "smooth_r", "smooth_r 半径", "mm", 0.001)}
                {field("recognize", "max_gap", "max_gap 间隙", "m", 0.000001)}
                {field("recognize", "min_len", "最短焊缝长度", "mm", 0)}
              </Panel>
            </>
          )}
        </>
      )}
      {tab === 5 && (
        <Panel title="程序与轨迹预演" icon={<FileCode2 />}>
          <form noValidate
            onSubmit={(e) => {
              e.preventDefault();
              onGenerate();
            }}
          >
            <Field
              label="程序名称"
              value={forms.program.name}
              onChange={(v) =>
                setForms((f) => ({ ...f, program: { ...f.program, name: v } }))
              }
              placeholder="留空由帧名生成"
              maxLength={8}
            />
            <Field
              label="程序备注"
              value={forms.program.comment}
              onChange={(v) =>
                setForms((f) => ({
                  ...f,
                  program: { ...f.program, comment: v },
                }))
              }
              maxLength={60}
            />
            {field(
              "program",
              "utool",
              "工具号 UTOOL",
              undefined,
              0,
              undefined,
              1,
            )}
            {field(
              "program",
              "uframe",
              "坐标系 UFRAME",
              undefined,
              0,
              undefined,
              1,
            )}
            <Field
              label="姿态 W,P,R"
              value={forms.program.wpr}
              onChange={(v) =>
                setForms((f) => ({ ...f, program: { ...f.program, wpr: v } }))
              }
            />
            <label className="switch-row">
              包含焊接指令
              <input
                type="checkbox"
                checked={forms.program.weld}
                onChange={(e) =>
                  setForms((f) => ({
                    ...f,
                    program: { ...f.program, weld: e.target.checked },
                  }))
                }
              />
            </label>
            <details className="program-advanced">
              <summary>高级参数</summary>
              <label className="field">
                <span>指令名称</span>
                <select
                  aria-label="指令名称"
                  value={forms.program.inst}
                  onChange={(e) =>
                    setForms((f) => ({
                      ...f,
                      program: {
                        ...f.program,
                        inst: e.target.value as "Weld" | "Arc",
                      },
                    }))
                  }
                >
                  <option>Weld</option>
                  <option>Arc</option>
                </select>
              </label>
              {field(
                "program",
                "weld_prog",
                "焊机程序号",
                undefined,
                0,
                undefined,
                1,
              )}
              {field(
                "program",
                "weld_set",
                "焊机设定号",
                undefined,
                0,
                undefined,
                1,
              )}
              {field("program", "speed_weld", "焊接速度", "cm/min", 0.001)}
              {field("program", "eps", "简化偏差 eps", "mm", 0.001)}
              {field("program", "max_seg", "途经点最大间距", "mm", 0.001)}
            </details>
            {state.calibration?.uncalibrated && (
              <div className="notice warning">
                <TriangleAlert />
                坐标仍是相机系，禁止上机。
              </div>
            )}
            <button
              className="primary wide"
              disabled={
                pending ||
                state.loading ||
                state.selected === null ||
                !state.calibration
              }
            >
              <Busy busy={state.pending === "program"}>生成 .LS 程序</Busy>
            </button>
          </form>
        </Panel>
      )}
      {tab === 6 && (
        <Panel title="FTP 文件传输" icon={<Send />}>
          <form noValidate
            onSubmit={(e) => {
              e.preventDefault();
              onPush();
            }}
          >
            <div className="form-section-label">控制器连接信息</div>
            <Field
              label="控制器地址"
              value={forms.ftp.host}
              onChange={(v) =>
                setForms((f) => ({ ...f, ftp: { ...f.ftp, host: v } }))
              }
              placeholder={state.mode === "demo" ? "可留空，使用 controller.demo 模拟下发" : "请输入地址"}
            />
            {field("ftp", "port", "端口", undefined, 1, 65535, 1)}
            {(["user", "password", "remote_dir"] as const).map((key, i) => (
              <Field
                key={key}
                label={["用户名", "密码", "目标目录"][i]}
                value={forms.ftp[key]}
                type={key === "password" ? "password" : "text"}
                onChange={(v) =>
                  setForms((f) => ({ ...f, ftp: { ...f.ftp, [key]: v } }))
                }
              />
            ))}
            <details className="ftp-advanced">
              <summary>高级连接选项</summary>
              {field("ftp", "timeout_s", "连接超时", "s", 1)}
            </details>
            <label className="switch-row">
              被动模式
              <input
                type="checkbox"
                checked={forms.ftp.passive}
                onChange={(e) =>
                  setForms((f) => ({
                    ...f,
                    ftp: { ...f.ftp, passive: e.target.checked },
                  }))
                }
              />
            </label>
            <Notice warning={Boolean(program?.uncalibrated)}>
              {program?.uncalibrated
                ? "坐标仍是相机系，禁止上机。先标定并重新生成。"
                : "仅传输程序文件，不触发机器人运动。"}
            </Notice>
            <button
              className="primary wide"
              disabled={pending || state.loading}
            >
              <Busy busy={state.pending === "push"}>预览下发确认</Busy>
              <Send size={15} />
            </button>
            {state.mode === "demo" && (
              <p className="hint">
                演示模式不连接真实设备；fail.demo 可测试失败路径。
              </p>
            )}
          </form>
        </Panel>
      )}
    </>
  );
}

