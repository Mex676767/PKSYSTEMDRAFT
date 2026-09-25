import { useEffect, useRef, useState } from "react";
import { Maximize, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Screen video is intentionally muted. Voice stays on the call's audio path. */
export function ScreenShareTile({
  stream,
  label,
  onStop,
  isLocalPreview = false,
}: {
  stream: MediaStream;
  label: string;
  onStop?: () => void;
  isLocalPreview?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const tile = useRef<HTMLDivElement>(null);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    let active = true;
    el.srcObject = stream;
    void el.play().then(() => { if (active) setBlocked(false); }).catch(() => { if (active) setBlocked(true); });
    return () => { active = false; el.pause(); el.srcObject = null; };
  }, [stream]);
  return <div ref={tile} className="rounded-xl overflow-hidden border border-border bg-black text-white">
    <div className="relative aspect-video flex items-center justify-center">
      <video ref={video} autoPlay muted playsInline className="w-full h-full object-contain" aria-label={label} />
      {blocked && <Button className="absolute" onClick={() => { void video.current?.play().then(() => setBlocked(false)).catch(() => setError("Playback is unavailable. Try rejoining the call.")); }}><Play className="w-4 h-4 mr-2" />Watch screen</Button>}
    </div>
    <div className="flex items-center gap-2 p-2 bg-black/80">
      <span className="text-xs flex-1 min-w-0 truncate">{label}</span>
      {onStop && <Button size="sm" variant="destructive" onClick={onStop}>Stop sharing</Button>}
      {!isLocalPreview && (
        <Button size="icon" variant="ghost" aria-label={`Fullscreen: ${label}`} onClick={() => {
          if (!tile.current?.requestFullscreen) { setError("Fullscreen is unavailable in this browser."); return; }
          void tile.current.requestFullscreen().catch(() => setError("Fullscreen couldn't open. Try again."));
        }}><Maximize className="w-4 h-4" /></Button>
      )}
    </div>
    {error && <p role="alert" className="p-2 text-xs text-amber-300">{error}</p>}
  </div>;
}
