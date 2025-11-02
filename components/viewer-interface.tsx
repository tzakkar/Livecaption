"use client";

import { useEffect, useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Event {
  id: string;
  uid: string;
  title: string;
  description: string | null;
}

interface ViewerInterfaceProps {
  event: Event;
}

interface Caption {
  id: string;
  text: string;
  timestamp: string;
  is_final: boolean;
}

export function ViewerInterface({ event }: ViewerInterfaceProps) {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [partialText, setPartialText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const supabase = getSupabaseBrowserClient();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
        (payload: { payload: { text: string } }) => {
          console.log("Partial transcript received:", payload);
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
        </CardHeader>
      </Card>

      {/* Live Captions Display */}
      <Card>
        <CardHeader>
          <CardTitle>Live Captions</CardTitle>
          <CardDescription>
            Captions will appear here in real-time
          </CardDescription>
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
                  Waiting for captions...
                </p>
                <p className="text-sm text-muted-foreground max-w-md">
                  Captions will appear here automatically when the broadcaster
                  starts
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
                return (
                  <div
                    key={caption.id}
                    className="p-3 rounded border bg-muted/30"
                  >
                    <div className="text-xs text-muted-foreground mb-1">
                      {timestamp}
                    </div>
                    <div className="text-lg leading-relaxed">
                      {caption.text}
                    </div>
                  </div>
                );
              })}
              {partialText && (
                <div className="p-3 rounded border border-primary/20 bg-primary/5">
                  <div className="text-xs text-primary/50 mb-1">Live</div>
                  <div className="text-lg leading-relaxed italic text-primary/70">
                    {partialText}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
