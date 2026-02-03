import React, { useState, useEffect, useCallback } from "react";
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
  const [videoSrc, setVideoSrc] = useState( null);
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
   

  // Helper: set selected action by id (keeps selectedAction as an object)
  const setSelectedActionById = (id) => {
    if (!id) return setSelectedAction(null);
    const found = tracks.flatMap((t) => t.actions).find((a) => a.id === id);
    setSelectedAction(found || null);
  };

  const DEFAULT_VIDEO = "/default.mp4";
  const activeVideoSrc = videoSrc || DEFAULT_VIDEO;

  // ------------------- TIMELINE STATE -------------------
  const [tracks, setTracks] = useState([
    { id: "video-main", type: "video", actions: [] }, 
    { id: "track-text", type: "text", actions: [] },
    { id: "track-audio", type: "audio", actions: [] },
    { id: "track-secondvideo", type: "Second video", actions: [] }, 
    { id: "track-trim", type: "trim", actions: [] },
  ]);

  // ------------------- FILE HANDLERS -------------------
  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
    setVideoSrc(URL.createObjectURL(selectedFile));
     handleOnVideoUpload(selectedFile);
  };

  const handleFileUploaded = (data) => {
    setServerFilename(data.filename);
    setVideoSrc(data.video_url);
  };

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

  // ------------------- TEXT ACTION HANDLERS for Timelinekonva -------------------
  const handleAddAction = (trackId, startTime) => {
    const newAction = {
      id: Date.now().toString(),
      start: 0,
      end: startTime + 3,
      type: "text",
      text: "New Text",
      fontSize: 24,
      color: "white",
      y: 50,
    };
    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId
          ? { ...track, actions: [...track.actions, newAction] }
          : track
      )
    );
    setSelectedAction(newAction); // select immediately
  };

  const handleUpdateAction = (actionId, updates) => {
    setTracks((prev) =>
      prev.map((track) => ({
        ...track,
        actions: track.actions.map((action) => {
          if (action.id !== actionId) return action;
          const merged = { ...action, ...updates };
          // sanitize numeric fields
          const start = Number.isFinite(Number(merged.start)) ? Number(merged.start) : Number(action.start) || 0;
          let end = Number.isFinite(Number(merged.end)) ? Number(merged.end) : Number(action.end);
          if (!Number.isFinite(end) || end < start) end = start + 3;
          const fontSize = Number.isFinite(Number(merged.fontSize)) ? Number(merged.fontSize) : Number(action.fontSize) || 24;
          const x = Number.isFinite(Number(merged.x)) ? Number(merged.x) : Number(action.x) || 0;
          const y = Number.isFinite(Number(merged.y)) ? Number(merged.y) : Number(action.y) || 50;

          return { ...merged, start, end, fontSize, x, y };
        }),
      }))
    );
    setSelectedAction((prev) => (prev && prev.id === actionId ? { ...prev, ...updates } : prev));
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

  // Repair any existing actions with invalid numeric fields (runs when `tracks` changes)
  useEffect(() => {
    let repaired = false;
    const newTracks = tracks.map((track) => {
      const newActions = track.actions.map((a) => {
        const start = Number.isFinite(Number(a.start)) ? Number(a.start) : 0;
        let end = Number.isFinite(Number(a.end)) ? Number(a.end) : NaN;
        if (!Number.isFinite(end) || end < start) {
          end = start + 3;
        }
        const fontSize = Number.isFinite(Number(a.fontSize)) ? Number(a.fontSize) : 24;
        const x = Number.isFinite(Number(a.x)) ? Number(a.x) : 0;
        const y = Number.isFinite(Number(a.y)) ? Number(a.y) : 50;

        if (start !== a.start || end !== a.end || fontSize !== a.fontSize || x !== a.x || y !== a.y) {
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

  // ------------------- ADD TEXT OVERLAY TO SERVER -------------------
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

    // Build and sanitize payload
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
      (o) => !Number.isFinite(o.start) || !Number.isFinite(o.end) || !Number.isFinite(o.fontsize)
    );
    if (invalid) {
      console.error("Invalid overlay payload, aborting:", invalid, overlays);
      return alert("Cannot add overlays: invalid numeric values in overlays. Check console for details.");
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

  //----------------- video upload frames extraction -----------------
  async function extractVideoFrames(file, interval = 1) {
  const video = document.createElement("video");
  video.src = URL.createObjectURL(file);
  video.muted = true;

  await video.play();
  video.pause();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const frames = [];

  for (let t = 0; t < video.duration; t += interval) {
    video.currentTime = t;

    await new Promise(res => (video.onseeked = res));

    ctx.drawImage(video, 0, 0);
    frames.push(canvas.toDataURL("image/jpeg"));
  }

  return {
    duration: video.duration,
    frames
  };
}

const handleOnVideoUpload = async (file) => {
  setIsLoadingFrames(true);
  try {
  const { duration, frames } = await extractVideoFrames(file, 1);

  setTracks(prev =>
    prev.map(track =>
      track.type === "video"
        ? {
            ...track,
            actions: [{
              id: "video-main",
              start: 0,
              end: duration,
              frames
            }]
          }
        : track
    )
  );

  setVideoDuration(duration);
  
} finally { setIsLoadingFrames(false);
}
 };
 

  // ------------------- RENDER -------------------
  return (
    <div style={{ padding: 20 }}>
      <h2>🎬 Video Editor</h2>

      <YouTubePreview url="" />
       <Upload onFileSelect={handleFileSelect} onFileUploaded={handleFileUploaded} /> 

       <div
        style={{
          position: "relative",
          width: videoWidthPx,
          height: videoHeightPx,
          marginTop: 10,
        }}
      > {isLoadingFrames && (
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
            src={activeVideoSrc}
            width={duration }
            //height={videoHeightPx}            
            height={(videoHeightPx/videoWidthPx)*duration}
            controls
            preload="auto"
            onLoadedMetadata={(e) => {
              setDuration(e.target.duration);
              setVideoWidthPx(e.target.videoWidth);
              setVideoHeightPx(e.target.videoHeight);
            }}
          />
        )}

        {/* Video Overlay Konva */}
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
            {bottomVideoSrc && <video src={bottomVideoSrc} controls muted height={220} />}
          </div>
        )} </div>

        {/* Timeline */}
        <TimelineKonva
          tracks={tracks}
          videoDuration={duration}
          onChange={handleTimelineChange}
          onAddAction={handleAddAction}
          onSelectAction={setSelectedAction}
          onDeleteAction={handleDeleteAction}
          onVideoUpload={handleOnVideoUpload}
        /> 

        {/* Edit selected text */}
        <div style={{ marginTop: 10 }}>
          {selectedAction && selectedAction.text !== undefined && (
            <input
              value={selectedAction.text}
              onChange={(e) =>
                handleUpdateAction(selectedAction.id, { text: e.target.value })
              }
              placeholder="Edit text"
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
