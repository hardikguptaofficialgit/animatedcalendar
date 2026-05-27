"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OverlayPortal } from "./overlay-portal";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Moon,
  Redo2,
  Settings,
  Sun,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCalendar } from "@/hooks/use-calendar";
import { useTheme } from "@/hooks/use-theme";
import { useCalendarSound } from "@/hooks/use-calendar-sound";
import { useSwipeNavigation } from "@/hooks/use-swipe-navigation";
import {
  addMonths,
  daysBetween,
  getMonthKey,
  getMonthLabel,
  getMonthMatrix,
  getWeekdayLabels,
  isToday,
  monthContainsDate,
  parseMonthKey,
  toIsoDate,
} from "@/lib/date";
import { monthImageMap } from "@/data/month-images";
import { DateRange, NoteRecord } from "@/types/calendar";
import { NotesPanel } from "./notes-panel";
import { CalendarGrid } from "./calendar-grid";
import { ContextMenu } from "./context-menu";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import html2canvas from "html2canvas";
import { RealisticPageMesh } from "./RealisticPageMesh";

type SuspensionVector = {
  x: number;
  y: number;
};

const SUSPENSION_LIMITS = {
  maxX: 76,
  maxYDown: 82,
  maxYUp: 28,
};

function clampSuspensionOffset(x: number, y: number): SuspensionVector {
  const clampedX = THREE.MathUtils.clamp(x, -SUSPENSION_LIMITS.maxX, SUSPENSION_LIMITS.maxX);
  const clampedY = THREE.MathUtils.clamp(y, -SUSPENSION_LIMITS.maxYUp, SUSPENSION_LIMITS.maxYDown);
  const yRange = clampedY < 0 ? SUSPENSION_LIMITS.maxYUp : SUSPENSION_LIMITS.maxYDown;
  const normalizedX = clampedX / SUSPENSION_LIMITS.maxX;
  const normalizedY = clampedY / yRange;
  const radialLength = normalizedX * normalizedX + normalizedY * normalizedY;

  if (radialLength <= 1) {
    return { x: clampedX, y: clampedY };
  }

  const scale = 1 / Math.sqrt(radialLength);
  return {
    x: normalizedX * SUSPENSION_LIMITS.maxX * scale,
    y: normalizedY * yRange * scale,
  };
}

