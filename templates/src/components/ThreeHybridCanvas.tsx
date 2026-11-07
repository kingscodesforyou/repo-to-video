import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface Face3D {
  indices: number[];
  color?: string;
}

/** 三维向量与相机投影数学工具 (真实 3D 顶点变换、法线光照与深度排序) */
const rotateVec3 = (v: Vec3, rx: number, ry: number, rz: number): Vec3 => {
  // Rotate X
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const y1 = v.y * cosX - v.z * sinX;
  const z1 = v.y * sinX + v.z * cosX;
  // Rotate Y
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const x2 = v.x * cosY + z1 * sinY;
  const z2 = -v.x * sinY + z1 * cosY;
  // Rotate Z
  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);
  const x3 = x2 * cosZ - y1 * sinZ;
  const y3 = x2 * sinZ + y1 * cosZ;
  return { x: x3, y: y3, z: z2 };
};

const subVec3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

const crossVec3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

const normalizeVec3 = (v: Vec3): Vec3 => {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
};

const dotVec3 = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

const projectVec3 = (
  v: Vec3,
  cx: number,
  cy: number,
  fov: number = 520,
  camDist: number = 420
): { x: number; y: number; scale: number; depth: number } => {
  const z = v.z + camDist;
  const safeZ = Math.max(60, z);
  const scale = fov / safeZ;
  return {
    x: cx + v.x * scale,
    y: cy + v.y * scale,
    scale,
    depth: z,
  };
};

/* ==========================================================================
   1. 真实 3D 多面体形态变化晶体 (MorphingPolyhedron3D)
   支持从离散碎片态 -> 聚合态 -> 二十面体高纯度几何晶体连续顶点形变与法线光照
   ========================================================================== */
export const MorphingPolyhedron3D: React.FC<{
  width?: number;
  height?: number;
  morphProgress: number; // 0 (scattered shards) -> 1 (faceted icosahedron crystal)
  accentColor: string;
  isLight?: boolean;
  facetsCount?: number;
}> = ({
  width = 300,
  height = 260,
  morphProgress,
  accentColor,
  isLight = false,
}) => {
  const f = useCurrentFrame();
  const phi = (1 + Math.sqrt(5)) / 2;
  const radius = 64;

  // 标准正二十面体 12 个三维顶点
  const baseVertices: Vec3[] = [
    { x: -1, y: phi, z: 0 },
    { x: 1, y: phi, z: 0 },
    { x: -1, y: -phi, z: 0 },
    { x: 1, y: -phi, z: 0 },
    { x: 0, y: -1, z: phi },
    { x: 0, y: 1, z: phi },
    { x: 0, y: -1, z: -phi },
    { x: 0, y: 1, z: -phi },
    { x: phi, y: 0, z: -1 },
    { x: phi, y: 0, z: 1 },
    { x: -phi, y: 0, z: -1 },
    { x: -phi, y: 0, z: 1 },
  ].map((v) => {
    const n = normalizeVec3(v);
    return { x: n.x * radius, y: n.y * radius, z: n.z * radius };
  });

  // 20 个三角晶面拓扑
  const faces: Face3D[] = [
    { indices: [0, 11, 5] },
    { indices: [0, 5, 1] },
    { indices: [0, 1, 7] },
    { indices: [0, 7, 10] },
    { indices: [0, 10, 11] },
    { indices: [1, 5, 9] },
    { indices: [5, 11, 4] },
    { indices: [11, 10, 2] },
    { indices: [10, 7, 6] },
    { indices: [7, 1, 8] },
    { indices: [3, 9, 4] },
    { indices: [3, 4, 2] },
    { indices: [3, 2, 6] },
    { indices: [3, 6, 8] },
    { indices: [3, 8, 9] },
    { indices: [4, 9, 5] },
    { indices: [2, 4, 11] },
    { indices: [6, 2, 10] },
    { indices: [8, 6, 7] },
    { indices: [9, 8, 1] },
  ];

  const rx = f * 0.018 + 0.35;
  const ry = f * 0.026 - 0.4;
  const rz = f * 0.009;
  const lightDir = normalizeVec3({ x: -0.45, y: -0.65, z: -0.6 });

  const cx = width / 2;
  const cy = height / 2;

  // 计算形变与旋转后的三维面片，并执行画家算法深度排序 + Lambert 法线光照
  const renderedFaces = faces.map((face, fi) => {
    const [i0, i1, i2] = face.indices;
    const v0 = baseVertices[i0];
    const v1 = baseVertices[i1];
    const v2 = baseVertices[i2];

    // 面中心向外爆炸/形变偏移（morphProgress: 0 为离散碎片，1 为严丝合缝晶体）
    const faceCenter = normalizeVec3({
      x: (v0.x + v1.x + v2.x) / 3,
      y: (v0.y + v1.y + v2.y) / 3,
      z: (v0.z + v1.z + v2.z) / 3,
    });
    const explodeDist = interpolate(morphProgress, [0, 1], [48 + (fi % 4) * 14, 0], clamp);

    const transformVertex = (v: Vec3) => {
      const displaced = {
        x: v.x + faceCenter.x * explodeDist,
        y: v.y + faceCenter.y * explodeDist,
        z: v.z + faceCenter.z * explodeDist,
      };
      return rotateVec3(displaced, rx, ry, rz);
    };

    const tv0 = transformVertex(v0);
    const tv1 = transformVertex(v1);
    const tv2 = transformVertex(v2);

    const normal = normalizeVec3(crossVec3(subVec3(tv1, tv0), subVec3(tv2, tv0)));
    const lambert = Math.max(0.18, Math.min(1, (dotVec3(normal, lightDir) + 1) * 0.52));

    const p0 = projectVec3(tv0, cx, cy, 420, 340);
    const p1 = projectVec3(tv1, cx, cy, 420, 340);
    const p2 = projectVec3(tv2, cx, cy, 420, 340);
    const avgDepth = (p0.depth + p1.depth + p2.depth) / 3;

    return {
      fi,
      points: `${p0.x.toFixed(1)},${p0.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`,
      avgDepth,
      lambert,
    };
  });

  // 按 Z 深度从远到近排序
  renderedFaces.sort((a, b) => b.avgDepth - a.avgDepth);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
      <defs>
        <radialGradient id="crystalCoreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={accentColor} stopOpacity={0.38 * morphProgress} />
          <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={radius * 1.45} fill="url(#crystalCoreGlow)" />
      {renderedFaces.map((rf) => {
        const fillAlpha = Math.round(
          interpolate(rf.lambert, [0.18, 1], [isLight ? 45 : 32, isLight ? 190 : 165])
        )
          .toString(16)
          .padStart(2, "0");
        return (
          <polygon
            key={rf.fi}
            points={rf.points}
            fill={`${accentColor}${fillAlpha}`}
            stroke={accentColor}
            strokeWidth={morphProgress > 0.8 ? 1.4 : 1.0}
            strokeOpacity={0.45 + rf.lambert * 0.5}
          />
        );
      })}
    </svg>
  );
};

