import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

const PAGE_WIDTH_SEGMENTS = 12;
const PAGE_HEIGHT_SEGMENTS = 16;

interface VertexDeformTable {
  normX: Float32Array;
  xWave: Float32Array;
  dragBiasRight: Float32Array;
  dragBiasLeft: Float32Array;
  hingeDistance: Float32Array;
  hingeLock: Float32Array;
  yInfluence: Float32Array;
  resistanceRight: Float32Array;
  resistanceLeft: Float32Array;
  sideLeadRight: Float32Array;
  sideLeadLeft: Float32Array;
}

function buildVertexDeformTable(original: Float32Array, width: number, height: number): VertexDeformTable {
  const count = original.length / 3;
  const normX = new Float32Array(count);
  const xWave = new Float32Array(count);
  const dragBiasRight = new Float32Array(count);
  const dragBiasLeft = new Float32Array(count);
  const hingeDistance = new Float32Array(count);
  const hingeLock = new Float32Array(count);
  const yInfluence = new Float32Array(count);
  const resistanceRight = new Float32Array(count);
  const resistanceLeft = new Float32Array(count);
  const sideLeadRight = new Float32Array(count);
  const sideLeadLeft = new Float32Array(count);

  const topEdge = height / 2;
  const hingeBand = Math.max(16, height * 0.045);
  const hingeMin = hingeBand * 0.25;
  const widthHalf = width / 2;
  const sideLeadScale = width * 0.042;
  const dragBiasScale = width * 0.06;

  for (let i = 0; i < count; i++) {
    const index = i * 3;
    const originalX = original[index];
    const originalY = original[index + 1];

    const nx = (originalX + widthHalf) / width;
    const ny = (topEdge - originalY) / height;
    const hingeDist = topEdge - originalY;
    const wave = Math.sin(nx * Math.PI);
    const yInf = ny <= 0.04 ? 0 : ny >= 1 ? 1 : (ny - 0.04) / 0.96;
    const hLock =
      hingeDist <= hingeMin ? 0 : hingeDist >= hingeBand ? 1 : (hingeDist - hingeMin) / (hingeBand - hingeMin);
    const biasRight = nx;
    const biasLeft = 1 - nx;
    const resistRight = 0.68 + (1 - 0.68) * biasRight;
    const resistLeft = 0.68 + (1 - 0.68) * biasLeft;
    const leadRight = (-0.24 + (0.24 - -0.24) * nx) * sideLeadScale + (biasRight - 0.5) * dragBiasScale;
    const leadLeft = (-0.24 + (0.24 - -0.24) * nx) * sideLeadScale + (biasLeft - 0.5) * dragBiasScale;

    normX[i] = nx;
    xWave[i] = wave;
    dragBiasRight[i] = biasRight;
    dragBiasLeft[i] = biasLeft;
    hingeDistance[i] = hingeDist;
    hingeLock[i] = 1 - hLock;
    yInfluence[i] = yInf;
    resistanceRight[i] = resistRight;
    resistanceLeft[i] = resistLeft;
    sideLeadRight[i] = leadRight;
    sideLeadLeft[i] = leadLeft;
  }

  return {
    normX,
    xWave,
    dragBiasRight,
    dragBiasLeft,
    hingeDistance,
    hingeLock,
    yInfluence,
    resistanceRight,
    resistanceLeft,
    sideLeadRight,
    sideLeadLeft,
  };
}

interface RealisticPageMeshProps {
  frontTex: THREE.Texture | null;
  backTex: THREE.Texture | null;
  revealTex: THREE.Texture | null;
  width: number;
  height: number;
  flipProgress: React.MutableRefObject<number>;
  grabRight: React.MutableRefObject<boolean>;
  isDragging: React.MutableRefObject<boolean>;
  isAnimating: React.MutableRefObject<boolean>;
}