export function WallCalendarApp() {
  const calendar = useCalendar();
  const theme = useTheme();
  const sound = useCalendarSound(theme.soundEnabled);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const hangingBodyRef = useRef<HTMLDivElement | null>(null);
  const frontCaptureRef = useRef<HTMLDivElement | null>(null);
  const backCaptureRef = useRef<HTMLDivElement | null>(null);

  const [frontTex, setFrontTex] = useState<THREE.Texture | null>(null);
  const [backTex, setBackTex] = useState<THREE.Texture | null>(null);
  const [revealTex, setRevealTex] = useState<THREE.Texture | null>(null);
  const [isFlippingActive, setIsFlippingActive] = useState(false);
  const [isFlipSceneActive, setIsFlipSceneActive] = useState(false);
  const [flipCanvasMounted, setFlipCanvasMounted] = useState(false);
  const [isSyncingMonth, setIsSyncingMonth] = useState(false);

  const flipProgress = useRef(0);
  const grabRight = useRef(false);
  const isDragging = useRef(false);
  const bounds = useRef({ w: 440, h: 600 });
  const startY = useRef(0);
  const cardTopRef = useRef(0);
  const hasStartedDrag = useRef(false);
  const isAnimating = useRef(false);
  const flipVelocity = useRef(0);
  const lastMoveTime = useRef(0);
  const lastMoveProgress = useRef(0);
  const dragDisplayProgress = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const suspensionFrameRef = useRef<number | null>(null);
  const pendingNextCaptureRef = useRef(false);
  const suppressFullCaptureRef = useRef(false);
  const suspensionDraggingRef = useRef(false);
  const suspensionPointerIdRef = useRef<number | null>(null);
  const suspensionStateRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const suspensionTargetRef = useRef<SuspensionVector>({ x: 0, y: 0 });
  const suspensionDragStartRef = useRef<SuspensionVector>({ x: 0, y: 0 });
  const suspensionTargetStartRef = useRef<SuspensionVector>({ x: 0, y: 0 });
  const suspensionPointerVelocityRef = useRef<SuspensionVector>({ x: 0, y: 0 });
  const suspensionLastMoveRef = useRef({ x: 0, y: 0, time: 0 });
  const suspensionLastFrameTimeRef = useRef(0);
  const textureCacheRef = useRef<{ front: THREE.Texture | null; back: THREE.Texture | null; reveal: THREE.Texture | null }>({
    front: null,
    back: null,
    reveal: null,
  });

  const currentPage = useMemo(
    () => buildCalendarPageData(calendar.visibleMonth, calendar.notes, calendar.ranges, calendar.monthImages),
    [calendar.monthImages, calendar.notes, calendar.ranges, calendar.visibleMonth]
  );
  const nextMonthKey = useMemo(() => addMonths(calendar.visibleMonth, 1), [calendar.visibleMonth]);
  const nextPage = useMemo(
    () => buildCalendarPageData(nextMonthKey, calendar.notes, calendar.ranges, calendar.monthImages),
    [calendar.monthImages, calendar.notes, calendar.ranges, nextMonthKey]
  );
  const textureCaptureKey = `${calendar.visibleMonth}|${nextMonthKey}|${theme.mode}`;
  const notesTextureVersion = useMemo(() => {
    const noteStamp = calendar.notes.reduce((stamp, note) => stamp + note.updatedAt, 0);
    const rangeStamp = calendar.ranges.map((range) => `${range.id}:${range.start}:${range.end}`).join("|");
    const imageStamp = Object.values(calendar.monthImages).join("|");
    return `${noteStamp}|${rangeStamp}|${imageStamp}`;
  }, [calendar.monthImages, calendar.notes, calendar.ranges]);
  const canvasDpr = useMemo(
    () => Math.min(1.25, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1),
    []
  );

  const disposeTexture = (texture: THREE.Texture | null) => {
    texture?.dispose();
  };

  const stopAnimation = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const applySuspensionTransform = useCallback(() => {
    const el = hangingBodyRef.current;
    if (!el) {
      return;
    }

    const { x, y, vx, vy } = suspensionStateRef.current;
    const rotate = THREE.MathUtils.clamp(x * 0.085 + vx * 0.014, -7.5, 7.5);
    const stretch = THREE.MathUtils.clamp(1 + Math.max(0, y) * 0.001 + Math.abs(vy) * 0.00018, 1, 1.055);
    const squash = THREE.MathUtils.clamp(1 - (stretch - 1) * 0.42, 0.978, 1);

    el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rotate.toFixed(2)}deg) scaleX(${squash.toFixed(4)}) scaleY(${stretch.toFixed(4)})`;
  }, []);

  const stopSuspensionAnimation = useCallback(() => {
    if (suspensionFrameRef.current !== null) {
      cancelAnimationFrame(suspensionFrameRef.current);
      suspensionFrameRef.current = null;
    }
  }, []);

  const runSuspensionFrame = useCallback(
    (now: number) => {
      const previousTime = suspensionLastFrameTimeRef.current || now;
      const dt = Math.min(0.032, Math.max(0.001, (now - previousTime) / 1000));
      suspensionLastFrameTimeRef.current = now;

      const state = suspensionStateRef.current;
      const target = suspensionTargetRef.current;
      const dx = target.x - state.x;
      const dy = target.y - state.y;
      const stiffness = suspensionDraggingRef.current ? 22 : 15;
      const damping = suspensionDraggingRef.current ? 8.6 : 6.8;
      const ax = dx * stiffness - state.vx * damping;
      const ay = dy * stiffness - state.vy * damping;

      state.vx += ax * dt;
      state.vy += ay * dt;
      state.x += state.vx * dt;
      state.y += state.vy * dt;

      const clamped = clampSuspensionOffset(state.x, state.y);
      if (clamped.x !== state.x) {
        state.x = clamped.x;
        state.vx *= 0.7;
      }
      if (clamped.y !== state.y) {
        state.y = clamped.y;
        state.vy *= 0.72;
      }

      applySuspensionTransform();

      const settled =
        !suspensionDraggingRef.current &&
        Math.abs(target.x) < 0.05 &&
        Math.abs(target.y) < 0.05 &&
        Math.abs(state.x) < 0.05 &&
        Math.abs(state.y) < 0.05 &&
        Math.abs(state.vx) < 0.05 &&
        Math.abs(state.vy) < 0.05;

      if (settled) {
        state.x = 0;
        state.y = 0;
        state.vx = 0;
        state.vy = 0;
        suspensionTargetRef.current = { x: 0, y: 0 };
        applySuspensionTransform();
        suspensionFrameRef.current = null;
        return;
      }

      suspensionFrameRef.current = requestAnimationFrame(runSuspensionFrame);
    },
    [applySuspensionTransform]
  );

  const ensureSuspensionAnimation = useCallback(() => {
    if (suspensionFrameRef.current !== null) {
      return;
    }

    suspensionLastFrameTimeRef.current = performance.now();
    suspensionFrameRef.current = requestAnimationFrame(runSuspensionFrame);
  }, [runSuspensionFrame]);

  const resetFlipInteraction = () => {
    stopAnimation();
    isDragging.current = false;
    hasStartedDrag.current = false;
    isAnimating.current = false;
    flipProgress.current = 0;
    flipVelocity.current = 0;
    lastMoveProgress.current = 0;
    dragDisplayProgress.current = 0;
    setIsFlippingActive(false);
    setIsFlipSceneActive(false);
  };

  const finalizeFlip = () => {
    stopAnimation();
    flipProgress.current = 0;
    flipVelocity.current = 0;
    hasStartedDrag.current = false;
    isAnimating.current = false;
    isDragging.current = false;
    dragDisplayProgress.current = 0;
    setIsFlippingActive(false);
    setIsFlipSceneActive(false);
  };

  const capturePageTextures = useCallback(async (mode: "full" | "next-only" = "full") => {
    if (!frontCaptureRef.current || !backCaptureRef.current) {
      return;
    }

    const opts = {
      useCORS: true,
      backgroundColor: theme.mode === "dark" ? "#181b19" : "#ffffff",
      scale: Math.min(1, window.devicePixelRatio || 1),
      logging: false,
      imageTimeout: 0,
    };

    try {
      const fc = mode === "full" ? await html2canvas(frontCaptureRef.current, opts) : null;
      const bc = await html2canvas(backCaptureRef.current, opts);

      if (fc) {
        const ft = new THREE.CanvasTexture(fc);
        ft.colorSpace = THREE.SRGBColorSpace;
        ft.anisotropy = 2;
        ft.needsUpdate = true;

        setFrontTex((previous) => {
          disposeTexture(previous);
          return ft;
        });
      }

      const reveal = new THREE.CanvasTexture(bc);
      reveal.colorSpace = THREE.SRGBColorSpace;
      reveal.anisotropy = 2;
      reveal.needsUpdate = true;

      const bt = reveal.clone();
      bt.colorSpace = THREE.SRGBColorSpace;
      bt.anisotropy = 2;
      bt.needsUpdate = true;
      bt.wrapS = THREE.RepeatWrapping;
      bt.repeat.x = -1;

      setBackTex((previous) => {
        disposeTexture(previous);
        return bt;
      });
      setRevealTex((previous) => {
        disposeTexture(previous);
        return reveal;
      });
    } catch (err) {
      console.warn("Failed to gen textures", err);
    }
  }, [theme.mode]);

  const completeSuccessfulFlip = useCallback(() => {
    stopAnimation();
    flipProgress.current = 0;
    flipVelocity.current = 0;
    hasStartedDrag.current = false;
    isAnimating.current = false;
    isDragging.current = false;
    dragDisplayProgress.current = 0;
    setIsFlippingActive(false);
    setIsFlipSceneActive(false);

    const { front: oldFront, reveal } = textureCacheRef.current;
    if (reveal) {
      setFrontTex((previous) => {
        if (previous !== reveal) {
          disposeTexture(previous);
        }
        return reveal;
      });
    } else {
      disposeTexture(oldFront);
    }

    setIsSyncingMonth(true);
    suppressFullCaptureRef.current = true;
    pendingNextCaptureRef.current = true;
    calendar.shiftMonth(1);
    void sound.playMonthTurn();
  }, [calendar, sound]);

  useEffect(() => {
    if (calendar.navigationMode !== "flip" || !pendingNextCaptureRef.current) {
      return;
    }

    pendingNextCaptureRef.current = false;
    void capturePageTextures("next-only").finally(() => {
      suppressFullCaptureRef.current = false;
      setIsSyncingMonth(false);
    });
  }, [calendar.navigationMode, calendar.visibleMonth, capturePageTextures]);

  useEffect(() => {
    if (calendar.navigationMode !== "flip") {
      return;
    }

    let active = true;
    const runCapture = () => {
      if (active && !suppressFullCaptureRef.current) {
        void capturePageTextures();
      }
    };

    const timer = window.setTimeout(runCapture, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [calendar.navigationMode, capturePageTextures, textureCaptureKey]);

  useEffect(() => {
    if (calendar.navigationMode === "flip" && frontTex && backTex && revealTex) {
      setFlipCanvasMounted(true);
    }
  }, [backTex, calendar.navigationMode, frontTex, revealTex]);

  useEffect(() => {
    if (calendar.navigationMode !== "flip") {
      return;
    }

    const timer = window.setTimeout(() => {
      if (!suppressFullCaptureRef.current) {
        void capturePageTextures();
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [calendar.navigationMode, capturePageTextures, notesTextureVersion, textureCaptureKey]);

  useEffect(() => {
    textureCacheRef.current = { front: frontTex, back: backTex, reveal: revealTex };
  }, [frontTex, backTex, revealTex]);

  useEffect(() => {
    return () => {
      disposeTexture(textureCacheRef.current.front);
      disposeTexture(textureCacheRef.current.back);
      disposeTexture(textureCacheRef.current.reveal);
      stopAnimation();
      stopSuspensionAnimation();
    };
  }, [stopSuspensionAnimation]);

  useEffect(() => {
    applySuspensionTransform();
  }, [applySuspensionTransform]);

  useEffect(() => {
    const el = hangingBodyRef.current;
    if (!el) {
      return;
    }

    const releaseSuspension = (pointerId?: number) => {
      if (!suspensionDraggingRef.current) {
        return;
      }

      suspensionDraggingRef.current = false;
      suspensionPointerIdRef.current = null;

      const state = suspensionStateRef.current;
      const pointerVelocity = suspensionPointerVelocityRef.current;
      state.vx += pointerVelocity.x * 0.14;
      state.vy += pointerVelocity.y * 0.14;
      suspensionPointerVelocityRef.current = { x: 0, y: 0 };
      suspensionTargetRef.current = { x: 0, y: 0 };

      if (typeof pointerId === "number" && el.hasPointerCapture(pointerId)) {
        el.releasePointerCapture(pointerId);
      }

      ensureSuspensionAnimation();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-calendar-interactive="true"]')) {
        return;
      }

      if (isSyncingMonth || isFlippingActive) {
        return;
      }

      const cardEl = cardRef.current;
      if (cardEl) {
        const rect = cardEl.getBoundingClientRect();
        const localY = event.clientY - rect.top;
        if (localY > rect.height * 0.46) {
          return;
        }
      }

      suspensionDraggingRef.current = true;
      suspensionPointerIdRef.current = event.pointerId;
      suspensionDragStartRef.current = { x: event.clientX, y: event.clientY };
      suspensionTargetStartRef.current = { ...suspensionTargetRef.current };
      suspensionPointerVelocityRef.current = { x: 0, y: 0 };
      suspensionLastMoveRef.current = {
        x: suspensionTargetRef.current.x,
        y: suspensionTargetRef.current.y,
        time: performance.now(),
      };
      ensureSuspensionAnimation();
      el.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!suspensionDraggingRef.current || suspensionPointerIdRef.current !== event.pointerId) {
        return;
      }

      const nextTarget = clampSuspensionOffset(
        suspensionTargetStartRef.current.x + (event.clientX - suspensionDragStartRef.current.x),
        suspensionTargetStartRef.current.y + (event.clientY - suspensionDragStartRef.current.y)
      );
      const now = performance.now();
      const last = suspensionLastMoveRef.current;
      const dt = Math.max(0.008, (now - last.time) / 1000);

      suspensionPointerVelocityRef.current = {
        x: (nextTarget.x - last.x) / dt,
        y: (nextTarget.y - last.y) / dt,
      };
      suspensionLastMoveRef.current = { x: nextTarget.x, y: nextTarget.y, time: now };
      suspensionTargetRef.current = nextTarget;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (suspensionPointerIdRef.current !== event.pointerId) {
        return;
      }

      releaseSuspension(event.pointerId);
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (suspensionPointerIdRef.current !== event.pointerId) {
        return;
      }

      releaseSuspension(event.pointerId);
    };

    const onLostPointerCapture = () => {
      if (suspensionDraggingRef.current) {
        releaseSuspension(undefined);
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerCancel);
    el.addEventListener("lostpointercapture", onLostPointerCapture);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerCancel);
      el.removeEventListener("lostpointercapture", onLostPointerCapture);
    };
  }, [applySuspensionTransform, ensureSuspensionAnimation, isFlippingActive, isSyncingMonth]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) {
      return;
    }

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (target instanceof Element && target.closest('[data-calendar-interactive="true"]')) {
        return;
      }

      if (
        calendar.navigationMode !== "flip" ||
        isDragging.current ||
        isAnimating.current ||
        !frontTex ||
        !backTex ||
        !revealTex ||
        isSyncingMonth
      ) {
        return;
      }

      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (y <= rect.height * 0.5) {
        return;
      }

      stopAnimation();
      stopSuspensionAnimation();
      suspensionDraggingRef.current = false;
      suspensionPointerIdRef.current = null;
      suspensionTargetRef.current = { x: 0, y: 0 };
      suspensionStateRef.current = { x: 0, y: 0, vx: 0, vy: 0 };
      applySuspensionTransform();
      bounds.current = { w: rect.width || 440, h: rect.height || 600 };
      cardTopRef.current = rect.top;
      setFlipCanvasMounted(true);
      isDragging.current = true;
      hasStartedDrag.current = false;
      startY.current = e.clientY;
      grabRight.current = x > rect.width * 0.5;
      flipProgress.current = 0;
      flipVelocity.current = 0;
      lastMoveTime.current = performance.now();
      lastMoveProgress.current = 0;
      dragDisplayProgress.current = 0;
      el.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) {
        return;
      }

      const deltaY = e.clientY - startY.current;

      if (!hasStartedDrag.current) {
        if (deltaY < -14) {
          hasStartedDrag.current = true;
          setIsFlippingActive(true);
          setIsFlipSceneActive(true);
          startY.current = e.clientY + 14;
          flipProgress.current = 0.01;
          dragDisplayProgress.current = 0.01;
        } else {
          return;
        }
      }

      const newY = Math.max(0, e.clientY - cardTopRef.current);
      const nextProgress = Math.max(0, Math.min(1, 1 - newY / bounds.current.h));
      const now = performance.now();
      const dt = Math.max(1, now - lastMoveTime.current) / 1000;
      flipVelocity.current = (nextProgress - lastMoveProgress.current) / dt;
      lastMoveTime.current = now;
      lastMoveProgress.current = nextProgress;
      dragDisplayProgress.current = nextProgress;
      flipProgress.current = nextProgress;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging.current) {
        return;
      }

      isDragging.current = false;
      const shouldSnap = hasStartedDrag.current;
      isAnimating.current = shouldSnap;
      if (shouldSnap) {
        setIsFlipSceneActive(true);
      }

      if (!shouldSnap) {
        if (el.hasPointerCapture(e.pointerId)) {
          el.releasePointerCapture(e.pointerId);
        }
        resetFlipInteraction();
        return;
      }

      const target = flipProgress.current > 0.18 || flipVelocity.current > 0.75 ? 1 : 0;
      if (el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }

      let previousTime = performance.now();
      const finishSnap = (now: number) => {
        if (isDragging.current) {
          return;
        }

        const dt = Math.min(0.032, (now - previousTime) / 1000);
        previousTime = now;

        const current = flipProgress.current;
        const remaining = target - current;

        if (Math.abs(remaining) < 0.004) {
          flipProgress.current = target;
          if (target === 1) {
            completeSuccessfulFlip();
          } else {
            finalizeFlip();
          }
          animationFrameRef.current = null;
          return;
        }

        const ease = 1 - Math.exp(-26 * dt);
        flipProgress.current = THREE.MathUtils.clamp(current + remaining * ease, 0, 1);
        animationFrameRef.current = requestAnimationFrame(finishSnap);
      };

      animationFrameRef.current = requestAnimationFrame(finishSnap);
    };

    const onPointerCancel = () => {
      resetFlipInteraction();
    };

    const onLostPointerCapture = () => {
      if (!isAnimating.current) {
        resetFlipInteraction();
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerCancel);
    el.addEventListener("lostpointercapture", onLostPointerCapture);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerCancel);
      el.removeEventListener("lostpointercapture", onLostPointerCapture);
      stopAnimation();
    };
  }, [applySuspensionTransform, backTex, completeSuccessfulFlip, frontTex, isSyncingMonth, revealTex, sound, stopSuspensionAnimation]);

  const navigateMonth = useCallback((amount: number) => {
    if (isSyncingMonth || isFlippingActive) {
      return;
    }
    calendar.shiftMonth(amount);
    if (calendar.navigationMode === "flip") {
      void sound.playMonthTurn();
    }
  }, [calendar, isFlippingActive, isSyncingMonth, sound]);

  useSwipeNavigation(containerRef, {
    onNext: () => navigateMonth(1),
    onPrevious: () => navigateMonth(-1),
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement;
      const inTextField =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement;

      if (inTextField) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateMonth(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateMonth(1);
      }
      if (event.key.toLowerCase() === "escape") {
        calendar.closeContextMenu();
        setShowSettings(false);
        calendar.setNotesPanelOpen(false);
        setShowShortcuts(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [calendar, isFlippingActive, isSyncingMonth, sound]);

  const jumpToToday = () => {
    calendar.setVisibleMonth(getMonthKey(new Date()));
    void sound.playDateTap();
  };

  const handleSelectDate = (date: string, options?: { rangeModifier: boolean }) => {
    if (calendar.draftRangeStart) {
      calendar.completeRange(date);
      calendar.setNotesPanelOpen(true);
      void sound.playConfirm();
      return;
    }

    if (options?.rangeModifier) {
      calendar.startRange(date);
      calendar.setNotesPanelOpen(false);
      calendar.closeContextMenu();
      void sound.playConfirm();
      return;
    }

    calendar.setSelectedDate(date);
    calendar.setFocusedDate(date);
    calendar.setNotesFilter("day", { date, rangeId: null });
    void sound.playDateTap();
  };

  const handlePointerStart = (date: string) => {
    if (!calendar.draftRangeStart) {
      return;
    }

    calendar.updateHoverDate(date);
  };

  const handlePointerEnter = (date: string) => {
    if (!calendar.draftRangeStart) {
      return;
    }

    calendar.updateHoverDate(date);
  };

  const handleContextDate = (date: string, point: { x: number; y: number }) => {
    calendar.setSelectedDate(date);
    calendar.setFocusedDate(date);
    calendar.openContextMenu(date, point.x, point.y);
  };

  const monthDate = parseMonthKey(calendar.visibleMonth);

  // Spiral binding rings across the top strip
  const rings = Array.from({ length: 28 });

  const activeRangeStart = calendar.draftRangeStart;
  const pendingRangeDays =
    calendar.hoverRange && activeRangeStart ? daysBetween(calendar.hoverRange.start, calendar.hoverRange.end) : 0;
  const isFlipNavigation = calendar.navigationMode === "flip";

  const beginRangeSelection = () => {
    const seedDate = calendar.selectedDate ?? calendar.focusedDate ?? `${calendar.visibleMonth}-01`;
    calendar.startRange(seedDate);
    calendar.setNotesPanelOpen(false);
    calendar.closeContextMenu();
    void sound.playDateTap();
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden overflow-y-auto transition-colors duration-300 md:h-screen md:overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-white/[0.06] dark:bg-black/20"
      />
      <button
        type="button"
        onClick={() => {
          calendar.closeContextMenu();
          calendar.setNotesPanelOpen(false);
          setShowSettings(true);
          setShowShortcuts(false);
        }}
        className={`calendar-edge-trigger calendar-edge-trigger-left fixed bottom-20 left-0 z-40 flex h-10 w-9 items-center justify-center rounded-r-2xl border border-l-0 transition-[transform,background-color,color,box-shadow,border-color,opacity] duration-200 active:scale-95 md:hidden ${showSettings ? "pointer-events-none opacity-0" : "opacity-100"}`}
        aria-label="Open settings"
      >
        <Settings size={19} strokeWidth={2.35} />
      </button>

      <button
        type="button"
        onClick={() => {
          calendar.closeContextMenu();
          calendar.setNotesPanelOpen(false);
          setShowSettings(true);
          setShowShortcuts(false);
        }}
        className={`calendar-doodle-trigger calendar-doodle-trigger-left calendar-edge-trigger calendar-edge-trigger-left fixed left-0 top-1/2 z-40 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-r-2xl border border-l-0 transition-[transform,background-color,color,box-shadow,border-color,opacity] duration-200 active:scale-95 md:flex ${showSettings ? "pointer-events-none opacity-0" : "opacity-100"}`}
        aria-label="Open settings"
      >
        <Settings size={21} strokeWidth={2.35} />
      </button>

      <div
        ref={containerRef}
        className="relative z-10 mx-auto flex min-h-screen max-w-[1480px] items-center justify-center overflow-visible px-3 pb-6 pt-3 sm:px-6 lg:px-10 md:h-screen md:items-start md:overflow-visible md:pt-4 md:pb-6"
      >
        {activeRangeStart ? (
          <div className="calendar-range-banner pointer-events-none fixed inset-x-0 top-4 z-40 mx-auto w-[min(calc(100vw-2rem),520px)] rounded-2xl border border-line bg-card px-4 py-3 text-center shadow-[0_16px_36px_rgba(0,0,0,0.14)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink/45">Range selection</p>
            <p className="mt-1 text-sm font-semibold text-ink">
              Start: {activeRangeStart}. Click another date to finish the range.
            </p>
            <p className="mt-1 text-xs text-ink/60">
              {calendar.hoverRange
                ? `${pendingRangeDays} day span preview`
                : "Move across dates to preview the range. You can also Ctrl/Cmd-click any date to start a range instantly."}
            </p>
          </div>
        ) : null}

        <div className="calendar-product-shell relative">
          <div className="pointer-events-none absolute -top-12 left-1/2 z-20 -translate-x-1/2 md:hidden">
            <p className="calendar-mobile-title">Calendar</p>
          </div>
          <div className="pointer-events-none absolute left-[-9999px] top-[-9999px] opacity-0">
            <div ref={frontCaptureRef} className="relative w-[440px] overflow-hidden bg-card">
              <CalendarPageLayer
                page={currentPage}
                openNotes={() => {
                  calendar.setVisibleMonth(currentPage.monthKey);
                  calendar.setNotesFilter("month");
                  calendar.setNotesPanelOpen(true);
                }}
              />
            </div>
            <div ref={backCaptureRef} className="relative w-[440px] overflow-hidden bg-card">
              <CalendarPageLayer
                page={nextPage}
                openNotes={() => {
                  calendar.setVisibleMonth(nextPage.monthKey);
                  calendar.setNotesFilter("month");
                  calendar.setNotesPanelOpen(true);
                }}
              />
            </div>
          </div>

	          <div className="calendar-hanger-stage relative z-10 mx-auto w-full max-w-[520px]">
	            <div className="calendar-hanger-anchor" aria-hidden="true" />
            <div
              ref={hangingBodyRef}
              className="calendar-hanging-body"
            >
              <div
                className="calendar-card relative z-10 mx-auto mt-0 w-full max-w-[440px] rounded-none border-0 bg-card shadow-[0_30px_60px_rgba(0,0,0,0.25),0_10px_20px_rgba(0,0,0,0.15)] transition-shadow duration-300"
                style={{ boxShadow: undefined }}
              >
                {/* Hanging wire */}
                <div className="pointer-events-none absolute left-[8%] right-[8%] top-[-42px] z-[40] h-[48px] drop-shadow-md">
                  <svg width="100%" height="100%" viewBox="0 0 200 30" preserveAspectRatio="none" className="overflow-visible">
                    <path
                      d="M0,28 L88,28 C90,28 92,26 93,18 L94.5,8 C95.5,2 104.5,2 105.5,8 L107,18 C108,26 110,28 112,28 L200,28"
                      fill="none"
                      stroke="#2c2c2c"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  <div className="absolute left-[50%] top-[2px] z-20 h-[6px] w-[6px] -translate-x-1/2 rounded-full bg-[#111] shadow-[0_4px_6px_rgba(0,0,0,0.8)]" />
                  <div className="absolute left-[50%] top-[7px] z-10 h-[9px] w-[2px] -translate-x-1/2 rounded-full bg-[#aaa]" />
                </div>

                {/* Binding bar (the grey strip along the top that the coil threads through) */}
                <div className="pointer-events-none absolute inset-x-[22px] top-[-1px] z-[33] h-[18px] overflow-hidden rounded-t-[2px]">
                  <div className="absolute inset-x-0 top-0 h-[8px] bg-[linear-gradient(180deg,#fafafa_0%,#eeeeee_48%,#d8d8d8_100%)]" />
                  <div className="absolute inset-x-0 top-[8px] h-[4px] bg-[linear-gradient(180deg,rgba(0,0,0,0.14),rgba(255,255,255,0.62))]" />
                  <div className="absolute inset-x-0 bottom-0 h-[6px] bg-[linear-gradient(180deg,#d3d3d3_0%,#fcfcfc_100%)]" />
                  <div className="absolute inset-x-[10px] top-[4px] h-[2px] rounded-full bg-black/15" />
                </div>

                {/* Dark top edge / shadow line */}
                <div className="pointer-events-none absolute inset-x-[36px] top-[-2px] z-[34] h-[3px] bg-[linear-gradient(90deg,rgba(20,20,20,0.95),rgba(108,108,108,0.96)_18%,rgba(28,28,28,0.98)_50%,rgba(108,108,108,0.96)_82%,rgba(20,20,20,0.95))] shadow-[0_1px_2px_rgba(0,0,0,0.25)]" />

                {/*
                  ============================================================
                  SPIRAL COIL RINGS — redesigned to look like real metal loops
                  ============================================================
                  Each ring is an SVG arc that:
                  • Comes up from behind the page (bottom half = behind = drawn first, darker)
                  • Arcs over the top (front half = in front of = drawn on top, lighter/shinier)
                  • Has a highlight stripe to simulate the cylindrical metal tube
                  ============================================================
                */}
                <div className="calendar-coil-strip" aria-hidden="true">
                  <div className="calendar-coil-strip-inner" style={{ height: 42 }}>
                    {rings.map((_, i) => (
                      <CoilRing key={i} />
                    ))}
                  </div>
                </div>

                {/* Card inner top fade */}
                <div className="pointer-events-none absolute inset-x-0 top-0 z-[22] h-[14px] overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-[10px] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.14),rgba(255,255,255,0))]" />
                  <div className="absolute inset-x-0 bottom-0 h-[8px] bg-[linear-gradient(to_bottom,rgba(0,0,0,0.16),rgba(0,0,0,0))]" />
                </div>

	                <div
                    ref={cardRef}
                    className="relative w-full touch-none select-none rounded-none"
                  >
	                  <div
	                    className="relative z-[1] h-full w-full select-none overflow-hidden rounded-none bg-white dark:bg-[#1f1f1fc0]"
	                    style={{
                      height: bounds.current.h,
                      opacity: isFlippingActive ? 0 : 1,
                      transition: isFlippingActive ? "none" : "opacity 180ms ease",
                    }}
                  >
                    <CalendarPageLayer
                      page={currentPage}
                      openNotes={() => {
                        calendar.setNotesFilter("month");
                        calendar.setNotesPanelOpen(true);
                      }}
                      interactive
                      eventsByDate={calendar.eventsByDate}
                      weekdayLabels={calendar.weekdayLabels}
                      weeks={calendar.weeks}
                      metadataByDate={calendar.metadataByDate}
                      onPointerStart={handlePointerStart}
                      onPointerEnter={handlePointerEnter}
                      onSelectDate={handleSelectDate}
                      onFocusDate={calendar.setFocusedDate}
                      onContextDate={handleContextDate}
                    />
                  </div>

	                  {isFlipNavigation && flipCanvasMounted ? (
	                    <div
	                      className="pointer-events-none absolute left-1/2 top-0 z-[120] -translate-x-1/2"
	                      style={{
	                        width: bounds.current.w + 120,
	                        height: bounds.current.h + 120,
	                        marginTop: -50,
	                        overflow: "visible",
	                        opacity: isFlippingActive ? 1 : 0,
	                        visibility: isFlippingActive ? "visible" : "hidden",
	                        transition: isFlippingActive ? "none" : "opacity 100ms ease",
	                      }}
	                    >
	                      <Canvas
	                        dpr={[1, canvasDpr]}
	                        frameloop={isFlipSceneActive ? "always" : "never"}
	                        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
	                        orthographic
	                        camera={{ position: [0, 0, 500], zoom: 1, near: 0.1, far: 2000 }}
	                      >
	                        <group position={[0, 40, 0]}>
	                          <RealisticPageMesh
	                            frontTex={frontTex}
	                            backTex={backTex}
	                            revealTex={revealTex}
	                            width={bounds.current.w}
	                            height={bounds.current.h}
	                            flipProgress={flipProgress}
	                            grabRight={grabRight}
	                            isDragging={isDragging}
	                            isAnimating={isAnimating}
	                          />
	                        </group>
	                      </Canvas>
	                    </div>
	                  ) : null}
	                </div>
	              </div>
	            </div>

	          {!isFlipNavigation ? (
	            <div className="calendar-navigation-rail" data-calendar-interactive="true">
	              <button
	                type="button"
	                onClick={() => navigateMonth(-1)}
	                className="calendar-navigation-button"
	                aria-label="Go to previous month"
	              >
	                <ChevronLeft size={18} strokeWidth={2.2} />
	                <span>Previous</span>
	              </button>
	              <button
	                type="button"
	                onClick={() => navigateMonth(1)}
	                className="calendar-navigation-button"
	                aria-label="Go to next month"
	              >
	                <span>Next</span>
	                <ChevronRight size={18} strokeWidth={2.2} />
	              </button>
	            </div>
		          ) : null}
		        </div>
	          </div>

	        <div className={`calendar-flip-callout ${!isFlipNavigation ? "is-hidden" : ""}`} aria-hidden="true">
          <p className="calendar-flip-callout-text">
            Try Flipping
            <br />
            the Calendar
          </p>
          <div className="calendar-flip-callout-arrow-wrapper">
            <img src="/arrow.png" className="arrow-head-img" alt="" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            calendar.closeContextMenu();
            setShowSettings(false);
            calendar.setNotesFilter("month");
            calendar.setNotesPanelOpen(true);
          }}
          className={`calendar-edge-trigger fixed bottom-20 right-2 z-40 flex h-10 w-9 items-center justify-center rounded-l-2xl border border-r-0 transition-[transform,background-color,color,box-shadow,border-color,opacity] duration-200 active:scale-95 md:hidden ${calendar.notesPanelOpen ? "pointer-events-none opacity-0" : "opacity-100"}`}
          aria-label="Open notes"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>

        <button
          type="button"
          onClick={() => {
            calendar.closeContextMenu();
            setShowSettings(false);
            calendar.setNotesFilter("month");
            calendar.setNotesPanelOpen(true);
          }}
          className={`calendar-edge-trigger fixed right-3 top-1/2 z-40 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-l-2xl border border-r-0 transition-[transform,background-color,color,box-shadow,border-color,opacity] duration-200 active:scale-95 md:flex ${calendar.notesPanelOpen ? "pointer-events-none opacity-0" : "opacity-100"}`}
          aria-label="Open notes"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>

        <OverlayPortal
          open={showSettings}
          onClose={() => setShowSettings(false)}
          side="left"
          panelClassName="!w-[min(90vw,380px)]"
          ariaLabel="Close settings"
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink/40">Preferences</p>
              <h2 className="mt-0.5 text-xl font-semibold text-ink">Settings</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-paper/50 text-ink/60 transition-all hover:border-accent/50 hover:text-accent active:scale-95"
              aria-label="Close settings"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          <div className="calendar-scrollbar flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <SettingsGroup title="Appearance">
              <SettingsRow
                label={theme.mode === "light" ? "Dark mode" : "Light mode"}
                icon={theme.mode === "light" ? <Moon size={14} strokeWidth={2} /> : <Sun size={14} strokeWidth={2} />}
                onClick={() => theme.setTheme(theme.mode === "light" ? "dark" : "light")}
              />
              <SettingsRow
                label={theme.soundEnabled ? "Sound on" : "Sound off"}
                icon={theme.soundEnabled ? <Volume2 size={14} strokeWidth={2} /> : <VolumeX size={14} strokeWidth={2} />}
                onClick={() => theme.setSoundEnabled(!theme.soundEnabled)}
              />
            </SettingsGroup>

            <SettingsGroup title="Navigation">
              <SettingsSegmentedControl
                label="Month switching"
                value={calendar.navigationMode}
                options={[
                  { value: "flip", label: "Flip animation" },
                  { value: "buttons", label: "Normal buttons" },
                ]}
                onChange={(value) => {
                  calendar.setNavigationMode(value as typeof calendar.navigationMode);
                  resetFlipInteraction();
                  if (value === "flip") {
                    setFlipCanvasMounted(false);
                  }
                }}
              />
            </SettingsGroup>

            <SettingsGroup title="Actions">
              <SettingsRow label="Jump to today" icon={<CalendarDays size={14} strokeWidth={2} />} onClick={jumpToToday} />
              <SettingsRow
                label="Keyboard shortcuts"
                icon={<Keyboard size={14} strokeWidth={2} />}
                onClick={() => {
                  setShowSettings(false);
                  setShowShortcuts(true);
                }}
              />
              <SettingsRow label="Undo" icon={<Undo2 size={14} strokeWidth={2} />} onClick={calendar.undo} />
              <SettingsRow label="Redo" icon={<Redo2 size={14} strokeWidth={2} />} onClick={calendar.redo} />
            </SettingsGroup>

            <SettingsGroup title="Customize">
              <div className="space-y-2">
                <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/50">Accent color</label>
                <select
                  value={theme.accent}
                  onChange={(event) => theme.setAccent(event.target.value as typeof theme.accent)}
                  className="w-full rounded-lg border border-line bg-paper/50 px-3 py-2 text-sm font-medium text-ink outline-none transition-colors focus:border-accent"
                >
                  <option value="teal">Teal</option>
                  <option value="brick">Brick</option>
                  <option value="amber">Amber</option>
                  <option value="slate">Slate</option>
                </select>
              </div>
            </SettingsGroup>
          </div>
        </OverlayPortal>

        <OverlayPortal
          open={calendar.notesPanelOpen}
          onClose={() => calendar.setNotesPanelOpen(false)}
          side="right"
          ariaLabel="Close notes"
        >
          <NotesPanel className="h-full flex-1 rounded-none border-0" onClose={() => calendar.setNotesPanelOpen(false)} />
        </OverlayPortal>

        <OverlayPortal
          open={showShortcuts}
          onClose={() => setShowShortcuts(false)}
          side="center"
          ariaLabel="Close keyboard shortcuts"
        >
          <div className="rounded-[1.5rem] border border-line bg-card p-4 shadow-[0_24px_60px_rgba(0,0,0,0.2)] sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/45">Keyboard shortcuts</p>
                <h3 className="mt-1 text-lg font-semibold text-ink">Quick controls</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-paper/50 text-ink/60 transition-colors hover:border-accent hover:text-accent"
                aria-label="Close keyboard shortcuts"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              <ShortcutRow keys="Ctrl/Cmd + Click" description="Start a date range from any day cell." />
              <ShortcutRow keys="Click another date" description="Finish the active range selection." />
              <ShortcutRow keys="Arrow Left" description="Go to the previous month." />
              <ShortcutRow keys="Arrow Right" description="Go to the next month." />
              <ShortcutRow keys="Esc" description="Close menus, notes, settings, or shortcuts." />
            </div>
          </div>
        </OverlayPortal>
      </div>

    

      <ContextMenu />
    </main>
  );
}

/**
 * CoilRing — renders a single spiral-bound metal ring using an inline SVG.
 *
 * Anatomy of a spiral binding ring (viewed from the front):
 *
 *   ┌──────────────────────────────┐  ← top arc (front, shiny)
 *   │        front half            │
 *   │  (passes IN FRONT of paper)  │
 *   └──────────────────────────────┘  ← midpoint (threading through hole in paper)
 *   ┌──────────────────────────────┐
 *   │        back half             │
 *   │  (passes BEHIND the paper)   │
 *   └──────────────────────────────┘  ← bottom arc (back, darker)
 *
 * We fake the 3-D illusion by:
 *  1. Drawing the bottom (back) arc first — it's darker, slightly thicker.
 *  2. Drawing the paper binding strip over it (opaque, matches the card colour).
 *  3. Drawing the top (front) arc last — it's lighter with a bright highlight stripe.
 */
const CoilRing = memo(function CoilRing() {
  // SVG canvas: 8 px wide, 42 px tall
  // The ring outer diameter is ~8 px, loop height is ~20 px.
  // Centre of the paper binding strip sits at y=20 (mid-canvas).
  const w = 8;
  const h = 42;
  const cx = w / 2;          // horizontal centre of the ring tube
  const ry = 9;               // vertical radius of the ellipse (half the loop height)
  const rx = 3.6;             // horizontal radius
  const midY = 20;            // y at which the wire passes through the paper
  const topArcY = midY - ry;  // topmost point of the front arc
  const botArcY = midY + ry;  // bottommost point of the back arc

  // Wire tube stroke widths
  const tubeW = 2.4;          // outer stroke (the full tube)
  const highlightW = 0.9;     // inner highlight (simulates cylindrical shine)

  // Colors
  const tubeDark  = "#404040";   // back-half / shadow side
  const tubeMid   = "#606060";   // front-half base
  const tubeShine = "#c8c8c8";   // bright highlight stripe on top arc
  const paperMask = "#e8e5e0";   // matches the binding strip; hides the back arc behind the page

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ display: "block", overflow: "visible", flexShrink: 0 }}
    >
      {/*
        ── LAYER 1: back (bottom) half of the ring ──────────────────────────
        This arc goes from the left midpoint, curves DOWN and around, back to
        the right midpoint. It sits *behind* the paper so it's darker.
      */}
      <path
        d={`
          M ${cx - rx} ${midY}
          A ${rx} ${ry} 0 0 0 ${cx + rx} ${midY}
        `}
        fill="none"
        stroke={tubeDark}
        strokeWidth={tubeW}
        strokeLinecap="round"
      />

      {/*
        ── LAYER 2: paper mask ───────────────────────────────────────────────
        A small rectangle that covers the midpoint zone, simulating the paper
        binding strip occluding the wire. This is the key to the depth illusion.
        We use a hardcoded light colour here; in production you'd use a CSS var
        matching --card or --paper.
      */}
      <rect
        x={0}
        y={midY - 3}
        width={w}
        height={6}
        fill={paperMask}
      />
      {/* Dark mode version — just overlay a very slightly different tone */}
      {/* (In a real app you'd use a CSS variable; here we layer two rects) */}

      {/*
        ── LAYER 3: front (top) half of the ring ────────────────────────────
        Arc from left midpoint, curves UP and over, to right midpoint.
        Drawn on top so it appears in front of the paper.
      */}
      <path
        d={`
          M ${cx - rx} ${midY}
          A ${rx} ${ry} 0 0 1 ${cx + rx} ${midY}
        `}
        fill="none"
        stroke={tubeMid}
        strokeWidth={tubeW}
        strokeLinecap="round"
      />

      {/*
        ── LAYER 4: highlight stripe on the front arc ────────────────────────
        A thinner, lighter path slightly inside the front arc's top edge,
        simulating light catching the rounded metal surface.
      */}
      <path
        d={`
          M ${cx - rx + 0.5} ${midY - 1}
          A ${rx - 0.5} ${ry - 1.5} 0 0 1 ${cx + rx - 0.5} ${midY - 1}
        `}
        fill="none"
        stroke={tubeShine}
        strokeWidth={highlightW}
        strokeLinecap="round"
        opacity={0.75}
      />

      {/*
        ── LAYER 5: small vertical connector stubs ───────────────────────────
        The back arc's two endpoints connect downward to the next coil turn
        (which is below the visible strip). These tiny lines add realism.
      */}
      <line
        x1={cx - rx} y1={midY}
        x2={cx - rx} y2={midY + 5}
        stroke={tubeDark}
        strokeWidth={tubeW * 0.75}
        strokeLinecap="round"
        opacity={0.5}
      />
      <line
        x1={cx + rx} y1={midY}
        x2={cx + rx} y2={midY + 5}
        stroke={tubeDark}
        strokeWidth={tubeW * 0.75}
        strokeLinecap="round"
        opacity={0.5}
      />
    </svg>
  );
});

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-ink/40">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function SettingsRow({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-line bg-paper/30 px-3 py-2.5 text-left text-sm font-medium text-ink transition-all hover:border-accent/40 hover:bg-card hover:text-accent active:scale-[0.98]"
    >
      <span className="text-ink/50 transition-colors group-hover:text-accent">{icon}</span>
      {label}
    </button>
  );
}

function SettingsSegmentedControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-paper/35 p-1.5">
      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/50">{label}</p>
      <div className="grid grid-cols-2 gap-1">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                active
                  ? "bg-card text-accent shadow-[0_8px_18px_rgba(0,0,0,0.12)]"
                  : "text-ink/65 hover:bg-card/65 hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ShortcutRow({ keys, description }: { keys: string; description: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper/24 px-3.5 py-2.5">
      <p className="max-w-[220px] text-[13px] font-medium leading-snug text-ink">{description}</p>
      <span className="min-w-[118px] rounded-lg border border-line bg-card px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-center text-ink/70">
        {keys}
      </span>
    </div>
  );
}

function CalendarPageLayer({
  page,
  openNotes,
  interactive = false,
  eventsByDate,
  weekdayLabels,
  weeks,
  metadataByDate,
  onPointerStart,
  onPointerEnter,
  onSelectDate,
  onFocusDate,
  onContextDate,
}: {
  page: ReturnType<typeof buildCalendarPageData>;
  openNotes: () => void;
  interactive?: boolean;
  eventsByDate?: Parameters<typeof CalendarGrid>[0]["eventsByDate"];
  weekdayLabels?: string[];
  weeks?: Date[][];
  metadataByDate?: Parameters<typeof CalendarGrid>[0]["metadataByDate"];
  onPointerStart?: (date: string) => void;
  onPointerEnter?: (date: string) => void;
  onSelectDate?: (date: string) => void;
  onFocusDate?: (date: string) => void;
  onContextDate?: (date: string, point: { x: number; y: number }) => void;
}) {
  const resolvedWeekdayLabels = weekdayLabels ?? page.weekdayLabels;
  const resolvedWeeks = weeks ?? page.weeks;
  const resolvedMetadataByDate = metadataByDate ?? page.metadataByDate;
  const bindingRings = Array.from({ length: 34 });
  const visibleNoteLines = page.notePreviewLines.slice(0, 7);

  return (
    <>
      <div className="relative z-[6] h-[22px] overflow-hidden">
        <div className="absolute inset-x-0 top-[2px] flex justify-between px-8">
          {bindingRings.map((_, i) => (
            <div key={`page-binding-hole-${i}`} className="relative flex w-[12px] justify-center">
              <div className="h-[8px] w-[5px] rounded-full bg-black/30 shadow-[inset_0_1px_2px_rgba(0,0,0,0.55)] dark:bg-black/45" />
              <div className="absolute top-0 h-[3px] w-[3px] rounded-full bg-white/65 dark:bg-white/10" />
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-black/10 dark:bg-white/10" />
        <div className="absolute inset-x-0 bottom-0 h-[8px] bg-[linear-gradient(to_bottom,rgba(0,0,0,0.10),rgba(0,0,0,0))]" />
      </div>

      <div className="cover relative z-[2] h-[258px]">
        <div className="absolute inset-0 bg-[#3b82f6]">
          <img src={page.image} alt={page.monthName} className="h-full w-full object-cover" />
        </div>

        <div
          className="pointer-events-none absolute bottom-0 left-0 z-10 h-[60px] w-full"
          style={{
            background:
              "linear-gradient(to top right, #3b82f6 50.5%, transparent 51%), linear-gradient(to top left, #3b82f6 50.5%, transparent 51%)",
            backgroundSize: "50% 100%",
            backgroundPosition: "left bottom, right bottom",
            backgroundRepeat: "no-repeat",
          }}
        />

        <div
          className="pointer-events-none absolute bottom-0 left-0 z-20 h-[35px] w-full"
          style={{
            background:
              "linear-gradient(to top right, var(--card) 50.5%, transparent 51%), linear-gradient(to top left, var(--card) 50.5%, transparent 51%)",
            backgroundSize: "50% 100%",
            backgroundPosition: "left bottom, right bottom",
            backgroundRepeat: "no-repeat",
          }}
        />
      </div>

      <div className="pointer-events-none absolute right-[14px] top-[118px] z-[25] flex items-end gap-2 text-right sm:right-[18px] sm:top-[134px] sm:gap-2.5 md:right-[25px] md:top-[164px] md:gap-3">
        <div>
          <p className="mb-0.5 text-[16px] font-medium leading-none tracking-wide text-white drop-shadow-sm sm:text-[18px] md:text-[22px]">
            {page.year}
          </p>
          <p className="font-heading text-[2rem] font-extrabold uppercase leading-none tracking-tight text-white drop-shadow-md sm:text-[2.35rem] md:text-4xl">
            {page.monthName}
          </p>
        </div>
      </div>

      <div className="body-section">
        <div className="notes flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-[11px] font-bold text-ink">Notes</p>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">
              {page.noteCount > 0 ? `${page.noteCount} saved` : "empty"}
            </span>
          </div>
          <div
            data-calendar-interactive="true"
            className="mt-2 flex flex-1 cursor-pointer flex-col justify-start gap-2.5 rounded-md px-1 pb-4 transition-colors hover:bg-paper/40"
            onClick={openNotes}
            aria-label="Open notes"
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openNotes();
              }
            }}
          >
            {Array.from({ length: 7 }).map((_, i) => {
              const line = visibleNoteLines[i];
              return (
                <div key={i} className="min-h-[28px] border-b-[1.5px] border-line pb-2.5">
                  {line ? (
                    <div
                      className="group relative space-y-1"
                      title={`${line.title}\n${line.content}`}
                      tabIndex={0}
                    >
                      <p className="truncate text-[11px] font-semibold leading-none text-ink/85">{line.title}</p>
                      <p className="line-clamp-2 break-words text-[10px] leading-[1.25] text-ink/55">{line.content}</p>
                      <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden max-w-[180px] rounded-md border border-white/10 bg-[#111312]/95 px-2.5 py-2 text-[10px] font-medium leading-snug text-white shadow-lg group-hover:block group-focus-visible:block dark:border-white/10 dark:bg-[#f4f0e7]/95 dark:text-[#111312]">
                        <p className="font-semibold">{line.title}</p>
                        <p className="mt-1 break-words">{line.content}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="calendar min-h-[280px]">
          <CalendarGrid
            ariaLabel={`${page.label} calendar`}
            weekdayLabels={resolvedWeekdayLabels}
            weeks={resolvedWeeks}
            metadataByDate={resolvedMetadataByDate}
            eventsByDate={eventsByDate}
            interactive={interactive}
            onPointerStart={onPointerStart}
            onPointerEnter={onPointerEnter}
            onSelectDate={onSelectDate}
            onFocusDate={onFocusDate}
            onContextDate={onContextDate}
          />
        </div>
      </div>
    </>
  );
}

function buildCalendarPageData(
  monthKey: string,
  notes: NoteRecord[],
  ranges: DateRange[],
  monthImages: Record<string, string>
) {
  const monthLabel = getMonthLabel(monthKey);
  const [monthName, year] = monthLabel.split(" ");
  const monthDate = parseMonthKey(monthKey);
  const weeks = getMonthMatrix(monthKey, `${monthKey}-01`, "month");
  const weekdayLabels = getWeekdayLabels();
  const image = monthImages[monthKey] ?? monthImageMap[monthDate.getUTCMonth()].src;
  const rangeById = ranges.reduce<Record<string, DateRange>>((accumulator, range) => {
    accumulator[range.id] = range;
    return accumulator;
  }, {});

  const notesByDate = notes.reduce<Record<string, number>>((accumulator, note) => {
    if (note.scope === "day" && note.date) {
      accumulator[note.date] = (accumulator[note.date] ?? 0) + 1;
    }

    if (note.scope === "range" && note.rangeId) {
      const range = rangeById[note.rangeId];
      if (range) {
        let cursor = new Date(`${range.start}T00:00:00.000Z`);
        const end = new Date(`${range.end}T00:00:00.000Z`);

        while (cursor <= end) {
          const isoDate = toIsoDate(cursor);
          accumulator[isoDate] = (accumulator[isoDate] ?? 0) + 1;
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
      }
    }

    return accumulator;
  }, {});

  const notePreviewLines = notes
    .filter((note) => {
      if (note.scope === "month") {
        return note.monthKey === monthKey;
      }
      if (note.scope === "day") {
        return Boolean(note.date && monthContainsDate(monthKey, note.date));
      }
      if (note.scope === "range" && note.rangeId) {
        const range = rangeById[note.rangeId];
        if (!range) {
          return false;
        }
        return range.start.slice(0, 7) <= monthKey && range.end.slice(0, 7) >= monthKey;
      }
      return false;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((note) => {
      const range = note.rangeId ? rangeById[note.rangeId] : null;
      const targetLabel =
        note.scope === "month"
          ? "Month"
          : note.scope === "range"
            ? range
              ? `${range.start.slice(5)}-${range.end.slice(5)}`
              : "Range"
            : note.date?.slice(5) ?? "Day";

      return {
        title: `${targetLabel} ${note.title}`.trim(),
        content: note.content,
      };
    });

  const metadataByDate = weeks.flat().reduce<Record<string, { inMonth: boolean; today: boolean; noteCount: number }>>(
    (accumulator, day) => {
      const isoDate = toIsoDate(day);
      accumulator[isoDate] = {
        inMonth: monthContainsDate(monthKey, isoDate),
        today: isToday(isoDate),
        noteCount: notesByDate[isoDate] ?? 0,
      };
      return accumulator;
    },
    {}
  );

  return {
    image,
    label: monthLabel,
    monthKey,
    monthName,
    year,
    weekdayLabels,
    weeks,
    metadataByDate,
    noteCount: notePreviewLines.length,
    notePreviewLines,
  };
}
