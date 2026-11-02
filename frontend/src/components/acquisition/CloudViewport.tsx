"use client";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import PointCloud from "../PointCloud";
import { useWorkspace } from "../../stores/provider";
import type { CloudData, Vec3 } from "../../lib/types";
export interface Measurement {
  first: Vec3;
  second?: Vec3;
  distance?: number;
  reference: boolean;
}
export interface CloudHandle {
  reset: () => void;
  zoomIn: () => void;
  toggleProjection: () => void;
  clearMeasurement: () => void;
}
interface Props {
  cloud: CloudData;
  light: boolean;
  mode: "semantic" | "instance";
  size: number;
  hidden: boolean;
  bounds: boolean;
  tool: "rotate" | "pan" | "measure";
  onMeasure: (value: Measurement | null) => void;
  onError: (message: string) => void;
}
/** Layout adapter only. Rendering, point material and RAF scheduling are shared with every workbench. */
export default forwardRef<CloudHandle, Props>(
  function CloudViewport(props, ref) {
    const { state } = useWorkspace();
    const { onMeasure } = props;
    const [reset, setReset] = useState(0),
      [zoom, setZoom] = useState(0),
      [projection, setProjection] = useState<"perspective" | "orthographic">(
        "perspective",
      );
    const first = useRef<Vec3 | null>(null);
    const clear = useCallback(() => {
      first.current = null;
      onMeasure(null);
    }, [onMeasure]);
    useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          setZoom(0);
          setProjection("perspective");
          setReset((v) => v + 1);
        },
        zoomIn: () => setZoom((v) => v + 1),
        toggleProjection: () =>
          setProjection((v) =>
            v === "perspective" ? "orthographic" : "perspective",
          ),
        clearMeasurement: clear,
      }),
      [clear],
    );
    const pick = useCallback(
      (point: Vec3) => {
        if (!first.current) {
          first.current = point;
          onMeasure({ first: point, reference: false });
        } else {
          onMeasure({
            first: first.current,
            second: point,
            distance: Math.hypot(...point.map((v, i) => v - first.current![i])),
            reference: false,
          });
          first.current = null;
        }
      },
      [onMeasure],
    );
    return (
      <PointCloud
        cloud={props.cloud}
        seams={state.seams}
        selected={state.selected}
        light={props.light}
        mode={props.mode === "semantic" ? "语义" : "实例"}
        size={props.size}
        reset={reset}
        grid
        interaction={props.tool === "pan" ? "pan" : "orbit"}
        zoom={zoom}
        hidden={props.hidden}
        bounds={props.bounds}
        projection={projection}
        measuring={props.tool === "measure"}
        onPointPick={pick}
      />
    );
  },
);

