import { useState, useRef } from "react";
import config from "../config";

function MergePanel({ onMerged }) {
  const [uploadedFiles, setUploadedFiles] = useState([]); // { name, filename }
  const [mergedFile, setMergedFile] = useState(null);
  const [merging, setMerging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef();

  // Upload a single file to the server's videouploads folder
  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${config.API_URL}/upload/local`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Upload failed");
    }

    const data = await res.json();
    return data.filename; // server-side filename in videouploads/
  };

  // Handle file picker selection — upload each chosen file
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setUploading(true);
    try {
      const newEntries = [];
      for (const file of files) {
        const filename = await uploadFile(file);
        newEntries.push({ name: file.name, filename });
      }
      setUploadedFiles((prev) => [...prev, ...newEntries]);
    } catch (err) {
      alert("Upload error: " + err.message);
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-added if needed
      e.target.value = "";
    }
  };

  const removeFile = (index) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const mergeVideos = async () => {
    if (uploadedFiles.length < 2) {
      return alert("Add at least 2 videos to merge");
    }

    setMerging(true);
    const outputName = "merged_" + Date.now() + ".mp4";

    try {
      const res = await fetch(`${config.API_URL}/video/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: uploadedFiles.map((f) => f.filename),
          output_name: outputName,
        }),
      });
      console.log("filename",uploadedFiles);
      const data = await res.json();

      if (!res.ok) {
        alert("Merge failed: " + data.error);
        return;
      }

      setMergedFile(outputName);
    } catch (err) {
      alert("Merge error: " + err.message);
    } finally {
      setMerging(false);
    }
  };

  const downloadAndCleanup = async () => {
    // Trigger download
    const downloadUrl = `${config.API_URL}/video/download/${mergedFile}`;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = mergedFile;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Delete all files from server after a short delay to allow download to start
    setTimeout(async () => {
      try {
        await fetch(`${config.API_URL}/video/cleanup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            files: uploadedFiles.map((f) => f.filename),
            merged: mergedFile,
          }),
        });
      } catch (err) {
        console.warn("Cleanup failed:", err);
      }

      // Reset UI
      setUploadedFiles([]);
      setMergedFile(null);
      if (onMerged) onMerged();
    }, 1500);
  };

  return (
    <div style={styles.container}>  

      {/* File list */}
      {uploadedFiles.length > 0 && (
        <ol style={styles.fileList}>
          {uploadedFiles.map((f, i) => (
            <li key={i} style={styles.fileItem}>
              <span style={styles.fileName}>{f.name}</span>
              <button
                onClick={() => removeFile(i)}
                style={styles.removeBtn}
                title="Remove"
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}

      {/* Add videos button */}
      {!mergedFile && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <button
            onClick={() => fileInputRef.current.click()}
            style={styles.addBtn}
            disabled={uploading}
          >
            {uploading ? "Uploading…" : "+ Add Video(s)"}
          </button>
        </>
      )}

      {/* Merge button */}
      {!mergedFile && (
        <button
          onClick={mergeVideos}
          disabled={uploadedFiles.length < 2 || merging || uploading}
          style={{
            ...styles.mergeBtn,
            opacity: uploadedFiles.length < 2 || merging ? 0.5 : 1,
          }}
        >
          {merging ? "Merging…" : `Merge ${uploadedFiles.length} Video(s)`}
        </button>
      )}

      {/* Download button — shown after merge */}
      {mergedFile && (
        <button onClick={downloadAndCleanup} style={styles.downloadBtn}>
          ⬇ Download Merged Video
        </button>
      )}
    </div>
  );
}

const styles = {
  container: {
    border: "1px solid #ccc",
    borderRadius: 8,
    padding: 16,
    maxWidth: 420,
    fontFamily: "sans-serif",
  },
  heading: {
    marginTop: 0,
  },
  fileList: {
    paddingLeft: 20,
    marginBottom: 12,
  },
  fileItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  fileName: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  removeBtn: {
    marginLeft: 8,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#e55",
    fontWeight: "bold",
  },
  addBtn: {
    display: "block",
    marginBottom: 8,
    padding: "8px 14px",
    cursor: "pointer",
    background: "#f0f0f0",
    border: "1px solid #bbb",
    borderRadius: 5,
  },
  mergeBtn: {
    display: "block",
    padding: "10px 20px",
    background: "#4a90e2",
    color: "#fff",
    border: "none",
    borderRadius: 5,
    cursor: "pointer",
    fontWeight: "bold",
  },
  downloadBtn: {
    display: "block",
    padding: "10px 20px",
    background: "#27ae60",
    color: "#fff",
    border: "none",
    borderRadius: 5,
    cursor: "pointer",
    fontWeight: "bold",
  },
};

export default MergePanel;
