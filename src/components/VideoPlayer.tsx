import { Play, Music, Volume2, Pause } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";

interface VideoPlayerProps {
  youtubeId: string | null;
  title: string | null;
  artist: string | null;
  isPlaying: boolean;
  setIsPlaying: (val: boolean) => void;
}

export default function VideoPlayer({ youtubeId, title, artist, isPlaying, setIsPlaying }: VideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Send play/pause commands to the YouTube Player API
  useEffect(() => {
    if (youtubeId && iframeRef.current) {
      try {
        const command = isPlaying ? "playVideo" : "pauseVideo";
        iframeRef.current.contentWindow?.postMessage(
          JSON.stringify({ event: "command", func: command, args: "" }),
          "*"
        );
      } catch (err) {
        console.warn("Gagal mengontrol iframe via postMessage:", err);
      }
    }
  }, [isPlaying, youtubeId]);

  return (
    <div id="video-player-container" className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden p-4 shadow-2xl backdrop-blur-md flex flex-col h-full justify-between">
      <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-indigo-400 animate-pulse" />
          <h3 className="font-sans font-bold text-xs tracking-wider text-white uppercase">
            NOW PLAYING
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
          <span className="text-[10px] font-mono tracking-wider text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase">
            {youtubeId ? (isPlaying ? "Active Playback" : "Paused") : "Idle"}
          </span>
        </div>
      </div>

      <div className="relative flex-1 min-h-[220px] md:min-h-[300px] bg-[#070709] rounded-xl overflow-hidden flex items-center justify-center border border-white/5 group">
        {youtubeId ? (
          <>
            <iframe
              ref={iframeRef}
              id="youtube-player-iframe"
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&enablejsapi=1`}
              title={title || "YouTube Video Player"}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
            
            {/* Elegant Overlay when Paused */}
            {!isPlaying && (
              <div 
                onClick={() => setIsPlaying(true)}
                className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center gap-3 cursor-pointer transition-all hover:bg-black/60 z-10"
              >
                <div className="w-14 h-14 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-lg transition-all scale-100 hover:scale-105">
                  <Play className="w-6 h-6 ml-1 fill-current" />
                </div>
                <span className="text-xs font-sans font-semibold text-slate-300">Diberhentikan (Jeda) — Klik untuk Putar</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-6 space-y-4">
            {/* Spinning Neon Music Disc Placeholder */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
              className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-600 to-emerald-400 p-1 shadow-2xl flex items-center justify-center cursor-default"
            >
              <div className="absolute inset-1.5 rounded-full bg-slate-950 border border-white/5 flex items-center justify-center">
                <Music className="w-7 h-7 text-indigo-400/85" />
              </div>
              <div className="absolute w-3 h-3 rounded-full bg-slate-900 border border-white/10 shadow-inner" />
            </motion.div>

            <div className="space-y-1">
              <h4 className="font-sans font-semibold text-white text-sm">Pemutar Video Musik</h4>
              <p className="font-sans text-[11px] text-slate-400 max-w-xs leading-relaxed">
                Pilih lagu dari pencarian atau daftar favorit untuk memutar video klip musik di sini.
              </p>
            </div>

            {/* Simulated sound wave indicator */}
            <div className="flex items-center gap-1 h-3 mt-2">
              {[0.3, 0.7, 0.4, 0.9, 0.2, 0.6, 0.8].map((val, idx) => (
                <motion.div
                  key={idx}
                  className="w-1 bg-gradient-to-t from-indigo-500 to-indigo-300 rounded-full"
                  animate={{ height: ["10%", "100%", "10%"] }}
                  transition={{
                    duration: 1 + val,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: idx * 0.15,
                  }}
                  style={{ width: "3.5px" }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-white/5 flex flex-col">
        {title ? (
          <div>
            <span className="font-mono text-[9px] text-indigo-400 tracking-widest uppercase font-bold block mb-0.5">
              Playing Track
            </span>
            <h4 className="font-sans font-semibold text-white text-sm truncate max-w-full">
              {title}
            </h4>
            <p className="font-sans text-xs text-slate-400 truncate mt-0.5">
              {artist}
            </p>
          </div>
        ) : (
          <div className="py-1">
            <span className="text-[11px] font-mono text-slate-505 italic">
              Menunggu pemutaran lagu...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
