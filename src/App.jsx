  // App.jsx
  import React, { useState, useEffect, useCallback, useRef,useMemo } from "react";
  import "./app.css";
  import VideoPlayer from "./components/VideoPlayer";
  import YouTubePreview from "./components/YouTubePreview";
  import MergePanel from "./components/MergePannel";
  import Loader from "./components/Loader"; 
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
    const [splitScreenConfig, setSplitScreenConfig] = useState({
              enabled: false,
              topVideoFilename: null,
              bottomVideoFilename: null,
              audioMode: 'top', // 'top', 'bottom', 'external', 'mute'
              externalAudioFilename: null
            });

    const [secondVideoFile, setSecondVideoFile] = useState(null);
    const [secondVideoSrc, setSecondVideoSrc] = useState(null);
    const [isProcessingSplitScreen, setIsProcessingSplitScreen] = useState(false);
    const secondVideoInputRef = useRef(null);
    const [splitMode, setSplitMode] = useState(false); 
    const [serverFilename, setServerFilename] = useState(null);
    const [mergedVideos, setMergedVideos] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedAction, setSelectedAction] = useState(null); 
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
    const [timelineScrollLeft, setTimelineScrollLeft] = useState(0);
    const [razorMode, setRazorMode] = useState(false);
    const [cuts, setCuts] = useState([]);
    const [mainVideoSource, setMainVideoSource] = useState(null);
    const [mainVideoSrc, setMainVideoSrc] = useState(null);
    const [videoOverlays, setVideoOverlays] = useState([]);
    const [selectedVideoOverlay, setSelectedVideoOverlay] = useState(null);
    const [insertVideos, setInsertVideos] = useState([]);
    const [isProcessingInsert, setIsProcessingInsert] = useState(false); 
    const [imageOverlays, setImageOverlays] = useState([]);
    const [selectedImageOverlay, setSelectedImageOverlay] = useState(null);
    const [isProcessingImages, setIsProcessingImages] = useState(false);
    const imageOverlayInputRef = useRef(null);
    


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
    const secondVideoRef = useRef(null);
    const isUploadingSecondVideoRef = useRef(false);
    const videoOverlayInputRef = useRef(null);

    const PIXELS_PER_SECOND = 10;
    const timelineWidth = videoDuration * PIXELS_PER_SECOND;

    const setSelectedActionById = (id) => {
      if (!id) return setSelectedAction(null);
      const found = tracks.flatMap((t) => t.actions).find((a) => a.id === id);
      setSelectedAction(found || null);
    };

    const DEFAULT_VIDEO = "/default.mp4";
    //const activeVideoSrc = selectedVideoSrc || blobUrl || videoSrc || DEFAULT_VIDEO;
   const activeVideoSrc = mainVideoSource  || videoSrc  || DEFAULT_VIDEO;

    // ------------------- FILE UPLOAD -------------------
    const maxFileSizeMB = 200 * 1024 * 1024;

    const handleVideoRequest = async (file) => {
      if (!file) return;

      if (file.size > maxFileSizeMB) {
        return alert("File is too large. Please select a file under 200MB.");
      }

      if (splitMode && secondVideoFile) {
        console.warn("⚠️ Attempting to upload main video while in split mode!");
        console.warn("This might be a bug - check what triggered this");
      }

      if (!splitMode && !isUploadingSecondVideoRef.current) {
          if (blobUrl?.startsWith("blob:")) {
            console.log("🗑️ Revoking old blobUrl:", blobUrl);
            URL.revokeObjectURL(blobUrl);
          }
        } else {
          console.log("🛡️ Skipping blob revocation (split mode active or second video uploading)");
        }

      const url = URL.createObjectURL(file);
      setMainVideoSource(url);
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
          setMainVideoSrc(`/stream/${data.filename}`);
          setMainVideoSource(url);
        })
        .catch((err) => {
          console.error("Video upload failed:", err);
          console.log("Using local playback only.");
        });
    };

    // ------------------- TIMELINE STATE -------------------
    const [tracks, setTracks] = useState([
      { id: "video-main", type: "video", actions: [] },
      { id: "track-video-overlay", type: "videooverlay", actions: [] },
      { id: "track-text", type: "text", actions: [] },
       { id: "track-image", type: "image", actions: [] },
      { id: "track-audio", type: "audio", actions: [] },
      { id: "track-secondvideo", type: "secondvideo", actions: [] }, 
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

    


  const handleSplit = (time) => {

    const roundedTime = Number(time.toFixed(2));

    console.log("✂️ split at", roundedTime);

    setCuts(prev => {

      // avoid duplicate cuts
      if (prev.includes(roundedTime)) {
        console.log("⚠️ cut already exists");
        return prev;
      }

      const updated = [...prev, roundedTime].sort((a,b)=>a-b);

      console.log("🪓 cuts:", updated);

      return updated;
    });

  };

  const clips = useMemo(() => {

    if (cuts.length < 2) return [];

    const result = [];

    for (let i = 0; i < cuts.length - 1; i++) {

      result.push({
        id: i,
        start: cuts[i],
        end: cuts[i + 1]
      });

    }

    console.log("🎬 derived clips:", result);

    return result;

  }, [cuts]);
  

    const handleExportTrim = async () => {
      if (!serverFilename || clips.length === 0) {
        alert("No file or trim ranges");
        return;
      }
      const payloadCuts = clips.map(c => ({
          start: c.start,
          end: c.end
        }));
        console.log("payloas,",payloadCuts);
      try {
        setIsProcessing(true);
        const res = await fetch("http://localhost:8000/video/trim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: serverFilename, cuts: payloadCuts }),
        });
        const data = await res.json(); 
        setVideoSrc(data.video_url);
        setServerFilename(data.output);
      // setClips([]);
        //setTrimResetKey((v) => v + 1);
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

      if (splitMode && secondVideoFile) {
    console.warn("⚠️ Uploading main video while in split mode!");
  }

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
        // ✅ Prevent replacing main video if it already exists
        const videoTrack = tracks.find(t => t.id === trackId);
        if (videoTrack?.actions?.length > 0) {
          console.log('⚠️ Main video already exists, ignoring button click');
          return;
        }
        
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
    
  //----------------- Split Screen - Bottom Area-----------------//
    
    useEffect(() => {
      // ✅ Only run on TRUE unmount
      return () => {
        // Check if component is actually being removed from DOM
        const isUnmounting = !document.body.contains(videoRef.current);
        
        if (isUnmounting && !splitMode && !isUploadingSecondVideoRef.current) {
          if (blobUrl?.startsWith("blob:")) {
            console.log("🗑️ Revoking blobUrl on unmount:", blobUrl);
            URL.revokeObjectURL(blobUrl);
          }
          if (mainVideoSource?.startsWith("blob:") && mainVideoSource !== blobUrl) {
            console.log("🗑️ Revoking mainVideoSource on unmount:", mainVideoSource);
            URL.revokeObjectURL(mainVideoSource);
          }
        } else {
          console.log("🛡️ Cleanup skipped - component still mounted");
        }
      };
    }, []);                //[blobUrl, mainVideoSource, splitMode]);

  const handleSecondVideoUpload = async (file) => {
  if (!file) return;

  if (file.size > maxFileSizeMB) {
    return alert("File is too large. Please select a file under 200MB.");
  }

  console.log("🎬 Starting SECOND video upload (should NOT affect main video)");
  console.log("📊 Main video state BEFORE second upload:", {
    mainVideoSource,
    blobUrl,
    videoSrc,
    serverFilename
  });
  
  isUploadingSecondVideoRef.current = true;
  setIsLoadingFrames(true);

  await new Promise(resolve => setTimeout(resolve, 0));

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
    console.log("Second video uploaded to server:", data);

    // ✅ Create blob URL for SECOND video only
    const url = URL.createObjectURL(file); 

    // ✅ CRITICAL: Set ONLY second video states
    setSecondVideoFile(file);
    setSecondVideoSrc(url);  // ✅ This should be the ONLY source update

    console.log("📊 Second video blob created:", url);
    console.log("📊 Main video state AFTER (should be unchanged):", {
      mainVideoSource,
      blobUrl,
      videoSrc,
      serverFilename
    });
    
    // Update split-screen config
    setSplitScreenConfig(prev => ({
      ...prev,
      enabled: true,
      bottomVideoFilename: data.filename
    }));
    console.log("✅ Split mode already enabled (prevents blob cleanup)");

    // Enable split mode
    setSplitMode(true);
    console.log("✅ Split mode enabled");

    // Add to secondvideo track with frames
    const duration = data.thumbnails?.length || 0;

    setTracks((prev) =>
      prev.map((track) =>
        track.id === "track-secondvideo"
          ? {
              ...track,
              actions: [
                {
                  id: "secondvideo-main",
                  start: 0,
                  end: duration,
                  allFrames: data.thumbnails || [],
                  frames: (data.thumbnails || []).slice(0, 30),
                  filename: data.filename,
                  src: url,
                },
              ],
            }
          : track
      )
    );

    console.log("✅ Second video added to track (main video should still be intact)");
    
  } catch (err) {
    console.error("Second video upload failed:", err);
    alert("Failed to upload second video: " + err.message);
    setSplitMode(false);
  } finally {
    setIsLoadingFrames(false);
    isUploadingSecondVideoRef.current = false;
  }
};

  // Handler for second video file input
  const handleSecondVideoFileSelect = (e) => {
    
    const file = e.target.files?.[0];
    if (!file) {
    // User cancelled - unblock cleanup
    console.log("❌ File selection cancelled, disabling protection");
    isUploadingSecondVideoRef.current = false;
    return;
  }

    handleSecondVideoUpload(file);
    e.target.value = "";
  };

  // Add this handler in App.jsx (after handleExportAudioMode)

  const handleExportSplitScreen = async () => {
    // Validation
    if (!serverFilename) {
      alert("⚠️ Please upload the top video first");
      return;
    }

    if (!splitScreenConfig.bottomVideoFilename) {
      alert("⚠️ Please upload the bottom video");
      return;
    }

    if (splitScreenConfig.audioMode === 'external' && !splitScreenConfig.externalAudioFilename) {
      alert("⚠️ Please upload external audio or change audio mode");
      return;
    }

    try {
      setIsProcessingSplitScreen(true);

      const payload = {
        top_video: serverFilename,
        bottom_video: splitScreenConfig.bottomVideoFilename,
        audio_mode: splitScreenConfig.audioMode,
        audio_filename: splitScreenConfig.audioMode === 'external' 
          ? splitScreenConfig.externalAudioFilename 
          : null
      };

      console.log("📤 Sending split-screen request:", payload);

      const response = await fetch("http://localhost:8000/video/split-screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Split-screen creation failed");
      }

      const data = await response.json();
      console.log("✅ Split-screen created:", data);

      // Update video source to the new split-screen video
      setVideoSrc(data.video_url);
      setServerFilename(data.output);

      alert("✅ Split-screen video created successfully!");
      loadVideosForMerge();

    } catch (err) {
      console.error("Split-screen error:", err);
      alert("❌ Failed to create split-screen: " + err.message);
    } finally {
      setIsProcessingSplitScreen(false);
    }
  };

  // Handler to remove second video
  const handleRemoveSecondVideo = () => {
    if (secondVideoSrc?.startsWith("blob:")) {
      URL.revokeObjectURL(secondVideoSrc);
    }

    setSecondVideoFile(null);
    setSecondVideoSrc(null);
    setSplitMode(false); 
    setSplitScreenConfig({
      enabled: false,
      topVideoFilename: null,
      bottomVideoFilename: null,
      audioMode: 'top',
      externalAudioFilename: null
    });

    // Clear secondvideo track
    setTracks((prev) =>
      prev.map((track) =>
        track.id === "track-secondvideo"
          ? { ...track, actions: [] }
          : track
      )
    );

    console.log("🗑️ Second video removed");
  };

  // Handler for split-screen audio mode change
  const handleSplitScreenAudioModeChange = (mode) => {
    console.log("🎵 Split-screen audio mode changed to:", mode);
    
    setSplitScreenConfig(prev => ({
      ...prev,
      audioMode: mode
    }));
  };

  // Handler for external audio upload for split-screen
  const handleSplitScreenExternalAudioUpload = async (file) => {
    if (!file || !file.type.startsWith('audio/')) {
      alert("Please select a valid audio file");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:8000/upload/local", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Audio upload failed");
      }

      const data = await res.json();
      console.log("✅ External audio uploaded:", data.filename);

      setSplitScreenConfig(prev => ({
        ...prev,
        audioMode: 'external',
        externalAudioFilename: data.filename
      }));

      alert("✅ External audio uploaded");
    } catch (err) {
      console.error("External audio upload failed:", err);
      alert("❌ Failed to upload audio: " + err.message);
    }
  };

  useEffect(() => {
    if (serverFilename) {
      setSplitScreenConfig(prev => ({
        ...prev,
        topVideoFilename: serverFilename
      }));
    }
  }, [serverFilename]);

  const handleAddSecondVideoRequest = (trackId) => {
    console.log("📹 Second video request for track:", trackId);
    isUploadingSecondVideoRef.current = true;
    secondVideoInputRef.current?.click();
  };

  // Handler for second video track actions (like remove)
  const handleSecondVideoTrackAction = (action, trackId) => {
    console.log("🎬 Second video track action:", action, trackId);
    
    if (action === "remove") {
      handleRemoveSecondVideo();
    }
  };

  //----insert Video clipls on main video  

