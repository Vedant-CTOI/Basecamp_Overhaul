"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { AmbientMode, AmbientPreset } from "./AmbientField";
import { BRAND } from "@/lib/config";

type ShaderMode = Exclude<AmbientMode, "canvas">;

const VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const SHADER_UTILS = `
  precision highp float;

  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform vec3 uInk;
  uniform vec3 uDeep;
  uniform vec3 uRed;
  uniform vec3 uPink;
  uniform vec3 uStage;
  uniform vec3 uStageUp;
  uniform vec3 uEmber;
  uniform vec3 uWine;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.52;
    mat2 rotation = mat2(0.80, 0.60, -0.60, 0.80);

    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p = rotation * p * 2.03 + 17.17;
      amplitude *= 0.50;
    }

    return value;
  }

  vec2 stagePoint() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 point = (vUv - 0.5) * vec2(aspect, 1.0);
    vec2 pointer = (uPointer - 0.5) * vec2(aspect, 1.0);
    vec2 delta = point - pointer;
    point += normalize(delta + vec2(0.0001)) * 0.045 * exp(-dot(delta, delta) * 3.2);
    return point;
  }

  float vignette(vec2 uv) {
    vec2 edge = smoothstep(vec2(0.02), vec2(0.42), uv * (1.0 - uv));
    return edge.x * edge.y;
  }

  vec3 finishColor(vec3 color) {
    float grain = hash21(gl_FragCoord.xy + uTime * 0.17) - 0.5;
    color += grain * 0.012;
    color *= mix(0.63, 1.0, vignette(vUv));
    return color;
  }
`;

const COLOR_BENDS_SHADER = `
  ${SHADER_UTILS}

  void main() {
    vec2 point = stagePoint();
    float time = uTime * 0.075;

    vec2 firstWarp = vec2(
      fbm(point * 1.12 + vec2(time * 0.16, -time * 0.09)),
      fbm(point * 1.08 + vec2(5.2, -3.1) + vec2(-time * 0.10, time * 0.12))
    );
    vec2 secondWarp = vec2(
      fbm(point * 0.92 + firstWarp * 1.55 + vec2(8.3, time * 0.08)),
      fbm(point * 1.04 + firstWarp * 1.28 + vec2(-4.4, -time * 0.11))
    );

    float sweep = point.y * 1.15 + point.x * 0.40;
    float bend = sin((sweep + secondWarp.x * 0.72) * 3.15 + time * 0.30);
    float counter = sin(
      (point.y * 0.62 - point.x * 0.92 + secondWarp.y * 0.66) * 2.75 -
      time * 0.22
    );
    float broadLight = smoothstep(-0.82, 0.72, bend);
    float pinkLift = smoothstep(0.18, 0.96, counter + secondWarp.x * 0.34);
    float silk = 1.0 - smoothstep(0.12, 0.68, abs(counter - 0.18));
    float depth = fbm(point * 1.30 + secondWarp * 0.84 + time * 0.025);

    vec3 color = mix(uInk, uDeep, 0.58 + depth * 0.42);
    color = mix(color, uRed, broadLight * (0.78 + depth * 0.22));
    color = mix(color, uPink, pinkLift * broadLight * 0.52);
    color = mix(color, uPink, silk * broadLight * 0.18);
    color += uRed * smoothstep(0.62, 1.0, depth) * 0.30;
    color += uRed * broadLight * 0.10;

    gl_FragColor = vec4(finishColor(color), 1.0);
  }
`;

const METABALLS_SHADER = `
  ${SHADER_UTILS}

  void main() {
    vec2 point = stagePoint();
    float time = uTime * 0.13;
    float field = 0.0;
    float blush = 0.0;

    for (int i = 0; i < 8; i++) {
      float index = float(i);
      float phase = index * 2.31;
      vec2 center = vec2(
        sin(time * (0.42 + index * 0.018) + phase) * (0.61 + 0.08 * sin(index)),
        cos(time * (0.31 + index * 0.014) + phase * 1.13) * (0.39 + 0.055 * cos(index * 1.7))
      );
      center += vec2(
        sin(time * 0.17 + index * 1.73),
        cos(time * 0.19 - index * 1.21)
      ) * 0.10;

      vec2 delta = point - center;
      delta.x *= 0.88 + 0.12 * sin(index * 2.0);
      float radius = 0.030 + 0.006 * sin(index * 1.9);
      float influence = radius / (dot(delta, delta) + 0.009);
      field += influence;
      blush += influence * (0.45 + 0.55 * sin(index * 2.7));
    }

    float body = smoothstep(0.60, 1.04, field);
    float halo = smoothstep(0.24, 0.66, field);
    float rim = smoothstep(0.46, 0.78, field) - smoothstep(1.05, 1.42, field);
    float core = smoothstep(1.15, 2.10, field);
    float softNoise = fbm(point * 1.35 + vec2(time * 0.035, -time * 0.028));

    vec3 color = mix(uInk, uDeep, halo * 0.42);
    color = mix(color, uRed, body * (0.76 + softNoise * 0.16));
    color = mix(color, uPink, rim * (0.38 + blush / max(field, 0.001) * 0.36));
    color = mix(color, uPink, core * 0.38);
    color += uRed * halo * (1.0 - body) * 0.10;

    gl_FragColor = vec4(finishColor(color), 1.0);
  }
`;