/* ==========================================================================
   2. 真实 3D 机械涡轮与多轴分离环 (MechanicalRotor3D)
   用于过滤腔核心、机械拆解与旋转分离阀门
   ========================================================================== */
export const MechanicalRotor3D: React.FC<{
  width?: number;
  height?: number;
  accentColor: string;
  separateProgress: number;
  rpm?: number;
}> = ({ width = 380, height = 220, accentColor, separateProgress, rpm = 1.0 }) => {
  const f = useCurrentFrame();
  const cx = width / 2;
  const cy = height / 2;

  const rings = [
    { r: 74, zOffset: -85, speed: 0.032 * rpm, segments: 16, tiltX: 0.35 },
    { r: 62, zOffset: 0, speed: -0.045 * rpm, segments: 12, tiltX: -0.25 },
    { r: 70, zOffset: 85, speed: 0.025 * rpm, segments: 16, tiltX: 0.3 },
  ];

  const elements: Array<{ depth: number; node: React.ReactNode }> = [];

  rings.forEach((ring, ri) => {
    const spreadZ = ring.zOffset * (1 + separateProgress * 0.42);
    const angleOffset = f * ring.speed;
    const pts: Array<{ x: number; y: number; depth: number }> = [];

    for (let s = 0; s <= ring.segments; s++) {
      const theta = (s / ring.segments) * Math.PI * 2 + angleOffset;
      const vLocal: Vec3 = {
        x: spreadZ,
        y: Math.cos(theta) * ring.r,
        z: Math.sin(theta) * ring.r,
      };
      const vRot = rotateVec3(vLocal, ring.tiltX * 0.3, 0.32, 0);
      const proj = projectVec3(vRot, cx, cy, 480, 400);
      pts.push(proj);
    }

    const pathD = pts
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");
    const avgDepth = pts.reduce((acc, p) => acc + p.depth, 0) / pts.length;

    elements.push({
      depth: avgDepth,
      node: (
        <g key={`ring-${ri}`}>
          <path
            d={pathD}
            fill="none"
            stroke={ri === 1 ? accentColor : "rgba(148, 163, 184, 0.55)"}
            strokeWidth={ri === 1 ? 3.2 : 2.0}
            strokeDasharray={ri === 1 ? "12 6" : undefined}
          />
          {pts.slice(0, -1).map((p, pi) =>
            pi % 2 === 0 ? (
              <circle
                key={pi}
                cx={p.x}
                cy={p.y}
                r={ri === 1 ? 3.5 : 2.2}
                fill={ri === 1 ? accentColor : "#94A3B8"}
              />
            ) : null
          )}
        </g>
      ),
    });
  });

  elements.sort((a, b) => b.depth - a.depth);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
      {/* 中心光学轴线 */}
      <line
        x1={cx - 135}
        y1={cy}
        x2={cx + 135}
        y2={cy}
        stroke={accentColor}
        strokeWidth="1.5"
        strokeDasharray="4 4"
        opacity={0.5}
      />
      {elements.map((el) => el.node)}
    </svg>
  );
};