// Handler to add a video overlay (Picture-in-Picture)
const handleAddVideoOverlay = async (file, startTime = 0) => {
  if (!file || !file.type.startsWith('video/')) {
    alert("Please select a valid video file");
    return;
  }

  console.log("📹 Adding video overlay:", file.name);
  
  try {
    // Create blob URL for preview
    const url = URL.createObjectURL(file);
    
    // Upload to server for processing
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("http://localhost:8000/upload/local", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      throw new Error("Upload failed");
    }

    const data = await res.json();
    console.log("✅ Video overlay uploaded:", data.filename);

    // Get video metadata
    const video = document.createElement('video');
    video.src = url;
    
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = reject;
    });

    const duration = video.duration;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // Calculate default overlay size (25% of main video)
    const defaultWidth = (videoWidthPx || 640) * 0.25;
    const defaultHeight = (defaultWidth / videoWidth) * videoHeight;

    // Create new overlay object
    const newOverlay = {
      id: Date.now().toString(),
      type: 'video',
      src: url,
      serverFilename: data.filename,
      start: startTime,
      end: startTime + duration,
      duration: duration,
      position: { 
        x: (videoWidthPx || 640) - defaultWidth - 20, // Bottom right corner
        y: (videoHeightPx || 360) - defaultHeight - 20 
      },
      size: { 
        width: defaultWidth, 
        height: defaultHeight 
      },
      opacity: 1,
      zIndex: videoOverlays.length + 1,
      volume: 0.5, // Default volume for overlay video
      transform: {
        rotation: 0,
        scale: 1,
      },
    };

    setVideoOverlays(prev => [...prev, newOverlay]);
    setSelectedVideoOverlay(newOverlay);

    // Add to timeline track
    setTracks((prev) =>
      prev.map((track) =>
        track.id === "track-video-overlay" // We'll create this track
          ? {
              ...track,
              actions: [
                ...track.actions,
                {
                  id: newOverlay.id,
                  start: newOverlay.start,
                  end: newOverlay.end,
                  src: url,
                  filename: data.filename,
                },
              ],
            }
          : track
      )
    );

    console.log("✅ Video overlay added successfully");
    
    // Cleanup
    URL.revokeObjectURL(video.src);

  } catch (err) {
    console.error("Failed to add video overlay:", err);
    alert("Failed to add video overlay: " + err.message);
  }
};