const FERROFLUID_SHADER = `
  ${SHADER_UTILS}

  void main() {
    vec2 point = stagePoint();
    float time = uTime * 0.085;

    vec2 warp = vec2(
      fbm(point * 1.28 + vec2(time * 0.15, -time * 0.07)),
      fbm(point * 1.31 + vec2(-3.7, 6.1) + vec2(-time * 0.09, time * 0.12))
    ) - 0.5;
    float liquid = fbm(point * 2.05 + warp * 1.92 + vec2(time * 0.045, -time * 0.052));
    float tide = fbm(point * 0.78 - warp * 0.62 + vec2(-time * 0.027, time * 0.033));
    float threshold = 0.48 + (tide - 0.5) * 0.18;
    float body = smoothstep(threshold - 0.08, threshold + 0.11, liquid);
    float ridge = 1.0 - smoothstep(0.025, 0.145, abs(liquid - threshold));
    float innerRidge = 1.0 - smoothstep(
      0.018,
      0.095,
      abs(liquid - threshold - 0.12)
    );

    vec3 color = mix(uInk, uDeep, 0.38 + tide * 0.34);
    color = mix(color, uDeep * 0.58, body * 0.86);
    color += uRed * ridge * 0.82;
    color += uPink * innerRidge * ridge * 0.34;
    color += uRed * smoothstep(0.70, 0.96, tide) * (1.0 - body) * 0.18;

    gl_FragColor = vec4(finishColor(color), 1.0);
  }
`;

const DARKROOM_SHADER = `
  ${SHADER_UTILS}

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 point = (vUv - 0.5) * vec2(aspect, 1.0);
    float time = uTime;

    float breathe = fbm(point * 0.85 + vec2(time * 0.006, -time * 0.004));
    float lift = clamp(0.22 + (0.5 - vUv.y) * 0.30 + breathe * 0.16, 0.0, 1.0);
    vec3 color = mix(uStage, uStageUp, lift);

    vec2 emberPos = vec2(
      sin(time * 0.1047) * 0.13 + sin(time * 0.0331) * 0.05,
      -0.34 + cos(time * 0.0731) * 0.04
    );
    float dist = length(point - emberPos);
    float smoke = fbm(point * 2.1 + vec2(time * 0.011, -time * 0.019));
    float bloom = exp(-dist * dist * 5.4) * (0.60 + 0.40 * smoke);
    float core = exp(-dist * dist * 24.0);

    color += uEmber * bloom * 0.32;
    color += uEmber * core * 0.20;
    color += uRed * core * smoke * 0.09;

    float grain = hash21(gl_FragCoord.xy + fract(uTime * 0.31) * 240.0) - 0.5;
    color += grain * 0.022;
    color *= mix(0.72, 1.0, vignette(vUv));

    gl_FragColor = vec4(color, 1.0);
  }
`;

