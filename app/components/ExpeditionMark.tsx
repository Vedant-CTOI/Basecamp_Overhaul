"use client";

import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import styles from "./ExpeditionMark.module.css";

export type ExpeditionConcept = "tent" | "pod";
type Point = [number, number, number];

const OPENING = "#280A0D";

function TriangleFace({
  width,
  height,
  color,
  position,
  scale = 1,
}: {
  width: number;
  height: number;
  color: string;
  position: [number, number, number];
  scale?: number;
}) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(0, height);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, [height, width]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} position={position} scale={scale}>
      <meshPhysicalMaterial
        color={color}
        roughness={0.42}
        metalness={0.08}
        clearcoat={0.3}
        clearcoatRoughness={0.46}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Plinth() {
  return (
    <group>
      <mesh position={[0, -0.225, 0]}>
        <boxGeometry args={[2.42, 0.09, 2.42]} />
        <meshPhysicalMaterial
          color="#531114"
          roughness={0.44}
          metalness={0.1}
          clearcoat={0.3}
          clearcoatRoughness={0.38}
        />
      </mesh>
      <mesh position={[0, -0.167, 0]}>
        <boxGeometry args={[2.3, 0.026, 2.3]} />
        <meshPhysicalMaterial
          color="#8B1D21"
          roughness={0.4}
          metalness={0.08}
          clearcoat={0.36}
          clearcoatRoughness={0.32}
        />
      </mesh>
    </group>
  );
}

function createFacetedGeometry(
  faces: Array<[Point, Point, Point, string]>,
) {
  const positions: number[] = [];
  const colors: number[] = [];

  const triangle = (
    a: Point,
    b: Point,
    c: Point,
    colorValue: string,
  ) => {
    positions.push(...a, ...b, ...c);
    const color = new THREE.Color(colorValue);
    for (let vertex = 0; vertex < 3; vertex += 1) {
      colors.push(color.r, color.g, color.b);
    }
  };

  faces.forEach(([a, b, c, color]) => triangle(a, b, c, color));

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createTentShellGeometry() {
  const frontLeft: Point = [-0.9, 0, 0.72];
  const frontRight: Point = [0.9, 0, 0.72];
  const backRight: Point = [0.76, 0, -0.68];
  const backLeft: Point = [-0.76, 0, -0.68];
  const peak: Point = [0, 1.18, -0.06];

  return createFacetedGeometry([
    [frontLeft, peak, frontRight, "#CA3035"],
    [frontRight, peak, backRight, "#F05A5D"],
    [backRight, peak, backLeft, "#76171B"],
    [backLeft, peak, frontLeft, "#A82328"],
    [frontLeft, frontRight, backRight, "#651316"],
    [frontLeft, backRight, backLeft, "#651316"],
  ]);
}

function createTentOpeningGeometry() {
  return createFacetedGeometry([
    [
      [-0.25, 0.075, 0.686],
      [0.08, 0.76, 0.25],
      [0.41, 0.075, 0.686],
      OPENING,
    ],
  ]);
}

function ExpeditionTent() {
  const geometry = useMemo(() => createTentShellGeometry(), []);
  const openingGeometry = useMemo(() => createTentOpeningGeometry(), []);

  useEffect(
    () => () => {
      geometry.dispose();
      openingGeometry.dispose();
    },
    [geometry, openingGeometry],
  );

  return (
    <group position={[0, -0.01, 0]}>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial
          vertexColors
          roughness={0.48}
          metalness={0.04}
          clearcoat={0.22}
          clearcoatRoughness={0.52}
          flatShading
        />
      </mesh>

      <mesh geometry={openingGeometry}>
        <meshPhysicalMaterial
          vertexColors
          roughness={0.72}
          metalness={0.02}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={[0, 1.175, -0.06]}>
        <octahedronGeometry args={[0.035, 0]} />
        <meshStandardMaterial color="#F47A79" roughness={0.48} />
      </mesh>
    </group>
  );
}

function createPodHullGeometry() {
  const front: Point[] = [
    [-0.76, 0.16, 0.7],
    [0, 1.17, 0.7],
    [0.76, 0.16, 0.7],
  ];
  const back: Point[] = [
    [-0.56, 0.24, -0.8],
    [0, 1.01, -0.8],
    [0.56, 0.24, -0.8],
  ];

  return createFacetedGeometry([
    [front[0], front[1], front[2], "#C72E33"],
    [back[2], back[1], back[0], "#6B1418"],
    [front[0], back[0], back[1], "#CD3237"],
    [front[0], back[1], front[1], "#CD3237"],
    [front[1], back[1], back[2], "#E3484D"],
    [front[1], back[2], front[2], "#E3484D"],
    [front[2], back[2], back[0], "#81191D"],
    [front[2], back[0], front[0], "#81191D"],
  ]);
}

function LandingFoot({
  x,
  z,
  rotation,
}: {
  x: number;
  z: number;
  rotation: number;
}) {
  return (
    <group>
      <mesh position={[x * 0.82, 0.01, z]} rotation={[0, 0, rotation]}>
        <cylinderGeometry args={[0.042, 0.054, 0.27, 8]} />
        <meshStandardMaterial color="#681417" roughness={0.46} metalness={0.18} />
      </mesh>
      <mesh position={[x, -0.135, z]}>
        <boxGeometry args={[0.24, 0.045, 0.2]} />
        <meshPhysicalMaterial
          color="#541013"
          roughness={0.45}
          metalness={0.16}
          clearcoat={0.2}
        />
      </mesh>
    </group>
  );
}

function PodPort({ side }: { side: -1 | 1 }) {
  const quaternion = useMemo(() => {
    const normal = new THREE.Vector3(side * 0.8, 0.6, 0).normalize();
    return new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      normal,
    );
  }, [side]);

  return (
    <group
      position={[side * 0.43, 0.66, 0.08]}
      quaternion={quaternion}
    >
      <mesh>
        <circleGeometry args={[0.105, 6]} />
        <meshPhysicalMaterial
          color="#26090B"
          roughness={0.24}
          metalness={0.18}
          clearcoat={0.52}
        />
      </mesh>
      <mesh position={[0, 0, 0.012]}>
        <ringGeometry args={[0.112, 0.135, 6]} />
        <meshStandardMaterial color="#8E1C20" roughness={0.44} />
      </mesh>
    </group>
  );
}

