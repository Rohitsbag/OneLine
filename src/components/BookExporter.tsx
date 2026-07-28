import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { BookOpen, Printer, Check, Image as ImageIcon, Layers, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/utils/supabase/client";
import { Storage } from "@/utils/storage";
import { resolveMediaUrl } from "@/utils/media";

interface Entry {
    date: string;
    content: string;
    media_items?: { type: "image" | "audio"; url: string; duration?: number }[];
}

export type BookTheme = "minimalist" | "editorial" | "obsidian" | "botanical" | "coffee";
export type DateRangeMode = "year" | "all" | "custom";
export type LayoutDensity = "spacious" | "compact";

interface BookExporterProps {
    userId: string;
    isGuest?: boolean;
}

// Convert image URL (signed or blob) into Base64 Data URI for 100% reliable PDF embedding
async function imageUrlToBase64(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve(reader.result as string);
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                try {
                    const canvas = document.createElement("canvas");
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext("2d");
                    if (ctx) {
                        ctx.drawImage(img, 0, 0);
                        resolve(canvas.toDataURL("image/jpeg", 0.9));
                        return;
                    }
                } catch {}
                resolve(null);
            };
            img.onerror = () => resolve(null);
            img.src = url;
        });
    }
}

const THEME_CONFIGS: Record<BookTheme, {
    name: string;
    desc: string;
    bgHex: string;
    textHex: string;
    accentHex: string;
    cardBg: string;
    cardText: string;
    fontFamily: string;
}> = {
    minimalist: {
        name: "Minimalist Clean",
        desc: "Pure white paper, crisp modern typography.",
        bgHex: "#ffffff",
        textHex: "#18181b",
        accentHex: "#71717a",
        cardBg: "bg-white border-zinc-300",
        cardText: "text-zinc-900",
        fontFamily: "font-sans",
    },
    editorial: {
        name: "Classic Editorial",
        desc: "Warm parchment paper, rich serif typography.",
        bgHex: "#FAF7F2",
        textHex: "#2A2421",
        accentHex: "#8C6D58",
        cardBg: "bg-[#FAF7F2] border-[#E8DFC8]",
        cardText: "text-[#2A2421]",
        fontFamily: "font-serif",
    },
    obsidian: {
        name: "Midnight Obsidian",
        desc: "Deep dark obsidian background, silver luxury text.",
        bgHex: "#0D0D11",
        textHex: "#f3f4f6",
        accentHex: "#9ca3af",
        cardBg: "bg-[#0D0D11] border-zinc-800",
        cardText: "text-zinc-100",
        fontFamily: "font-sans",
    },
    botanical: {
        name: "Soft Botanical",
        desc: "Linen ivory paper with subtle sage green accents.",
        bgHex: "#F8F9F5",
        textHex: "#1C2826",
        accentHex: "#3D6B5A",
        cardBg: "bg-[#F8F9F5] border-[#E0E5D8]",
        cardText: "text-[#1C2826]",
        fontFamily: "font-serif",
    },
    coffee: {
        name: "Warm Coffee",
        desc: "Latte tone paper with warm espresso typography.",
        bgHex: "#F5EFE6",
        textHex: "#3C2A21",
        accentHex: "#785237",
        cardBg: "bg-[#F5EFE6] border-[#E5D4C0]",
        cardText: "text-[#3C2A21]",
        fontFamily: "font-serif",
    },
};

