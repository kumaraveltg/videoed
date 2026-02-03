import React, { useEffect, useState } from "react";
import DynamicTextOverlay from "./DynamicTextOverlay"; 


function CompositionPanel({
  filename,
  onAudioSelect,
  isMuted,
  setIsMuted,
  splitMode,
  setSplitMode,
  onBottomVideoSelect, 
}) {
  // Hooks must be inside the function body
  const [overlays, setOverlays] = useState([]); 
 

  const handleSubmit = async () => {
    if (!filename) return alert("Please upload a video first");

     const payload = {
    filename: filename,
    overlays: overlays.map(o => ({
      text: o.text,
      start: Number(o.start),
      end: Number(o.end),
      position: o.position || "custom",
      x: o.x ?? null,
      y: o.y ?? null,
      fontsize: Number(o.fontsize) || 24,
      fontcolor: o.fontcolor || "white"
    }))
  };

  console.log("Sending payload →", payload); // 🔍 DEBUG

    try {
      const response = await fetch("http://localhost:8000/video/add-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });  
      const data = await response.json(); 
      alert(`Video created: ${data.video_url}`);
    } catch (err) {
      console.error(err);
      alert("Error adding text overlay");
    }
  };

  return (
    <div style={{ marginTop: 20 }}>
      <h3>🎨 Composition</h3>

       

      {/* Dynamic Text Overlay */}
      <DynamicTextOverlay overlays={overlays} setOverlays={setOverlays} />

      {/* AUDIO */}
      <div style={{ marginTop: 10 }}>
        <label>Audio:</label>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => onAudioSelect(e.target.files[0])}
        />
        <button onClick={() => setIsMuted(!isMuted)}>
          {isMuted ? "Unmute" : "Mute"}
        </button>
      </div>

      {/* SPLIT */}
      <div style={{ marginTop: 10 }}>
        <label>
          <input
            type="checkbox"
            checked={splitMode}
            onChange={() => setSplitMode(!splitMode)}
          />
          Enable Split Screen (Top/Bottom)
        </label>
      </div>

      {splitMode && (
        <div style={{ marginTop: 10 }}>
          <label>Bottom Video:</label>
          <input
            type="file"
            accept="video/*"
            onChange={(e) =>
              onBottomVideoSelect(URL.createObjectURL(e.target.files[0]))
            }
          />
        </div>
      )}

      <button onClick={handleSubmit} style={{ marginTop: 20 }}>
        Submit Video
      </button>
    </div>
  );
}

export default CompositionPanel;