/* ==========================================================================
   3. 真实 3D 空间拓扑网络 (SpatialTopologyNetwork3D)
   支持三维空间节点围绕中心旋转、深度遮挡排序与边脉冲传输
   ========================================================================== */
export const SpatialTopologyNetwork3D: React.FC<{
  width?: number;
  height?: number;
  accentColor: string;
  convergeProgress: number;
  activeChannels?: number;
}> = ({ width = 540, height = 360, accentColor, convergeProgress }) => {
  const f = useCurrentFrame();
  const cx = width / 2;
  const cy = height / 2;

  const nodes3D: Array<{ id: string; pos: Vec3; isCore?: boolean }> = [
    { id: "CORE", pos: { x: 0, y: 0, z: 0 }, isCore: true },
    { id: "VEC", pos: { x: -120, y: -70, z: 60 } },
    { id: "BM25", pos: { x: 125, y: -65, z: -50 } },
    { id: "GRAPH", pos: { x: -95, y: 85, z: -70 } },
    { id: "TIME", pos: { x: 110, y: 80, z: 75 } },
    { id: "CTX_1", pos: { x: 0, y: -115, z: -90 } },
    { id: "CTX_2", pos: { x: 0, y: 115, z: 85 } },
  ];

  const edges: Array<[number, number]> = [
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 1],
    [5, 2],
    [6, 3],
    [6, 4],
    [1, 3],
    [2, 4],
  ];

  const ry = f * 0.015;
  const rx = Math.sin(f * 0.01) * 0.22 + 0.25;

  const projectedNodes = nodes3D.map((n) => {
    const shrink = n.isCore ? 1 : interpolate(convergeProgress, [0, 1], [1, 0.68], clamp);
    const vScaled = { x: n.pos.x * shrink, y: n.pos.y * shrink, z: n.pos.z * shrink };
    const vRot = rotateVec3(vScaled, rx, ry, 0);
    const proj = projectVec3(vRot, cx, cy, 520, 420);
    return { ...n, ...proj };
  });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
      {/* 三维空间边与脉冲 */}
      {edges.map(([u, v], ei) => {
        const nu = projectedNodes[u];
        const nv = projectedNodes[v];
        const pulseT = ((f * 0.035 + ei * 0.19) % 1);
        const px = nu.x + (nv.x - nu.x) * pulseT;
        const py = nu.y + (nv.y - nu.y) * pulseT;
        const isToCore = v === 0;
        return (
          <g key={`edge-${ei}`}>
            <line
              x1={nu.x}
              y1={nu.y}
              x2={nv.x}
              y2={nv.y}
              stroke={isToCore ? accentColor : "rgba(148,163,184,0.35)"}
              strokeWidth={isToCore ? 2.0 : 1.2}
              strokeOpacity={isToCore ? 0.65 : 0.35}
            />
            <circle
              cx={px}
              cy={py}
              r={isToCore ? 4 : 2.5}
              fill={accentColor}
            />
          </g>
        );
      })}

      {/* 深度排序后的三维空间节点 */}
      {[...projectedNodes]
        .sort((a, b) => b.depth - a.depth)
        .map((n) => {
          const r = n.isCore ? 26 * n.scale : 13 * n.scale;
          return (
            <g key={n.id}>
              <circle
                cx={n.x}
                cy={n.y}
                r={r * 1.45}
                fill={accentColor}
                fillOpacity={n.isCore ? 0.25 : 0.12}
              />
              <circle
                cx={n.x}
                cy={n.y}
                r={r}
                fill={n.isCore ? accentColor : "#131722"}
                stroke={accentColor}
                strokeWidth={n.isCore ? 3 : 2}
              />
              <text
                x={n.x}
                y={n.y + 4}
                textAnchor="middle"
                fill={n.isCore ? "#0B0D12" : "#F3F4F6"}
                fontSize={n.isCore ? 12 : 10}
                fontWeight="800"
                fontFamily="monospace"
              >
                {n.id}
              </text>
            </g>
          );
        })}
    </svg>
  );
};