export function BookExporter({ userId, isGuest = false }: BookExporterProps) {
    const [rangeMode, setRangeMode] = useState<DateRangeMode>("year");
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [startDateStr, setStartDateStr] = useState<string>(
        format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd")
    );
    const [endDateStr, setEndDateStr] = useState<string>(format(new Date(), "yyyy-MM-dd"));

    const [theme, setTheme] = useState<BookTheme>("minimalist");
    const [density, setDensity] = useState<LayoutDensity>("spacious");
    const [includePhotos, setIncludePhotos] = useState(true);
    const [bookTitle, setBookTitle] = useState("OneLine — Journal of Memories");
    const [bookSubtitle, setBookSubtitle] = useState("A daily personal record");

    const [isGenerating, setIsGenerating] = useState(false);
    const [progressPercent, setProgressPercent] = useState(0);
    const [progressText, setProgressText] = useState("");

    const effectiveId = userId || "guest";

    // Build print HTML document and trigger browser print dialog
    const generateAndPrintBook = async () => {
        setIsGenerating(true);
        setProgressPercent(10);
        setProgressText("Gathering entries from memory...");

        try {
            // 1. Gather all local entries for authenticated users
            const allLocal: Entry[] = [];
            if (userId) {
                const now = new Date();
                for (let i = 0; i < 730; i++) {
                    const d = new Date(now);
                    d.setDate(d.getDate() - i);
                    const dStr = format(d, "yyyy-MM-dd");
                    const cached = Storage.getEntryCacheSync<any>(userId, dStr);
                    if (cached && (cached.content?.trim() || cached.media_items?.length)) {
                        allLocal.push({
                            date: dStr,
                            content: cached.content?.trim() || "",
                            media_items: cached.media_items || [],
                        });
                    }
                }
            }

            // 2. Fetch Supabase server entries if online
            let mergedEntries = [...allLocal];

            if (!isGuest && userId && navigator.onLine) {
                setProgressPercent(25);
                setProgressText("Syncing with server entries...");
                try {
                    const { data, error } = await supabase
                        .from("entries")
                        .select("date, content, media_items")
                        .eq("user_id", userId)
                        .order("date", { ascending: true });

                    if (!error && data) {
                        const serverDates = new Set(data.map((e) => e.date));
                        mergedEntries = [
                            ...data,
                            ...allLocal.filter((e) => !serverDates.has(e.date)),
                        ];
                    }
                } catch (e) {
                    console.warn("[BookExporter] Supabase fetch error:", e);
                }
            }

            // Sort ascending (chronological book order)
            mergedEntries.sort((a, b) => a.date.localeCompare(b.date));

            // 3. Filter by selected date range
            let filtered = mergedEntries;
            if (rangeMode === "year") {
                filtered = mergedEntries.filter((e) => e.date.startsWith(`${selectedYear}`));
            } else if (rangeMode === "custom") {
                filtered = mergedEntries.filter((e) => e.date >= startDateStr && e.date <= endDateStr);
            }

            if (filtered.length === 0) {
                alert("No journal entries found for the selected date range.");
                setIsGenerating(false);
                return;
            }

            setProgressPercent(40);
            setProgressText(`Processing ${filtered.length} entries & media...`);

            // 4. Resolve media signed URLs and convert to Base64
            const processedEntries = await Promise.all(
                filtered.map(async (entry, idx) => {
                    if (idx % 5 === 0) {
                        const p = 40 + Math.floor((idx / filtered.length) * 50);
                        setProgressPercent(p);
                        setProgressText(`Embedding photos into PDF (${idx}/${filtered.length})...`);
                    }

                    let imgBase64: string | null = null;
                    if (includePhotos && entry.media_items) {
                        const imgItem = entry.media_items.find((item) => item.type === "image");
                        if (imgItem) {
                            try {
                                const resolved = await resolveMediaUrl(imgItem.url);
                                if (resolved) {
                                    imgBase64 = await imageUrlToBase64(resolved);
                                }
                            } catch {
                                imgBase64 = null;
                            }
                        }
                    }

                    return { ...entry, resolvedImgUrl: imgBase64 };
                })
            );

            setProgressPercent(95);
            setProgressText("Formatting print-ready hardcover pages...");

            // 5. Construct Printable HTML Window
            const themeConfig = THEME_CONFIGS[theme];
            const fontCss = themeConfig.fontFamily === "font-serif" 
                ? "font-family: Georgia, Cambria, 'Times New Roman', Times, serif;" 
                : "font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;";

            const bgHex = themeConfig.bgHex;
            const textHex = themeConfig.textHex;
            const accentHex = themeConfig.accentHex;

            // Group entries by Month for Chapter Titles
            const monthGroups: Record<string, typeof processedEntries> = {};
            processedEntries.forEach((entry) => {
                const monthKey = format(parseISO(entry.date), "MMMM yyyy");
                if (!monthGroups[monthKey]) monthGroups[monthKey] = [];
                monthGroups[monthKey].push(entry);
            });

            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${bookTitle}</title>
                    <meta charset="utf-8" />
                    <style>
                        @page {
                            size: A4 portrait;
                            margin: 20mm 18mm 20mm 18mm;
                        }
                        * {
                            box-sizing: border-box;
                        }
                        body {
                            background-color: ${bgHex} !important;
                            color: ${textHex} !important;
                            ${fontCss}
                            margin: 0;
                            padding: 0;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .cover-page {
                            height: 90vh;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            text-align: center;
                            page-break-after: always;
                            padding: 40px;
                        }
                        .cover-emblem {
                            width: 64px;
                            height: 64px;
                            border: 2px solid ${accentHex};
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            margin-bottom: 32px;
                            font-size: 26px;
                        }
                        .cover-title {
                            font-size: 36px;
                            font-weight: 700;
                            letter-spacing: -0.02em;
                            margin-bottom: 12px;
                            color: ${textHex};
                        }
                        .cover-subtitle {
                            font-size: 15px;
                            color: ${accentHex};
                            font-weight: 400;
                            margin-bottom: 48px;
                        }
                        .cover-meta {
                            font-size: 11px;
                            color: ${accentHex};
                            letter-spacing: 0.15em;
                            text-transform: uppercase;
                        }
                        .month-section {
                            page-break-before: always;
                            padding-top: 10px;
                        }
                        .month-header {
                            font-size: 22px;
                            font-weight: 700;
                            border-bottom: 2px solid ${accentHex};
                            padding-bottom: 8px;
                            margin-bottom: 24px;
                            color: ${textHex};
                            letter-spacing: 0.02em;
                        }
                        .entry-card {
                            margin-bottom: ${density === "spacious" ? "28px" : "18px"};
                            page-break-inside: avoid;
                        }
                        .entry-date {
                            font-size: 11px;
                            font-weight: 700;
                            letter-spacing: 0.1em;
                            text-transform: uppercase;
                            color: ${accentHex};
                            margin-bottom: 4px;
                        }
                        .entry-text {
                            font-size: ${density === "spacious" ? "15px" : "13.5px"};
                            line-height: 1.7;
                            margin: 0 0 8px 0;
                            color: ${textHex};
                        }
                        .entry-img-container {
                            margin-top: 10px;
                            margin-bottom: 12px;
                            page-break-inside: avoid;
                        }
                        .entry-img {
                            max-width: 100%;
                            max-height: 380px;
                            width: auto;
                            height: auto;
                            object-fit: contain;
                            border-radius: 10px;
                            border: 1px solid ${accentHex}44;
                            display: block;
                        }
                        @media print {
                            body {
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                        }
                    </style>
                </head>
                <body>
                    <!-- Cover Page -->
                    <div class="cover-page">
                        <div class="cover-emblem">📖</div>
                        <div class="cover-title">${bookTitle}</div>
                        <div class="cover-subtitle">${bookSubtitle}</div>
                        <div class="cover-meta">${filtered.length} MOMENTS RECORDED</div>
                    </div>

                    <!-- Book Chapters -->
                    ${Object.entries(monthGroups).map(([monthName, monthEntries]) => `
                        <div class="month-section">
                            <div class="month-header">${monthName}</div>
                            ${monthEntries.map((e) => `
                                <div class="entry-card">
                                    <div class="entry-date">${format(parseISO(e.date), "EEEE, MMMM d, yyyy")}</div>
                                    ${e.content ? `<p class="entry-text">"${e.content}"</p>` : ""}
                                    ${e.resolvedImgUrl ? `
                                        <div class="entry-img-container">
                                            <img src="${e.resolvedImgUrl}" class="entry-img" alt="Attached photo" />
                                        </div>
                                    ` : ""}
                                </div>
                            `).join("")}
                        </div>
                    `).join("")}

                    <script>
                        window.onload = function() {
                            var imgs = Array.from(document.images);
                            var loaded = 0;
                            if (imgs.length === 0) {
                                setTimeout(function() { window.print(); }, 400);
                                return;
                            }
                            imgs.forEach(function(img) {
                                if (img.complete) {
                                    loaded++;
                                    if (loaded === imgs.length) setTimeout(function() { window.print(); }, 400);
                                } else {
                                    img.onload = img.onerror = function() {
                                        loaded++;
                                        if (loaded === imgs.length) setTimeout(function() { window.print(); }, 400);
                                    };
                                }
                            });
                        }
                    </script>
                </body>
                </html>
            `;

            setIsGenerating(false);
            setProgressPercent(100);

            // Open print window
            const printWin = window.open("", "_blank");
            if (printWin) {
                printWin.document.write(htmlContent);
                printWin.document.close();
            } else {
                alert("Please allow popups for this site to generate your PDF print book.");
            }
        } catch (e) {
            console.error("[BookExporter] Generation error:", e);
            alert("An error occurred while generating the book. Please try again.");
            setIsGenerating(false);
        }
    };

    return (
        <div className="w-full max-w-3xl bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl text-white shadow-2xl">
            {/* Header Title */}
            <div className="flex items-center gap-3 mb-6 border-b border-zinc-800 pb-4">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <BookOpen className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-xl font-bold tracking-tight">Hardcover Book Exporter</h3>
                    <p className="text-xs text-zinc-400 font-light">
                        Format your journal entries into a publication-grade print-ready PDF book.
                    </p>
                </div>
            </div>

            {/* Print Tip Banner */}
            <div className="mb-6 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 text-xs text-amber-300">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                    <strong>Print Tip:</strong> In your browser print popup, make sure to check <strong>"Background graphics"</strong> under Options so your background theme colors & photos render perfectly in your PDF!
                </span>
            </div>

            {/* Configurator Form */}
            <div className="space-y-6">
                {/* 1. Date Range Options */}
                <div>
                    <label className="text-xs font-mono text-zinc-400 tracking-wider uppercase block mb-3">
                        1. Select Date Range
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => setRangeMode("year")}
                            className={cn(
                                "py-2.5 px-4 rounded-xl text-xs font-medium border transition-all text-center",
                                rangeMode === "year"
                                    ? "bg-white text-zinc-950 border-white shadow-md font-semibold"
                                    : "bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:bg-zinc-800"
                            )}
                        >
                            Full Year ({selectedYear})
                        </button>
                        <button
                            type="button"
                            onClick={() => setRangeMode("all")}
                            className={cn(
                                "py-2.5 px-4 rounded-xl text-xs font-medium border transition-all text-center",
                                rangeMode === "all"
                                    ? "bg-white text-zinc-950 border-white shadow-md font-semibold"
                                    : "bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:bg-zinc-800"
                            )}
                        >
                            All Time
                        </button>
                        <button
                            type="button"
                            onClick={() => setRangeMode("custom")}
                            className={cn(
                                "py-2.5 px-4 rounded-xl text-xs font-medium border transition-all text-center",
                                rangeMode === "custom"
                                    ? "bg-white text-zinc-950 border-white shadow-md font-semibold"
                                    : "bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:bg-zinc-800"
                            )}
                        >
                            Custom Range
                        </button>
                    </div>

                    {rangeMode === "custom" && (
                        <div className="grid grid-cols-2 gap-4 mt-3 p-4 bg-zinc-950/40 rounded-2xl border border-zinc-800">
                            <div>
                                <label className="text-[11px] text-zinc-400 block mb-1">Start Date</label>
                                <input
                                    type="date"
                                    value={startDateStr}
                                    onChange={(e) => setStartDateStr(e.target.value)}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] text-zinc-400 block mb-1">End Date</label>
                                <input
                                    type="date"
                                    value={endDateStr}
                                    onChange={(e) => setEndDateStr(e.target.value)}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Select Aesthetic Theme */}
                <div>
                    <label className="text-xs font-mono text-zinc-400 tracking-wider uppercase block mb-3">
                        2. Choose Aesthetic Theme
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {(Object.keys(THEME_CONFIGS) as BookTheme[]).map((tKey) => {
                            const cfg = THEME_CONFIGS[tKey];
                            const isSelected = theme === tKey;
                            return (
                                <button
                                    key={tKey}
                                    type="button"
                                    onClick={() => setTheme(tKey)}
                                    className={cn(
                                        "p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between h-28 cursor-pointer shadow-md",
                                        cfg.cardBg,
                                        cfg.cardText,
                                        isSelected ? "ring-2 ring-amber-500 border-transparent scale-[1.02]" : "opacity-85 hover:opacity-100"
                                    )}
                                >
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-xs">{cfg.name}</span>
                                            {isSelected && (
                                                <span className="w-4 h-4 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center">
                                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] opacity-80 mt-1 font-light leading-tight">
                                            {cfg.desc}
                                        </p>
                                    </div>
                                    <span className="text-[9px] uppercase tracking-widest font-mono opacity-60">
                                        Sample Theme
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 3. Cover Title Customization */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-mono text-zinc-400 tracking-wider uppercase block mb-2">
                            Book Cover Title
                        </label>
                        <input
                            type="text"
                            value={bookTitle}
                            onChange={(e) => setBookTitle(e.target.value)}
                            placeholder="e.g. OneLine — Journal of Memories"
                            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-zinc-600"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-mono text-zinc-400 tracking-wider uppercase block mb-2">
                            Cover Subtitle / Dedication
                        </label>
                        <input
                            type="text"
                            value={bookSubtitle}
                            onChange={(e) => setBookSubtitle(e.target.value)}
                            placeholder="e.g. Reflections by Rohit"
                            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-zinc-600"
                        />
                    </div>
                </div>

                {/* 4. Density & Photo Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-800">
                    <div>
                        <label className="text-xs font-mono text-zinc-400 tracking-wider uppercase block mb-2">
                            Layout Density
                        </label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setDensity("spacious")}
                                className={cn(
                                    "flex-1 py-2 px-3 rounded-xl text-xs font-medium border transition-colors flex items-center justify-center gap-1.5",
                                    density === "spacious"
                                        ? "bg-white text-zinc-950 border-white font-semibold"
                                        : "bg-zinc-800/40 text-zinc-400 border-zinc-700/50"
                                )}
                            >
                                <Layers className="w-3.5 h-3.5" />
                                <span>Spacious (1-2 / pg)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setDensity("compact")}
                                className={cn(
                                    "flex-1 py-2 px-3 rounded-xl text-xs font-medium border transition-colors flex items-center justify-center gap-1.5",
                                    density === "compact"
                                        ? "bg-white text-zinc-950 border-white font-semibold"
                                        : "bg-zinc-800/40 text-zinc-400 border-zinc-700/50"
                                )}
                            >
                                <Layers className="w-3.5 h-3.5" />
                                <span>Compact (3-4 / pg)</span>
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-mono text-zinc-400 tracking-wider uppercase block mb-2">
                            Media Options
                        </label>
                        <button
                            type="button"
                            onClick={() => setIncludePhotos(!includePhotos)}
                            className={cn(
                                "w-full py-2 px-3 rounded-xl text-xs font-medium border transition-colors flex items-center justify-center gap-2",
                                includePhotos
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold"
                                    : "bg-zinc-800/40 text-zinc-400 border-zinc-700/50"
                            )}
                        >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Include Attached Photos: {includePhotos ? "ON" : "OFF"}</span>
                        </button>
                    </div>
                </div>

                {/* Progress bar during compilation */}
                {isGenerating && (
                    <div className="p-4 bg-zinc-950/80 rounded-2xl border border-amber-500/30 animate-in fade-in">
                        <div className="flex items-center justify-between text-xs mb-2">
                            <span className="text-amber-300 font-mono">{progressText}</span>
                            <span className="text-zinc-400 font-mono">{progressPercent}%</span>
                        </div>
                        <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                            <div
                                className="bg-amber-500 h-full transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Action Trigger Button */}
                <button
                    type="button"
                    onClick={generateAndPrintBook}
                    disabled={isGenerating}
                    className="w-full py-3.5 rounded-2xl bg-white text-zinc-950 font-bold text-sm shadow-xl hover:bg-zinc-100 transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                    <Printer className="w-4 h-4" />
                    <span>{isGenerating ? "Embedding Photos & Compiling..." : "Generate & Export Book (PDF / Print)"}</span>
                </button>
            </div>
        </div>
    );
}
