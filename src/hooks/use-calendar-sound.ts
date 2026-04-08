"use client";

import { useCallback, useEffect, useRef } from "react";

function getAudioContext() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

export function useCalendarSound(enabled: boolean) {
  const contextRef = useRef<AudioContext | null>(null);
  const pageFlipRef = useRef<HTMLAudioElement | null>(null);
  const timeoutIdsRef = useRef<number[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const audio = new Audio("/pageflip.mp3");
    audio.preload = "auto";
    audio.volume = 0.68;
    pageFlipRef.current = audio;

    return () => {
      timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutIdsRef.current = [];
      pageFlipRef.current?.pause();
      pageFlipRef.current = null;
      void contextRef.current?.close();
      contextRef.current = null;
    };
  }, []);

  const queueTone = useCallback((callback: () => void, delay: number) => {
    const timeoutId = window.setTimeout(() => {
      timeoutIdsRef.current = timeoutIdsRef.current.filter((id) => id !== timeoutId);
      callback();
    }, delay);
    timeoutIdsRef.current.push(timeoutId);
  }, []);

  const ensureContext = useCallback(async () => {
    if (!enabled || typeof window === "undefined") {
      return null;
    }

    if (!contextRef.current) {
      contextRef.current = getAudioContext();
    }

    if (!contextRef.current) {
      return null;
    }

    if (contextRef.current.state === "suspended") {
      await contextRef.current.resume();
    }

    return contextRef.current;
  }, [enabled]);

  const playTone = useCallback(
    async (config: { frequency: number; duration: number; gain: number; type?: OscillatorType; attack?: number }) => {
      const context = await ensureContext();
      if (!context) {
        return;
      }

      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = config.type ?? "sine";
      oscillator.frequency.setValueAtTime(config.frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(config.gain, now + (config.attack ?? 0.012));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + config.duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + config.duration + 0.02);
    },
    [ensureContext]
  );

  const playMonthTurn = useCallback(async () => {
    if (!enabled) {
      return;
    }

    const audio = pageFlipRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
        await audio.play();
      } catch {}
    }

    await playTone({ frequency: 160, duration: 0.08, gain: 0.03, type: "triangle" });
    queueTone(() => {
      void playTone({ frequency: 118, duration: 0.12, gain: 0.018, type: "sawtooth", attack: 0.008 });
    }, 32);
  }, [enabled, playTone, queueTone]);

  const playDateTap = useCallback(async () => {
    await playTone({ frequency: 420, duration: 0.07, gain: 0.025, type: "triangle" });
  }, [playTone]);

  const playConfirm = useCallback(async () => {
    await playTone({ frequency: 520, duration: 0.08, gain: 0.03, type: "sine" });
    queueTone(() => {
      void playTone({ frequency: 660, duration: 0.1, gain: 0.02, type: "sine" });
    }, 40);
  }, [playTone, queueTone]);

  return {
    playMonthTurn,
    playDateTap,
    playConfirm,
  };
}