function TentLandingPod() {
  const geometry = useMemo(() => createPodHullGeometry(), []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group position={[0, -0.05, 0]}>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial
          vertexColors
          roughness={0.34}
          metalness={0.12}
          clearcoat={0.38}
          clearcoatRoughness={0.4}
          flatShading
        />
      </mesh>

      <TriangleFace
        width={0.44}
        height={0.42}
        color={OPENING}
        position={[0, 0.31, 0.712]}
      />
      <TriangleFace
        width={0.16}
        height={0.115}
        color="#F16B6D"
        position={[0, 0.405, 0.723]}
      />

      <PodPort side={-1} />
      <PodPort side={1} />

      <LandingFoot x={-0.58} z={0.18} rotation={0.16} />
      <LandingFoot x={0.58} z={0.18} rotation={-0.16} />

      <mesh position={[0, 0.005, -0.66]} rotation={[0.12, 0, 0]}>
        <cylinderGeometry args={[0.042, 0.054, 0.27, 8]} />
        <meshStandardMaterial color="#681417" roughness={0.46} metalness={0.18} />
      </mesh>
      <mesh position={[0, -0.135, -0.78]}>
        <boxGeometry args={[0.24, 0.045, 0.2]} />
        <meshPhysicalMaterial
          color="#541013"
          roughness={0.45}
          metalness={0.16}
          clearcoat={0.2}
        />
      </mesh>

      <mesh position={[0, 1.16, -0.14]}>
        <octahedronGeometry args={[0.052, 0]} />
        <meshPhysicalMaterial
          color="#FF8583"
          emissive="#8F1B20"
          emissiveIntensity={1.1}
          roughness={0.24}
          clearcoat={0.7}
        />
      </mesh>
    </group>
  );
}

