import Slider from "rc-slider";
import "rc-slider/assets/index.css";
import React, { useState,useRef } from "react";

function MultiTrimSlider({ duration, onRangesChange,resetKey }) {
  const [currentRange, setCurrentRange] = useState([0, 0]);
  const [ranges, setRanges] = useState([]);
  const sliderRef = useRef();

  if (duration == null) return null;

  const addRange = () => {
  const start = Number(currentRange[0]);
  const end = Number(currentRange[1]);

  if (isNaN(start) || isNaN(end)) {
    alert("Invalid time values");
    return;
  }

  if (start >= end) {
    alert("Invalid range");
    return;
  }
  const newRange = { start, end };
  const newRanges = [...ranges, newRange]
    // sort by start time
    .sort((a, b) => a.start - b.start);

  setRanges(newRanges);
  onRangesChange([...newRanges]); // force new array
};

  const removeRange = (index) => {
    const newRanges = ranges.filter((_, i) => i !== index);
    setRanges(newRanges);
    onRangesChange(newRanges);
  };

  // 🔹 Keyboard arrow control
  const handleKeyDown = (e) => {
    const step = 1; // 1 second per arrow press
    let [start, end] = currentRange;

    if (e.key === "ArrowLeft") {
      start = Math.max(0, start - step);
      end = Math.max(start + 1, end - step);
      setCurrentRange([start, end]);
    }

    if (e.key === "ArrowRight") {
      start = Math.min(duration - 1, start + step);
      end = Math.min(duration, end + step);
      setCurrentRange([start, end]);
    }
  };

  return (
    <div key={resetKey} className="trim-slider-component" style={{ margin: "20px 0" }}>
      <h4>Multiple Trim (Use arrow keys for precise adjustment)</h4>
      <div tabIndex={0} onKeyDown={handleKeyDown} ref={sliderRef}> 
      <Slider
        range
        min={0}
        max={Math.floor(duration)}
        defaultValue={[0, Math.floor(duration)]}
        onAfterChange={(values) => setCurrentRange(values)}
        marks={{
          0: "0s",
          [Math.floor(duration)]: `${Math.floor(duration)}s`
        }}
      />
      </div>

      <div style={{ marginTop: 10 }}>
        <b>Selected:</b> {currentRange[0]}s - {currentRange[1]}s
        <button onClick={addRange} style={{ marginLeft: 10 }}>
          ➕ Add Trim
        </button>
      </div>

      <hr />

      <h5>Trim Ranges (Keep Parts)</h5>
      {ranges.length === 0 && <p>No ranges added</p>}

      {ranges.map((r, idx) => (
        <div key={idx} style={{ marginBottom: 5 }}>
          #{idx + 1}: {r.start}s - {r.end}s
          <button
            onClick={() => removeRange(idx)}
            style={{ marginLeft: 10, color: "red" }}
          >
            ❌ Remove
          </button>
        </div>
      ))}
    </div>
    
  );
}

export default MultiTrimSlider;
