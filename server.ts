import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Helper to parse JSON clean, handling any potential markdown formatting wrapping from Gemini's output
function parseCleanJson(text: string) {
  const cleanedText = text.trim();
  try {
    return JSON.parse(cleanedText);
  } catch (e) {
    let extractedText = cleanedText;
    if (extractedText.includes("```json")) {
      extractedText = extractedText.split("```json")[1].split("```")[0].trim();
    } else if (extractedText.includes("```")) {
      extractedText = extractedText.split("```")[1].split("```")[0].trim();
    }
    try {
      return JSON.parse(extractedText);
    } catch (e2) {
      // Last-ditch extraction: Find first '{' and last '}'
      const firstCurly = extractedText.indexOf("{");
      const lastCurly = extractedText.lastIndexOf("}");
      if (firstCurly !== -1 && lastCurly !== -1 && lastCurly > firstCurly) {
        try {
          return JSON.parse(extractedText.substring(firstCurly, lastCurly + 1));
        } catch (e3) {
          throw new Error("Gagal mengurai respons JSON dari AI. Silakan coba sesaat lagi.");
        }
      }
      throw e2;
    }
  }
}

// Robust wrapper to generate contents with Google Search tool and safety fallback
async function generateSongContentWithFallback(prompt: string, schema: any) {
  try {
    console.log("Memulai pencarian lagu dengan Google Search Grounding di Gemini...");
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });
    return response;
  } catch (searchError: any) {
    console.warn("Google Search Grounding gagal atau diblokir. Menggunakan model fallback offline:", searchError.message);
    // If the Search Grounding is blocked or throws an error (very common for unpaid API keys, specific regions, or enterprise setups)
    // we retry with the standard model generation, instructing it to fulfill the requested schema.
    const fallbackResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt + "\n\nCatatan: Jangan gunakan alat pencarian eksternal. Berikan rekomendasi lagu terbaik dari memorimu dalam format JSON murni sesuai schema yang diminta.",
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });
    return fallbackResponse;
  }
}

// API endpoint for searching songs with Google Search grounding
app.post("/api/songs/search", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== "string" || query.trim() === "") {
      return res.status(400).json({ error: "Pencarian tidak boleh kosong." });
    }

    const prompt = `Cari detail lagu dan video musik resmi paling relevan di YouTube untuk kata kunci pencarian: "${query}".
Kamu harus merespons dengan menemukan 5 atau 6 lagu yang paling cocok.
Sangat penting: Temukan ID Video YouTube asli (11 karakter, misalnya 'dQw4w9WgXcQ' atau 'bX444Y_V0Uo' untuk lagu Kemesraan Iwan Fals) yang dapat dimuat di iframe YouTube player.
Gunakan alat pencarian Google untuk memverifikasi keaslian detail lagu tersebut.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        songs: {
          type: Type.ARRAY,
          description: "Daftar lagu hasil pencarian",
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Judul lagu" },
              artist: { type: Type.STRING, description: "Nama penyanyi atau band" },
              youtubeId: {
                type: Type.STRING,
                description: "ID YouTube video 11 karakter asli untuk pemutaran video (sangat kritis, harus akurat)",
              },
              year: { type: Type.STRING, description: "Tahun rilis lagu (opsional)" },
              album: { type: Type.STRING, description: "Nama album (opsional)" },
              description: { type: Type.STRING, description: "Deskripsi singkat 1 kalimat mengapa lagu ini ikonik atau menarik" },
            },
            required: ["title", "artist", "youtubeId"],
          },
        },
      },
      required: ["songs"],
    };

    const response = await generateSongContentWithFallback(prompt, schema);
    const text = response.text || "{}";
    const data = parseCleanJson(text);
    return res.json(data);
  } catch (error: any) {
    console.error("Gemini Search Error:", error);
    return res.status(500).json({
      error: "Gagal melakukan pencarian lagu. Pastikan API Key diatur dengan benar.",
      details: error.message,
    });
  }
});

// API endpoint for song recommendations based on mood or tag
app.post("/api/songs/recommend", async (req, res) => {
  try {
    const { mood } = req.body;
    if (!mood || typeof mood !== "string" || mood.trim() === "") {
      return res.status(400).json({ error: "Mood atau aktivitas harus diisi." });
    }

    const prompt = `Rekomendasikan 6 lagu terbaik yang sangat cocok untuk suasana hati (mood) atau aktivitas: "${mood}".
Gunakan Google Search untuk menemukan judul lagu asli, artis, dan ID Video YouTube 11 karakter yang sebenarnya agar bisa langsung diputar di pemutar video.
Jika suasana hati dalam bahasa Indonesia, berikan campuran lagu Indonesia dan lagu Barat populer yang cocok.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        songs: {
          type: Type.ARRAY,
          description: "Daftar lagu hasil rekomendasi",
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Judul lagu" },
              artist: { type: Type.STRING, description: "Nama penyanyi atau band" },
              youtubeId: {
                type: Type.STRING,
                description: "ID YouTube video 11 karakter asli untuk pemutaran video resmi",
              },
              year: { type: Type.STRING, description: "Tahun rilis-nya" },
              album: { type: Type.STRING, description: "Nama album" },
              description: { type: Type.STRING, description: "Alasan mengapa lagu ini cocok dengan suasana hati tersebut" },
            },
            required: ["title", "artist", "youtubeId", "description"],
          },
        },
      },
      required: ["songs"],
    };

    const response = await generateSongContentWithFallback(prompt, schema);
    const text = response.text || "{}";
    const data = parseCleanJson(text);
    return res.json(data);
  } catch (error: any) {
    console.error("Gemini Recommendation Error:", error);
    return res.status(500).json({
      error: "Gagal memberikan rekomendasi lagu.",
      details: error.message,
    });
  }
});

// Configure Vite middleware in development, serve static files in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
