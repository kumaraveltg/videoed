// App.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import "./app.css";
import VideoPlayer from "./components/VideoPlayer";
import MultiTrimSlider from "./components/MultiTrimSlider";
import YouTubePreview from "./components/YouTubePreview";
import MergePanel from "./components/MergePannel";
import Loader from "./components/Loader";
import CompositionPanel from "./components/CompositionPanel";
import TimelineKonva from "./components/TimelineKonva";
import VideoOverlayKonva from "./components/VideoOverlayKonva";
import { AUDIO_MODES ,AudioModeEngine } from "./components/AudioModeEngine";
import { debugLog, debugGroup, debugGroupEnd } from "./utils/debuggerLog";


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
  const [audioMode, setAudioMode] = useState("keep");
  const [addedAudioSrc, setAddedAudioSrc] = useState(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  
  // ✅ NEW: Track timeline scroll position
  const [timelineScrollLeft, setTimelineScrollLeft] = useState(0);

  // Refs
  const audioInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const timelineScrollRef = useRef(null);
  const videoRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const lastScrollLeft = useRef(0);
  const addedAudioRef = useRef();
  const audioEngineRef = useRef(null);
  const addedAudioFileRef = useRef(null);

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

  // ✅ Initialize audio engine ONLY when audio is added (ONE TIME) 
useEffect(() => {
  if (!addedAudioSrc || !videoRef.current || !addedAudioRef.current) {
    console.log("[AudioEngine] Waiting for audio source...");
    return;
  }

  const audio = addedAudioRef.current;
  const video = videoRef.current;

  const initEngine = () => {
    try {
      console.log("[AudioEngine] Creating engine...");
      
      // ✅ CRITICAL: Pause both elements first
      const wasPlaying = !video.paused;
      const videoTime = video.currentTime;
      
      if (wasPlaying) {
        video.pause();
      }
      
      // ✅ Sync audio to video time BEFORE creating engine
      audio.currentTime = videoTime;
      console.log("  → Synced to time:", videoTime.toFixed(2));
      
      // ✅ Wait a frame for currentTime to settle
      requestAnimationFrame(() => {
        audioEngineRef.current = new AudioModeEngine(video, audio);
        audioEngineRef.current.sync();
        audioEngineRef.current.setMode(audioMode);
        
        console.log("[AudioEngine] ✅ Engine initialized");
        
        // ✅ Resume playback if it was playing
        if (wasPlaying) {
          setTimeout(() => {
            video.play().catch(e => console.warn("Resume failed:", e));
          }, 100);
        }
      });
      
    } catch (error) {
      console.error("[AudioEngine] Failed to initialize:", error);
      if (error.message.includes("already connected")) {
        alert("Audio engine error. Please refresh the page.");
      }
    }
  };

  // Wait for audio to be ready
  if (audio.readyState >= 2) { // HAVE_CURRENT_DATA or better
    initEngine();
  } else {
    const onReady = () => {
      console.log("[AudioEngine] Audio element ready");
      initEngine();
    };
    audio.addEventListener('loadeddata', onReady, { once: true });
    
    return () => {
      audio.removeEventListener('loadeddata', onReady);
    };
  }

  return () => {
    console.log("[AudioEngine] Cleaning up engine");
    if (audioEngineRef.current) {
      if (addedAudioRef.current) {
        addedAudioRef.current.pause();
      }
    }
    audioEngineRef.current = null;
  };
}, [addedAudioSrc]);

// ✅ Apply mode changes SEPARATELY
useEffect(() => {
  console.log("[App] Mode state changed to:", audioMode);
  
  if (!audioEngineRef.current) {
    // Fallback for no engine
    if (videoRef.current) {
      const shouldMute = audioMode === AUDIO_MODES.MUTE;
      console.log(`[Fallback] Video muted: ${shouldMute}`);
      videoRef.current.muted = shouldMute;
    }
    return;
  }

  // ✅ Apply mode with delay to ensure audio element is ready
  const applyMode = () => {
    try {
      console.log("[App] Applying mode via engine:", audioMode);
      audioEngineRef.current.setMode(audioMode);
      console.log("[App] ✅ Mode applied successfully");
    } catch (error) {
      console.error("[App] Failed to apply mode:", error);
    }
  };

  // Delay ensures React state updates are complete
  const timeoutId = setTimeout(applyMode, 50);
  
  return () => clearTimeout(timeoutId);
}, [audioMode]);
  
  
  
 // ✅ HANDLE AUDIO TRACK ACTIONS
  const handleAudioTrackAction = (action, trackId) => {
    console.log("[handleAudioTrackAction] Action:", { 
      action, 
      trackId, 
      hasEngine: !!audioEngineRef.current,
      hasAudio: !!addedAudioSrc,
      currentMode: audioMode
    });
    
    switch (action) {
      case "add":
        setPendingAudioTrack(trackId);
        audioInputRef.current?.click();
        break;

      case "mute":
        console.log("🔇 Setting MUTE mode");
        setAudioMode(AUDIO_MODES.MUTE);
        break;

      case "keep":
        console.log("🎵 Setting KEEP mode");
        setAudioMode(AUDIO_MODES.KEEP);
        break;

      case "replaceMode":
        console.log("🔁 Setting REPLACE mode");
        if (!addedAudioSrc) {
          alert("⚠️ Please add an audio file first");
          return;
        }
        setAudioMode(AUDIO_MODES.REPLACE);
        break;

      case "mix":
        console.log("🎚 Setting MIX mode");
        if (!addedAudioSrc) {
          alert("⚠️ Please add an audio file first");
          return;
        }
        setAudioMode(AUDIO_MODES.MIX);
        break;

      case "split":
        if (!addedAudioSrc) {
          alert("⚠️ Please add an audio file first");
          return;
        }
        splitAudioAtPlayhead(trackId);
        break;

      case "delete":
        removeAudioTrack(trackId);
        break;

      default:
        console.warn("Unknown audio action:", action);
    }
  };



 // ✅ ADD AUDIO FILE
  const handleAddAudio = (file, trackId) => {
  console.log("[handleAddAudio] Adding audio:", file.name);
  
  const url = URL.createObjectURL(file);
  
  const audio = new Audio(url);
  audio.onloadedmetadata = () => {
    console.log("[handleAddAudio] Metadata loaded");
    console.log("  → Duration:", audio.duration);
    
    // ✅ CRITICAL: Set source FIRST, wait for React to render
    setAddedAudioSrc(url);

    addedAudioFileRef.current = file;

    // ✅ Add to tracks
    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId
          ? {
              ...track,
              actions: [
                {
                  id: Date.now().toString(),
                  start: 0,
                  end: audio.duration,
                  src: url,
                  volume: 1,
                },
              ],
            }
          : track
      )
    );
    
     

    // ✅ Switch to MIX mode after engine initializes
    setTimeout(() => {
      console.log("[handleAddAudio] Switching to MIX mode");
      setAudioMode(AUDIO_MODES.MIX);
    }, 500); // Increased delay to ensure engine is ready
  };
  
  audio.onerror = (e) => {
    console.error("[handleAddAudio] Failed to load:", e);
    alert("Failed to load audio file");
  };
};
 

