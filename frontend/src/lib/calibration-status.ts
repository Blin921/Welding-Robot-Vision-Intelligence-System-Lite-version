import type { Calibration } from "./types";

export function calibrationStatus(calibration: Calibration | null) {
  if (!calibration)
    return {
      color: "yellow",
      label: "标定状态未知",
      title: "尚未取得当前帧标定状态",
    } as const;
  if (calibration.uncalibrated || !calibration.has_calib)
    return {
      color: "red",
      label: "当前帧未标定",
      title: "当前帧尚未标定，坐标仍为相机系",
    } as const;
  if ((calibration.max_dev_mm ?? 0) > 1.5)
    return {
      color: "yellow",
      label: "标定需复核",
      title: `最大残差 ${calibration.max_dev_mm}mm 超过 1.5mm，请复核`,
    } as const;
  return {
    color: "green",
    label: "当前帧已标定",
    title:
      typeof calibration.max_dev_mm === "number"
        ? (calibration.calib_tag ?? "标定已保存")
        : "标定已保存；当前接口未返回残差，精度需另行复核",
  } as const;
}
