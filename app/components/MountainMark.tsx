"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BRAND } from "@/lib/config";
import styles from "./MountainMark.module.css";

type Point = [number, number, number];

const SEGMENTS = 18;
const RINGS = 7;

function mountainHeight(ring: number, angle: number) {
  const distance = ring / RINGS;
  const mainPeak = Math.pow(1 - distance, 1.35) * 1.42;
  const westRidge =
    Math.exp(-Math.pow(distance - 0.38, 2) / 0.035) *
    Math.max(0, Math.cos(angle + 0.55)) *
    0.34;
  const eastShoulder =
    Math.exp(-Math.pow(distance - 0.56, 2) / 0.055) *
    Math.max(0, Math.cos(angle - 2.15)) *
    0.25;
  const strata =
    Math.sin(angle * 3 + ring * 1.7) * 0.07 * (1 - distance) +
    Math.cos(angle * 5 - ring * 0.8) * 0.035;

  return 0.1 + mainPeak + westRidge + eastShoulder + strata;
}

function createMountainGeometry() {
  const rings: Point[][] = [];

  for (let ring = 1; ring <= RINGS; ring += 1) {
    const distance = ring / RINGS;
    const points: Point[] = [];

    for (let segment = 0; segment < SEGMENTS; segment += 1) {
      const angle = (segment / SEGMENTS) * Math.PI * 2;
      const edgeBreak =
        1 +
        Math.sin(segment * 2.31 + ring * 0.9) * 0.055 +
        Math.cos(segment * 1.17 - ring * 1.4) * 0.035;
      const radius = 1.33 * distance * edgeBreak;
      const drift = 1 - distance;

      points.push([
        Math.cos(angle) * radius - 0.12 * drift,
        mountainHeight(ring, angle),
        Math.sin(angle) * radius * 0.78 + 0.08 * drift,
      ]);
    }

    rings.push(points);
  }

  const positions: number[] = [];
  const colors: number[] = [];
  const low = new THREE.Color("#521113");
  const middle = new THREE.Color("#B9272B");
  const high = new THREE.Color("#FF6A67");

  const pushTriangle = (a: Point, b: Point, c: Point, variation = 0) => {
    positions.push(...a, ...b, ...c);

    const averageHeight = (a[1] + b[1] + c[1]) / 3;
    const elevation = THREE.MathUtils.clamp((averageHeight - 0.02) / 1.58, 0, 1);
    const color = new THREE.Color();

    if (elevation < 0.55) {
      color.lerpColors(low, middle, elevation / 0.55);
    } else {
      color.lerpColors(middle, high, (elevation - 0.55) / 0.45);
    }

    color.offsetHSL(variation * 0.008, variation * 0.02, variation * 0.035);

    for (let vertex = 0; vertex < 3; vertex += 1) {
      colors.push(color.r, color.g, color.b);
    }
  };

  const summit: Point = [-0.16, 1.68, 0.08];
  const firstRing = rings[0];

  for (let segment = 0; segment < SEGMENTS; segment += 1) {
    pushTriangle(
      summit,
      firstRing[segment],
      firstRing[(segment + 1) % SEGMENTS],
      Math.sin(segment * 2.7),
    );
  }

  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    const inner = rings[ring];
    const outer = rings[ring + 1];

    for (let segment = 0; segment < SEGMENTS; segment += 1) {
      const next = (segment + 1) % SEGMENTS;
      const variation = Math.sin(segment * 1.91 + ring * 2.4);

      if ((segment + ring) % 2 === 0) {
        pushTriangle(inner[segment], outer[segment], outer[next], variation);
        pushTriangle(inner[segment], outer[next], inner[next], -variation);
      } else {
        pushTriangle(inner[segment], outer[segment], inner[next], variation);
        pushTriangle(inner[next], outer[segment], outer[next], -variation);
      }
    }
  }

  const outerRing = rings[rings.length - 1];
  const baseY = -0.16;

  for (let segment = 0; segment < SEGMENTS; segment += 1) {
    const next = (segment + 1) % SEGMENTS;
    const topA = outerRing[segment];
    const topB = outerRing[next];
    const bottomA: Point = [topA[0], baseY, topA[2]];
    const bottomB: Point = [topB[0], baseY, topB[2]];

    pushTriangle(topA, bottomA, bottomB, -0.7);
    pushTriangle(topA, bottomB, topB, -0.5);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

function MountainSculpture({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(() => createMountainGeometry(), []);
  const rotation = useRef(-0.42);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ pointer }, delta) => {
    if (!group.current || reducedMotion) return;

    rotation.current += delta * 0.24;
    group.current.rotation.y = THREE.MathUtils.damp(
      group.current.rotation.y,
      rotation.current + pointer.x * 0.16,
      5,
      delta,
    );
    group.current.rotation.x = THREE.MathUtils.damp(
      group.current.rotation.x,
      -0.04 + pointer.y * 0.08,
      5,
      delta,
    );
  });

  return (
    <group
      ref={group}
      position={[0, -0.58, 0]}
      rotation={[-0.04, -0.42, 0]}
      scale={0.94}
    >
      <mesh geometry={geometry}>
        <meshPhysicalMaterial
          vertexColors
          roughness={0.46}
          metalness={0.08}
          clearcoat={0.34}
          clearcoatRoughness={0.42}
        />
      </mesh>
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[2.72, 0.11, 2.72]} />
        <meshPhysicalMaterial
          color="#651416"
          roughness={0.4}
          metalness={0.12}
          clearcoat={0.42}
          clearcoatRoughness={0.36}
        />
      </mesh>
      <mesh position={[0, -0.132, 0]}>
        <boxGeometry args={[2.6, 0.025, 2.6]} />
        <meshPhysicalMaterial
          color="#8A1B1E"
          roughness={0.38}
          metalness={0.1}
          clearcoat={0.46}
          clearcoatRoughness={0.32}
        />
      </mesh>
    </group>
  );
}

function MountainFallback() {
  return (
    <svg
      viewBox="0 0 220 170"
      className={styles.fallback}
      aria-hidden="true"
    >
      <path
        d="M25 139 79 76l18 16 27-57 72 104Z"
        fill="#9F2327"
      />
      <path d="m97 92 27-57 16 83Z" fill="#F05A59" />
      <path d="M25 139h171l-8 10H34Z" fill="#611416" />
    </svg>
  );
}

export default function MountainMark({
  className = "",
  size = "lockup",
}: {
  className?: string;
  size?: "lockup" | "showcase";
}) {
  const reducedMotion = useReducedMotion() ?? false;

  return (
    <div
      className={`${styles.mark} ${size === "showcase" ? styles.showcase : ""} ${className}`}
      role="img"
      aria-label="Basecamp mountain mark"
    >
      <Canvas
        aria-hidden="true"
        dpr={[1, 1.6]}
        camera={{ position: [0, 0.14, 4.65], fov: 34 }}
        frameloop={reducedMotion ? "demand" : "always"}
        fallback={<MountainFallback />}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        }}
      >
        <ambientLight intensity={0.72} />
        <hemisphereLight args={["#ffd3ce", "#260708", 1.2]} />
        <directionalLight
          color="#fff1e8"
          intensity={3.2}
          position={[2.8, 4.2, 3.4]}
        />
        <pointLight
          color={BRAND.colors.primary}
          intensity={8}
          distance={6}
          position={[-2.5, 1, -2.4]}
        />
        <MountainSculpture reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
