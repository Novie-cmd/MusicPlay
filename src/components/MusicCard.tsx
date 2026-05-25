import React from "react";
import { Play, Heart, Star, Disc } from "lucide-react";
import { Song } from "../types";
import { motion } from "motion/react";

interface MusicCardProps {
  song: Song;
  isFavorited: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onFavoriteToggle: () => void;
  isSignedIn: boolean;
}

export default function MusicCard({
  song,
  isFavorited,
  isPlaying,
  onPlay,
  onFavoriteToggle,
  isSignedIn,
}: MusicCardProps) {
  const thumbnailUrl = `https://img.youtube.com/vi/${song.youtubeId}/mqdefault.jpg`;

  return (
    <motion.div
      id={`song-card-${song.youtubeId}`}
      whileHover={{ y: -4, borderColor: "rgba(99, 102, 241, 0.4)" }}
      transition={{ duration: 0.2 }}
      className={`relative bg-white/5 border ${
        isPlaying ? "border-indigo-500 bg-white/10" : "border-white/5"
      } rounded-xl p-4 flex flex-col justify-between gap-3 shadow-lg hover:bg-white/10 transition-all group`}
    >
      {/* Aspect Video Artwork/Thumbnail Container */}
      <div 
        onClick={onPlay}
        className="aspect-video bg-slate-950 rounded-lg relative overflow-hidden flex items-center justify-center cursor-pointer border border-white/5 group-hover:border-white/15 shadow-inner"
      >
        <img 
          src={thumbnailUrl} 
          alt={song.title} 
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-80"
        />
        {/* Play Icon Circle Overlay on Hover or if Playing */}
        <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-300 ${isPlaying ? "opacity-100 bg-black/30" : "opacity-0 group-hover:opacity-100"}`}>
          <div className={`w-12 h-12 ${isPlaying ? "bg-emerald-500 shadow-emerald-500/50" : "bg-indigo-600 shadow-indigo-600/50"} rounded-full flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110 duration-300`}>
            {isPlaying ? (
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((val) => (
                  <span
                    key={val}
                    className="w-1 h-4 bg-white rounded-full animate-pulse"
                    style={{ animationDelay: `${val * 0.15}s` }}
                  />
                ))}
              </div>
            ) : (
              <Play className="w-5 h-5 text-white ml-0.5 fill-current" />
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-sans font-semibold text-white truncate text-sm tracking-tight group-hover:text-indigo-400 transition-colors">
            {song.title}
          </h4>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteToggle();
            }}
            id={`fav-btn-${song.youtubeId}`}
            className={`flex-shrink-0 p-1.5 rounded-lg border transition-all cursor-pointer ${
              isFavorited
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
                : "bg-slate-800/40 border-slate-705 text-slate-400 hover:text-rose-400 hover:bg-slate-800"
            }`}
            title={isFavorited ? "Hapus dari Favorit" : "Simpan Favorit Online"}
          >
            <Heart className={`w-4 h-4 ${isFavorited ? "fill-current text-rose-500" : ""}`} />
          </button>
        </div>

        <p className="font-sans text-xs text-slate-400 truncate -mt-0.5">
          {song.artist}
        </p>

        {song.description && (
          <p className="font-sans text-[11px] text-slate-400 leading-relaxed line-clamp-2 mt-1 min-h-[32px]">
            {song.description}
          </p>
        )}
      </div>

      {/* Footer metadata details */}
      <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1 text-[10px] font-mono text-slate-500">
        <span className="truncate max-w-[130px]" title={song.album}>
          {song.album || "Single"}
        </span>
        {song.year && (
          <span className="bg-slate-800/80 px-1.5 py-0.5 rounded text-[9px]">
            {song.year}
          </span>
        )}
      </div>
    </motion.div>
  );
}
