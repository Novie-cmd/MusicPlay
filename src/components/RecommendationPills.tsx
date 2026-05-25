import React, { useState } from "react";
import { Sparkles, Music, ChevronRight } from "lucide-react";
import { motion } from "motion/react";

interface RecommendationPillsProps {
  onSelectMood: (mood: string) => void;
  isLoading: boolean;
}

const PRESET_MOODS = [
  {
    label: "😭 Galau & Sedih",
    description: "Lagu galau Indonesia penuh emosi & menyentuh hati",
    mood: "Lagu galau Indonesia yang sedih dan penuh emosi",
  },
  {
    label: "☕ Santai & Rileks",
    description: "Indie akustik, jazz, dan lofi senja yang menenangkan",
    mood: "Lagu indie akustik, jazz, dan lofi chill untuk bersantai",
  },
  {
    label: "⚡ Semangat Kerja",
    description: "Musik upbeat penambah fokus dan produktivitas",
    mood: "Upbeat songs that trigger high concentration and productivity",
  },
  {
    label: "📻 Nostalgia Klasik",
    description: "Tembang kenangan legendaris era 80an, 90an, & 2000an",
    mood: "Lagu populer klasik Indonesia penuh kenangan era 90an",
  },
];

export default function RecommendationPills({ onSelectMood, isLoading }: RecommendationPillsProps) {
  const [customMood, setCustomMood] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customMood.trim() && !isLoading) {
      onSelectMood(customMood.trim());
    }
  };

  return (
    <div id="ai-concierge-section" className="bg-white/5 border border-white/5 rounded-2xl p-5 shadow-2xl backdrop-blur-md flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
        <h3 className="font-sans font-bold text-xs tracking-wider text-white uppercase">
          AI MUSIC CONCIERGE (REKOMENDASI MOOD)
        </h3>
      </div>

      <p className="font-sans text-xs text-slate-400 leading-normal">
        Pilih suasana hati Anda hari ini. Gemini AI akan mencari informasi musik di Google yang paling mewakili emosi Anda beserta video lagunya secara instan.
      </p>

      {/* Grid of Preset Moods */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {PRESET_MOODS.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onSelectMood(item.mood)}
            disabled={isLoading}
            id={`preset-mood-${idx}`}
            className="flex flex-col items-start p-3 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-500/30 hover:bg-white/10 transition-all text-left group disabled:opacity-50 cursor-pointer"
          >
            <span className="font-sans font-medium text-xs text-slate-200 group-hover:text-indigo-300 transition-colors flex items-center justify-between w-full">
              {item.label}
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors group-hover:translate-x-0.5" />
            </span>
            <span className="font-sans text-[10px] text-slate-400 leading-relaxed mt-1 block">
              {item.description}
            </span>
          </button>
        ))}
      </div>

      {/* Custom Mood Form */}
      <form onSubmit={handleSubmit} id="custom-mood-form" className="flex items-center gap-2 mt-1 border-t border-white/5 pt-4">
        <div className="relative flex-1">
          <input
            type="text"
            className="w-full text-xs bg-black/40 border border-white/5 focus:border-indigo-500/50 rounded-lg px-3 py-2 text-slate-200 pl-8 focus:outline-hidden placeholder:text-slate-600 font-sans shadow-inner"
            placeholder="Ketik suasana hati khusus (misal: lagu dangdut ceria, metal jepang)..."
            value={customMood}
            onChange={(e) => setCustomMood(e.target.value)}
            disabled={isLoading}
          />
          <Music className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-3" />
        </div>
        <button
          type="submit"
          disabled={isLoading || !customMood.trim()}
          className="bg-indigo-650 hover:bg-indigo-600 disabled:bg-slate-800 text-white font-sans font-medium text-xs px-3.5 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1 flex-shrink-0 font-semibold"
        >
          {isLoading ? "Memuat..." : "Rekomendasi"}
        </button>
      </form>
    </div>
  );
}
