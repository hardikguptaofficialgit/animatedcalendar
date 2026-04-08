"use client";

import { ChangeEvent, useRef } from "react";
import { Camera } from "lucide-react";
import { useCalendarStore } from "@/store/use-calendar-store";
import { readFileAsDataUrl } from "@/lib/utils";

interface HeroPanelProps {
  monthKey: string;
  monthLabel: string;
  image: string;
}

export function HeroPanel({ monthKey, monthLabel, image }: HeroPanelProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const setMonthImage = useCalendarStore((state) => state.setMonthImage);

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setMonthImage(monthKey, dataUrl);
  };

  const [monthName, year] = monthLabel.split(" ");

  return (
    <section ref={ref} className="group relative overflow-hidden border-b border-line">
      <div className="relative h-[130px] w-full sm:h-[160px]">
        {/* background image */}
        <img
          src={image}
          alt={monthLabel}
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />

        {/* cover action */}
        <div className="absolute bottom-3 left-3 z-20">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/90 backdrop-blur-sm transition-all hover:bg-black/75 active:scale-95"
          >
            <Camera size={11} strokeWidth={2} />
            Change Cover
          </button>
        </div>

        {/* month label */}
        <div className="absolute bottom-3 right-4 z-20 text-right">
          <p className="text-[9px] font-medium uppercase tracking-[0.45em] text-white/70">
            {year}
          </p>
          <p className="font-serif text-[1.75rem] leading-none tracking-tight text-white drop-shadow-sm sm:text-[2.25rem]">
            {monthName}
          </p>
        </div>
      </div>
    </section>
  );
}