//------------------- EXPORT AUDIO MODE -------------------
const handleExportAudioMode = async () => {

  if (!serverFilename) {
    alert("No video uploaded to server");
    return;
  }

  if (
    (audioMode === AUDIO_MODES.REPLACE ||
     audioMode === AUDIO_MODES.MIX) &&
    !addedAudioFileRef.current
  ) {
    alert("Please add an audio file first");
    return;
  }

  try {
    setIsProcessingAudio(true);

    let audioFilename = null;

    // ✅ upload audio FIRST
    if (
      addedAudioFileRef.current &&
      (audioMode === AUDIO_MODES.REPLACE ||
       audioMode === AUDIO_MODES.MIX)
    ) {

      const fd = new FormData();
      fd.append("file", addedAudioFileRef.current);

      const uploadRes = await fetch(
        "http://localhost:8000/upload/local",
        {
          method: "POST",
          body: fd,
        }
      );

      if (!uploadRes.ok)
        throw new Error("Audio upload failed");

      const uploadData = await uploadRes.json();

      // ✅ USE SERVER RETURNED NAME
      audioFilename = uploadData.filename;
    }

    const payload = {
      filename: serverFilename,
      mode: audioMode,
      audio_filename: audioFilename,
    };

    const response = await fetch(
      "http://localhost:8000/video/audio-control",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error);
    }

    const data = await response.json();

    setVideoSrc(data.video_url);
    setServerFilename(data.output);

    alert(`Audio ${audioMode} done`);

  } catch (err) {
    console.error(err);
    alert(err.message);
  } finally {
    setIsProcessingAudio(false);
  }
};

  // ✅ Remove audio track
 const removeAudioTrack = (trackId) => {
    console.log("[removeAudioTrack] Removing track:", trackId);
    
    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId ? { ...track, actions: [] } : track
      )
    );
    
    // Clean up audio source
    if (addedAudioSrc) {
      URL.revokeObjectURL(addedAudioSrc);
    }
    
    addedAudioFileRef.current = null;
    setAddedAudioSrc(null);
    setAudioMode(AUDIO_MODES.KEEP);
    
    // Reset engine
    audioEngineRef.current = null;
    
    // Unmute video
    if (videoRef.current) {
      videoRef.current.muted = false;
    }
    
    console.log("[removeAudioTrack] ✅ Track removed");
  };

  // ✅ Split audio at playhead
   const splitAudioAtPlayhead = (trackId) => {
    console.log("[splitAudioAtPlayhead] Splitting at:", currentTime);
    
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id !== trackId) return track;
        
        const newActions = [];
        track.actions.forEach((action) => {
          if (currentTime > action.start && currentTime < action.end) {
            // Split into two parts
            console.log(`Splitting action ${action.id} at ${currentTime}s`);
            newActions.push(
              { 
                ...action, 
                id: action.id,
                end: currentTime 
              },
              { 
                ...action, 
                id: `${action.id}-split-${Date.now()}`,
                start: currentTime 
              }
            );
          } else {
            newActions.push(action);
          }
        });
        
        console.log("[splitAudioAtPlayhead] New actions count:", newActions.length);
        return { ...track, actions: newActions };
      })
    );
  };
  
 
  
  

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
          <div style={{ position: "relative", width: videoWidthPx || 640 }}>
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
          {/* ✅ Hidden audio element */}
        {addedAudioSrc && (
          <audio
            ref={addedAudioRef}
            src={addedAudioSrc}
            style={{ display: "none" }}
            preload="auto"
            onError={(e) => console.error("[Audio Element] Load error:", e)}
            onLoadedData={() => console.log("[Audio Element] ✅ Loaded")}
          />
        )}
      </div>
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
          onAudioTrackAction={handleAudioTrackAction}
          audioMode={audioMode}
        />
      </div>
      {/* ✅ Audio Mode Indicator */}
      <div style={{ 
  marginTop: 15, 
  padding: 14, 
  background: audioEngineRef.current ? "#1e3a2e" : "#2a2a2a",
  borderRadius: 8,
  border: `2px solid ${
    audioMode === AUDIO_MODES.MUTE ? "#ef4444" :
    audioMode === AUDIO_MODES.KEEP ? "#3b82f6" :
    audioMode === AUDIO_MODES.REPLACE ? "#f59e0b" :
    "#10b981"
  }`
}}>
  {/* ... existing audio mode indicator content ... */}
