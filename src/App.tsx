import React, { useState, useEffect, FormEvent } from "react";
import { 
  Play, Pause, Heart, Search, LogIn, LogOut, Disc, 
  Sparkles, Music, Trash2, Headphones, AlertCircle, RefreshCw 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp 
} from "firebase/firestore";

import { auth, db, handleFirestoreError } from "./firebase";
import { Song, Favorite, OperationType } from "./types";
import VideoPlayer from "./components/VideoPlayer";
import MusicCard from "./components/MusicCard";
import RecommendationPills from "./components/RecommendationPills";

// Curated starting trending list for Indonesia/Global
const TRENDING_TRACKS: Song[] = [
  {
    title: "Kemesraan",
    artist: "Iwan Fals",
    youtubeId: "bX444Y_V0Uo",
    year: "1988",
    album: "Kemesraan",
    description: "Tembang cinta legendaris Indonesia yang merayakan kebersamaan dan kedamaian.",
  },
  {
    title: "Asmalibrasi",
    artist: "Soegi Bornean",
    youtubeId: "v72fGskS-m4",
    year: "2020",
    album: "Irama Kopi",
    description: "Lagu folk-pop bernuansa etnik Jawa-Kalimantan yang menceritakan tentang keluhuran janji cinta.",
  },
  {
    title: "Bohemian Rhapsody",
    artist: "Queen",
    youtubeId: "fJ9rUzIMcZQ",
    year: "1975",
    album: "A Night at the Opera",
    description: "Karya progresif rock legendaris dunia yang memadukan opera, paduan suara, dan gitar megah.",
  },
  {
    title: "Hati-Hati di Jalan",
    artist: "Tulus",
    youtubeId: "i2vHka6fhcY",
    year: "2022",
    album: "Manusia",
    description: "Balada puitis tentang kedewasaan dalam berpisah, memecahkan rekor streaming tertinggi di Asia Tenggara.",
  }
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeMoodTitle, setActiveMoodTitle] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Playing state
  const [currentPlayback, setCurrentPlayback] = useState<{
    youtubeId: string;
    title: string;
    artist: string;
  } | null>(null);
  const [isGlobalPlaying, setIsGlobalPlaying] = useState(false);

  // Favorites state
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [favLoading, setFavLoading] = useState(false);
  const [localAuthNotice, setLocalAuthNotice] = useState<string | null>(null);

  // 1. Listen to Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Listen to user's favorites from Firestore
  useEffect(() => {
    if (!user) {
      setFavorites([]);
      return;
    }

    setFavLoading(true);
    const favoritesPath = "favorites";
    const q = query(
      collection(db, favoritesPath),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Favorite[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as Favorite);
        });
        
        // Sort by timestamp in memory to avoid needing Firestore composite index creation
        list.sort((a, b) => {
          const t1 = a.addedAt?.seconds || 0;
          const t2 = b.addedAt?.seconds || 0;
          return t2 - t1; // Newest first
        });

        setFavorites(list);
        setFavLoading(false);
      },
      (error) => {
        setFavLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, favoritesPath);
        } catch (err: any) {
          console.error("Firestore favorite snapshot hook failed:", err.message);
        }
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Handle Google authenticating Popup
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setLocalAuthNotice(null);
    } catch (e: any) {
      console.error("Gagal masuk dengan Google:", e);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e: any) {
      console.error("Gagal keluar:", e);
    }
  };

  // 3. Search song handler via Express proxy API
  const handleSearch = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || searchLoading) return;

    setSearchLoading(true);
    setSearchError(null);
    setActiveMoodTitle(null);

    try {
      const response = await fetch("/api/songs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Pencarian gagal dilakukan.");
      }

      setSearchResults(data.songs || []);
      if (data.songs?.length === 0) {
        setSearchError("Lagu tidak ditemukan. Silakan gunakan kata kunci lain.");
      }
    } catch (err: any) {
      setSearchError(err.message || "Terdapat kendala koneksi.");
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  // 4. Recommendation AI trigger
  const handleSelectMood = async (moodQuery: string) => {
    setSearchLoading(true);
    setSearchError(null);
    setSearchQuery(""); // Clear search bar
    
    // Capitalize tag visual title
    const formattedMood = moodQuery.length > 35 ? moodQuery.substring(0, 35) + "..." : moodQuery;
    setActiveMoodTitle(formattedMood);

    try {
      const response = await fetch("/api/songs/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: moodQuery }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal mendapatkan rekomendasi.");
      }

      setSearchResults(data.songs || []);
    } catch (err: any) {
      setSearchError(err.message || "Gagal menghubungi AI Musik Concierge.");
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  // Toggle favorite trigger
  const handleFavoriteToggle = async (song: Song) => {
    if (!user) {
      setLocalAuthNotice("Silakan masuk dengan Google untuk menyimpan daftar lagu favorit secara online!");
      // Auto dismiss notice after 5 seconds
      setTimeout(() => {
        setLocalAuthNotice(null);
      }, 7000);
      return;
    }

    const docId = `${user.uid}_${song.youtubeId}`;
    const favoritesPath = `favorites/${docId}`;
    const favoritedRecord = favorites.find(f => f.youtubeId === song.youtubeId);

    try {
      if (favoritedRecord) {
        // Remove favorite
        await deleteDoc(doc(db, "favorites", docId));
      } else {
        // Add favorite
        const favoritePayload = {
          id: docId,
          userId: user.uid,
          title: song.title,
          artist: song.artist,
          youtubeId: song.youtubeId,
          thumbnail: `https://img.youtube.com/vi/${song.youtubeId}/mqdefault.jpg`,
          addedAt: serverTimestamp(),
          year: song.year || "",
          album: song.album || ""
        };

        await setDoc(doc(db, "favorites", docId), favoritePayload);
      }
    } catch (error: any) {
      try {
        handleFirestoreError(error, OperationType.WRITE, favoritesPath);
      } catch (err: any) {
        console.error("Gagal merubah status favorit online:", err.message);
      }
    }
  };

  const isSongFavorited = (youtubeId: string): boolean => {
    return favorites.some(f => f.youtubeId === youtubeId);
  };

  return (
    <div id="melody-app-root" className="h-screen bg-[#0A0A0B] text-slate-200 font-sans flex overflow-hidden select-none selection:bg-indigo-500 selection:text-white">
      {/* Left Sidebar */}
      <aside className="w-64 bg-[#000000] border-r border-white/5 flex flex-col justify-between hidden md:flex flex-shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white shadow-md shadow-indigo-950/40">M</div>
            <span className="text-xl font-bold tracking-tight text-white">MelodiAI</span>
          </div>
          
          <nav className="space-y-1 bg-transparent border-0 p-0">
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
                setSearchError(null);
                setActiveMoodTitle(null);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-indigo-400 bg-indigo-505/10 rounded-md font-medium text-left text-sm cursor-pointer"
            >
              <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
              Beranda
            </button>
            <button
              onClick={() => {
                document.getElementById("nav-search-input")?.focus();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors text-left text-sm cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              Telusuri
            </button>
          </nav>

          <div className="mt-8">
            <h3 className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Daftar Favorit</h3>
            <div className="space-y-1 max-h-[220px] overflow-y-auto scrollbar-thin pr-1">
              {favorites.map((fav) => (
                <div
                  key={fav.id}
                  onClick={() => {
                    setCurrentPlayback({
                      youtubeId: fav.youtubeId,
                      title: fav.title,
                      artist: fav.artist
                    });
                    setIsGlobalPlaying(true);
                  }}
                  className="group flex items-center justify-between px-3 py-1.5 text-slate-400 hover:text-white cursor-pointer rounded-lg hover:bg-white/5 transition-all text-sm truncate"
                >
                  <span className="truncate">{fav.title}</span>
                  <span className="opacity-0 group-hover:opacity-100 text-[9px] bg-indigo-950 text-indigo-400 border border-indigo-500/10 px-1 rounded-sm uppercase tracking-wider font-mono">Live</span>
                </div>
              ))}
              {favorites.length === 0 && (
                <p className="px-3 text-xs text-slate-600 italic">Belum ada favorit online</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-auto p-6">
          <div className="p-4 bg-gradient-to-br from-indigo-950/40 to-slate-900/60 rounded-xl border border-indigo-500/15 shadow-inner">
            <p className="text-xs text-indigo-400 font-semibold mb-1 italic">Sinkronisasi Aktif</p>
            <p className="text-[10px] text-slate-400 leading-normal">
              {user ? `${favorites.length} lagu tersimpan aman di cloud akun Anda.` : "Masuk akun Google untuk sinkronisasi cloud."}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Container Area */}
      <main className="flex-1 flex flex-col bg-gradient-to-b from-slate-900 to-[#0A0A0B] overflow-hidden h-full relative">
        
        {/* Top Header Navbar */}
        <header className="h-20 flex items-center px-6 sm:px-8 gap-6 border-b border-white/5 bg-[#000000]/40 backdrop-blur-md sticky top-0 z-40 flex-shrink-0 justify-between">
          {/* Quick Search */}
          <div className="relative flex-1 max-w-xl">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center">
              <Search className="w-4 h-4 text-slate-500" />
            </span>
            <form onSubmit={handleSearch} className="w-full">
              <input 
                id="nav-search-input"
                type="text" 
                className="w-full bg-slate-800/40 border border-white/5 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 text-slate-200 placeholder-slate-500 shadow-inner font-sans transition-all"
                placeholder="Cari lagu, artis, atau genre (contoh: Iwan Fals, Sheila on 7)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={searchLoading}
              />
            </form>
          </div>

          {/* User Log Module */}
          <div className="flex items-center gap-4">
            {authLoading ? (
              <span className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            ) : user ? (
              <div className="flex items-center gap-2.5 bg-black/40 border border-white/5 rounded-full pl-2 pr-3.5 py-1">
                {user.photoURL ? (
                  <img
                    referrerPolicy="no-referrer"
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    className="w-7 h-7 rounded-full border border-indigo-500/65"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-900 text-xs flex items-center justify-center font-semibold text-white">
                    {user.displayName?.substring(0, 1).toUpperCase() || "U"}
                  </div>
                )}
                <div className="flex flex-col text-left">
                  <span className="font-sans text-xs font-semibold text-slate-200 max-w-[100px] truncate leading-tight">
                    {user.displayName?.split(" ")[0]}
                  </span>
                  <span className="text-[9px] font-mono text-indigo-400 tracking-wider">ONLINE</span>
                </div>
                <button
                  onClick={handleLogout}
                  id="nav-logout-btn"
                  className="p-1 text-slate-400 hover:text-rose-400 transition-colors ml-1 cursor-pointer bg-transparent border-0"
                  title="Keluar"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleLogin}
                id="nav-login-btn"
                className="bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-sans font-semibold px-4 py-2 rounded-full transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-950/40"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Masuk Google</span>
              </button>
            )}
          </div>
        </header>

        {/* Floating User Login Notice Alert */}
        <AnimatePresence>
          {localAuthNotice && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-24 left-4 right-4 md:left-auto md:right-8 z-55 md:max-w-md bg-[#160b0d] border border-rose-500/40 text-rose-200 px-4 py-3 rounded-xl shadow-2xl flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-sans font-medium">MelodiAI Cloud Services</p>
                <p className="text-[11px] font-sans text-rose-300/90 mt-0.5">
                  {localAuthNotice}
                </p>
                <button
                  onClick={handleGoogleLogin}
                  className="mt-2 text-[10px] font-mono uppercase bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold px-2 py-1 rounded transition-colors cursor-pointer"
                >
                  Masuk Sekarang
                </button>
              </div>
              <button
                onClick={() => setLocalAuthNotice(null)}
                className="text-xs text-rose-400 hover:text-white"
              >
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Overflow Area */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 scrollbar-thin flex flex-col gap-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* L: AI recommendation and search outputs */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              <RecommendationPills
                onSelectMood={handleSelectMood}
                isLoading={searchLoading}
              />

              {/* Fast suggestions row */}
              <div className="flex flex-wrap gap-2 items-center bg-white/5 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] font-mono text-slate-500">Inspirasi:</span>
                {["Kemesraan", "Pamungkas", "Akustik Cafe", "Indie Indonesia", "Maliq & D'Essentials"].map((suggest, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSearchQuery(suggest);
                      setTimeout(() => {
                        handleSelectMood(`Lagu terpopuler oleh ${suggest}`);
                      }, 40);
                    }}
                    className="text-[10px] bg-slate-800/40 hover:bg-white/5 border border-white/5 text-slate-400 hover:text-indigo-400 px-2.5 py-1 rounded-md transition-all cursor-pointer font-sans"
                  >
                    "{suggest}"
                  </button>
                ))}
              </div>

              {/* Title Section */}
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="font-sans font-bold text-sm text-white tracking-tight">
                    {activeMoodTitle ? (
                      <span>Suasana: <span className="text-indigo-400 font-semibold">"{activeMoodTitle}"</span></span>
                    ) : searchQuery ? (
                      <span>Hasil Pencarian: "{searchQuery}"</span>
                    ) : (
                      "Lagu Sedang Populer saat ini"
                    )}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 border border-white/5 bg-white/3 px-2 py-0.5 rounded-full">
                  {searchResults.length || TRENDING_TRACKS.length} Tracks
                </span>
              </div>

              {/* Grid block */}
              {searchLoading ? (
                <div id="results-loader" className="flex flex-col items-center justify-center py-20 gap-4 bg-white/3 border border-white/5 rounded-2xl">
                  <Disc className="w-8 h-8 text-indigo-400 animate-spin" />
                  <div className="text-center space-y-1">
                    <p className="font-sans font-medium text-xs text-slate-200">Sedang mencari dengan Gemini AI...</p>
                    <p className="font-mono text-[10px] text-slate-500 max-w-sm mx-auto px-4">
                      Kami memverifikasi video YouTube asli secara real-time via Google Search untuk pemutaran handal.
                    </p>
                  </div>
                </div>
              ) : searchError ? (
                <div id="results-error" className="py-16 text-center bg-rose-950/10 border border-rose-500/10 rounded-2xl flex flex-col items-center justify-center gap-2">
                  <AlertCircle className="w-6 h-6 text-rose-500" />
                  <p className="font-sans text-xs text-slate-300 px-4">{searchError}</p>
                </div>
              ) : (
                <div id="songs-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(searchResults.length > 0 ? searchResults : TRENDING_TRACKS).map((song, index) => (
                    <div key={`${song.youtubeId}-${index}`}>
                      <MusicCard
                        song={song}
                        isFavorited={isSongFavorited(song.youtubeId)}
                        isPlaying={currentPlayback?.youtubeId === song.youtubeId && isGlobalPlaying}
                        onPlay={() => {
                          if (currentPlayback?.youtubeId === song.youtubeId) {
                            setIsGlobalPlaying(!isGlobalPlaying);
                          } else {
                            setCurrentPlayback({
                              youtubeId: song.youtubeId,
                              title: song.title,
                              artist: song.artist
                            });
                            setIsGlobalPlaying(true);
                          }
                        }}
                        onFavoriteToggle={() => handleFavoriteToggle(song)}
                        isSignedIn={!!user}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* R: Smooth video player and lists favorites */}
            <div className="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-0">
              <VideoPlayer
                youtubeId={currentPlayback?.youtubeId || null}
                title={currentPlayback?.title || null}
                artist={currentPlayback?.artist || null}
                isPlaying={isGlobalPlaying}
                setIsPlaying={setIsGlobalPlaying}
              />

              {/* Favorites Table Design as shown in Professional Polish HTML template */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-5 shadow-2xl backdrop-blur-md flex flex-col h-[380px]">
                <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-indigo-505 fill-current" />
                    <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-white">
                      FAVORIT ONLINE {favorites.length > 0 && `(${favorites.length})`}
                    </h3>
                  </div>
                  <span className="font-mono text-[9px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 border border-indigo-500/15 rounded-full font-semibold uppercase">
                    CLOUD SYNCED
                  </span>
                </div>

                {!user ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                      <Heart className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-sans text-xs text-slate-200 font-semibold">Simpan Lagu Favorit Anda Online</p>
                      <p className="font-sans text-[11px] text-slate-400 max-w-xs leading-relaxed">
                        Masuk dengan menggunakan Akun Google untuk mengaktifkan sinkronisasi persistensi dengan Firestore Cloud database secara otomatis.
                      </p>
                    </div>
                    <button
                      onClick={handleGoogleLogin}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-sans font-semibold text-xs px-4 py-2 rounded-full cursor-pointer transition-all shadow-md"
                    >
                      Hubungkan Google
                    </button>
                  </div>
                ) : favLoading ? (
                  <div className="flex-1 flex items-center justify-center p-4">
                    <Disc className="w-6 h-6 text-indigo-400 animate-spin" />
                  </div>
                ) : favorites.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-2">
                    <p className="font-sans text-xs text-slate-400 font-semibold">Belum memiliki lagu favorit online</p>
                    <p className="font-sans text-[10px] text-slate-500">
                      Klik ikon hati di kartu musik pilihan untuk menambahkannya ke sini.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
                    <table className="w-full text-left">
                      <thead className="text-[10px] text-slate-500 uppercase border-b border-white/5 sticky top-0 bg-[#0e0e11] z-10">
                        <tr>
                          <th className="py-2.5 font-semibold pl-2">Track</th>
                          <th className="py-2.5 font-semibold text-right pr-2">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {favorites.map((fav, index) => (
                          <tr 
                            key={fav.id}
                            id={`fav-row-${fav.youtubeId}`}
                            className={`border-b border-white/5 hover:bg-white/5 cursor-pointer group ${currentPlayback?.youtubeId === fav.youtubeId ? 'bg-indigo-500/10' : ''}`}
                            onClick={() => {
                              setCurrentPlayback({
                                youtubeId: fav.youtubeId,
                                title: fav.title,
                                artist: fav.artist
                              });
                              setIsGlobalPlaying(true);
                            }}
                          >
                            <td className="py-2 pl-2 flex items-center gap-2.5 min-w-0">
                              <span className="font-mono text-[10px] text-slate-500 min-w-[12px]">
                                {index + 1}
                              </span>
                              <div className="w-8 h-8 rounded-md overflow-hidden bg-slate-900 border border-white/5 flex-shrink-0 relative">
                                {fav.thumbnail ? (
                                  <img src={fav.thumbnail} alt={fav.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-indigo-950">
                                    <Music className="w-3.5 h-3.5 text-indigo-400" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h5 className="font-sans font-semibold text-white truncate max-w-[150px]">
                                  {fav.title}
                                </h5>
                                <p className="font-sans text-[10px] text-slate-400 truncate max-w-[150px]">
                                  {fav.artist}
                                </p>
                              </div>
                            </td>
                            <td className="py-2 text-right pr-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFavoriteToggle({
                                    title: fav.title,
                                    artist: fav.artist,
                                    youtubeId: fav.youtubeId,
                                    year: fav.year,
                                    album: fav.album
                                  });
                                }}
                                className="w-7 h-7 inline-flex items-center justify-center text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-all cursor-pointer bg-transparent border-0"
                                title="Hapus dari Favorit"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Global Immersive Player Bar (The footer from the Professional Polish design script!) */}
        <footer className="h-24 bg-[#111111] border-t border-white/10 px-6 sm:px-8 flex items-center justify-between sticky bottom-0 z-50 mt-auto flex-shrink-0 select-none">
          {/* Now Playing Info */}
          <div className="flex items-center gap-4 w-72 min-w-0">
            <div className="w-14 h-14 bg-gradient-to-tr from-indigo-950 to-slate-900 rounded-lg border border-white/10 shadow-lg flex-shrink-0 overflow-hidden relative">
              {currentPlayback ? (
                <img 
                  src={`https://img.youtube.com/vi/${currentPlayback.youtubeId}/mqdefault.jpg`} 
                  alt={currentPlayback.title}
                  className="w-full h-full object-cover animate-pulse"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-950">
                  <Headphones className="w-5 h-5 text-indigo-500/80" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h5 className="text-white font-semibold truncate text-sm">
                {currentPlayback ? currentPlayback.title : "Tidak Ada Lagu Terpilih"}
              </h5>
              <p className="text-xs text-slate-400 truncate">
                {currentPlayback ? currentPlayback.artist : "Pilih lagu untuk memainkan video klip"}
              </p>
            </div>
          </div>

          {/* Player controls (Sleek minimalist interface) */}
          <div className="hidden sm:flex flex-col items-center flex-1 max-w-lg px-4">
            <div className="flex items-center gap-6 mb-2">
              <button 
                onClick={() => {
                  if (currentPlayback) {
                    const cur = currentPlayback;
                    setCurrentPlayback(null);
                    setTimeout(() => setCurrentPlayback(cur), 50);
                  }
                }}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer bg-transparent border-0"
                title="Putar Ulang Video"
                disabled={!currentPlayback}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              
              <button 
                onClick={() => {
                  if (currentPlayback) {
                    setIsGlobalPlaying(!isGlobalPlaying);
                  } else {
                    if (searchResults.length > 0) {
                      const first = searchResults[0];
                      setCurrentPlayback({
                        youtubeId: first.youtubeId,
                        title: first.title,
                        artist: first.artist
                      });
                    } else {
                      const first = TRENDING_TRACKS[0];
                      setCurrentPlayback({
                        youtubeId: first.youtubeId,
                        title: first.title,
                        artist: first.artist
                      });
                    }
                    setIsGlobalPlaying(true);
                  }
                }}
                className="w-10 h-10 bg-white hover:bg-indigo-100 rounded-full flex items-center justify-center text-black cursor-pointer transition-transform hover:scale-105 border-0 text-center"
                title={currentPlayback ? (isGlobalPlaying ? "Jeda" : "Putar") : "Mulai Putar"}
              >
                {currentPlayback && isGlobalPlaying ? (
                  <Pause className="w-4 h-4 fill-current text-black inline-block" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5 fill-current text-black inline-block" />
                )}
              </button>
            </div>

            {/* Simulated interactive progress line tracker */}
            <div className="w-full flex items-center gap-3">
              <span className="text-[10px] text-slate-500 font-mono">1:24</span>
              <div className="flex-1 h-1 bg-white/10 rounded-full relative overflow-hidden">
                <div className="absolute left-0 top-0 h-full w-[40%] bg-indigo-500 rounded-full" />
              </div>
              <span className="text-[10px] text-slate-500 font-mono">3:45</span>
            </div>
          </div>

          {/* Extra tools / volume */}
          <div className="flex items-center gap-3 w-72 justify-end">
            <svg className="w-5 h-5 text-slate-500 hidden md:inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path>
            </svg>
            <div className="w-20 h-1 bg-white/10 rounded-full hidden md:block">
              <div className="w-4/5 h-full bg-[#6366f1] rounded-full"></div>
            </div>
            <p className="text-[10px] font-mono text-slate-505 bg-white/5 border border-white/5 px-2.5 py-1 rounded">
              MELODIAI V1.0
            </p>
          </div>
        </footer>

      </main>
    </div>
  );
}
