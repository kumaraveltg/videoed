import React, { useState } from "react";

 function DynamicTextOverlay({ overlays, setOverlays }) {
  // Add new overlay
  const addOverlay = () => {
    setOverlays([
      ...overlays,
      {
        text: "",
        start: 0,
        end: 5,
        position: "top",
        x: null,
        y: null,
        fontsize: 24,
        fontcolor: "white",
      },
    ]);
  };

  // Remove overlay
  const removeOverlay = (index) => {
    setOverlays(overlays.filter((_, i) => i !== index));
  };

  // Update overlay field
  const updateOverlay = (index, field, value) => {
    const newOverlays = [...overlays];
    newOverlays[index][field] = value;
    setOverlays(newOverlays);
  };

  return (
    <div style={{ border: "1px solid #ddd", padding: 10, marginBottom: 20 }}>
      <h3>Dynamic Text Overlays</h3>
      {overlays.map((o, index) => (
        <div
          key={index}
          style={{
            marginBottom: 10,
            padding: 10,
            border: "1px solid #ccc",
            borderRadius: 5,
          }}
        >
          <label>Text:</label>
          <input
            type="text"
            value={o.text}
            onChange={(e) => updateOverlay(index, "text", e.target.value)}
          />

          <label>Start (s):</label>
          <input
            type="number"
            value={o.start}
            onChange={(e) => updateOverlay(index, "start", parseFloat(e.target.value))}
          />

          <label>End (s):</label>
          <input
            type="number"
            value={o.end}
            onChange={(e) => updateOverlay(index, "end", parseFloat(e.target.value))}
          />

          <label>Position:</label>
          <select
            value={o.position}
            onChange={(e) => updateOverlay(index, "position", e.target.value)}
          >
            <option value="center">Center</option>
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
            <option value="topleft">Top Left</option>
            <option value="custom">Custom</option>
          </select>

          {o.position === "custom" && (
            <>
              <label>X:</label>
              <input
                type="number"
                value={o.x || ""}
                onChange={(e) => updateOverlay(index, "x", parseInt(e.target.value))}
              />
              <label>Y:</label>
              <input
                type="number"
                value={o.y || ""}
                onChange={(e) => updateOverlay(index, "y", parseInt(e.target.value))}
              />
            </>
          )}

          <label>Font Size:</label>
          <input
            type="number"
            value={o.fontsize}
            onChange={(e) => updateOverlay(index, "fontsize", parseInt(e.target.value))}
          />

          <label>Font Color:</label>
          <input
            type="text"
            value={o.fontcolor}
            onChange={(e) => updateOverlay(index, "fontcolor", e.target.value)}
          />

          <button onClick={() => removeOverlay(index)} style={{ marginTop: 5 }}>
            Remove
          </button>
        </div>
      ))}

      <button onClick={addOverlay}>Add Overlay</button>
    </div>
  );
}
export default DynamicTextOverlay;