const INK_WASH_SHADER = `
  ${SHADER_UTILS}

  void main() {
    vec2 point = stagePoint();
    float time = uTime * 0.045;

    vec2 sink = vec2(0.0, time * 0.05);
    vec2 q = vec2(
      fbm(point * 1.5 + sink * 0.6 + vec2(0.0, time * 0.02)),
      fbm(point * 1.5 + vec2(5.2, 1.3) - sink * 0.4)
    );
    vec2 r = vec2(
      fbm(point * 1.8 + q * 1.9 + vec2(1.7, 9.2) + sink * 0.3),
      fbm(point * 1.7 + q * 1.6 + vec2(8.3, 2.8) - vec2(time * 0.015, 0.0))
    );
    float plume = fbm(point * 2.1 + r * 2.3 - sink);

    float region = smoothstep(
      0.34,
      0.68,
      fbm(point * 0.62 + q * 0.5 + vec2(0.0, time * 0.012))
    );
    float body = smoothstep(0.48, 0.70, plume) * region;
    float veil = smoothstep(0.38, 0.55, plume) * region;
    float edge = clamp(veil - body * 1.3, 0.0, 1.0);
    float filament = (1.0 - smoothstep(0.012, 0.08, abs(plume - 0.5))) * region;

    vec3 color = mix(uStage, uStageUp, 0.32 + q.x * 0.22);
    color = mix(color, uWine, veil * 0.70);
    color = mix(color, mix(uWine, uRed, 0.55 + r.y * 0.30), body * 0.80);
    color = mix(color, uPink, edge * 0.42);
    color = mix(color, uPink, filament * 0.11);

    gl_FragColor = vec4(finishColor(color), 1.0);
  }
`;

const HOUSE_TYPE_SHADER = `
  ${SHADER_UTILS}
  uniform sampler2D uType;

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 point = (vUv - 0.5) * vec2(aspect, 1.0);
    float time = uTime;

    float breathe = fbm(point * 0.85 + vec2(time * 0.006, -time * 0.004));
    float lift = clamp(0.22 + (0.5 - vUv.y) * 0.28 + breathe * 0.15, 0.0, 1.0);
    vec3 color = mix(uStage, uStageUp, lift);

    vec2 emberPos = vec2(sin(time * 0.1047) * 0.11, -0.36 + cos(time * 0.0731) * 0.035);
    float dist = length(point - emberPos);
    float smoke = fbm(point * 2.1 + vec2(time * 0.011, -time * 0.019));
    color += uEmber * exp(-dist * dist * 5.8) * (0.60 + 0.40 * smoke) * 0.22;

    vec2 st = vUv - 0.5;
    st.x *= aspect;
    vec2 drift1 = vec2(sin(time * 0.017), cos(time * 0.013)) * 0.014;
    vec2 drift2 = vec2(sin(time * 0.023 + 2.1), cos(time * 0.019 + 1.2)) * 0.022;
    vec2 drift3 = vec2(sin(time * 0.029 + 4.4), cos(time * 0.024 + 3.1)) * 0.030;

    float deep = texture2D(uType, clamp(st * 0.92 + 0.5 + drift1, 0.0, 1.0)).r;
    float mid = texture2D(uType, clamp(st * 0.64 + vec2(0.5, 0.47) + drift2, 0.0, 1.0)).g;
    float near = texture2D(uType, clamp(st * 0.45 + vec2(0.48, 0.54) + drift3, 0.0, 1.0)).b;

    color = mix(color, uPink, deep * 0.030);
    color = mix(color, vec3(0.60), mid * 0.042);
    color = mix(color, vec3(0.68), near * 0.058);

    float grain = hash21(gl_FragCoord.xy + fract(uTime * 0.31) * 240.0) - 0.5;
    color += grain * 0.020;
    color *= mix(0.74, 1.0, vignette(vUv));

    gl_FragColor = vec4(color, 1.0);
  }
`;

const FRAGMENT_SHADERS: Record<ShaderMode, string> = {
  "color-bends": COLOR_BENDS_SHADER,
  metaballs: METABALLS_SHADER,
  ferrofluid: FERROFLUID_SHADER,
  darkroom: DARKROOM_SHADER,
  "ink-wash": INK_WASH_SHADER,
  "house-type": HOUSE_TYPE_SHADER,
};

const PALETTES: Record<
  AmbientPreset,
  { ink: string; deep: string; red: string; pink: string }
> = {
  ember: {
    ink: "#06080F",
    deep: "#1E4570",
    red: BRAND.colors.primary,
    pink: "#DABF80",   // light gold replaces rose — Dove's warm accent
  },
  blush: {
    ink: "#0A0E1A",
    deep: BRAND.colors.primaryDim,
    red: BRAND.colors.primaryBright,
    pink: "#DABF80",
  },
};