// Update video overlay properties
const handleUpdateVideoOverlay = (overlayId, updates) => {
  console.log("🔧 Updating video overlay:", overlayId, updates);
  
  setVideoOverlays(prev =>
    prev.map(overlay =>
      overlay.id === overlayId
        ? { ...overlay, ...updates }
        : overlay
    )
  );

  // Update selected overlay if it's the one being updated
  setSelectedVideoOverlay(prev =>
    prev && prev.id === overlayId
      ? { ...prev, ...updates }
      : prev
  );

  // Update timeline track
  setTracks(prev =>
    prev.map(track =>
      track.id === "track-video-overlay"
        ? {
            ...track,
            actions: track.actions.map(action =>
              action.id === overlayId
                ? { ...action, ...updates }
                : action
            ),
          }
        : track
    )
  );
};

// Delete video overlay
const handleDeleteVideoOverlay = (overlayId) => {
  console.log("🗑️ Deleting video overlay:", overlayId);
  
  // Find and revoke blob URL
  const overlay = videoOverlays.find(o => o.id === overlayId);
  if (overlay && overlay.src?.startsWith("blob:")) {
    URL.revokeObjectURL(overlay.src);
  }

  setVideoOverlays(prev => prev.filter(o => o.id !== overlayId));
  
  if (selectedVideoOverlay?.id === overlayId) {
    setSelectedVideoOverlay(null);
  }

  // Remove from timeline track
  setTracks(prev =>
    prev.map(track =>
      track.id === "track-video-overlay"
        ? {
            ...track,
            actions: track.actions.filter(a => a.id !== overlayId),
          }
        : track
    )
  );
};

// Handler for timeline updates
const handleVideoOverlayTimelineChange = (overlayId, newStart, newEnd) => {
  handleUpdateVideoOverlay(overlayId, {
    start: newStart,
    end: newEnd,
  });
};

