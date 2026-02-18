  // App.jsx
  import React, { useState, useEffect, useCallback, useRef,useMemo } from "react";
  import "../app.css"
  import VideoPlayer from "../components/VideoPlayer";
  import YouTubePreview from "../components/YouTubePreview";
  import MergePanel from "../components/MergePannel";
  import Loader from "../components/Loader"; 
  import TimelineKonva from "../components/TimelineKonva";
  import VideoOverlayKonva from "../components/VideoOverlayKonva";
  import { AUDIO_MODES ,AudioModeEngine } from "../components/AudioModeEngine";
  import UnifiedPipelineForm from "../components/UnifiedPipelineForm";
  import { debugLog, debugGroup, debugGroupEnd } from "../utils/debuggerLog";
  import {useVirtualFrames} from "../hooks/useVirtualFrames";
  import  config from "../config";


  function VideoEditor() {
    // ------------------- VIDEO STATE -------------------
    const [file, setFile] = useState(null);
    const [videoSrc, setVideoSrc] = useState(null);
    const [duration, setDuration] = useState(0);
    const [videoWidthPx, setVideoWidthPx] = useState(640);
    const [videoHeightPx, setVideoHeightPx] = useState(360); 
    const [renderedVideoWidth, setRenderedVideoWidth] = useState(640); 
    const [renderedVideoHeight, setRenderedVideoHeight] = useState(360);
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
    const [mainVideo, setMainVideo] = useState(null);
    const [timelineKey, setTimelineKey] = useState(0);
    const [pendingCut, setPendingCut] = useState(null);
  
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
    const secondVideoInputRef = useRef(null);
    const imageOverlayInputRef = useRef(null);
    const PIXELS_PER_SECOND = 10;
    const timelineWidth = videoDuration * PIXELS_PER_SECOND;
    const videoContainerRef = useRef(null);
    const timelineToVideoScale = renderedVideoWidth / (timelineWidth || 1);        

    const setSelectedActionById = (id) => {
      if (!id) return setSelectedAction(null);
      const found = tracks.flatMap((t) => t.actions).find((a) => a.id === id);
      setSelectedAction(found || null);
    };

    //const DEFAULT_VIDEO = "/default.mp4";
    //const activeVideoSrc = selectedVideoSrc || blobUrl || videoSrc || DEFAULT_VIDEO;
   const activeVideoSrc = mainVideoSource ||   videoSrc ||null;

    // ------------------- FILE UPLOAD -------------------
    const maxFileSizeMB = 200 * 1024 * 1024;
  
    const handleVideoUpload = (e) => {
  const file = e.target.files[0];
  if (file) {
    setMainVideo(file); // ✅ This should set the File object
  }
};

const calculateRenderedDimensions = (videoElement) => {
    if (!videoElement || !videoContainerRef.current) return;
    
  
  if (!videoContainerRef.current) {
    console.log('⚠️ No container ref');
    return;
  }
  
  if (!videoElement.videoWidth || !videoElement.videoHeight) {
    console.log('⚠️ Video dimensions not ready');
    return;
  }

    const containerWidth = videoContainerRef.current.clientWidth;
    const containerHeight = videoContainerRef.current.clientHeight;
    if (!containerWidth || !containerHeight) {
    console.log('⚠️ Container not rendered yet');
    return;
  }
    const videoAspectRatio = videoElement.videoWidth / videoElement.videoHeight;
    const containerAspectRatio = containerWidth / containerHeight;

    let renderedWidth, renderedHeight;

    if (videoAspectRatio > containerAspectRatio) {
      // Video is wider - constrain by width
      renderedWidth = containerWidth;
      renderedHeight = containerWidth / videoAspectRatio;
    } else {
      // Video is taller - constrain by height
      renderedHeight = containerHeight;
      renderedWidth = containerHeight * videoAspectRatio;
    }

    // ✅ ADD THIS VALIDATION BEFORE SETTING STATE
  if (!isFinite(renderedWidth) || !isFinite(renderedHeight) || 
      renderedWidth <= 0 || renderedHeight <= 0) {
    console.log('⚠️ Invalid calculated dimensions:', { renderedWidth, renderedHeight });
    return;
  }
    console.log('📐 Calculated rendered dimensions:', {
      original: { width: videoElement.videoWidth, height: videoElement.videoHeight },
      container: { width: containerWidth, height: containerHeight },
      rendered: { width: renderedWidth, height: renderedHeight }
    });

    setRenderedVideoWidth(Math.round(renderedWidth));
    setRenderedVideoHeight(Math.round(renderedHeight));
  };
   useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
  
      const resizeObserver = new ResizeObserver(() => {
        calculateRenderedDimensions(video);
      });
  
      resizeObserver.observe(video);
  
      return () => {
        resizeObserver.disconnect();
      };
    }, [videoRef.current]);

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

      fetch(`${config.API_URL}/upload/local`, {
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
        const res = await fetch(`${config.API_URL}/video/list`);
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

  if (pendingCut === null) {
    setPendingCut(roundedTime);  // ✅ First click
    console.log("✂️ First cut at:", roundedTime);
  } else {
    const start = Math.min(pendingCut, roundedTime);
    const end = Math.max(pendingCut, roundedTime);
    setCuts(prev => [...prev, start, end].sort((a, b) => a - b));
    setPendingCut(null);  // ✅ Reset after second click
    console.log("✂️ Trim range:", start, "→", end);
  }
};

  const handleDeleteClip = (clipId) => {
  // Each clip uses index as id, remove both cuts for that clip
  setCuts(prev => {
    const updated = [...prev];
    updated.splice(clipId * 2, 2);  // Remove start and end cut
    return updated;
  });
};

  const clips = useMemo(() => {

    if (cuts.length < 2) return [];

    const result = [];

    for (let i = 0; i < cuts.length - 1; i+=2)
       { 
      result.push({
        id: i/2,
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
        const res = await fetch(`${config.API_URL}/video/trim`, {
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
        end: (startTime || 0) + 10,
        type: "text",
        text: "New Text",
        fontSize: 24,
        color: "white",
        x: 50,
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
             console.log("✅ Updated action:", { id: actionId, start, end, x, y });
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
        const res = await fetch(`${config.API_URL}/video/add-text`, {
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
    //--- Virtual Frames----------

          // In your main component (App.jsx or wherever you manage state)

const frameCacheRef = useRef(new Map());
const [frameCacheVersion, setFrameCacheVersion] = useState(0);
const [loadingFrames, setLoadingFrames] = useState(new Set());
const [failedFrames, setFailedFrames] = useState(new Set());

useEffect(() => {
  return () => {
    frameCacheRef.current.forEach(url => URL.revokeObjectURL(url));
  };
}, []);

// Load frames for visible range
useEffect(() => {
  if (!serverFilename || !visibleRange) return;

  const start = Math.floor(visibleRange.start);
  const end = Math.ceil(visibleRange.end);
  
  console.log(`[useVirtualFrames] Checking range ${start}-${end}`);

  // Find frames that need loading
  const framesToLoad = [];
  for (let i = start; i <= end; i++) {
    const isLoaded = frameCacheRef.current.has(i);
    const isLoading = loadingFrames.has(i);
    const hasFailed = failedFrames.has(i);
    
    if (!isLoaded && !isLoading && !hasFailed) {
      framesToLoad.push(i);
    }
  }

  if (framesToLoad.length === 0) {
    console.log(`[useVirtualFrames] All frames in range already loaded/loading`);
    return;
  }

  console.log(`[useVirtualFrames] Loading ${framesToLoad.length} frames:`, framesToLoad);

  // Mark as loading (single update)
  setLoadingFrames(prev => {
    const next = new Set(prev);
    framesToLoad.forEach(i => next.add(i));
    return next;
  });

  // ✅ Load frames in parallel with batching
  const CONCURRENT_LOADS = 5;
  
  const loadBatch = async (batch) => {
    const results = await Promise.allSettled(
      batch.map(async (frameIndex) => {
        try {
          const url = `${config.API_URL}/video/frame/${serverFilename}/${frameIndex}`;
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          
          return { frameIndex, objectUrl, success: true };
        } catch (error) {
          console.error(`[Frame ${frameIndex}] Load failed:`, error);
          return { frameIndex, success: false, error };
        }
      })
    );

    // ✅ Collect results first (no state updates in loop)
    const successfulFrames = new Map();
    const failedFramesSet = new Set();
    const completedFrames = new Set();

    results.forEach((result, idx) => {
      const frameIndex = batch[idx];
      completedFrames.add(frameIndex);

      if (result.status === 'fulfilled' && result.value.success) {
        successfulFrames.set(frameIndex, result.value.objectUrl);
        //console.log(`[Frame ${frameIndex}] ✅ Loaded`);
      } else {
        failedFramesSet.add(frameIndex);
        console.log(`[Frame ${frameIndex}] ❌ Failed`);
      }
    });

    // ✅ Batch update: Only 3 state updates instead of N*3
    if (successfulFrames.size > 0) {
      successfulFrames.forEach((url, idx) => {
        frameCacheRef.current.set(idx, url);  // ✅ Mutate ref directly
      });
      setFrameCacheVersion(v => v + 1);  // ✅ Trigger one re-render
    }

    setLoadingFrames(prev => {
      const next = new Set(prev);
      completedFrames.forEach(idx => next.delete(idx));
      return next;
    });

    if (failedFramesSet.size > 0) {
      setFailedFrames(prev => {
        const next = new Set(prev);
        failedFramesSet.forEach(idx => next.add(idx));
        return next;
      });
    }
  };

  // ✅ Create batches and load them
  const batches = [];
  for (let i = 0; i < framesToLoad.length; i += CONCURRENT_LOADS) {
    batches.push(framesToLoad.slice(i, i + CONCURRENT_LOADS));
  }

  // ✅ Load batches sequentially to avoid overwhelming the server
  batches.forEach(batch => loadBatch(batch));

}, [visibleRange, serverFilename,]); // frameCache, loadingFrames, failedFrames
// ✅ Cleanup: Revoke object URLs when frames are removed from cache


const retryFailedFrames = () => {
  console.log(`[Retry] Clearing ${failedFrames.size} failed frames`);
  frameCacheRef.current.clear();
  setFailedFrames(new Set());
};
  

const handleOnVideoUpload = async (file) => {
  setIsLoadingFrames(true);

  if (splitMode && secondVideoFile) {
    console.warn("⚠️ Uploading main video while in split mode!");
  }

  try {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${config.API_URL}/upload/local`, {
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

    // ✅ CRITICAL FIX: Get actual video duration
    const video = document.createElement("video");
    video.src = url;
    
    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        const actualDuration = video.duration;
        console.log(`[Upload] Video duration: ${actualDuration}s`);
        
        setVideoDuration(actualDuration);  // ✅ Set global duration
        
        setTracks((prev) =>
          prev.map((track) =>
            track.type === "video"
              ? {
                  ...track,
                  actions: [
                    {
                      id: "video-main",
                      start: 0,
                      end: actualDuration,  // ✅ Use actual duration, not thumbnail count
                      useVirtualFrames: true,
                    },
                  ],
                }
              : track
          )
        );
        
        URL.revokeObjectURL(video.src);
        resolve();
      };
    });
    
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
                    useVirtualFrames: true,
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
        console.log("⏱️ timeupdate:", video.currentTime);
        setCurrentTime(video.currentTime);
      };

      video.addEventListener("timeupdate", onTimeUpdate);
      return () => video.removeEventListener("timeupdate", onTimeUpdate);
    }, [videoRef.current]);

    

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
          `${config.API_URL}/upload/local`,
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
        `${config.API_URL}/video/audio-control`,
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

    const res = await fetch(`${config.API_URL}/upload/local`, {
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

      const response = await fetch(`${config.API_URL}/video/split-screen`, {
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

      const res = await fetch(`${config.API_URL}/upload/local`, {
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

    const res = await fetch(`${config.API_URL}/upload/local`, {
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

    const response = await fetch(`${config.API_URL}/video/add-multiple-inserts`, {
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

    const res = await fetch(`${config.API_URL}/upload/local`, {
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

        const response = await fetch(`${config.API_URL}/video/insert-at-position`, {
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

    const res = await fetch(`${config.API_URL}/upload/local`, {
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

    const response = await fetch(`${config.API_URL}/video/add-image-overlays`, {
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
//--- unifiedprocesscomplete 
const handleUnifiedProcessComplete = (result) => {
  console.log('✅ Unified processing complete:', result);
  
  // Update video source to the new processed video
  setVideoSrc(result.video_url);
  setServerFilename(result.output);
  
  // Refresh video list
  //loadVideosForMerge();
  
  // Optional: Clear all edits after processing
  const clearEdits = window.confirm(
    'Processing complete! Clear all edits and start fresh?'
  );
  
  if (clearEdits) {
    // Reset timeline 
    setCuts([]);
    setVideoOverlays([]);
    setImageOverlays([]);
    setInsertVideos([]);
    
    // Reset tracks
    setTracks(prev => prev.map(track => ({
      ...track,
      actions: track.type === 'video' ? track.actions : []
    })));
    
    // Reset audio
    setAudioMode('keep');
    if (addedAudioSrc) {
      URL.revokeObjectURL(addedAudioSrc);
    }
    setAddedAudioSrc(null);
    addedAudioFileRef.current = null;
  }
};

const handleClearTimeline = () => {
  console.log('🧹 Clearing timeline...');
  
  // Clear all states
  setCuts([]);
  setVideoOverlays([]);
  setImageOverlays([]);
  setInsertVideos([]);
  setSelectedAction(null);
  setSelectedVideoOverlay(null);
  setSelectedImageOverlay(null);
  setRazorMode(false);
  
  // Clear audio
  if (addedAudioSrc && addedAudioSrc.startsWith('blob:')) {
    URL.revokeObjectURL(addedAudioSrc);
  }
  setAddedAudioSrc(null);
  setAudioMode('keep');
  addedAudioFileRef.current = null;
  audioEngineRef.current = null;
  
  setTracks(prev => prev.map(track => {
    // Keep video track completely untouched (with frames)
    if (track.type === 'video' || track.id === 'video-main') {
      console.log('✅ Preserving video track with frames:', track);
      return track;  // Don't modify video track at all
    }
    // Clear all other tracks
    console.log('🧹 Clearing track:', track.id);
    return { ...track, actions: [] };
  }));

  // Reset tracks
  setTracks(prev =>
  prev.map(track => {
    if (track.type === 'video') {
      return {
        ...track,
        actions: [],
        useVirtualFrames: false,
        src: null,
        duration: 0
      };
    }
    // ✅ IMPORTANT: keep non-video tracks valid
    return {
      ...track,
      actions: []
    };
  })
);
  
  // Unmute video
  if (videoRef.current) {
    videoRef.current.muted = false;
    videoRef.current.currentTime = 0;
  }
  // ✅ Reset visible range to start
  setVisibleRange({ start: 0, end: 30 });
  setCurrentTime(0);
  
  // ✅ Clear frame cache to force reload
  frameCacheRef.current = new Map();
  setLoadingFrames(new Set());
  setFailedFrames(new Set());
  
  // ✅ Reset current time
  setCurrentTime(0);
  // ✅ Force complete re-render by incrementing key
  setTimelineKey(prev => prev + 1);
  
  console.log('✅ Timeline cleared');
};

    // ------------------- RENDER -------------------
    return (
      <div style={{ padding: 20 }}>
        <h2>🎬 Video Editor</h2>

        <YouTubePreview url="" /> 
        
       {/* Video Container */}
<div
  ref={videoContainerRef}
  style={{
    position: "relative",
    width: 640,
    height: splitMode ? "auto" : 400,
    marginTop: 10,
    marginLeft: "auto",
    marginRight: "auto",
    border: "2px solid #444",
    background: "#000",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1
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
    (mainVideoSource || videoSrc) ? (
      <div className="editor-root" style={{ position: "relative", width: 640, height: 400 }}>    
        <div className="video-area" style={{ position: "relative", width: "100%", height: "100%" }}> 
          <VideoPlayer
            ref={videoRef}
            src={mainVideoSource || videoSrc}
            muted={false}
            width={640}
            height={400}
            controls
            preload="auto" 
            style={{
              position: "relative",
              zIndex: 10,
              objectFit: "contain",
              background: "#000",
              width: "100%",
              height: "100%",
              display: "block"
            }}
            onLoadedMetadata={(e) => { 
              setDuration(e.target.duration);
              setVideoWidthPx(e.target.videoWidth);
              setVideoHeightPx(e.target.videoHeight);
              setVideoDuration(e.target.duration);
              calculateRenderedDimensions(e.target);
            }}
          /> 
         
          {/* ✅ OVERLAY INSIDE video-area */}
          {renderedVideoWidth > 0 && renderedVideoHeight > 0 && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: renderedVideoWidth,
                height: renderedVideoHeight-45,
                pointerEvents: "none", // auto
                zIndex: 100,
              }}
              onClick={() => console.log("🚨 OVERLAY DIV CLICKED")}  // ← add this
            >
              <div style={{ position: "relative", width: "100%", height: "100%", pointerEvents: "auto"  }}
               //onMouseDown={(e) => e.stopPropagation()}
              >
                <VideoOverlayKonva
                 // style={{ pointerEvents: "auto" }}
                  videoWidth={renderedVideoWidth}
                  videoHeight={renderedVideoHeight-45}
                  containerWidth={640}
                  containerHeight={360}
                  videoDuration={duration}
                  tracks={tracks}
                  selectedActionId={selectedAction?.id}
                  setSelectedActionId={setSelectedActionById}
                  onUpdateAction={handleUpdateAction}
                  currentTime={currentTime}
                  imageOverlays={imageOverlays} 
                  onUpdateImageOverlay={handleUpdateImageOverlay}
                  videoRef={videoRef}
                />
              </div>
            </div>
          )}
        
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
      </div>
    ) : (
      <div style={{
        width: 640,
        height: 360,
        background: "#1a1a1a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        border: "2px dashed #374151",
        borderRadius: 8
      }}>
        <div style={{ fontSize: 64, color: "#4b5563" }}>🎬</div>
        <div style={{ fontSize: 18, color: "#9ca3af", fontWeight: "bold" }}>
          No Video Loaded
        </div>
        <div style={{ fontSize: 14, color: "#6b7280", textAlign: "center", maxWidth: 400 }}>
          Click the "📹 Upload Video" button below to get started
        </div>
      </div> 
    )
    
  )} </div>
  
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
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            
            // ✅ Set mainVideo state for UnifiedPipelineForm
            setMainVideo(file);
            
            // ✅ Keep your existing upload logic
            handleVideoRequest(file);
            handleOnVideoUpload(file);
            
            e.target.value = "";
          }}
        />
      <div style={{
  width: 640,
  margin: "10px auto 0",
  display: "flex",
  gap: 2,
  padding: "4px",
  background: "#222",
  border: "1px solid #555",
  borderBottom: "none",
  borderRadius: "4px 4px 0 0"
}}>
  <button
    onClick={() => setRazorMode(v => !v)}
    style={{
      padding: '8px 16px',
      background: razorMode ? '#ef4444' : '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: 4,
      cursor: 'pointer',
      fontWeight: 'bold',
    }}
  >
    {razorMode ? "✂️ Razor Active (Click to Disable)" : "✂️ Enable Razor Tool"}
  </button>

  <input
    type="file"
    accept="video/*"
    hidden
    id="insert-video-input"
    onChange={(e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const position = prompt(
        `Insert at what position? (0 - ${videoDuration.toFixed(2)}s)\nCurrent time: ${currentTime.toFixed(2)}s`,
        currentTime.toFixed(2)
      );
      if (position !== null) handleAddInsertVideo(file, parseFloat(position));
      e.target.value = "";
    }}
  />

  <button
    onClick={() => document.getElementById('insert-video-input').click()}
    disabled={!serverFilename}
    style={{
      padding: "8px 16px",
      background: serverFilename ? "#10b981" : "#6b7280",
      color: "white",
      border: "none",
      borderRadius: 6,
      cursor: serverFilename ? "pointer" : "not-allowed",
      fontWeight: "bold"
    }}
  >
    ➕ Insert Videos
  </button>

  {razorMode && (
    <span style={{ color: '#92400e', background: '#fef3c7', padding: '8px', borderRadius: 4, fontSize: 13 }}>
      ⚠️ Click timeline to split
    </span>
  )}
</div>
      <div 
        style={{
          width: 640, // ✅ Match video player width exactly
          margin: "20px auto 0", // Center align
          overflowX: "auto",
          overflowY: "hidden",
          background: "#222",
          border: "1px solid #555",
          position: "relative",
        }}
        ref={timelineScrollRef}
      >

      <div className="timeline-scroll-content">
          <TimelineKonva
            key={timelineKey}
            tracks={tracks}
            visibleRange={visibleRange}
            videoDuration={videoDuration}
            timelinePxWidth={timelineWidth}
            width={640}
            videoRef={videoRef}
            currentTime={currentTime} 
            scrollLeft={timelineScrollLeft} // ✅ Pass scroll position
            onTimeChange={(time) => {
              setCurrentTime(time);
              if (videoRef.current) {
                const wasPlaying = !videoRef.current.paused;
                videoRef.current.currentTime = time;
                if (wasPlaying) {
                  videoRef.current.play().catch(() => {});
                }
              }
            }}
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
            frameCache={frameCacheRef.current}
            loadingFrames={loadingFrames}
            failedFrames={failedFrames}
            pendingCut={pendingCut}
            onDeleteClip={handleDeleteClip}
          />
        </div>
     </div>  
      {selectedAction && selectedAction.type === "text" && (
  <div style={{ marginTop: 10, padding: 10, background: "#2a2a2a", borderRadius: 4 }}>
    <h4 style={{ color: "#60a5fa", marginTop: 0 }}>Edit Text Overlay</h4>
    
    {/* Text content */}
    <input
      type="text"
      placeholder="Edit overlay text"
      value={selectedAction.text || ""}
      onChange={(e) =>
        handleUpdateAction(selectedAction.id, {
          text: e.target.value,
        })
      }
      style={{ padding: 5, width: 250, marginBottom: 10 }}
    />
    
    {/* Start time */}
    <div style={{ marginBottom: 10 }}>
      <label style={{ color: "#9ca3af", marginRight: 10 }}>Start Time (s):</label>
      <input
        type="number"
        min="0"
        max={videoDuration}
        step="0.1"
        value={selectedAction.start || 0}
        onChange={(e) =>
          handleUpdateAction(selectedAction.id, {
            start: parseFloat(e.target.value) || 0
          })
        }
        style={{ padding: 5, width: 100 }}
      />
    </div>
    
    {/* End time */}
    <div style={{ marginBottom: 10 }}>
      <label style={{ color: "#9ca3af", marginRight: 10 }}>End Time (s):</label>
      <input
        type="number"
        min="0"
        max={videoDuration}
        step="0.1"
        value={selectedAction.end || 0}
        onChange={(e) =>
          handleUpdateAction(selectedAction.id, {
            end: parseFloat(e.target.value) || 0
          })
        }
        style={{ padding: 5, width: 100 }}
      />
    </div>
    
    {/* Duration display */}
    <div style={{ color: "#6b7280", fontSize: 12 }}>
      Duration: {((selectedAction.end || 0) - (selectedAction.start || 0)).toFixed(2)}s
    </div>
  </div>
)}
 
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

  <div style={{ padding: 20 }}>
           {/* ... all your existing UI components ... */}
           
           {/* ==================== UNIFIED PIPELINE SECTION ==================== */}
           {/* Place this AFTER all the individual export buttons but BEFORE MergePanel */}
           
           <hr style={{ margin: '40px 0', border: 'none', borderTop: '2px solid #374151' }} />
           
           <UnifiedPipelineForm
             // Main video
             mainVideo={mainVideo}
             setMainVideo={setMainVideo}
             setFile={setFile}  // ✅ Add this
              setMainVideoSource={setMainVideoSource}  // ✅ Add this
              setBlobUrl={setBlobUrl}  // ✅ Add this
              setVideoSrc={setVideoSrc}
              onClearTimeline={handleClearTimeline}          
             // Timeline data
             clips={clips}
             tracks={tracks}
             
             // Audio data
             audioMode={audioMode}
             addedAudioFile={addedAudioFileRef.current}
             
             // Overlays
             videoOverlays={videoOverlays}
             imageOverlays={imageOverlays}
             
             // Insert videos
             insertVideos={insertVideos}
             
             // Split screen
             splitScreenConfig={splitScreenConfig}
             
             // Callback
             onProcessComplete={handleUnifiedProcessComplete}
           />
           
           <hr style={{ margin: '40px 0', border: 'none', borderTop: '2px solid #374151' }} />
           
           {/* ... rest of your code (MergePanel, etc.) ... */}
         </div>     

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

            {/* <button
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
            </button> */}

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
      ➕ Insert Clips
    </button>
    {failedFrames.size > 0 && (
  <button
    onClick={retryFailedFrames}
    style={{
      padding: '6px 12px',
      background: '#f59e0b',
      color: 'white',
      border: 'none',
      borderRadius: 4,
      cursor: 'pointer',
      fontSize: 12,
      marginLeft: 10
    }}
  >
    ⚠️ Retry {failedFrames.size} Failed Frames
  </button>
)}
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
          {/* <button
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
          </button> */}

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
          
            
      <hr />
       

      
      {/* <h3>🧩 Merge Videos</h3>
      <MergePanel videos={mergedVideos} onMerged={loadVideosForMerge} />  */}
      
    </div>  
  );
}

  export default VideoEditor;