function RotatingConcept({
  concept,
  reducedMotion,
}: {
  concept: ExpeditionConcept;
  reducedMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const initialRotation = concept === "tent" ? -0.5 : -0.42;
  const rotation = useRef(initialRotation);
  const dragging = useRef(false);
  const lastPointerX = useRef(0);

  useFrame(({ pointer }, delta) => {
    if (!group.current) return;

    if (!reducedMotion && !dragging.current) {
      rotation.current += delta * 0.04;
    }

    group.current.rotation.y = THREE.MathUtils.damp(
      group.current.rotation.y,
      rotation.current + pointer.x * 0.08,
      5,
      delta,
    );
    group.current.rotation.x = THREE.MathUtils.damp(
      group.current.rotation.x,
      -0.06 + pointer.y * 0.035,
      5,
      delta,
    );
  });

  const beginDrag = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    dragging.current = true;
    lastPointerX.current = event.nativeEvent.clientX;
  };

  const turn = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    const nextX = event.nativeEvent.clientX;
    rotation.current += (nextX - lastPointerX.current) * 0.012;
    lastPointerX.current = nextX;
  };

  const endDrag = () => {
    dragging.current = false;
  };

  return (
    <group
      ref={group}
      position={[0, -0.38, 0]}
      rotation={[-0.06, initialRotation, 0]}
      onPointerDown={beginDrag}
      onPointerMove={turn}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      {concept === "tent" ? <ExpeditionTent /> : <TentLandingPod />}
      <Plinth />
    </group>
  );
}

function ConceptFallback({ concept }: { concept: ExpeditionConcept }) {
  return (
    <svg
      viewBox="0 0 240 210"
      className={styles.fallback}
      aria-hidden="true"
    >
      {concept === "tent" ? (
        <>
          <path d="M47 158 119 53l74 105Z" fill="#C82F34" />
          <path d="m119 53 74 105h-25Z" fill="#F05A5D" />
          <path d="m91 158 31-63 33 63Z" fill="#19090B" />
        </>
      ) : (
        <>
          <path d="m57 146 11-68 52-38 52 38 11 68Z" fill="#C82F34" />
          <path d="m120 40 52 38 11 68-63-21Z" fill="#F05A5D" />
          <path d="m96 145 24-49 25 49Z" fill="#19090B" />
          <path d="m72 145-16 34M168 145l16 34" stroke="#71171A" strokeWidth="8" />
        </>
      )}
      <path d="M31 181h178l-8 11H39Z" fill="#531114" />
    </svg>
  );
}

export default function ExpeditionMark({
  concept,
  className = "",
}: {
  concept: ExpeditionConcept;
  className?: string;
}) {
  const reducedMotion = useReducedMotion() ?? false;
  const label =
    concept === "tent"
      ? "Rotating expedition tent concept"
      : "Rotating tent landing pod concept";

  return (
    <div className={`${styles.mark} ${className}`} role="img" aria-label={label}>
      <Canvas
        aria-hidden="true"
        dpr={[1, 1.7]}
        camera={{ position: [0, 0.3, 4.45], fov: 32 }}
        frameloop={reducedMotion ? "demand" : "always"}
        fallback={<ConceptFallback concept={concept} />}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        }}
      >
        <ambientLight intensity={0.58} />
        <hemisphereLight args={["#FFD8D2", "#210608", 1.35]} />
        <directionalLight
          color="#FFF5EC"
          intensity={3.4}
          position={[2.8, 4.6, 3.5]}
        />
        <directionalLight
          color="#B81F26"
          intensity={1.8}
          position={[-3.4, 1.3, -2.7]}
        />
        <pointLight
          color="#EF3D43"
          intensity={7}
          distance={5.5}
          position={[-2.2, 0.6, 2.3]}
        />
        <pointLight
          color="#FF716F"
          intensity={3.4}
          distance={4.2}
          position={[0, -1.25, 2.1]}
        />
        <RotatingConcept concept={concept} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
