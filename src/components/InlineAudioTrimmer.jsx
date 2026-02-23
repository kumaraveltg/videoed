import React, { useState, useRef, useEffect, useCallback } from "react";
import { AUDIO_MODES } from "./AudioModeEngine";

const fmt = (s) => {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, "0");
  return `${m}:${sec}`;
};

function buildWaveform(audioBuffer, bars = 100) {
  if (!audioBuffer)
    return Array.from({ length: bars }, () => 0.2 + Math.random() * 0.6);
  const data = audioBuffer.getChannelData(0);
  const step = Math.floor(data.length / bars);
  return Array.from({ length: bars }, (_, i) => {
    let sum = 0;
    for (let j = 0; j < step; j++) sum += Math.abs(data[i * step + j] || 0);
    return Math.min(1, (sum / step) * 8);
  });
}

function WaveformTrimmer({ bars, color, clipStart, clipEnd, rawDuration, onTrimChange }) {
  const containerRef = useRef(null);
  const dragging = useRef(null);

  const getTime = (clientX) => {
    const rect = containerRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return frac * rawDuration;
  };

  const handlePointerDown = (handle, e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = handle;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragging.current) return;
    e.preventDefault();
    const t = getTime(e.clientX);
    if (dragging.current === "start") {
      onTrimChange(Math.min(t, clipEnd - 0.5), clipEnd);
    } else {
      onTrimChange(clipStart, Math.max(t, clipStart + 0.5));
    }
  };

  const handlePointerUp = (e) => {
    dragging.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const startPct = rawDuration > 0 ? (clipStart / rawDuration) * 100 : 0;
  const endPct   = rawDuration > 0 ? (clipEnd   / rawDuration) * 100 : 100;

  return (
    <div ref={containerRef} style={{
      position: "relative", height: 52,
      userSelect: "none", width: "100%",
    }}>
      {/* Bars inside clipped box */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center",
        gap: 1, padding: "0 2px",
        background: "#080808", borderRadius: 4,
        overflow: "hidden",
      }}>
        {bars.map((h, i) => {
          const pct = (i / bars.length) * 100;
          const active = pct >= startPct && pct <= endPct;
          return (
            <div key={i} style={{
              flex: 1, height: `${Math.max(6, h * 100)}%`,
              background: active ? color : "#1e1e1e", borderRadius: 1,
            }} />
          );
        })}
      </div>

      {/* Muted overlays */}
      <div style={{ position: "absolute", top: 0, left: 0, width: `${startPct}%`, height: "100%", background: "rgba(0,0,0,0.78)", pointerEvents: "none", borderRadius: "4px 0 0 4px" }} />
      <div style={{ position: "absolute", top: 0, right: 0, width: `${100 - endPct}%`, height: "100%", background: "rgba(0,0,0,0.78)", pointerEvents: "none", borderRadius: "0 4px 4px 0" }} />

      {/* START handle */}
      <div
        style={{ position: "absolute", top: 0, left: `${startPct}%`, width: 28, height: "100%", transform: "translateX(-50%)", cursor: "ew-resize", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none" }}
        onPointerDown={(e) => handlePointerDown("start", e)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div style={{ width: 4, height: "70%", background: "#fff", borderRadius: 2, boxShadow: `0 0 10px ${color}`, pointerEvents: "none" }} />
        <span style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 2, fontSize: 9, color: "#fff", background: "#111", padding: "1px 4px", borderRadius: 2, fontFamily: "monospace", whiteSpace: "nowrap", pointerEvents: "none" }}>
          {fmt(clipStart)}
        </span>
      </div>

      {/* END handle */}
      <div
        style={{ position: "absolute", top: 0, left: `${endPct}%`, width: 28, height: "100%", transform: "translateX(-50%)", cursor: "ew-resize", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none" }}
        onPointerDown={(e) => handlePointerDown("end", e)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div style={{ width: 4, height: "70%", background: "#fff", borderRadius: 2, boxShadow: `0 0 10px ${color}`, pointerEvents: "none" }} />
        <span style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 2, fontSize: 9, color: "#fff", background: "#111", padding: "1px 4px", borderRadius: 2, fontFamily: "monospace", whiteSpace: "nowrap", pointerEvents: "none" }}>
          {fmt(clipEnd)}
        </span>
      </div>
    </div>
  );
}

// Per-audio waveform loader and trimmer
function AudioClipEditor({ track, color, videoDuration, onTrimChange, onRemove }) {
  const [rawDuration, setRawDuration] = useState(track.duration || 0);
  const [waveform, setWaveform]       = useState([]);
  const [clipStart, setClipStart]     = useState(track.clipStart ?? 0);
  const [clipEnd, setClipEnd]         = useState(track.clipEnd ?? track.duration ?? 0);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [mismatch, setMismatch]       = useState(null);

  useEffect(() => {
    if (!track.src) return;
    setIsAnalysing(true);
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const run = async () => {
      try {
        const res     = await fetch(track.src);
        const buf     = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(buf);
        const dur     = decoded.duration;
        setRawDuration(dur);
        setClipStart(track.clipStart ?? 0);
        setClipEnd(track.clipEnd ?? dur);
        setWaveform(buildWaveform(decoded, 100));
        onTrimChange(track.id, track.clipStart ?? 0, track.clipEnd ?? dur);
      } catch {
        setWaveform(buildWaveform(null, 100));
      } finally {
        ctx.close();
        setIsAnalysing(false);
      }
    };
    run();
  }, [track.src]);

  useEffect(() => {
    if (!rawDuration || !videoDuration) return;
    const clipped = clipEnd - clipStart;
    if (Math.abs(clipped - videoDuration) < 0.1) setMismatch("match");
    else if (clipped < videoDuration)             setMismatch("loop");
    else                                          setMismatch("trim");
  }, [clipStart, clipEnd, rawDuration, videoDuration]);

  const handleTrim = (s, e) => {
    setClipStart(s);
    setClipEnd(e);
    onTrimChange(track.id, s, e);
  };

  const resetToFull = () => handleTrim(0, rawDuration);

  const clippedDur = clipEnd - clipStart;
  const mismatchMeta = {
    loop:  { label: "⟳ loops",  bg: "#78350f", text: "#fde68a" },
    trim:  { label: "✂ trims",  bg: "#7f1d1d", text: "#fca5a5" },
    match: { label: "✓ exact",  bg: "#064e3b", text: "#6ee7b7" },
  };
  const meta = mismatch ? mismatchMeta[mismatch] : null;

  return (
    <div style={{ marginBottom: 10, background: "#111", borderRadius: 6, overflow: "hidden", border: `1px solid ${color}33` }}>
      {/* Clip header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: "#0a0a0a", borderBottom: `1px solid ${color}22` }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: "#9ca3af", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {track.name}
        </span>
        {rawDuration > 0 && (
          <>
            <span style={{ fontSize: 9, color: "#6b7280" }}>
              raw <b style={{ color: "#9ca3af" }}>{fmt(rawDuration)}</b>
            </span>
            <span style={{ fontSize: 9, color: "#6b7280" }}>
              clip <b style={{ color }}>{fmt(clippedDur)}</b>
            </span>
            {meta && (
              <span style={{ padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 700, background: meta.bg, color: meta.text }}>
                {meta.label}
              </span>
            )}
            <button onClick={resetToFull} style={{ padding: "1px 6px", background: "transparent", border: "1px solid #374151", borderRadius: 3, color: "#6b7280", fontSize: 9, cursor: "pointer" }}>
              reset
            </button>
          </>
        )}
        <button
          onClick={() => onRemove(track.id)}
          style={{ padding: "1px 6px", background: "#7f1d1d", border: "none", borderRadius: 3, color: "#fca5a5", fontSize: 10, cursor: "pointer", fontWeight: 700 }}
        >
          ✕
        </button>
      </div>

      {/* Waveform */}
      <div style={{ padding: "8px 8px 20px" }}>
        {isAnalysing ? (
          <div style={{ height: 52, background: "#0a0a0a", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#4b5563", fontSize: 11 }}>
            Analysing…
          </div>
        ) : waveform.length > 0 ? (
          <WaveformTrimmer
            bars={waveform}
            color={color}
            clipStart={clipStart}
            clipEnd={clipEnd}
            rawDuration={rawDuration}
            onTrimChange={handleTrim}
          />
        ) : (
          <div style={{ height: 52, background: "#0a0a0a", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#374151", fontSize: 11 }}>
            Loading…
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function InlineAudioTrimmer({
  audioMode,
  audioTracks = [],
  videoDuration,
  onTrimChange,
  onRemoveAudio,
}) {
  const isReplaceMix = audioMode === AUDIO_MODES.REPLACE || audioMode === AUDIO_MODES.MIX;
  const color = audioMode === AUDIO_MODES.REPLACE ? "#f59e0b" : "#10b981";

  if (audioTracks.length === 0) return null;

  return (
    <div style={{ padding: "8px 8px 4px", background: "#0d0d0d", borderTop: "2px solid #333", fontFamily: "monospace", width: "100%", boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700, letterSpacing: 1 }}>
          AUDIO CLIPS
        </span>
        <span style={{ fontSize: 9, color: "#4b5563" }}>({audioTracks.length} file{audioTracks.length > 1 ? "s" : ""})</span>
        <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: isReplaceMix ? "#1a2a1a" : "#2a1a00", color: isReplaceMix ? color : "#f59e0b", marginLeft: 4 }}>
          {audioMode}
        </span>
        {!isReplaceMix && (
          <span style={{ fontSize: 9, color: "#f59e0b" }}>⚠ set mode to replace/mix to apply</span>
        )}
        <span style={{ fontSize: 9, color: "#4b5563", marginLeft: "auto" }}>
          video: <b style={{ color: "#9ca3af" }}>{fmt(videoDuration)}</b>
        </span>
      </div>

      {/* One editor per audio clip */}
      {audioTracks.map((track, i) => {
        const trackColor = i % 2 === 0 ? "#10b981" : "#6366f1";
        return (
          <AudioClipEditor
            key={track.id}
            track={track}
            color={trackColor}
            videoDuration={videoDuration}
            onTrimChange={onTrimChange}
            onRemove={onRemoveAudio}
          />
        );
      })}
    </div>
  );
}
