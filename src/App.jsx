// App.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import "./app.css";
import Upload from "./components/Upload";
import VideoPlayer from "./components/VideoPlayer";
import MultiTrimSlider from "./components/MultiTrimSlider";
import YouTubePreview from "./components/YouTubePreview";
import MergePanel from "./components/MergePannel";
import Loader from "./components/Loader";
import CompositionPanel from "./components/CompositionPanel";
import TimelineKonva from "./components/TimelineKonva";
import VideoOverlayKonva from "./components/VideoOverlayKonva";

function App() {
  // ------------------- VIDEO STATE -------------------
  const [file, setFile] = useState(null);
  const [videoSrc, setVideoSrc] = useState(null);
  const [duration, setDuration] = useState(0);
  const [videoWidthPx, setVideoWidthPx] = useState(0);
  const [videoHeightPx, setVideoHeightPx] = useState(0);
  const [trimRanges, setTrimRanges] = useState([]);
  const [trimResetKey, setTrimResetKey] = useState(0);

  const [audioSrc, setAudioSrc] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [bottomVideoSrc, setBottomVideoSrc] = useState(null);

  const [serverFilename, setServerFilename] = useState(null);
  const [mergedVideos, setMergedVideos] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const [selectedAction, setSelectedAction] = useState(null);
  const [width, setWidth] = useState(200);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isLoadingFrames, setIsLoadingFrames] = useState(false);
  
  const [currentTime, setCurrentTime] = useState(0);
  const [blobUrl, setBlobUrl] = useState(null);
  const [selectedVideoSrc, setSelectedVideoSrc] = useState(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 30 });
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [pendingAudioTrack, setPendingAudioTrack] = useState(null);
  const [pendingVideoTrack, setPendingVideoTrack] = useState(null);
  
  // ✅ NEW: Track timeline scroll position
  const [timelineScrollLeft, setTimelineScrollLeft] = useState(0);

  // Refs
  const audioInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const timelineScrollRef = useRef(null);
  const videoRef = useRef(null);
  const audioRefs = useRef({});
  const replaceAudioRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const lastScrollLeft = useRef(0);

  const PIXELS_PER_SECOND = 10;
  const timelineWidth = videoDuration * PIXELS_PER_SECOND;

  const setSelectedActionById = (id) => {
    if (!id) return setSelectedAction(null);
    const found = tracks.flatMap((t) => t.actions).find((a) => a.id === id);
    setSelectedAction(found || null);
  };

  const DEFAULT_VIDEO = "/default.mp4";
  const activeVideoSrc = selectedVideoSrc || blobUrl || videoSrc || DEFAULT_VIDEO;

  // ------------------- FILE UPLOAD -------------------
  const maxFileSizeMB = 200 * 1024 * 1024;

  const handleVideoRequest = async (file) => {
    if (!file) return;

    if (file.size > maxFileSizeMB) {
      return alert("File is too large. Please select a file under 200MB.");
    }

    if (blobUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(blobUrl);
    }

    const url = URL.createObjectURL(file);
    setBlobUrl(url);
    setFile(file);

    const formData = new FormData();
    formData.append("file", file);

    fetch("http://localhost:8000/upload/local", {
      method: "POST",
      body: formData,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Upload failed");
        return res.json();
      })
      .then((data) => {
        setServerFilename(data.filename);
        setVideoSrc(`/stream/${data.filename}`);
      })
      .catch((err) => {
        console.error("Video upload failed:", err);
        console.log("Using local playback only.");
      });
  };

  // ------------------- TIMELINE STATE -------------------
  const [tracks, setTracks] = useState([
    { id: "video-main", type: "video", actions: [] },
    { id: "track-text", type: "text", actions: [] },
    { id: "track-audio", type: "audio", actions: [] },
    { id: "track-secondvideo", type: "secondvideo", actions: [] },
    { id: "track-trim", type: "trim", actions: [] },
  ]);

  // ------------------- LOAD MERGE VIDEOS -------------------
  const loadVideosForMerge = async () => {
    try {
      const res = await fetch("http://localhost:8000/video/list");
      const data = await res.json();
      setMergedVideos(data.videos || []);
    } catch (err) {
      console.error("Failed to load video list", err);
    }
  };

  useEffect(() => {
    loadVideosForMerge();
  }, []);

  // ------------------- EXPORT TRIM -------------------
  const handleExportTrim = async () => {
    if (!serverFilename || trimRanges.length === 0) {
      alert("No file or trim ranges");
      return;
    }
    try {
      setIsProcessing(true);
      const res = await fetch("http://localhost:8000/video/trim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: serverFilename, cuts: trimRanges }),
      });
      const data = await res.json();
      setVideoSrc(data.video_url);
      setServerFilename(data.output);
      setTrimRanges([]);
      setTrimResetKey((v) => v + 1);
      alert("Trim successful!");
      loadVideosForMerge();
    } catch (err) {
      alert("Trim failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // ------------------- TEXT ACTION HANDLERS -------------------
  const handleAddAction = (trackId, startTime) => {
    const newAction = {
      id: Date.now().toString(),
      start: startTime || 0,
      end: (startTime || 0) + 3,
      type: "text",
      text: "New Text",
      fontSize: 24,
      color: "white",
      x: 0,
      y: 50,
    };
    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId
          ? { ...track, actions: [...track.actions, newAction] }
          : track
      )
    );
    setSelectedAction(newAction);
  };

  const handleUpdateAction = (actionId, updates) => {
    setTracks((prev) =>
      prev.map((track) => ({
        ...track,
        actions: track.actions.map((action) => {
          if (action.id !== actionId) return action;
          const merged = { ...action, ...updates };
          const start = Number.isFinite(Number(merged.start))
            ? Number(merged.start)
            : Number(action.start) || 0;
          let end = Number.isFinite(Number(merged.end))
            ? Number(merged.end)
            : Number(action.end);
          if (!Number.isFinite(end) || end < start) end = start + 3;
          const fontSize = Number.isFinite(Number(merged.fontSize))
            ? Number(merged.fontSize)
            : Number(action.fontSize) || 24;
          const x = Number.isFinite(Number(merged.x))
            ? Number(merged.x)
            : Number(action.x) || 0;
          const y = Number.isFinite(Number(merged.y))
            ? Number(merged.y)
            : Number(action.y) || 50;

          return { ...merged, start, end, fontSize, x, y };
        }),
      }))
    );
    setSelectedAction((prev) =>
      prev && prev.id === actionId ? { ...prev, ...updates } : prev
    );
  };

  const handleDeleteAction = (trackId, actionId) => {
    setTracks((prevTracks) =>
      prevTracks.map((t) => {
        if (t.id === trackId) {
          return { ...t, actions: t.actions.filter((a) => a.id !== actionId) };
        }
        return t;
      })
    );
  };

  useEffect(() => {
    let repaired = false;
    const newTracks = tracks.map((track) => {
      const newActions = track.actions.map((a) => {
        const start = Number.isFinite(Number(a.start)) ? Number(a.start) : 0;
        let end = Number.isFinite(Number(a.end)) ? Number(a.end) : NaN;
        if (!Number.isFinite(end) || end < start) {
          end = start + 3;
        }
        const fontSize = Number.isFinite(Number(a.fontSize))
          ? Number(a.fontSize)
          : 24;
        const x = Number.isFinite(Number(a.x)) ? Number(a.x) : 0;
        const y = Number.isFinite(Number(a.y)) ? Number(a.y) : 50;

        if (
          start !== a.start ||
          end !== a.end ||
          fontSize !== a.fontSize ||
          x !== a.x ||
          y !== a.y
        ) {
          repaired = true;
          return { ...a, start, end, fontSize, x, y };
        }
        return a;
      });
      return { ...track, actions: newActions };
    });

    if (repaired) setTracks(newTracks);
  }, [tracks]);

  const handleTimelineChange = useCallback(
    (trackId, actionId, newStart, newY = null) => {
      setTracks((prev) =>
        prev.map((track) =>
          track.id !== trackId
            ? track
            : {
                ...track,
                actions: track.actions.map((a) =>
                  a.id === actionId
                    ? {
                        ...a,
                        start: newStart,
                        end: newStart + (a.end - a.start),
                        y: newY ?? a.y,
                      }
                    : a
                ),
              }
        )
      );
    },
    []
  );

  // ------------------- TEXT OVERLAY SERVER -------------------
  const getTextOverlaysPayload = () => {
    const textTrack = tracks.find((t) => t.type === "text");
    if (!textTrack) return [];
    return textTrack.actions.map((a) => ({
      text: a.text,
      start: a.start,
      end: a.end,
      fontsize: a.fontSize,
      fontcolor: a.color,
      position: "custom",
      x: a.x || 0,
      y: a.y || 50,
    }));
  };

  const handleAddTextOverlay = async () => {
    if (!serverFilename) return alert("No video selected");

    const overlays = getTextOverlaysPayload().map((o) => ({
      text: o.text,
      start: Number(o.start),
      end: Number(o.end),
      fontsize: Number(o.fontsize),
      fontcolor: o.fontcolor,
      position: o.position || "custom",
      x: Number(o.x || 0),
      y: Number(o.y || 50),
    }));

    const invalid = overlays.find(
      (o) =>
        !Number.isFinite(o.start) ||
        !Number.isFinite(o.end) ||
        !Number.isFinite(o.fontsize)
    );
    if (invalid) {
      console.error("Invalid overlay payload, aborting:", invalid, overlays);
      return alert(
        "Cannot add overlays: invalid numeric values in overlays. Check console for details."
      );
    }

    const payload = { filename: serverFilename, overlays };

    try {
      const res = await fetch("http://localhost:8000/video/add-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        alert("Text overlay added!");
        setVideoSrc(data?.video_url || videoSrc);
        setServerFilename(data?.output || serverFilename);
      } else {
        console.error("Add-text failed", res.status, data);
        alert("Failed to add overlays: " + (data?.error || res.status));
      }
    } catch (err) {
      console.error("Add-text request error", err);
      alert("API error: " + err.message);
    }
  };

  // ------------------- VIDEO UPLOAD WITH FRAMES -------------------
  const handleOnVideoUpload = async (file) => {
    setIsLoadingFrames(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:8000/upload/local", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

      const data = await res.json();

      const url = URL.createObjectURL(file);
      setBlobUrl(url);
      setFile(file);

      setServerFilename(data.filename);
      setVideoSrc(`/stream/${data.filename}`);

      const duration = data.thumbnails?.length || 0;

      setTracks((prev) =>
        prev.map((track) =>
          track.type === "video"
            ? {
                ...track,
                actions: [
                  {
                    id: "video-main",
                    start: 0,
                    end: duration,
                    allFrames: data.thumbnails || [],
                    frames: (data.thumbnails || []).slice(0, 30),
                  },
                ],
              }
            : track
        )
      );

      setVideoDuration(duration);
    } catch (err) {
      console.error("Video upload to server failed:", err);

      // Fallback: local frame extraction
      const video = document.createElement("video");
      video.src = URL.createObjectURL(file);
      video.onloadedmetadata = () => {
        const duration = video.duration;
        setVideoDuration(duration);

        setTracks((prev) =>
          prev.map((track) =>
            track.type === "video"
              ? {
                  ...track,
                  actions: [
                    {
                      id: "video-main",
                      start: 0,
                      end: duration,
                      allFrames: [],
                      frames: [],
                    },
                  ],
                }
              : track
          )
        );

        URL.revokeObjectURL(video.src);
      };

      console.log("Video loaded locally, server features disabled");
    } finally {
      setIsLoadingFrames(false);
    }
  };

  const handleAddVideoAction = (trackId, start = 0, end = 5, src = null) => {
    const newAction = {
      id: Date.now().toString(),
      start,
      end,
      type: "video",
      src,
      frames: [],
    };

    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId
          ? { ...track, actions: [...track.actions, newAction] }
          : track
      )
    );
    setSelectedVideoSrc(src);
  };

  const handleVideoFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file || !pendingVideoTrack) return;

    handleVideoRequest(file);
    handleOnVideoUpload(file);

    setPendingVideoTrack(null);
    e.target.value = "";
  };

  const handleAddVideoRequest = (trackId) => {
    setPendingVideoTrack(trackId);
    videoInputRef.current?.click();
  };

  // ------------------- VIDEO TIME UPDATE -------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, []);

  useEffect(() => {
    return () => {
      if (blobUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  // ✅ FIX #2: Improved viewport calculation with proper bounds
  useEffect(() => {
  if (videoDuration === 0) return;

  const WINDOW_SIZE = 30; // Show 30 seconds
  const HALF_WINDOW = WINDOW_SIZE / 2;
  
  // Center window around current time
  let start = currentTime - HALF_WINDOW;
  let end = currentTime + HALF_WINDOW;
  
  // Clamp to video bounds
  if (start < 0) {
    start = 0;
    end = Math.min(WINDOW_SIZE, videoDuration);
  }
  
  if (end > videoDuration) {
    end = videoDuration;
    start = Math.max(0, videoDuration - WINDOW_SIZE);
  }

  // Only update if significantly changed (prevents jitter)
  setVisibleRange((prev) => {
    const changed = Math.abs(prev.start - start) > 1 || Math.abs(prev.end - end) > 1;
    return changed ? { start: Math.floor(start), end: Math.ceil(end) } : prev;
  });
}, [currentTime, videoDuration]);

  // ✅ FIX #3: Track scroll position and sync with ruler
  useEffect(() => {
    const container = timelineScrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Update scroll position state for ruler sync
      setTimelineScrollLeft(container.scrollLeft);
      setIsUserScrolling(true);
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        setIsUserScrolling(false);
      }, 2000);

      lastScrollLeft.current = container.scrollLeft;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Auto-scroll timeline (smart edge detection)
  useEffect(() => {
    if (!timelineScrollRef.current || isUserScrolling || videoDuration === 0) return;

    const container = timelineScrollRef.current;
    const playheadX = currentTime * PIXELS_PER_SECOND;
    const containerWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;

    const leftTrigger = scrollLeft + containerWidth * 0.2;
    const rightTrigger = scrollLeft + containerWidth * 0.8;

    let targetScroll = null;

    if (playheadX < leftTrigger && scrollLeft > 0) {
      targetScroll = Math.max(0, playheadX - containerWidth * 0.4);
    } else if (playheadX > rightTrigger) {
      targetScroll = playheadX - containerWidth * 0.4;
    }

    if (targetScroll !== null && Math.abs(targetScroll - scrollLeft) > 5) {
      container.scrollTo({
        left: targetScroll,
        behavior: "smooth",
      });
    }
  }, [currentTime, isUserScrolling, PIXELS_PER_SECOND, videoDuration]);

  // ------------------- AUDIO HANDLING -------------------
  const [audioConfig, setAudioConfig] = useState({
    main: {
      mode: "keep",
      replaceSrc: null,
      volume: 1,
    },
    second: {
      mode: "keep",
      replaceSrc: null,
      volume: 1,
    },
  });

  const handleAddAudio = (file) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);

    audio.onloadedmetadata = () => {
      setTracks((prev) =>
        prev.map((track) =>
          track.type === "audio"
            ? {
                ...track,
                actions: [
                  ...track.actions,
                  {
                    id: Date.now().toString(),
                    start: 0,
                    end: audio.duration,
                    src: url,
                    volume: 1,
                    mode: "mix",
                  },
                ],
              }
            : track
        )
      );
    };
  };

  // Audio playback sync
  useEffect(() => {
    const audioTrack = tracks.find((t) => t.type === "audio");
    if (!audioTrack) return;

    audioTrack.actions.forEach((action) => {
      if (!audioRefs.current[action.id]) {
        audioRefs.current[action.id] = new Audio(action.src);
      }

      const audio = audioRefs.current[action.id];
      const active = currentTime >= action.start && currentTime <= action.end;

      if (active) {
        audio.currentTime = Math.max(0, currentTime - action.start);
        const vol = Number.isFinite(action.volume)
          ? Math.min(1, Math.max(0, action.volume))
          : 1;
        audio.volume = vol;

        if (audio.paused) {
          audio.play().catch(() => {});
        }
      } else {
        audio.pause();
      }
    });
  }, [currentTime, tracks]);

  // ------------------- RENDER -------------------
  return (
    <div style={{ padding: 20 }}>
      <h2>🎬 Video Editor</h2>

      <YouTubePreview url="" />

      <div
        style={{
          position: "relative",
          width: videoWidthPx || 640,
          height: videoHeightPx || 360,
          marginTop: 10,
          border: "2px solid #444",
        }}
      >
        {isLoadingFrames && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <Loader />
          </div>
        )}

        {!splitMode && (
          <VideoPlayer
            key={activeVideoSrc}
            ref={videoRef}
            src={activeVideoSrc}
            muted={false}
            width={videoWidthPx || 640}
            height={videoHeightPx || 360}
            controls
            preload="auto"
            onLoadedMetadata={(e) => {
              setDuration(e.target.duration);
              setVideoWidthPx(e.target.videoWidth);
              setVideoHeightPx(e.target.videoHeight);
              setVideoDuration(e.target.duration);
            }}
          />
        )}

        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: videoWidthPx || 800,
            height: videoHeightPx,
            margin: "0 auto",
            pointerEvents: selectedAction ? "auto" : "none",
          }}
        >
          {videoWidthPx > 0 && videoHeightPx > 0 && (
            <VideoOverlayKonva
              videoWidth={videoWidthPx}
              videoHeight={videoHeightPx}
              videoDuration={duration}
              tracks={tracks}
              selectedActionId={selectedAction?.id}
              setSelectedActionId={setSelectedActionById}
              onUpdateAction={handleUpdateAction}
            />
          )}

          {audioConfig.main.mode === "replace" &&
            audioConfig.main.replaceSrc && (
              <audio
                ref={replaceAudioRef}
                src={audioConfig.main.replaceSrc}
                preload="auto"
              />
            )}
        </div>

        {splitMode && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <video src={videoSrc} controls muted height={220} />
            {bottomVideoSrc && (
              <video src={bottomVideoSrc} controls muted height={220} />
            )}
          </div>
        )}
      </div>

      <input
        type="file"
        ref={audioInputRef}
        accept="audio/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file || !pendingAudioTrack) return;
          handleAddAudio(file, pendingAudioTrack);
          setPendingAudioTrack(null);
          e.target.value = "";
        }}
      />
      <input
        type="file"
        ref={videoInputRef}
        accept="video/*"
        hidden
        onChange={handleVideoFileSelect}
      />

      {/* ✅ IMPROVED: Timeline with scroll sync */}
      <div
        ref={timelineScrollRef}
        style={{
          overflowX: "auto",
          overflowY: "hidden",
          background: "#222",
          maxWidth: "100%",
          marginTop: 20,
          border: "1px solid #555",
          position: "relative",
        }}
      >
        <TimelineKonva
          tracks={tracks}
          visibleRange={visibleRange}
          videoDuration={videoDuration}
          timelinePxWidth={timelineWidth}
          width={timelineWidth}
          videoRef={videoRef}
          currentTime={currentTime}
          scrollLeft={timelineScrollLeft} // ✅ Pass scroll position
          onTimeChange={setCurrentTime}
          onChange={handleTimelineChange}
          onAddAction={handleAddAction}
          onSelectAction={setSelectedAction}
          onDeleteAction={handleDeleteAction}
          onVideoUpload={handleAddVideoAction}
          onAddAudioRequest={(trackId) => {
            setPendingAudioTrack(trackId);
            audioInputRef.current?.click();
          }}
          onAddVideoRequest={handleAddVideoRequest}
        />
      </div>

      <div style={{ marginTop: 10 }}>
        {selectedAction && selectedAction.text !== undefined && (
          <input
            value={selectedAction.text}
            onChange={(e) =>
              handleUpdateAction(selectedAction.id, { text: e.target.value })
            }
            placeholder="Edit text"
            style={{
              padding: "8px 12px",
              fontSize: 14,
              width: 300,
              border: "1px solid #555",
              borderRadius: 4,
            }}
          />
        )}
      </div>

      <button onClick={handleAddTextOverlay} style={{ marginTop: 10 }}>
        Add Text Overlays to Video
      </button>

      <MultiTrimSlider
        duration={duration}
        onRangesChange={setTrimRanges}
        resetKey={trimResetKey}
      />

      {trimRanges.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <strong>Total Trim Parts: {trimRanges.length}</strong>
          <br />
          <button
            onClick={handleExportTrim}
            disabled={isProcessing}
            style={{ marginTop: 10 }}
          >
            {isProcessing ? <Loader /> : "Export Final Video"}
          </button>
        </div>
      )}

      <hr />
      <h3>🧩 Merge Videos</h3>
      <MergePanel videos={mergedVideos} onMerged={loadVideosForMerge} />

      <CompositionPanel
        filename={serverFilename}
        onAudioSelect={(file) => setAudioSrc(URL.createObjectURL(file))}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        splitMode={splitMode}
        setSplitMode={setSplitMode}
        onBottomVideoSelect={setBottomVideoSrc}
      />
    </div>
  );
}

export default App;