// One canvas, one channel per glyph, so the shader drifts each letterform
// at its own parallax depth from a single sampler. Redrawn once the real
// Ogilvy Serif italic arrives via document.fonts.
function createTypeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const draw = () => {
    const context = canvas.getContext("2d");
    if (!context) return;
    const family =
      getComputedStyle(document.body)
        .getPropertyValue("--font-ogilvy-serif")
        .split(",")[0]
        ?.trim()
        .replace(/['"]/g, "") || "Georgia";
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = "lighter";
    context.textAlign = "center";
    context.textBaseline = "middle";

    const glyphs = [
      { char: "O", size: 640, x: 430, y: 400, fill: "#f00" },
      { char: "g", size: 600, x: 620, y: 500, fill: "#0f0" },
      { char: "y", size: 560, x: 380, y: 610, fill: "#00f" },
    ];
    for (const glyph of glyphs) {
      context.font = `italic 400 ${glyph.size}px "${family}", Georgia, serif`;
      context.fillStyle = glyph.fill;
      context.fillText(glyph.char, glyph.x, glyph.y);
    }
    texture.needsUpdate = true;
  };

  draw();
  document.fonts?.ready.then(draw).catch(() => undefined);
  return texture;
}

export default function AmbientShaderField({
  mode,
  preset,
  opacity,
  className,
}: {
  mode: ShaderMode;
  preset: AmbientPreset;
  opacity: number;
  className: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const palette = PALETTES[preset];
    let renderer: THREE.WebGLRenderer | undefined;
    let animationFrame = 0;
    let visible = true;
    let pageVisible = document.visibilityState === "visible";

    try {
      renderer = new THREE.WebGLRenderer({
        alpha: false,
        antialias: false,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(palette.ink, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
    renderer.domElement.className = "absolute inset-0 h-full w-full";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const typeTexture = mode === "house-type" ? createTypeTexture() : null;
    const uniforms = {
      uTime: { value: reducedMotion ? 8 : 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPointer: { value: new THREE.Vector2(0.5, 0.5) },
      uInk: { value: new THREE.Color(palette.ink) },
      uDeep: { value: new THREE.Color(palette.deep) },
      uRed: { value: new THREE.Color(palette.red) },
      uPink: { value: new THREE.Color(palette.pink) },
      uStage: { value: new THREE.Color("#141316") },
      uStageUp: { value: new THREE.Color("#1A2338") },
      uEmber: { value: new THREE.Color("#B78938") },
      uWine: { value: new THREE.Color("#1E4570") },
      uType: { value: typeTexture },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADERS[mode],
      uniforms,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const pointerTarget = new THREE.Vector2(0.5, 0.5);
    const pointerCurrent = new THREE.Vector2(0.5, 0.5);

    const resize = () => {
      const bounds = container.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      renderer?.setSize(width, height, false);
      uniforms.uResolution.value.set(width, height);
      renderer?.render(scene, camera);
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = container.getBoundingClientRect();
      pointerTarget.set(
        THREE.MathUtils.clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
        THREE.MathUtils.clamp(
          1 - (event.clientY - bounds.top) / bounds.height,
          0,
          1,
        ),
      );
    };

    const renderFrame = (time: number) => {
      if (pageVisible && visible) {
        uniforms.uTime.value = reducedMotion ? 8 : time * 0.001;
        pointerCurrent.lerp(pointerTarget, 0.028);
        uniforms.uPointer.value.copy(pointerCurrent);
        renderer?.render(scene, camera);
      }

      if (!reducedMotion) {
        animationFrame = window.requestAnimationFrame(renderFrame);
      }
    };

    const onVisibilityChange = () => {
      pageVisible = document.visibilityState === "visible";
    };
    const resizeObserver = new ResizeObserver(resize);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });

    resizeObserver.observe(container);
    intersectionObserver.observe(container);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    resize();
    renderFrame(0);

    let disposed = false;
    if (typeTexture) {
      document.fonts?.ready.then(() => {
        if (!disposed) renderer?.render(scene, camera);
      });
    }

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      geometry.dispose();
      material.dispose();
      typeTexture?.dispose();
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [mode, preset]);

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute inset-0 overflow-hidden bg-[#0D0C0D] ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            `radial-gradient(circle at 16% 22%, ${BRAND.colors.primary} 0%, transparent 35%), radial-gradient(circle at 82% 68%, ${BRAND.colors.primaryDim} 0%, transparent 42%), radial-gradient(circle at 62% 12%, ${BRAND.colors.pink} 0%, transparent 31%), #0D0C0D`,
          filter: "blur(28px) saturate(108%)",
          transform: "scale(1.05)",
        }}
      />
    </div>
  );
}
