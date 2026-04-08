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
  const displayProgress = useRef(0);
  const { gl } = useThree();

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(width, height, 72, 96);
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
        transparent: true,
      }),
    [revealTex]
  );

  const frontMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: frontTex,
        color: "#ffffff",
        side: THREE.FrontSide,
        transparent: true,
      }),
    [frontTex]
  );

  const backMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: backTex,
        color: "#f7f3eb",
        side: THREE.BackSide,
        transparent: true,
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
    displayProgress.current = THREE.MathUtils.damp(displayProgress.current, targetProgress, 35, delta);

    const progress = displayProgress.current;
    const shapedProgress = THREE.MathUtils.smootherstep(progress, 0, 1);
    const lateFlipFade = THREE.MathUtils.smoothstep(progress, 0.62, 0.9);
    const frontFade = THREE.MathUtils.smoothstep(progress, 0.7, 0.96);

    revealedPageMaterial.opacity = THREE.MathUtils.lerp(0.96, 1, THREE.MathUtils.smoothstep(progress, 0.28, 0.7));
    frontMaterial.opacity = 1 - frontFade * 0.72;
    backMaterial.opacity = 1 - lateFlipFade * 0.94;
    foldShadowMaterial.opacity = 0.055 * THREE.MathUtils.smoothstep(progress, 0.04, 0.9);
    const pos = geometry.attributes.position;
    const original = geometry.userData.original as Float32Array;
    const direction = grabRight.current ? 1 : -1;
    const topEdge = height / 2;
    const hingeBand = Math.max(16, height * 0.045);
    const baseRotation = THREE.MathUtils.lerp(0, Math.PI * 0.97, shapedProgress);
    const dragReach = THREE.MathUtils.lerp(0, 1, THREE.MathUtils.smoothstep(progress, 0.02, 0.24));
    const controlledCurl = THREE.MathUtils.lerp(0, height * 0.075, THREE.MathUtils.smoothstep(progress, 0.08, 0.9));
    const spineBow = Math.sin(shapedProgress * Math.PI) * width * 0.015;
    const undersideLift = Math.sin(shapedProgress * Math.PI) * 1.4;

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
      const resistance = THREE.MathUtils.lerp(0.58, 1, dragBias);
      const localRotation = baseRotation * yInfluence * THREE.MathUtils.lerp(0.88, 1.08, resistance);
      const pinnedRotation = THREE.MathUtils.lerp(localRotation, 0, hingeLock);

      if (pinnedRotation > 0) {
        vy = topEdge - Math.cos(pinnedRotation) * hingeDistance;
        vz = Math.sin(pinnedRotation) * hingeDistance;

        const sideLead =
          direction *
          dragReach *
          yInfluence *
          (THREE.MathUtils.lerp(-0.24, 0.24, normalizedX) * width * 0.06 +
            (dragBias - 0.5) * width * 0.085);
        const curlEnvelope = xWave * yInfluence * resistance;
        vx += sideLead + direction * curlEnvelope * controlledCurl;
        vz += curlEnvelope * controlledCurl * 0.65;
      }

      vx += direction * xWave * yInfluence * spineBow;
      vz += xWave * yInfluence * undersideLift;

      vx = THREE.MathUtils.lerp(vx, originalX, hingeLock * 0.985);
      vy = THREE.MathUtils.lerp(vy, originalY, hingeLock);
      vz = THREE.MathUtils.lerp(vz, 0, hingeLock);

      pos.setXYZ(i, vx, vy, vz);
    }

    pos.needsUpdate = true;
    geometry.computeVertexNormals();

    if (rigRef.current) {
      rigRef.current.position.set(0, 0, 0);
      rigRef.current.rotation.set(0, 0, 0);
    }

    if (pageGroupRef.current) {
      pageGroupRef.current.position.set(0, 0, 2);
      pageGroupRef.current.rotation.set(0, 0, 0);
    }
  });

  return (
    <group ref={rigRef} position={[0, 0, 0]}>
      {/* background static page */}
      <mesh position={[0, 0, -12]} material={revealedPageMaterial}>
        <planeGeometry args={[width, height]} />
      </mesh>

      {/* bending page group */}
      <group ref={pageGroupRef} position={[0, 0, 2]}>
        <mesh geometry={geometry} material={foldShadowMaterial} position={[0, 0, -10]} renderOrder={0} />
        <mesh geometry={geometry} material={frontMaterial} />
        <mesh geometry={geometry} material={backMaterial} />
      </group>

      <ambientLight intensity={0.25} />
    </group>
  );
}