export function RealisticPageMesh({
  frontTex,
  backTex,
  revealTex,
  width,
  height,
  flipProgress,
  grabRight,
  isDragging,
  isAnimating,
}: RealisticPageMeshProps) {
  const rigRef = useRef<THREE.Group>(null);
  const pageGroupRef = useRef<THREE.Group>(null);
  const revealedMeshRef = useRef<THREE.Mesh>(null);
  const frontMeshRef = useRef<THREE.Mesh>(null);
  const backMeshRef = useRef<THREE.Mesh>(null);
  const displayProgress = useRef(0);
  const { gl } = useThree();

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(width, height, PAGE_WIDTH_SEGMENTS, PAGE_HEIGHT_SEGMENTS);
    geo.userData.original = new Float32Array(geo.attributes.position.array as ArrayLike<number>);
    return geo;
  }, [width, height]);

  const deformTable = useMemo(() => {
    const original = geometry.userData.original as Float32Array;
    return buildVertexDeformTable(original, width, height);
  }, [geometry, width, height]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.NoToneMapping;
    gl.shadowMap.enabled = false;
  }, [gl]);

  const revealedPageMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: revealTex,
        color: "#ffffff",
        transparent: false,
        depthWrite: false,
      }),
    [revealTex]
  );

  const frontMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: frontTex,
        color: "#ffffff",
        side: THREE.FrontSide,
        transparent: false,
        depthWrite: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    [frontTex]
  );

  const backMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: backTex,
        color: "#f7f3eb",
        side: THREE.BackSide,
        transparent: false,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    [backTex]
  );

  useEffect(() => {
    return () => {
      revealedPageMaterial.dispose();
      frontMaterial.dispose();
      backMaterial.dispose();
    };
  }, [backMaterial, frontMaterial, revealedPageMaterial]);

  useFrame((_, delta) => {
    const targetProgress = THREE.MathUtils.clamp(flipProgress.current, 0, 1);
    if (isDragging.current || isAnimating.current) {
      displayProgress.current = targetProgress;
    } else {
      displayProgress.current = THREE.MathUtils.damp(displayProgress.current, targetProgress, 28, delta);
    }

    const progress = displayProgress.current;
    if (progress <= 0.0005) {
      const pos = geometry.attributes.position as THREE.BufferAttribute;
      const positionArray = pos.array as Float32Array;
      const original = geometry.userData.original as Float32Array;
      positionArray.set(original);
      pos.needsUpdate = true;
      if (revealedMeshRef.current) {
        revealedMeshRef.current.visible = false;
      }
      if (frontMeshRef.current) {
        frontMeshRef.current.visible = false;
      }
      if (backMeshRef.current) {
        backMeshRef.current.visible = false;
      }
      return;
    }

    if (revealedMeshRef.current) {
      revealedMeshRef.current.visible = progress >= 0.48;
    }

    if (frontMeshRef.current) {
      frontMeshRef.current.visible = progress >= 0.02;
    }

    if (backMeshRef.current) {
      backMeshRef.current.visible = progress >= 0.36;
    }

    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const positionArray = pos.array as Float32Array;
    const original = geometry.userData.original as Float32Array;
    const {
      xWave,
      hingeDistance,
      hingeLock,
      yInfluence,
      resistanceRight,
      resistanceLeft,
      sideLeadRight,
      sideLeadLeft,
    } = deformTable;

    const fromRight = grabRight.current;
    const direction = fromRight ? 1 : -1;
    const shapedProgress = THREE.MathUtils.smootherstep(progress, 0, 1);
    const topEdge = height / 2;
    const baseRotation = shapedProgress * (Math.PI * 0.965);
    const dragReach =
      progress <= 0.03 ? 0 : progress >= 0.38 ? 1 : (progress - 0.03) / (0.38 - 0.03);
    const curlT = progress <= 0.1 ? 0 : progress >= 0.96 ? 1 : (progress - 0.1) / (0.96 - 0.1);
    const controlledCurl = curlT * height * 0.068;
    const spineBow = Math.sin(shapedProgress * Math.PI) * width * 0.01;
    const undersideLift = Math.sin(shapedProgress * Math.PI) * 0.95;
    const vertexCount = pos.count;

    for (let i = 0; i < vertexCount; i++) {
      const index = i * 3;
      const originalX = original[index];
      const originalY = original[index + 1];
      const yInf = yInfluence[i];
      const hLock = hingeLock[i];
      const resistance = fromRight ? resistanceRight[i] : resistanceLeft[i];
      const localRotation = baseRotation * yInf * (0.92 + (1.01 - 0.92) * resistance);
      const pinnedRotation = localRotation * (1 - hLock);

      let vx = originalX;
      let vy = originalY;
      let vz = 0;

      if (pinnedRotation > 0) {
        const hingeDist = hingeDistance[i];
        vy = topEdge - Math.cos(pinnedRotation) * hingeDist;
        vz = Math.sin(pinnedRotation) * hingeDist;

        const sideLeadFactor = fromRight ? sideLeadRight[i] : sideLeadLeft[i];
        const sideLead = direction * dragReach * yInf * sideLeadFactor;
        const curlEnvelope = xWave[i] * yInf * resistance;
        vx += sideLead + direction * curlEnvelope * controlledCurl;
        vz += curlEnvelope * controlledCurl * 0.42;
      }

      const wave = xWave[i];
      vx += direction * wave * yInf * spineBow;
      vz += wave * yInf * undersideLift;

      const lockBlend = hLock * 0.985;
      vx = vx + (originalX - vx) * lockBlend;
      vy = vy + (originalY - vy) * hLock;
      vz *= 1 - hLock;

      positionArray[index] = vx;
      positionArray[index + 1] = vy;
      positionArray[index + 2] = vz;
    }

    pos.needsUpdate = true;
  });

  return (
    <group ref={rigRef} position={[0, 0, 0]}>
      <mesh ref={revealedMeshRef} position={[0, 0, -14]} material={revealedPageMaterial} renderOrder={0} visible={false}>
        <planeGeometry args={[width, height]} />
      </mesh>

      <group ref={pageGroupRef} position={[0, 0, 2]}>
        <mesh ref={backMeshRef} geometry={geometry} material={backMaterial} position={[0, 0, -0.35]} renderOrder={0} visible={false} />
        <mesh ref={frontMeshRef} geometry={geometry} material={frontMaterial} position={[0, 0, 0.35]} renderOrder={1} visible={false} />
      </group>

      <ambientLight intensity={0.25} />
    </group>
  );
}