</div>

{/* ✅ ADD THIS NEW SECTION RIGHT AFTER THE AUDIO MODE INDICATOR */}
<div style={{ marginTop: 20 }}>
  <button
    onClick={handleExportAudioMode}
    disabled={isProcessingAudio || !serverFilename}
    style={{
      padding: "12px 24px",
      fontSize: 16,
      fontWeight: "bold",
      background: isProcessingAudio
        ? "#6b7280"
        : audioMode === AUDIO_MODES.MUTE
        ? "#ef4444"
        : audioMode === AUDIO_MODES.KEEP
        ? "#3b82f6"
        : audioMode === AUDIO_MODES.REPLACE
        ? "#f59e0b"
        : "#10b981",
      color: "white",
      border: "none",
      borderRadius: 8,
      cursor: isProcessingAudio || !serverFilename ? "not-allowed" : "pointer",
      opacity: isProcessingAudio || !serverFilename ? 0.6 : 1,
      transition: "all 0.2s",
    }}
  >
    {isProcessingAudio ? (
      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Loader /> Processing Audio...
      </span>
    ) : (
      `🎬 Export Video with ${audioMode.toUpperCase()} Audio`
    )}
  </button>
  
  <div style={{ marginTop: 10 }}>
    {!serverFilename && (
      <p style={{ color: "#f59e0b", fontSize: 14, margin: 0 }}>
        ⚠️ Upload a video first to enable audio export
      </p>
    )}
    
    {serverFilename && !addedAudioSrc && (audioMode === AUDIO_MODES.REPLACE || audioMode === AUDIO_MODES.MIX) && (
      <p style={{ color: "#f59e0b", fontSize: 14, margin: 0 }}>
        ⚠️ Add an audio file for {audioMode.toUpperCase()} mode
      </p>
    )}
    
    {serverFilename && addedAudioSrc && (audioMode === AUDIO_MODES.REPLACE || audioMode === AUDIO_MODES.MIX) && (
      <p style={{ color: "#34d399", fontSize: 14, margin: 0 }}>
        ✅ Ready to export with {audioMode.toUpperCase()} audio
      </p>
    )}
    
    {serverFilename && audioMode === AUDIO_MODES.MUTE && (
      <p style={{ color: "#9ca3af", fontSize: 14, margin: 0 }}>
        ℹ️ Video will be exported without audio
      </p>
    )}
    
    {serverFilename && audioMode === AUDIO_MODES.KEEP && (
      <p style={{ color: "#60a5fa", fontSize: 14, margin: 0 }}>
        ℹ️ Video will keep its original audio
      </p>
    )}
  </div>
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