// ------------------- EXPORT VIDEO OVERLAYS -------------------
const handleExportVideoOverlays = async () => {
  if (!serverFilename) {
    alert("⚠️ Please upload the main video first");
    return;
  }

  if (videoOverlays.length === 0) {
    alert("⚠️ No video overlays to export");
    return;
  }

  try {
    setIsProcessing(true);

    // Convert videoOverlays to backend format
    const inserts = videoOverlays.map(overlay => ({
      insert_filename: overlay.serverFilename,
      start_time: overlay.start,
      end_time: overlay.end,
      x: Math.round(overlay.position.x),
      y: Math.round(overlay.position.y),
      width: Math.round(overlay.size.width),
      height: Math.round(overlay.size.height),
      opacity: overlay.opacity,
      volume: overlay.volume || 0.5,
      z_index: overlay.zIndex,
      fade_in: 0.3,
      fade_out: 0.3,
      loop: false
    }));

    console.log("📤 Sending video overlay request:", {
      main_video: serverFilename,
      inserts_count: inserts.length
    });

    const response = await fetch("http://localhost:8000/video/add-multiple-inserts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        main_video: serverFilename,
        inserts: inserts,
        keep_main_audio: true,
        mix_insert_audio: false
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to add video overlays");
    }

    const data = await response.json();
    console.log("✅ Video overlays added:", data);

    // Update video source
    setVideoSrc(data.video_url);
    setServerFilename(data.output);

    alert(`✅ ${data.inserts_count} video overlay(s) added successfully!`);
    loadVideosForMerge();

  } catch (err) {
    console.error("Video overlay export error:", err);
    alert("❌ Failed to export video overlays: " + err.message);
  } finally {
    setIsProcessing(false);
  }
};


// ==================== VIDEO INSERT AT POSITION ====================
 

// Add insert video to list
const handleAddInsertVideo = async (file, position) => {
  if (!file || !file.type.startsWith('video/')) {
    alert("Please select a valid video file");
    return;
  }

  try {
    // Upload to server
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("http://localhost:8000/upload/local", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      throw new Error("Upload failed");
    }

    const data = await res.json();
    console.log("✅ Insert video uploaded:", data.filename);

    // Get video duration
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.src = url;
    
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = reject;
    });

    const duration = video.duration;
    URL.revokeObjectURL(url);

    // Add to insert list
    const newInsert = {
      id: Date.now().toString(),
      filename: data.filename,
      position: position || 0,
      duration: duration,
      name: file.name
    };

    setInsertVideos(prev => [...prev, newInsert]);
    
    alert(`✅ Insert video added at ${position}s (${duration.toFixed(2)}s duration)`);

  } catch (err) {
    console.error("Failed to add insert video:", err);
    alert("Failed to add insert video: " + err.message);
  }
};

// Export with inserts
const handleExportWithInserts = async () => {
  if (!serverFilename) {
    alert("⚠️ Please upload the main video first");
    return;
  }

  if (insertVideos.length === 0) {
    alert("⚠️ No insert videos added");
    return;
  }

  try {
    setIsProcessingInsert(true);

    const payload = {
      main_video: serverFilename,
      inserts: insertVideos.map(ins => ({
        filename: ins.filename,
        position: ins.position
      }))
    };

    console.log("📤 Sending insert request:", payload);

    const response = await fetch("http://localhost:8000/video/insert-at-position", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Insert failed");
    }

    const data = await response.json();
    console.log("✅ Video insert complete:", data);

    // Update video source
    setVideoSrc(data.video_url);
    setServerFilename(data.output);

    alert(
      `✅ Insert successful!\n\n` +
      `Original: ${data.original_duration.toFixed(2)}s\n` +
      `Final: ${data.final_duration.toFixed(2)}s\n` +
      `Added: ${(data.final_duration - data.original_duration).toFixed(2)}s`
    );

    // Clear insert list
    setInsertVideos([]);
    loadVideosForMerge();

  } catch (err) {
    console.error("Insert error:", err);
    alert("❌ Failed to insert videos: " + err.message);
  } finally {
    setIsProcessingInsert(false);
  }
};

// Update insert position
const handleUpdateInsertPosition = (id, newPosition) => {
  setInsertVideos(prev =>
    prev.map(ins =>
      ins.id === id
        ? { ...ins, position: Math.max(0, Math.min(newPosition, videoDuration)) }
        : ins
    )
  );
};

// Remove insert
const handleRemoveInsert = (id) => {
  setInsertVideos(prev => prev.filter(ins => ins.id !== id));
};



// ==================== IMAGE OVERLAY HANDLERS ====================

// Add image overlay

const handleAddImageRequest = (trackId) => {
  console.log('🖼️ Image request for track:', trackId);
  imageOverlayInputRef.current?.click();
};

const handleAddImageOverlay = async (file, startTime = 0) => {
  if (!file || !file.type.startsWith('image/')) {
    alert("Please select a valid image file");
    return;
  }

  console.log("🖼️ Adding image overlay:", file.name);
  
  try {
    // Upload to server
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("http://localhost:8000/upload/local", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      throw new Error("Upload failed");
    }

    const data = await res.json();
    console.log("✅ Image uploaded:", data.filename);

    // Create blob URL for preview
    const url = URL.createObjectURL(file);
    
    // Get image dimensions
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });

    // Calculate default size (20% of video width)
    const defaultWidth = (videoWidthPx || 640) * 0.2;
    const defaultHeight = (defaultWidth / img.width) * img.height;

    // Create new image overlay
    const newOverlay = {
      id: Date.now().toString(),
      type: 'image',
      src: url,
      serverFilename: data.filename,
      start: startTime,
      end: startTime + 5, // Default 5 second display
      position: { 
        x: 20, // Top left corner
        y: 20 
      },
      size: { 
        width: defaultWidth, 
        height: defaultHeight 
      },
      opacity: 1,
      fadeIn: 0.3,
      fadeOut: 0.3,
      originalWidth: img.width,
      originalHeight: img.height,
    };

    setImageOverlays(prev => [...prev, newOverlay]);
    setSelectedImageOverlay(newOverlay);

    // ✅ Add to timeline track with FULL overlay data
    setTracks((prev) =>
      prev.map((track) =>
        track.id === "track-image"
          ? {
              ...track,
              actions: [
                ...track.actions,
                {
                  ...newOverlay, // ✅ Include ALL overlay properties
                  filename: data.filename,
                },
              ],
            }
          : track
      )
    );

    console.log("✅ Image overlay added successfully");

  } catch (err) {
    console.error("Failed to add image overlay:", err);
    alert("Failed to add image overlay: " + err.message);
  }
};
 
