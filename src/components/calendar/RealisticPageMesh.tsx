import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

interface RealisticPageMeshProps {
  frontTex: THREE.Texture | null;
  backTex: THREE.Texture | null;
  revealTex: THREE.Texture | null;
  width: number;
  height: number;
  flipProgress: React.MutableRefObject<number>;
  grabRight: React.MutableRefObject<boolean>;
}

export function RealisticPageMesh({
  frontTex,
  backTex,
  revealTex,
  width,
  height,
  flipProgress,
  grabRight,
}: RealisticPageMeshProps) {
  const rigRef = useRef<THREE.Group>(null);
  const pageGroupRef = useRef<THREE.Group>(null);
  const revealedMeshRef = useRef<THREE.Mesh>(null);
  const frontMeshRef = useRef<THREE.Mesh>(null);
  const backMeshRef = useRef<THREE.Mesh>(null);
  const displayProgress = useRef(0);
  const { gl } = useThree();

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(width, height, 48, 64);
    geo.userData.original = new Float32Array(geo.attributes.position.array as ArrayLike<number>);
    return geo;
  }, [width, height]);

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

  const foldShadowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#000000",
        transparent: true,
        opacity: 0.055,
        depthWrite: false,
      }),
    []
  );

  useEffect(() => {
    return () => {
      revealedPageMaterial.dispose();
      frontMaterial.dispose();
      backMaterial.dispose();
      foldShadowMaterial.dispose();
    };
  }, [backMaterial, foldShadowMaterial, frontMaterial, revealedPageMaterial]);

  useFrame((_, delta) => {
    const targetProgress = THREE.MathUtils.clamp(flipProgress.current, 0, 1);
    displayProgress.current = THREE.MathUtils.damp(displayProgress.current, targetProgress, 16, delta);

    const progress = displayProgress.current;
    const shapedProgress = THREE.MathUtils.smootherstep(progress, 0, 1);
    const shadowFade = THREE.MathUtils.smoothstep(progress, 0.14, 0.94);

    foldShadowMaterial.opacity = progress < 0.12 ? 0 : 0.036 * shadowFade;

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
    const direction = grabRight.current ? 1 : -1;
    const topEdge = height / 2;
    const hingeBand = Math.max(16, height * 0.045);
    const baseRotation = THREE.MathUtils.lerp(0, Math.PI * 0.948, shapedProgress);
    const dragReach = THREE.MathUtils.lerp(0, 1, THREE.MathUtils.smoothstep(progress, 0.04, 0.34));
    const controlledCurl = THREE.MathUtils.lerp(0, height * 0.061, THREE.MathUtils.smoothstep(progress, 0.12, 0.94));
    const spineBow = Math.sin(shapedProgress * Math.PI) * width * 0.01;
    const undersideLift = Math.sin(shapedProgress * Math.PI) * 0.95;

    for (let i = 0; i < pos.count; i++) {
      const index = i * 3;
      const originalX = original[index];
      const originalY = original[index + 1];

      let vx = originalX;
      let vy = originalY;
      let vz = 0;

      const normalizedX = (originalX + width / 2) / width;
      const normalizedY = (topEdge - originalY) / height;
      const dragBias = grabRight.current ? normalizedX : 1 - normalizedX;
      const hingeDistance = topEdge - originalY;
      const hingeLock = 1 - THREE.MathUtils.smoothstep(hingeDistance, hingeBand * 0.25, hingeBand);
      const xWave = Math.sin(normalizedX * Math.PI);
      const yInfluence = THREE.MathUtils.smoothstep(normalizedY, 0.04, 1);
      const resistance = THREE.MathUtils.lerp(0.68, 1, dragBias);
      const localRotation = baseRotation * yInfluence * THREE.MathUtils.lerp(0.92, 1.01, resistance);
      const pinnedRotation = THREE.MathUtils.lerp(localRotation, 0, hingeLock);

      if (pinnedRotation > 0) {
        vy = topEdge - Math.cos(pinnedRotation) * hingeDistance;
        vz = Math.sin(pinnedRotation) * hingeDistance;

        const sideLead =
          direction *
          dragReach *
          yInfluence *
            (THREE.MathUtils.lerp(-0.24, 0.24, normalizedX) * width * 0.042 +
            (dragBias - 0.5) * width * 0.06);
        const curlEnvelope = xWave * yInfluence * resistance;
        vx += sideLead + direction * curlEnvelope * controlledCurl;
        vz += curlEnvelope * controlledCurl * 0.42;
      }

      vx += direction * xWave * yInfluence * spineBow;
      vz += xWave * yInfluence * undersideLift;

      vx = THREE.MathUtils.lerp(vx, originalX, hingeLock * 0.985);
      vy = THREE.MathUtils.lerp(vy, originalY, hingeLock);
      vz = THREE.MathUtils.lerp(vz, 0, hingeLock);

      positionArray[index] = vx;
      positionArray[index + 1] = vy;
      positionArray[index + 2] = vz;
    }

    pos.needsUpdate = true;
  });

  return (
    <group ref={rigRef} position={[0, 0, 0]}>
      {/* background static page */}
      <mesh ref={revealedMeshRef} position={[0, 0, -14]} material={revealedPageMaterial} renderOrder={0} visible={false}>
        <planeGeometry args={[width, height]} />
      </mesh>

      {/* bending page group */}
      <group ref={pageGroupRef} position={[0, 0, 2]}>
        <mesh geometry={geometry} material={foldShadowMaterial} position={[0, 0, -10]} renderOrder={0} />
        <mesh ref={backMeshRef} geometry={geometry} material={backMaterial} position={[0, 0, -0.35]} renderOrder={1} visible={false} />
        <mesh ref={frontMeshRef} geometry={geometry} material={frontMaterial} position={[0, 0, 0.35]} renderOrder={2} visible={false} />
      </group>

      <ambientLight intensity={0.25} />
    </group>
  );
}
