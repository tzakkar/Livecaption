"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Languages, Loader2, PanelTopOpen, X, GripVertical, Maximize2, Minimize2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LANGUAGES } from "@/lib/languages";
import { LanguageSelector } from "@/components/language-selector";

interface Event {
  id: string;
  uid: string;
  title: string;
  description: string | null;
}

interface ViewerInterfaceProps {
  event: Event;
  /** When true, render minimal UI for a separate popup window (movable outside browser). */
  popup?: boolean;
}

interface Caption {
  id: string;
  text: string;
  timestamp: string;
  is_final: boolean;
  language_code?: string;
}

// Type definitions for Chrome Translator API
interface TranslatorCreateOptions {
  sourceLanguage: string;
  targetLanguage: string;
  monitor?: (monitor: TranslatorMonitor) => void;
}

interface TranslatorMonitor {
  addEventListener(
    type: "downloadprogress",
    listener: (event: TranslatorDownloadProgressEvent) => void
  ): void;
  removeEventListener(
    type: "downloadprogress",
    listener: (event: TranslatorDownloadProgressEvent) => void
  ): void;
}

interface TranslatorDownloadProgressEvent extends Event {
  loaded: number;
  total: number;
}

interface Translator {
  translate(text: string): Promise<string>;
  destroy(): void;
}

interface TranslatorConstructor {
  create(options: TranslatorCreateOptions): Promise<Translator>;
  availability(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<string>;
}

declare global {
  interface Window {
    Translator?: TranslatorConstructor;
  }
}

export function ViewerInterface({ event, popup: isPopupMode = false }: ViewerInterfaceProps) {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [partialText, setPartialText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const supabase = getSupabaseBrowserClient();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Translation state
  const [targetLanguage, setTargetLanguage] = useState("none");
  const [sourceLanguage, setSourceLanguage] = useState("en"); // Default to English
  const [translatedCaptions, setTranslatedCaptions] = useState<
    Map<string, string>
  >(new Map());
  const [translatedPartialText, setTranslatedPartialText] = useState("");
  const [isTranslatorSupported, setIsTranslatorSupported] = useState(false);
  const [isTranslationApiAvailable, setIsTranslationApiAvailable] = useState(false);
  const [translationProvider, setTranslationProvider] = useState<"chrome" | "api">("chrome");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState("");
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const translatorRef = useRef<Translator | null>(null);
  const translatorAbortRef = useRef<AbortController | null>(null);
  const TRANSLATION_PROVIDER_STORAGE_KEY = "captions-translation-provider";

  // Idle detection: no caption/partial for 15s → show "No sound detected" for 5s, then blank
  const lastActivityAtRef = useRef<number>(Date.now());
  const [showIdleMessage, setShowIdleMessage] = useState(false);
  const [idleMessageVisible, setIdleMessageVisible] = useState(false);
  const idleMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const IDLE_THRESHOLD_MS = 15000;
  const IDLE_MESSAGE_DURATION_MS = 5000;

  // Floating pop-up state
  const [isFloating, setIsFloating] = useState(false);
  const [floatingPosition, setFloatingPosition] = useState({ x: 24, y: 24 });
  const [floatingOpacity, setFloatingOpacity] = useState(0.95);
  const floatingSize = useRef({ w: 420, h: 360 });
  const dragStartRef = useRef<{ x: number; y: number; startLeft: number; startTop: number } | null>(null);

  // Pop-out target: "window" = new browser window, "overlay" = in-page float (no OS window buttons)
  const POPOUT_STORAGE_KEY = "captions-popout-target";
  const [popoutTarget, setPopoutTarget] = useState<"window" | "overlay">("window");
  useEffect(() => {
    try {
      const stored = localStorage.getItem(POPOUT_STORAGE_KEY);
      if (stored === "overlay" || stored === "window") setPopoutTarget(stored);
    } catch {
      /* ignore */
    }
  }, []);
  const setPopoutTargetAndSave = useCallback((value: "window" | "overlay") => {
    setPopoutTarget(value);
    try {
      localStorage.setItem(POPOUT_STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  // Same-page embed: video + caption overlay in one tab (true see-through to video, no second window)
  const [embedVideoUrl, setEmbedVideoUrl] = useState<string | null>(null);
  const [embedOverlayPosition, setEmbedOverlayPosition] = useState<{ x: number; y: number } | null>(null);
  const embedDragStartRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);

  // Auto-hide control bar (title + See-through) after idle; show again on hover/move
  const OVERLAY_CONTROLS_HIDE_MS = 2500;
  const [overlayControlsVisible, setOverlayControlsVisible] = useState(true);
  const overlayControlsHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleHideOverlayControls = useCallback(() => {
    if (overlayControlsHideTimeoutRef.current) clearTimeout(overlayControlsHideTimeoutRef.current);
    overlayControlsHideTimeoutRef.current = setTimeout(() => {
      setOverlayControlsVisible(false);
      overlayControlsHideTimeoutRef.current = null;
    }, OVERLAY_CONTROLS_HIDE_MS);
  }, []);
  const showOverlayControls = useCallback(() => {
    setOverlayControlsVisible(true);
    scheduleHideOverlayControls();
  }, [scheduleHideOverlayControls]);
  useEffect(() => () => {
    if (overlayControlsHideTimeoutRef.current) clearTimeout(overlayControlsHideTimeoutRef.current);
  }, []);
  // Start auto-hide timer when any overlay is shown (bar hides after 2.5s if no mouse move)
  useEffect(() => {
    if (isPopupMode || isFloating || embedVideoUrl) scheduleHideOverlayControls();
  }, [isPopupMode, isFloating, embedVideoUrl, scheduleHideOverlayControls]);
  // Popup: start with controls hidden for a clean “live translation” look
  useEffect(() => {
    if (isPopupMode) setOverlayControlsVisible(false);
  }, [isPopupMode]);

  const handleEmbedOverlayPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, input, label, [role='combobox']")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = embedOverlayPosition ?? { x: 24, y: window.innerHeight - 320 };
    embedDragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startX: pos.x,
      startY: pos.y,
    };
  }, [embedOverlayPosition]);
  const handleEmbedOverlayPointerMove = useCallback((e: React.PointerEvent) => {
    if (!embedDragStartRef.current) return;
    setEmbedOverlayPosition({
      x: embedDragStartRef.current.startX + (e.clientX - embedDragStartRef.current.x),
      y: embedDragStartRef.current.startY + (e.clientY - embedDragStartRef.current.y),
    });
  }, []);
  const handleEmbedOverlayPointerUp = useCallback((e: React.PointerEvent) => {
    if (embedDragStartRef.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      embedDragStartRef.current = null;
    }
  }, []);

  // Load existing captions on mount
  useEffect(() => {
    const loadCaptions = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("captions")
        .select("*")
        .eq("event_id", event.id)
        .eq("is_final", true)
        .order("sequence_number", { ascending: true });

      if (error) {
        console.error("Error loading captions:", error);
      } else if (data) {
        setCaptions(data);
        if (data.length > 0) lastActivityAtRef.current = Date.now();

        // Detect source language from the first caption with language_code
        if (data.length > 0) {
          const firstCaptionWithLang = data.find(
            (caption: Caption) => caption.language_code
          );
          if (firstCaptionWithLang?.language_code) {
            setSourceLanguage(firstCaptionWithLang.language_code);
            console.log(
              "Detected source language:",
              firstCaptionWithLang.language_code
            );
          }
        }

        // Scroll to bottom after initial load
        setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop =
              scrollContainerRef.current.scrollHeight;
          }
        }, 100);
      }
      setIsLoading(false);
    };