// Update image overlay properties
const handleUpdateImageOverlay = (overlayId, updates) => {
  console.log("🔧 Updating image overlay:", overlayId, updates);
  
  // ✅ Update imageOverlays state
  setImageOverlays(prev =>
    prev.map(overlay =>
      overlay.id === overlayId
        ? { ...overlay, ...updates }
        : overlay
    )
  );

  // ✅ Update selected overlay
  setSelectedImageOverlay(prev =>
    prev && prev.id === overlayId
      ? { ...prev, ...updates }
      : prev
  );

  // ✅ CRITICAL: Also update tracks with the full overlay data
  setTracks(prev =>
    prev.map(track =>
      track.id === "track-image"
        ? {
            ...track,
            actions: track.actions.map(action => {
              if (action.id !== overlayId) return action;
              
              // Get the current overlay from imageOverlays
              const currentOverlay = imageOverlays.find(o => o.id === overlayId);
              if (!currentOverlay) return action;
              
              // Merge updates with current overlay data
              const updatedOverlay = { ...currentOverlay, ...updates };
              
              return {
                ...action,
                start: updatedOverlay.start,
                end: updatedOverlay.end,
                position: updatedOverlay.position,
                size: updatedOverlay.size,
                opacity: updatedOverlay.opacity,
                // Store the full overlay data in the action
                type: 'image',
                ...updates
              };
            }),
          }
        : track
    )
  );
};

// Delete image overlay
const handleDeleteImageOverlay = (overlayId) => {
  console.log("🗑️ Deleting image overlay:", overlayId);
  
  // Find and revoke blob URL
  const overlay = imageOverlays.find(o => o.id === overlayId);
  if (overlay && overlay.src?.startsWith("blob:")) {
    URL.revokeObjectURL(overlay.src);
  }

  setImageOverlays(prev => prev.filter(o => o.id !== overlayId));
  
  if (selectedImageOverlay?.id === overlayId) {
    setSelectedImageOverlay(null);
  }

  // Remove from timeline track
  setTracks(prev =>
    prev.map(track =>
      track.id === "track-image"
        ? {
            ...track,
            actions: track.actions.filter(a => a.id !== overlayId),
          }
        : track
    )
  );
};

