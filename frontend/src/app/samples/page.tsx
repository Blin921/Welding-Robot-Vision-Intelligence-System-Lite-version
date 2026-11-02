import type { Metadata } from "next";
import SampleLab from "../../components/samples/SampleLab";
import "./samples.css";

export const metadata: Metadata = { title: "过程动画与明暗主题样板 · 焊接机器人视觉识别系统" };

export default function SamplesPage() {
  return <SampleLab />;
}
