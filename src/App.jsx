import React from 'react';
import { useEffect ,useState} from 'react';
import Upload from './components/Upload';
import VideoPlayer from './components/VideoPlayer';
import TrimSlider from './components/TrimSlider';
import YouTubePreview from './components/YouTubePreview';
import MergePanel from './components/MergePannel';

function App() {
  const [file, setFile] = useState(null);
  const [videoSrc, setVideoSrc] = useState(null);
  const [duration, setDuration] = useState(null);
  const [trim, setTrim] = useState({ start: 0, end: 0 });
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [mergedVideos, setMergedVideos] = useState([]);
  

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setVideoSrc(url);
  };

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

  return (
  <div style={{ padding: 20 }}>
    <h2>🎬 Video Editor</h2>
    <div style={{ marginBottom: 20 }}>
  {/* <input
    type="text"
    placeholder="Paste YouTube URL (Preview only)"
    value={youtubeUrl}
    onChange={(e) => setYoutubeUrl(e.target.value)}
    style={{ width: "400px", padding: 6 }}
  /> */}
</div>

    <YouTubePreview url={youtubeUrl} />

    <Upload onFileSelect={handleFileSelect} />

    {videoSrc && (
      <>
        <VideoPlayer 
          src={videoSrc}
          autoPlay={false}
          controls={true}
          onLoadedMetadata={(e) => setDuration(e.target.duration)}
        />

        <TrimSlider 
          duration={duration} 
          setTrim={setTrim} 
        />
      </>
    )}

    {(trim.start !== 0 || trim.end !== duration) && (
      <>
        <div style={{ marginTop: 10 }}>
          <strong>
            Trim: {Math.floor(trim.start)}s →{" "}
            {Math.floor(trim.end)}s
          </strong>
        </div>

        <button
          style={{ marginTop: 20 }}
          onClick={() => console.log("EXPORT", trim)}
        >
          Export
        </button>
      </>
    )}
    {/* ✅ MERGE SECTION */}
      <hr />
      <h3>🧩 Merge Videos</h3>

      <MergePanel   
        videos={mergedVideos} 
        onMerged={loadVideosForMerge}
      />
  </div>
);
}
  
export default App;