// Export with image overlays
const handleExportImageOverlays = async () => {
  if (!serverFilename) {
    alert("⚠️ Please upload the main video first");
    return;
  }

  if (imageOverlays.length === 0) {
    alert("⚠️ No image overlays to export");
    return;
  }

  try {
    setIsProcessingImages(true);

    // Convert imageOverlays to backend format
    const overlays = imageOverlays.map(overlay => ({
      image_filename: overlay.serverFilename,
      start: overlay.start,
      end: overlay.end,
      x: Math.round(overlay.position.x),
      y: Math.round(overlay.position.y),
      width: Math.round(overlay.size.width),
      height: Math.round(overlay.size.height),
      opacity: overlay.opacity,
      fade_in: overlay.fadeIn || 0,
      fade_out: overlay.fadeOut || 0,
    }));

    console.log("📤 Sending image overlay request:", {
      filename: serverFilename,
      overlays_count: overlays.length
    });

    const response = await fetch("http://localhost:8000/video/add-image-overlays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: serverFilename,
        overlays: overlays
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to add image overlays");
    }

    const data = await response.json();
    console.log("✅ Image overlays added:", data);

    // Update video source
    setVideoSrc(data.video_url);
    setServerFilename(data.output);

    alert(`✅ ${data.overlays_count} image overlay(s) added successfully!`);
    loadVideosForMerge();

  } catch (err) {
    console.error("Image overlay export error:", err);
    alert("❌ Failed to export image overlays: " + err.message);
  } finally {
    setIsProcessingImages(false);
  }
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
            height: splitMode ? "auto" : (videoHeightPx || 360),
            marginTop: 10,
            border: "2px solid #444",
          }}
        >
          {isLoadingFrames && (
            <div
              style={{
                position: "absolute",
              //position: "relative",
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
            <div style={{ position: "relative", width: videoWidthPx || 640,display: "inline-block" }}>
            <VideoPlayer
              //key={activeVideoSrc}
              ref={videoRef}
              src={activeVideoSrc}
              muted={false}
              width={videoWidthPx || 640}
              height={videoHeightPx || 440}
              controls
              preload="auto" 
              style = {{zIndex: 1,ObjectFit:"contain",background: "#000"}}
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

        {!splitMode && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: videoWidthPx || 640,
                      height: videoHeightPx || 440,
                      pointerEvents: "auto",
                      // pointerEvents: selectedAction ? "auto" : "none",
                      zIndex: 5,
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
                        currentTime={currentTime}
                        imageOverlays={imageOverlays} 
                        onUpdateImageOverlay={handleUpdateImageOverlay}
                      />
                    )}
                  </div>
                )} 
       {splitMode && (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      width: videoWidthPx || 640,
      gap: 8,
      position: "relative",
      background: "#000"
    }}
  >
    {/* TOP VIDEO - Main Video */}
    <div style={{ position: "relative", background: "#1a1a1a" }}>
      <div style={{ 
        color: "#fff", 
        fontSize: 12, 
        margin: 0, 
        padding: "5px 10px",
        background: "#3b82f6",
        fontWeight: "bold"
      }}>
        🔝 Top Video {serverFilename && `(${serverFilename})`}
      </div>
      <video
        ref={videoRef}
        // ✅ CRITICAL: Use explicit source priority
        src={mainVideoSource || blobUrl || videoSrc}
        controls
        muted={false}
        autoPlay={false}
        playsInline
        onLoadedMetadata={(e) => {
          console.log("✅ Top video loaded in split mode:", {
            src: e.target.src,
            currentSrc: e.target.currentSrc,
            duration: e.target.duration,
            readyState: e.target.readyState
          });
          setDuration(e.target.duration);
          setVideoWidthPx(e.target.videoWidth);
          setVideoHeightPx(e.target.videoHeight);
          setVideoDuration(e.target.duration);
        }}
        onError={(e) => {
          console.error("❌ Top video failed to load:", e);
          console.log("📊 Available sources:", {
            mainVideoSource,
            blobUrl,
            videoSrc,
            serverFilename
          });
          // Try fallback sources
          if (!mainVideoSource && videoSrc) {
            console.log("🔄 Trying videoSrc as fallback");
            e.target.src = videoSrc;
          }
        }}
        onCanPlay={() => {
          console.log("✅ Top video can play");
        }}
        style={{
          width: "100%",
          height: 220,
          display: "block",
          background: "#000",
          objectFit: "contain",
        }}
      />
    </div>

    {/* BOTTOM VIDEO - Second Video */}
    {secondVideoSrc ? (
      <div style={{ position: "relative", background: "#1a1a1a" }}>
        <div style={{ 
          color: "#fff", 
          fontSize: 12, 
          margin: 0, 
          padding: "5px 10px",
          background: "#8b5cf6",
          fontWeight: "bold"
        }}>
          🔽 Bottom Video {splitScreenConfig.bottomVideoFilename && `(${splitScreenConfig.bottomVideoFilename})`}
        </div>
        <video
          ref={secondVideoRef}
          src={secondVideoSrc}
          controls
          muted={false}
          autoPlay={false}
          playsInline
          onLoadedMetadata={(e) => {
            console.log("✅ Bottom video loaded:", {
              src: e.target.src,
              currentSrc: e.target.currentSrc,
              duration: e.target.duration,
              readyState: e.target.readyState
            });
          }}
          onError={(e) => {
            console.error("❌ Bottom video failed to load:", e);
            console.log("📊 Bottom video source:", secondVideoSrc);
          }}
          onCanPlay={() => {
            console.log("✅ Bottom video can play");
          }}
          style={{
            width: "100%",
            height: 220,
            display: "block",
            background: "#000",
            objectFit: "contain",
          }}
        />
      </div>
    ) : (
      <div style={{ 
        width: "100%", 
        height: 220, 
        background: "#374151",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 10,
        color: "#9ca3af"
      }}>
        <p style={{ margin: 0, fontSize: 18 }}>⚠️ No bottom video loaded</p>
        <p style={{ margin: 0, fontSize: 14 }}>Upload a second video to enable split-screen</p>
      </div>
    )}
    
    {/* Debug Info Panel */}
    <div style={{
      padding: 10,
      background: "#1f2937",
      borderRadius: 4,
      fontSize: 11,
      color: "#9ca3af",
      fontFamily: "monospace"
    }}>
      <strong style={{ color: "#60a5fa" }}>🐛 Debug Info:</strong>
      <div>Split Mode: {splitMode ? "✅ Active" : "❌ Inactive"}</div>
      <div>Main Video Source: {mainVideoSource ? "✅ blob" : blobUrl ? "blob (fallback)" : videoSrc ? "stream" : "❌ MISSING"}</div>
      <div>Bottom Video Source: {secondVideoSrc ? "✅ blob" : "❌ none"}</div>
      <div>Server Filename: {serverFilename || "❌ none"}</div>
      <div>Bottom Filename: {splitScreenConfig.bottomVideoFilename || "❌ none"}</div>
    </div>
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
            pointerEvents: "auto"
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
            onSplit={handleSplit}
            razorMode={razorMode}
            setRazorMode={setRazorMode}
            PIXELS_PER_SECOND={PIXELS_PER_SECOND}
            clips={clips} 
            onAddSecondVideoRequest={handleAddSecondVideoRequest}
            onSecondVideoTrackAction={handleSecondVideoTrackAction}
            onAddVideoOverlay={() => { console.log('🎬 onAddVideoOverlay called');
              console.log('📎 Ref exists:', !!videoOverlayInputRef.current);
              videoOverlayInputRef.current?.click()}}  
            onDeleteVideoOverlay={handleDeleteVideoOverlay}
            serverFilename={serverFilename}
            handleAddInsertVideo={handleAddInsertVideo}
            onAddImageRequest={handleAddImageRequest} 
            onDeleteImageOverlay={handleDeleteImageOverlay} 


          />
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
        

        {clips.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <strong>Total Trim Parts: {clips.length}</strong>
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

      

  {/* ==================== SPLIT-SCREEN SECTION ==================== */}
          {splitScreenConfig.enabled && (
            <div style={{ 
              marginTop: 30, 
              padding: 20, 
              background: "#2a2a2a", 
              borderRadius: 8,
              border: "2px solid #4a5568"
            }}>
              <h3 style={{ color: "#60a5fa", marginTop: 0 }}>
                📺 Split-Screen Configuration
              </h3>

              <div style={{ marginBottom: 20 }}>
                <p style={{ color: "#d1d5db", margin: "5px 0" }}>
                  <strong>Top Video:</strong> {serverFilename || "Not uploaded"}
                </p>
                <p style={{ color: "#d1d5db", margin: "5px 0" }}>
                  <strong>Bottom Video:</strong> {splitScreenConfig.bottomVideoFilename || "Not uploaded"}
                </p>
              </div>

              {/* Audio Mode Selection */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ color: "#9ca3af", marginBottom: 10 }}>
                  🎵 Audio Source
                </h4>
                
                <div style={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  gap: 10 
                }}>
                  {[
                    { value: 'top', label: '🔝 Use Top Video Audio', color: '#3b82f6' },
                    { value: 'bottom', label: '🔽 Use Bottom Video Audio', color: '#8b5cf6' },
                    { value: 'external', label: '🎵 Use External Audio', color: '#f59e0b' },
                    { value: 'mute', label: '🔇 Mute (No Audio)', color: '#ef4444' }
                  ].map((mode) => (
                    <label
                      key={mode.value}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: 12,
                        background: splitScreenConfig.audioMode === mode.value 
                          ? `${mode.color}33` 
                          : "#1f2937",
                        border: `2px solid ${
                          splitScreenConfig.audioMode === mode.value 
                            ? mode.color 
                            : "#374151"
                        }`,
                        borderRadius: 6,
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                    >
                      <input
                        type="radio"
                        name="splitScreenAudioMode"
                        value={mode.value}
                        checked={splitScreenConfig.audioMode === mode.value}
                        onChange={(e) => handleSplitScreenAudioModeChange(e.target.value)}
                        style={{ cursor: "pointer" }}
                      />
                      <span style={{ 
                        color: "#fff", 
                        fontWeight: splitScreenConfig.audioMode === mode.value ? "bold" : "normal" 
                      }}>
                        {mode.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* External Audio Upload */}
              {splitScreenConfig.audioMode === 'external' && (
                <div style={{ 
                  marginBottom: 20, 
                  padding: 15, 
                  background: "#1f2937", 
                  borderRadius: 6 
                }}>
                  <h4 style={{ color: "#f59e0b", marginTop: 0 }}>
                    📎 Upload External Audio
                  </h4>
                  
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSplitScreenExternalAudioUpload(file);
                      e.target.value = "";
                    }}
                    style={{ marginBottom: 10 }}
                  />
                  
                  {splitScreenConfig.externalAudioFilename && (
                    <p style={{ color: "#34d399", fontSize: 14, margin: "10px 0 0 0" }}>
                      ✅ Audio uploaded: {splitScreenConfig.externalAudioFilename}
                    </p>
                  )}
                </div>
              )}

              {/* Export Button */}
              <button
                onClick={handleExportSplitScreen}
                disabled={
                  isProcessingSplitScreen || 
                  !serverFilename || 
                  !splitScreenConfig.bottomVideoFilename ||
                  (splitScreenConfig.audioMode === 'external' && !splitScreenConfig.externalAudioFilename)
                }
                style={{
                  padding: "14px 28px",
                  fontSize: 16,
                  fontWeight: "bold",
                  background: isProcessingSplitScreen
                    ? "#6b7280"
                    : "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: isProcessingSplitScreen || 
                    !serverFilename || 
                    !splitScreenConfig.bottomVideoFilename
                    ? "not-allowed" 
                    : "pointer",
                  opacity: isProcessingSplitScreen || 
                    !serverFilename || 
                    !splitScreenConfig.bottomVideoFilename
                    ? 0.6 
                    : 1,
                  transition: "all 0.2s",
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10
                }}
              >
                {isProcessingSplitScreen ? (
                  <>
                    <Loader /> Processing Split-Screen...
                  </>
                ) : (
                  "🎬 Create Split-Screen Video"
                )}
              </button>

              {/* Status Messages */}
              <div style={{ marginTop: 15 }}>
                {!serverFilename && (
                  <p style={{ color: "#f59e0b", fontSize: 14, margin: "5px 0" }}>
                    ⚠️ Upload top video first
                  </p>
                )}
                
                {serverFilename && !splitScreenConfig.bottomVideoFilename && (
                  <p style={{ color: "#f59e0b", fontSize: 14, margin: "5px 0" }}>
                    ⚠️ Upload bottom video to enable split-screen
                  </p>
                )}
                
                {splitScreenConfig.audioMode === 'external' && !splitScreenConfig.externalAudioFilename && (
                  <p style={{ color: "#f59e0b", fontSize: 14, margin: "5px 0" }}>
                    ⚠️ Upload external audio file
                  </p>
                )}
                
                {serverFilename && splitScreenConfig.bottomVideoFilename && (
                  <p style={{ color: "#34d399", fontSize: 14, margin: "5px 0" }}>
                    ✅ Ready to create split-screen video
                  </p>
                )}
              </div>

              {/* Remove Second Video Button */}
              <button
                onClick={handleRemoveSecondVideo}
                style={{
                  marginTop: 15,
                  padding: "10px 20px",
                  background: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: "bold"
                }}
              >
                🗑️ Remove Bottom Video
              </button>
            </div>
          )}

          {/* Hidden file input for second video */}
          <input
            type="file"
            ref={secondVideoInputRef}
            accept="video/*"
            hidden
            onChange={handleSecondVideoFileSelect}
                  />

            {/* Insert Video  overlay */}
          <input
          type="file"
          ref={videoOverlayInputRef}
          accept="video/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            handleAddVideoOverlay(file, currentTime);
            e.target.value = "";
          }}
        />

        {/* ==================== VIDEO OVERLAY EXPORT SECTION ==================== */}
        {videoOverlays.length > 0 && (
          <div style={{ 
            marginTop: 30, 
            padding: 20, 
            background: "#2a2a2a", 
            borderRadius: 8,
            border: "2px solid #3b82f6"
          }}>
            <h3 style={{ color: "#60a5fa", marginTop: 0 }}>
              📹 Video Overlays ({videoOverlays.length})
            </h3>

            <div style={{ marginBottom: 20 }}>
              {videoOverlays.map((overlay, idx) => (
                <div key={overlay.id} style={{
                  padding: 10,
                  marginBottom: 10,
                  background: "#1f2937",
                  borderRadius: 6,
                  color: "#d1d5db",
                  fontSize: 14
                }}>
                  <strong>Overlay {idx + 1}:</strong> {overlay.serverFilename}
                  <br />
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>
                    Time: {overlay.start.toFixed(2)}s - {overlay.end.toFixed(2)}s | 
                    Position: ({Math.round(overlay.position.x)}, {Math.round(overlay.position.y)}) | 
                    Z-Index: {overlay.zIndex}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handleExportVideoOverlays}
              disabled={isProcessing || !serverFilename}
              style={{
                padding: "14px 28px",
                fontSize: 16,
                fontWeight: "bold",
                background: isProcessing ? "#6b7280" : "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: isProcessing || !serverFilename ? "not-allowed" : "pointer",
                opacity: isProcessing || !serverFilename ? 0.6 : 1,
                transition: "all 0.2s",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10
              }}
            >
              {isProcessing ? (
                <>
                  <Loader /> Processing Video Overlays...
                </>
              ) : (
                "🎬 Export Video with Overlays"
              )}
            </button>

            {!serverFilename && (
              <p style={{ color: "#f59e0b", fontSize: 14, marginTop: 10 }}>
                ⚠️ Upload main video first
              </p>
            )}
          </div>
        )}
      {/* ==================== VIDEO INSERT SECTION ==================== */}
<div style={{ 
  marginTop: 30, 
  padding: 20, 
  background: "#2a2a2a", 
  borderRadius: 8,
  border: "2px solid #10b981"
}}>
  <h3 style={{ color: "#34d399", marginTop: 0 }}>
    ➕ Insert Videos at Position (Extends Timeline)
  </h3>

  <div style={{ marginBottom: 20 }}>
    <p style={{ color: "#d1d5db", fontSize: 14 }}>
      Insert videos at specific positions in your main video. The timeline will extend to accommodate all inserts.
    </p>
    <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 5 }}>
      <strong>Example:</strong> 74s main video + 9s insert at 25s = 83s final video
    </p>
  </div>

  {/* Add Insert Button */}
  <div style={{ marginBottom: 20 }}>
    <input
      type="file"
      accept="video/*"
      hidden
      id="insert-video-input"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const position = prompt(
          `Insert at what position? (0 - ${videoDuration.toFixed(2)}s)\n` +
          `Current time: ${currentTime.toFixed(2)}s`,
          currentTime.toFixed(2)
        );
        
        if (position !== null) {
          handleAddInsertVideo(file, parseFloat(position));
        }
        
        e.target.value = "";
      }}
    />
    
    <button
      onClick={() => document.getElementById('insert-video-input').click()}
      disabled={!serverFilename}
      style={{
        padding: "12px 24px",
        background: serverFilename ? "#10b981" : "#6b7280",
        color: "white",
        border: "none",
        borderRadius: 6,
        cursor: serverFilename ? "pointer" : "not-allowed",
        fontWeight: "bold"
      }}
    >
      ➕ Add Insert Video
    </button>
  </div>

          {/* Insert List */}
          {insertVideos.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ color: "#9ca3af", marginBottom: 10 }}>
                Insert Videos ({insertVideos.length})
              </h4>
              
              {insertVideos
                .sort((a, b) => a.position - b.position)
                .map((insert, idx) => (
                  <div
                    key={insert.id}
                    style={{
                      padding: 12,
                      marginBottom: 10,
                      background: "#1f2937",
                      borderRadius: 6,
                      border: "1px solid #374151"
                    }}
                  >
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8
                    }}>
                      <strong style={{ color: "#34d399" }}>
                        #{idx + 1}: {insert.name}
                      </strong>
                      
                      <button
                        onClick={() => handleRemoveInsert(insert.id)}
                        style={{
                          padding: "4px 12px",
                          background: "#ef4444",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: 12
                        }}
                      >
                        🗑️ Remove
                      </button>
                    </div>
                    
                    <div style={{ 
                      fontSize: 13, 
                      color: "#d1d5db",
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      gap: "8px 12px"
                    }}>
                      <span>Position:</span>
                      <input
                        type="number"
                        value={insert.position}
                        onChange={(e) => handleUpdateInsertPosition(insert.id, parseFloat(e.target.value))}
                        min={0}
                        max={videoDuration}
                        step={0.1}
                        style={{
                          padding: "4px 8px",
                          background: "#374151",
                          border: "1px solid #4b5563",
                          borderRadius: 4,
                          color: "#fff",
                          width: 100
                        }}
                      />
                      
                      <span>Duration:</span>
                      <span>{insert.duration.toFixed(2)}s</span>
                      
                      <span>Server File:</span>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{insert.filename}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Export Button */}
          <button
            onClick={handleExportWithInserts}
            disabled={isProcessingInsert || !serverFilename || insertVideos.length === 0}
            style={{
              padding: "14px 28px",
              fontSize: 16,
              fontWeight: "bold",
              background: isProcessingInsert || !serverFilename || insertVideos.length === 0
                ? "#6b7280"
                : "#10b981",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: isProcessingInsert || !serverFilename || insertVideos.length === 0
                ? "not-allowed"
                : "pointer",
              opacity: isProcessingInsert || !serverFilename || insertVideos.length === 0
                ? 0.6
                : 1,
              transition: "all 0.2s",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10
            }}
          >
            {isProcessingInsert ? (
              <>
                <Loader /> Processing Inserts...
              </>
            ) : (
              "🎬 Export Video with Inserts"
            )}
          </button>

          {/* Status Messages */}
          <div style={{ marginTop: 15 }}>
            {!serverFilename && (
              <p style={{ color: "#f59e0b", fontSize: 14, margin: "5px 0" }}>
                ⚠️ Upload main video first
              </p>
            )}
            
            {serverFilename && insertVideos.length === 0 && (
              <p style={{ color: "#9ca3af", fontSize: 14, margin: "5px 0" }}>
                ℹ️ Add insert videos to extend your timeline
              </p>
            )}
            
            {serverFilename && insertVideos.length > 0 && (
              <p style={{ color: "#34d399", fontSize: 14, margin: "5px 0" }}>
                ✅ Ready to export! Final duration will be approximately{" "}
                {(videoDuration + insertVideos.reduce((sum, ins) => sum + ins.duration, 0)).toFixed(2)}s
              </p>
            )}
          </div>
        </div>
          {/* ==================== IMAGE OVERLAY SECTION ==================== */}

          <input
              type="file"
              ref={imageOverlayInputRef}
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                handleAddImageOverlay(file, currentTime);
                e.target.value = "";
              }}
            />
          <div style={{ 
            marginTop: 30, 
            padding: 20, 
            background: "#2a2a2a", 
            borderRadius: 8,
            border: "2px solid #f59e0b"
          }}> 
            {/* Export Button */}
            <button
              onClick={handleExportImageOverlays}
              disabled={isProcessingImages || !serverFilename || imageOverlays.length === 0}
              style={{
                padding: "14px 28px",
                fontSize: 16,
                fontWeight: "bold",
                background: isProcessingImages || !serverFilename || imageOverlays.length === 0
                  ? "#6b7280"
                  : "#f59e0b",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: isProcessingImages || !serverFilename || imageOverlays.length === 0
                  ? "not-allowed"
                  : "pointer",
                opacity: isProcessingImages || !serverFilename || imageOverlays.length === 0
                  ? 0.6
                  : 1,
                transition: "all 0.2s",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10
              }}
            >
              {isProcessingImages ? (
                <>
                  <Loader /> Processing Image Overlays...
                </>
              ) : (
                "🎬 Export Video with Image Overlays"
              )}
            </button>  
          </div>
      <hr />
      <h3>🧩 Merge Videos</h3>
      <MergePanel videos={mergedVideos} onMerged={loadVideosForMerge} /> 
      
    </div>
  );
}

  export default App;