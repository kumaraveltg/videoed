import { useState } from "react";
import ReactPlayer from "react-player";

function YouTubePreview() {
  const [url, setUrl] = useState("");               // input YouTube URL
  const [localVideoUrl, setLocalVideoUrl] = useState(null); // downloaded MP4

  const uploadYoutube = async () => {
    if (!url) return alert("Paste a YouTube URL first!");

    try {
      const formData = new FormData();
      formData.append("url", url);

      const res = await fetch("http://localhost:8000/upload/youtube", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("YouTube download failed");
      }

      const data = await res.json();
      console.log("YouTube download:", data);

      if (data.video_url) {
        setLocalVideoUrl(null);
       setTimeout(() => {
            setLocalVideoUrl(encodeURI(data.video_url));
            
          }, 100); // switch ReactPlayer to server video
                }

      alert("YouTube video downloaded to server!");
    } catch (err) {
      console.error(err);
      alert("Failed to download YouTube video");
    }
  };

  return (
    <div style={{ margin: "20px" }}>
      <input
        type="text"
        placeholder="Paste YouTube URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        style={{ width: "400px", marginRight: "10px" }}
      />
      <button onClick={uploadYoutube}> Play</button>

      <div style={{ marginTop: "20px" }}>
  {localVideoUrl && (
    <video
      key={localVideoUrl}
      src={localVideoUrl}
      controls
      width="700"
      height="400"
      playsInline
      preload="metadata"
      style={{ backgroundColor: "black" }}
      onError={(e) => {
        console.error("Video error:", e);
        alert("Video failed to load. Check codec/streaming.");
      }}
    />
  )}
</div>
      </div> 
  );
}

export default YouTubePreview;
