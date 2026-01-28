import { useState, useEffect } from "react";

function MergePanel({ videos, onMerged }) {
  const [selected, setSelected] = useState([]);

  const toggleSelect = (name) => {
    setSelected(prev =>
      prev.includes(name)
        ? prev.filter(v => v !== name)
        : [...prev, name]
    );
  };

  const mergeSelected = async () => {
    if (selected.length < 2) {
      return alert("Select at least 2 videos to merge");
    }

    const res = await fetch("http://localhost:8000/video/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: selected,
        output_name: "merged_" + Date.now() + ".mp4"
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert("Merge failed: " + data.error);
      return;
    }

    alert("Merged successfully!");
    onMerged(); // 🔄 reload folder
    setSelected([]);
  };

  return (
    <div style={{ border: "1px solid #aaa", padding: 10 }}>
      <h3>🧩 Merge Videos</h3>

      {videos.map(v => (
        <div key={v.filename}>
          <input
            type="checkbox"
            checked={selected.includes(v.filename)}
            onChange={() => toggleSelect(v.filename)}
          />
          <span style={{ marginLeft: 8 }}>{v.filename}</span>
        </div>
      ))}

      <button onClick={mergeSelected} style={{ marginTop: 10 }}>
        Merge Selected ({selected.length})
      </button>
    </div>
  );
}

export default MergePanel;