    loadCaptions();
  }, [event.id, supabase]);

  // Subscribe to realtime updates for final captions
  useEffect(() => {
    const channel = supabase
      .channel(`captions:${event.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "captions",
          filter: `event_id=eq.${event.id}`,
        },
        (payload: { new: Caption }) => {
          console.log("New caption received:", payload);
          lastActivityAtRef.current = Date.now();

          // Update source language if detected
          if (payload.new.language_code) {
            setSourceLanguage(payload.new.language_code);
          }

          // Clear partial text when final caption arrives
          setPartialText("");
          // Only add if we don't already have it (to avoid duplicates)
          setCaptions((prev) => {
            const exists = prev.some((c) => c.id === payload.new.id);
            if (exists) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event.id, supabase]);

  // Subscribe to broadcast channel for partial transcripts
  useEffect(() => {
    const broadcastChannel = supabase
      .channel(`broadcast:${event.uid}`)
      .on(
        "broadcast",
        { event: "partial_transcript" },
        (payload: { payload: { text: string; language_code?: string } }) => {
          console.log("Partial transcript received:", payload);
          lastActivityAtRef.current = Date.now();

          // Update source language if detected
          if (payload.payload.language_code) {
            setSourceLanguage(payload.payload.language_code);
          }

          setPartialText(payload.payload.text);
        }
      )
      .subscribe((status: string) => {
        console.log("Broadcast channel status:", status);
      });

    return () => {
      supabase.removeChannel(broadcastChannel);
    };
  }, [event.uid, supabase]);

  // Idle check: if no caption/partial for 15s, show "No sound detected"
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityAtRef.current;
      setShowIdleMessage(elapsed >= IDLE_THRESHOLD_MS);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Show idle message for 5s only, then hide (blank screen)
  useEffect(() => {
    if (showIdleMessage) {
      setIdleMessageVisible(true);
      if (idleMessageTimeoutRef.current) clearTimeout(idleMessageTimeoutRef.current);
      idleMessageTimeoutRef.current = setTimeout(() => {
        setIdleMessageVisible(false);
        idleMessageTimeoutRef.current = null;
      }, IDLE_MESSAGE_DURATION_MS);
    } else {
      setIdleMessageVisible(false);
      if (idleMessageTimeoutRef.current) {
        clearTimeout(idleMessageTimeoutRef.current);
        idleMessageTimeoutRef.current = null;
      }
    }
    return () => {
      if (idleMessageTimeoutRef.current) clearTimeout(idleMessageTimeoutRef.current);
    };
  }, [showIdleMessage]);

  // Popup window: set document title
  useEffect(() => {
    if (isPopupMode && event?.title) {
      document.title = `Live Captions – ${event.title}`;
    }
  }, [isPopupMode, event?.title]);

  // Popup window: transparent background so you can see video/content behind the window
  useEffect(() => {
    if (!isPopupMode) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.background;
    const prevBodyBg = body.style.background;
    html.style.background = "transparent";
    body.style.background = "transparent";
    return () => {
      html.style.background = prevHtmlBg;
      body.style.background = prevBodyBg;
    };
  }, [isPopupMode]);

  // Popup: fullscreen to hide address bar; sync state with fullscreen API
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    if (!isPopupMode) return;
    const onFullscreenChange = () =>
      setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [isPopupMode]);
  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Check if Translator API is supported (Chrome)
  useEffect(() => {
    if (typeof window !== "undefined" && "Translator" in self) {
      setIsTranslatorSupported(true);
    }
  }, []);

  // Check if server translation API is available and restore provider preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem(TRANSLATION_PROVIDER_STORAGE_KEY);
      if (stored === "chrome" || stored === "api") setTranslationProvider(stored);
    } catch {
      /* ignore */
    }
    fetch("/api/translate")
      .then((r) => r.json())
      .then((data: { available?: boolean }) => {
        const available = !!data.available;
        setIsTranslationApiAvailable(available);
        if (available) {
          try {
            const stored = localStorage.getItem(TRANSLATION_PROVIDER_STORAGE_KEY);
            if (stored !== "chrome" && stored !== "api") setTranslationProvider("api");
          } catch {
            setTranslationProvider("api");
          }
        }
      })
      .catch(() => setIsTranslationApiAvailable(false));
  }, []);

  const setTranslationProviderAndSave = useCallback((value: "chrome" | "api") => {
    setTranslationProvider(value);
    try {
      localStorage.setItem(TRANSLATION_PROVIDER_STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  // Server-side translation via API (DeepL etc.)
  const translateViaApi = useCallback(
    async (text: string): Promise<string> => {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceLanguage,
          targetLanguage,
          text: text.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Translation failed: ${res.status}`);
      }
      const data = (await res.json()) as { translatedText?: string };
      return data.translatedText ?? text;
    },
    [sourceLanguage, targetLanguage]
  );

  // Create translator when target language or source language changes (Chrome only)
  useEffect(() => {
    if (translationProvider !== "chrome") return;
    // Abort any in-flight translation when this effect re-runs or unmounts
    translatorAbortRef.current?.abort();
    const controller = new AbortController();
    translatorAbortRef.current = controller;
    const signal = controller.signal;

    const createTranslator = async () => {
      // Clean up existing translator
      if (translatorRef.current) {
        translatorRef.current.destroy();
        translatorRef.current = null;
      }

      // Reset states
      setTranslationError("");
      setDownloadProgress(null);
      setTranslatedCaptions(new Map());
      setTranslatedPartialText("");

      // If no translation or not supported, return
      if (targetLanguage === "none" || !isTranslatorSupported) {
        return;
      }

      try {
        setIsTranslating(true);

        // Check availability before creating (avoids NotSupportedError when pair is unsupported)
        const availability = await window.Translator!.availability({
          sourceLanguage: sourceLanguage,
          targetLanguage: targetLanguage,
        });

        console.log(
          `Translator availability for ${sourceLanguage} -> ${targetLanguage}:`,
          availability
        );

        if (availability === "no") {
          const sourceName =
            LANGUAGES.find((l) => l.code === sourceLanguage)?.name ?? sourceLanguage;
          const targetName =
            LANGUAGES.find((l) => l.code === targetLanguage)?.name ?? targetLanguage;
          setTranslationError(
            `${sourceName} → ${targetName} isn't supported by your browser's built-in translator. Try selecting English or another target language.`
          );
          setIsTranslating(false);
          return;
        }

        // Create the translator with download progress monitoring
        const translator = await window.Translator!.create({
          sourceLanguage: sourceLanguage,
          targetLanguage: targetLanguage,
          monitor: (m) => {
            m.addEventListener("downloadprogress", (e) => {
              const progress = Math.round(e.loaded * 100);
              console.log(`Translation model download: ${progress}%`);
              setDownloadProgress(progress);
            });
          },
        });

        if (signal.aborted) {
          translator.destroy();
          return;
        }

        translatorRef.current = translator;
        setDownloadProgress(null);

        // Translate existing captions (respects abort so we don't setState after unmount)
        await translateExistingCaptions(translator, signal);

        if (!signal.aborted) setIsTranslating(false);
      } catch (error) {
        if (signal.aborted || (error instanceof Error && error.name === "AbortError")) {
          return;
        }
        console.error("Error creating translator:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        const isUnsupportedPair =
          message.includes("Unable to create translator for the given source and target language") ||
          (error instanceof Error && error.name === "NotSupportedError");
        if (isUnsupportedPair) {
          const sourceName =
            LANGUAGES.find((l) => l.code === sourceLanguage)?.name ?? sourceLanguage;
          const targetName =
            LANGUAGES.find((l) => l.code === targetLanguage)?.name ?? targetLanguage;
          setTranslationError(
            `${sourceName} → ${targetName} isn't supported by your browser's built-in translator. Try selecting English or another target language.`
          );
        } else {
          setTranslationError(`Failed to initialize translator: ${message}`);
        }
        setIsTranslating(false);
        setDownloadProgress(null);
      }
    };

    createTranslator();

    // Cleanup on unmount or language change: abort first, then destroy translator
    return () => {
      controller.abort();
      if (translatorRef.current) {
        translatorRef.current.destroy();
        translatorRef.current = null;
      }
      translatorAbortRef.current = null;
    };
  }, [translationProvider, targetLanguage, sourceLanguage, isTranslatorSupported, captions]);

  // API translation: when provider is "api", translate all captions and set up partial
  useEffect(() => {
    if (translationProvider !== "api" || targetLanguage === "none" || !isTranslationApiAvailable) {
      if (translationProvider === "api") {
        setTranslatedCaptions(new Map());
        setTranslatedPartialText("");
        setTranslationError("");
      }
      return;
    }

    let cancelled = false;

    const run = async () => {
      setTranslationError("");
      setTranslatedPartialText("");
      setIsTranslating(true);
      const newTranslations = new Map<string, string>();
      try {
        for (const caption of captions) {
          if (cancelled) return;
          try {
            const translated = await translateViaApi(caption.text);
            if (cancelled) return;
            newTranslations.set(caption.id, translated);
          } catch (e) {
            console.error("API translate caption:", e);
          }
        }
        if (!cancelled) setTranslatedCaptions(newTranslations);
      } catch (e) {
        if (!cancelled)
          setTranslationError(e instanceof Error ? e.message : "Translation API failed.");
      } finally {
        if (!cancelled) setIsTranslating(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [translationProvider, targetLanguage, isTranslationApiAvailable, captions, translateViaApi]);

  // Translate new captions as they arrive (API path)
  useEffect(() => {
    if (
      translationProvider !== "api" ||
      targetLanguage === "none" ||
      !isTranslationApiAvailable ||
      captions.length === 0
    ) {
      return;
    }

    const lastCaption = captions[captions.length - 1];
    if (translatedCaptions.has(lastCaption.id)) return;

    let cancelled = false;
    translateViaApi(lastCaption.text)
      .then((translated) => {
        if (cancelled) return;
        setTranslatedCaptions((prev) => {
          const next = new Map(prev);
          next.set(lastCaption.id, translated);
          return next;
        });
      })
      .catch((e) => {
        if (!cancelled) console.error("API translate new caption:", e);
      });
    return () => {
      cancelled = true;
    };
  }, [translationProvider, targetLanguage, isTranslationApiAvailable, captions, translatedCaptions, translateViaApi]);

  // Translate partial text with debouncing (API path)
  useEffect(() => {
    if (
      translationProvider !== "api" ||
      targetLanguage === "none" ||
      !isTranslationApiAvailable ||
      !partialText
    ) {
      setTranslatedPartialText("");
      return;
    }

    const timeoutId = setTimeout(() => {
      translateViaApi(partialText)
        .then(setTranslatedPartialText)
        .catch(() => setTranslatedPartialText(""));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [translationProvider, targetLanguage, isTranslationApiAvailable, partialText, translateViaApi]);

  // Function to translate existing captions (honors abort signal to avoid setState after unmount)
  const translateExistingCaptions = async (
    translator: Translator,
    signal?: AbortSignal
  ) => {
    const newTranslations = new Map<string, string>();

    for (const caption of captions) {
      if (signal?.aborted) break;
      try {
        const translated = await translator.translate(caption.text);
        if (signal?.aborted) break;
        newTranslations.set(caption.id, translated);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error(`Error translating caption ${caption.id}:`, error);
      }
    }

    if (!signal?.aborted) setTranslatedCaptions(newTranslations);
  };

  // Floating pop-up drag handlers
  const handleFloatingPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, input, label")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startLeft: floatingPosition.x,
      startTop: floatingPosition.y,
    };
  }, [floatingPosition.x, floatingPosition.y]);

  const handleFloatingPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    setFloatingPosition({
      x: dragStartRef.current.startLeft + (e.clientX - dragStartRef.current.x),
      y: dragStartRef.current.startTop + (e.clientY - dragStartRef.current.y),
    });
  }, []);

  const handleFloatingPointerUp = useCallback((e: React.PointerEvent) => {
    if (dragStartRef.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      dragStartRef.current = null;
    }
  }, []);

  // Translate new captions as they arrive (Chrome only)
  useEffect(() => {
    if (
      translationProvider !== "chrome" ||
      !translatorRef.current ||
      targetLanguage === "none" ||
      captions.length === 0
    ) {
      return;
    }

    const translateNewCaption = async () => {
      const lastCaption = captions[captions.length - 1];

      // Check if we already have a translation for this caption
      if (translatedCaptions.has(lastCaption.id)) {
        return;
      }

      try {
        const translated = await translatorRef.current!.translate(
          lastCaption.text
        );
        if (translatorAbortRef.current?.signal.aborted) return;
        setTranslatedCaptions((prev) => {
          const newMap = new Map(prev);
          newMap.set(lastCaption.id, translated);
          return newMap;
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Error translating new caption:", error);
      }
    };

    translateNewCaption();
  }, [translationProvider, captions, targetLanguage, translatedCaptions]);

  // Translate partial text with debouncing (Chrome only)
  useEffect(() => {
    if (
      translationProvider !== "chrome" ||
      !translatorRef.current ||
      targetLanguage === "none" ||
      !partialText
    ) {
      setTranslatedPartialText("");
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const translated = await translatorRef.current!.translate(partialText);
        if (translatorAbortRef.current?.signal.aborted) return;
        setTranslatedPartialText(translated);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Error translating partial text:", error);
        setTranslatedPartialText("");
      }
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timeoutId);
  }, [translationProvider, partialText, targetLanguage]);

  // Subtitle-style: background opacity only (slider 0.3–1 → bar darkness). Text stays readable.
  const subtitleBgAlpha = 0.85 * floatingOpacity;
  const subtitleBg = `rgba(0, 0, 0, ${subtitleBgAlpha})`;

  // Last 15 words from captions + partial (for overlay display)
  const last15Words = (() => {
    const parts: string[] = captions.map((c) =>
      targetLanguage !== "none" && translatedCaptions.has(c.id)
        ? translatedCaptions.get(c.id)!
        : c.text
    );
    if (partialText) {
      parts.push(
        targetLanguage !== "none" && translatedPartialText
          ? translatedPartialText
          : partialText
      );
    }
    const full = parts.join(" ").trim();
    const words = full ? full.split(/\s+/).filter(Boolean) : [];
    return words.length <= 15 ? full : words.slice(-15).join(" ");
  })();

  // Popup window: minimal UI, transparent so you see video behind; bar = subtitle overlay
  if (isPopupMode) {
    return (
      <div
        className="flex h-screen flex-col text-white"
        onMouseMove={showOverlayControls}
      >
        {/* Control bar – auto-hides; hover top edge to show again */}
        {overlayControlsVisible ? (
          <div
            className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3 py-1.5"
            style={{ background: subtitleBg }}
          >
            <span className="text-xs font-medium text-white/90">Live translation</span>
            <div className="flex items-center gap-2">
              {isTranslatorSupported && (
                <div className="w-[120px]">
                  <LanguageSelector
                    value={targetLanguage}
                    onValueChange={(code) => setTargetLanguage(code || "none")}
                    disabled={isTranslating}
                    defaultOption={{ value: "none", label: "Original" }}
                  />
                </div>
              )}
              <input
                type="range"
                min="0.3"
                max="1"
                step="0.05"
                value={floatingOpacity}
                onChange={(e) => setFloatingOpacity(Number(e.target.value))}
                className="h-1 w-12 accent-white"
                title="See-through"
              />
              <button
                type="button"
                onClick={toggleFullscreen}
                className="rounded p-1 text-white/70 hover:bg-white/15 hover:text-white"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen (hide address bar)"}
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        ) : (
          <div
            className="h-1.5 shrink-0 cursor-pointer rounded-t-sm"
            style={{ background: subtitleBg }}
            onMouseEnter={showOverlayControls}
            title="Hover to show controls"
          />
        )}
        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
          style={{ background: subtitleBg }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-white/50" />
            </div>
          ) : captions.length === 0 && !partialText ? (
            <p className="text-center text-sm text-white/50 py-8">Waiting for translation…</p>
          ) : (
            <div className="text-base leading-relaxed text-white antialiased space-y-2">
              <p className="m-0">{last15Words || "\u00a0"}</p>
              {idleMessageVisible && (
                <p className="m-0 text-xs text-white/60">No sound detected — check the mic or speak.</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Same-page embed: video + caption overlay in one tab – true see-through to the video
  if (embedVideoUrl) {
    const embedSrc = embedVideoUrl.startsWith("http")
      ? embedVideoUrl
      : `https://www.youtube.com/embed/${embedVideoUrl.replace(/.*(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+).*/, "$1")}`;
    return (
      <div className="fixed inset-0 z-0 flex flex-col bg-black">
        <iframe
          src={embedSrc}
          title="Video"
          className="absolute inset-0 w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        {/* Subtitle overlay on top of video – draggable, see-through background */}
        <div
          className="fixed z-50 flex flex-col rounded-xl border border-white/20 text-white shadow-xl w-[420px] max-h-[50vh]"
          style={{
            ...(embedOverlayPosition
              ? { left: embedOverlayPosition.x, top: embedOverlayPosition.y }
              : { bottom: 24, right: 24 }),
            background: subtitleBg,
          }}
          onMouseMove={showOverlayControls}
        >
          {overlayControlsVisible ? (
            <div
              className="flex cursor-grab active:cursor-grabbing shrink-0 items-center justify-between gap-3 rounded-t-xl border-b border-white/10 px-3 py-1.5"
              style={{ background: subtitleBg }}
              onPointerDown={handleEmbedOverlayPointerDown}
              onPointerMove={handleEmbedOverlayPointerMove}
              onPointerUp={handleEmbedOverlayPointerUp}
              onPointerLeave={handleEmbedOverlayPointerUp}
            >
              <span className="text-xs font-medium text-white/90">Live translation</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.3"
                  max="1"
                  step="0.05"
                  value={floatingOpacity}
                  onChange={(e) => setFloatingOpacity(Number(e.target.value))}
                  className="h-1 w-12 accent-white"
                  title="See-through"
                />
                <button
                  type="button"
                  onClick={() => setEmbedVideoUrl(null)}
                  className="rounded p-1 text-white/70 hover:bg-white/15"
                  title="Exit overlay"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div
              className="h-1.5 shrink-0 cursor-pointer rounded-t-xl"
              style={{ background: subtitleBg }}
              onMouseEnter={showOverlayControls}
              onPointerDown={handleEmbedOverlayPointerDown}
              onPointerMove={handleEmbedOverlayPointerMove}
              onPointerUp={handleEmbedOverlayPointerUp}
              onPointerLeave={handleEmbedOverlayPointerUp}
              title="Hover to show controls"
            />
          )}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 max-h-[280px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-white/50" />
              </div>
            ) : captions.length === 0 && !partialText ? (
              <p className="text-center text-sm text-white/50 py-4">Waiting for translation…</p>
            ) : (
              <div className="text-base leading-relaxed text-white antialiased space-y-2">
                <p className="m-0">{last15Words || "\u00a0"}</p>
                {idleMessageVisible && (
                  <p className="m-0 text-xs text-white/60">No sound detected — check the mic or speak.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* In-page floating overlay: subtitle bar over video – background opacity only so you see through */}
      {isFloating && (
        <div
          className="fixed z-50 flex flex-col rounded-xl border border-white/10 text-white shadow-xl"
          style={{
            left: floatingPosition.x,
            top: floatingPosition.y,
            width: floatingSize.current.w,
            height: floatingSize.current.h,
            background: subtitleBg,
          }}
          onMouseMove={showOverlayControls}
        >
          {overlayControlsVisible ? (
            <div
              className="flex cursor-grab active:cursor-grabbing items-center justify-between gap-3 rounded-t-xl border-b border-white/10 px-3 py-1.5"
              style={{ background: subtitleBg }}
              onPointerDown={handleFloatingPointerDown}
              onPointerMove={handleFloatingPointerMove}
              onPointerUp={handleFloatingPointerUp}
              onPointerLeave={handleFloatingPointerUp}
            >
              <div className="flex items-center gap-2 text-xs font-medium text-white/90">
                <GripVertical className="h-3.5 w-3.5 text-white/60" />
                <span>Live translation</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.3"
                  max="1"
                  step="0.05"
                  value={floatingOpacity}
                  onChange={(e) => setFloatingOpacity(Number(e.target.value))}
                  className="h-1 w-12 accent-white"
                  onClick={(e) => e.stopPropagation()}
                  title="See-through"
                />
                <button
                  type="button"
                  onClick={() => setIsFloating(false)}
                  className="rounded p-1 text-white/70 hover:bg-white/15 hover:text-white"
                  title="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div
              className="h-1.5 shrink-0 cursor-pointer rounded-t-xl"
              style={{ background: subtitleBg }}
              onMouseEnter={showOverlayControls}
              onPointerDown={handleFloatingPointerDown}
              onPointerMove={handleFloatingPointerMove}
              onPointerUp={handleFloatingPointerUp}
              onPointerLeave={handleFloatingPointerUp}
              title="Hover to show controls"
            />
          )}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-white/50" />
              </div>
            ) : captions.length === 0 && !partialText ? (
              <p className="text-center text-sm text-white/50 py-6">Waiting for translation…</p>
            ) : (
              <div className="text-base leading-relaxed text-white antialiased space-y-2">
                <p className="m-0">{last15Words || "\u00a0"}</p>
                {idleMessageVisible && (
                  <p className="m-0 text-xs text-white/60">No sound detected — check the mic or speak.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Event Info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <CardTitle className="text-2xl">{event.title}</CardTitle>
                <Badge variant="outline" className="gap-1">
                  <Eye className="h-3 w-3" />
                  Viewer
                </Badge>
              </div>
              {event.description && (
                <CardDescription className="text-base">
                  {event.description}
                </CardDescription>
              )}
            </div>
          </div>

          {/* Language Selector */}
          {(isTranslatorSupported || isTranslationApiAvailable) && (
            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Languages className="h-4 w-4" />
                  <span>Translation:</span>
                </div>
                {isTranslatorSupported && isTranslationApiAvailable && (
                  <select
                    value={translationProvider}
                    onChange={(e) =>
                      setTranslationProviderAndSave(e.target.value as "chrome" | "api")
                    }
                    className="h-8 rounded-md border bg-background px-2 text-sm"
                    title="Chrome = on-device (Chrome 138+). API = server (DeepL etc.)."
                  >
                    <option value="chrome">Chrome (on-device)</option>
                    <option value="api">API (server)</option>
                  </select>
                )}
                {isTranslationApiAvailable && !isTranslatorSupported && (
                  <span className="text-xs text-muted-foreground">API (server)</span>
                )}
                <div className="w-[250px]">
                  <LanguageSelector
                    value={targetLanguage}
                    onValueChange={(code) => setTargetLanguage(code || "none")}
                    disabled={isTranslating}
                    defaultOption={{
                      value: "none",
                      label: "Original (No Translation)",
                    }}
                  />
                </div>
                {isTranslating && (
                  <Badge variant="outline" className="gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {translationProvider === "chrome" && downloadProgress !== null
                      ? `Downloading model ${downloadProgress}%`
                      : "Translating..."}
                  </Badge>
                )}
              </div>
              {sourceLanguage && sourceLanguage !== "en" && (
                <div className="text-xs text-muted-foreground ml-6">
                  Detected source language: {sourceLanguage.toUpperCase()}
                </div>
              )}
            </div>
          )}

          {/* Translation Error */}
          {translationError && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{translationError}</AlertDescription>
            </Alert>
          )}

          {/* Browser / API Not Supported Message */}
          {!isTranslatorSupported && !isTranslationApiAvailable && (
            <Alert className="mt-4">
              <AlertDescription>
                Translation is not available in your browser. Please use Chrome
                138+ with the built-in AI features enabled to access live
                translation.{" "}
                <a
                  href="https://developer.chrome.com/docs/ai/translator-api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  Learn more
                </a>
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>
      </Card>

      {/* Embed over video (same page) – true see-through to video, no second window */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Use as subtitles over video</CardTitle>
          <CardDescription>
            Put captions over a video on this page. The bar is see-through so you see the video behind it. No second window.
          </CardDescription>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">Video URL (YouTube or embed URL)</label>
              <input
                type="url"
                placeholder="https://www.youtube.com/watch?v=… or https://www.youtube.com/embed/…"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const url = (e.target as HTMLInputElement).value.trim();
                    if (url) setEmbedVideoUrl(url);
                  }
                }}
                id="embed-video-url"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const input = document.getElementById("embed-video-url") as HTMLInputElement;
                const url = input?.value?.trim();
                if (url) setEmbedVideoUrl(url);
              }}
              className="rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Show caption overlay over video
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            For a floating overlay <strong>outside the browser</strong> (no minimize/maximize/close, see-through to desktop): run the{" "}
            <code className="rounded bg-muted px-1 py-0.5">caption-overlay</code> Electron app and paste this viewer URL:{" "}
            <code className="break-all rounded bg-muted px-1 py-0.5 text-xs">
              {typeof window !== "undefined" ? `${window.location.origin}/view/${event.uid}?popup=1` : `…/view/${event.uid}?popup=1`}
            </code>
          </p>
        </CardHeader>
      </Card>

      {/* Live Captions Display */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Live Captions</CardTitle>
              <CardDescription className="mt-1">
            Captions will appear here in real-time
            {targetLanguage !== "none" &&
              ` (translated to ${
                LANGUAGES.find((l) => l.code === targetLanguage)?.name
              })`}
          </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Pop-out to:</span>
                <select
                  value={popoutTarget}
                  onChange={(e) =>
                    setPopoutTargetAndSave(e.target.value as "window" | "overlay")
                  }
                  className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  title="New window shows OS buttons; This page uses only a close button"
                >
                  <option value="window">New window</option>
                  <option value="overlay">This page (no window buttons)</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  if (popoutTarget === "overlay") {
                    setIsFloating(true);
                    return;
                  }
                  const url = `${window.location.origin}/view/${event.uid}?popup=1`;
                  window.open(
                    url,
                    "captions-popup",
                    "popup=yes,width=420,height=400,menubar=no,toolbar=no,location=no,status=no,resizable=yes"
                  );
                }}
                className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={
                  popoutTarget === "overlay"
                    ? "Open floating box on this page (no minimize/maximize/close bar)"
                    : "Open in a separate window (move outside browser)"
                }
              >
                <PanelTopOpen className="h-4 w-4" />
                Pop-out
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="bg-background border-2 rounded-lg p-8 min-h-[500px] flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                <p className="text-sm text-muted-foreground">
                  Loading captions...
                </p>
              </div>
            </div>
          ) : captions.length === 0 && !partialText ? (
            <div className="bg-background border-2 rounded-lg p-8 min-h-[500px] flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Eye className="h-6 w-6 text-primary" />
                </div>
                <p className="text-muted-foreground font-medium">
                  {idleMessageVisible ? "No sound detected" : showIdleMessage ? "" : "Waiting for captions..."}
                </p>
                <p className="text-sm text-muted-foreground max-w-md">
                  {idleMessageVisible
                    ? "Check the mic or speak. Captions will appear when sound is detected."
                    : showIdleMessage ? "" : "Captions will appear here automatically when the broadcaster starts"}
                </p>
              </div>
            </div>
          ) : (
            <div
              ref={scrollContainerRef}
              className="bg-background border-2 rounded-lg p-6 min-h-[500px] max-h-[600px] overflow-y-auto space-y-3"
            >
              {captions.map((caption) => {
                const timestamp = new Date(
                  caption.timestamp
                ).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });
                const displayText =
                  targetLanguage !== "none" &&
                  translatedCaptions.has(caption.id)
                    ? translatedCaptions.get(caption.id)!
                    : caption.text;

                return (
                  <div
                    key={caption.id}
                    className="p-3 rounded border bg-muted/30"
                  >
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                      <span>{timestamp}</span>
                      {targetLanguage !== "none" && (
                        <Badge
                          variant="secondary"
                          className="text-xs px-1.5 py-0"
                        >
                          <Languages className="h-2.5 w-2.5 mr-1" />
                          {LANGUAGES.find(
                            (l) => l.code === targetLanguage
                          )?.code.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    <div className="text-lg leading-relaxed">{displayText}</div>
                  </div>
                );
              })}
              {partialText && (
                <div className="p-3 rounded border border-primary/20 bg-primary/5">
                  <div className="text-xs text-primary/50 mb-1 flex items-center gap-2">
                    <span>Live</span>
                    {targetLanguage !== "none" && (
                      <Badge
                        variant="secondary"
                        className="text-xs px-1.5 py-0"
                      >
                        <Languages className="h-2.5 w-2.5 mr-1" />
                        {LANGUAGES.find(
                          (l) => l.code === targetLanguage
                        )?.code.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                  <div className="text-lg leading-relaxed italic text-primary/70">
                    {targetLanguage !== "none" && translatedPartialText
                      ? translatedPartialText
                      : partialText}
                  </div>
                </div>
              )}
              {idleMessageVisible && (
                <div className="pt-2 text-sm text-muted-foreground">
                  No sound detected — check the mic or speak.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Powered By Banner */}
      <section className="container mx-auto px-4 py-12">
        <div className="flex justify-center">
          <div className="flex items-center gap-3">
            <Badge
              variant="secondary"
              className="px-4 py-2 text-sm transition-colors hover:bg-primary/10"
            >
              <span className="text-muted-foreground">Powered by</span>
              <a
                href="https://elevenlabs.io/realtime-speech-to-text"
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <span className="ml-1.5 font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent group-hover:from-purple-500 group-hover:to-blue-500 transition-all">
                  ElevenLabs Scribe
                </span>
              </a>
              <span className="text-muted-foreground">and</span>
              <a
                href="https://supabase.com/realtime"
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <span className="ml-1.5 font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent group-hover:from-emerald-500 group-hover:to-teal-500 transition-all">
                  Supabase Realtime
                </span>
              </a>
            </Badge>
          </div>
        </div>
      </section>
    </div>
  );
}
