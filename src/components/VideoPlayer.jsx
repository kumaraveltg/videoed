import { useRef, useEffect, useState } from "react";
import "../app.css"

function VideoPlayer({
  src,
  autoPlay = false,
  controls = true,
  addedAudioRef,
  onLoadedMetadata,
  ...rest
}) {
  const videoRef = useRef(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    const addedAudio = addedAudioRef?.current;

    if (!video || !addedAudio) return;

    const onPlay = () => addedAudio.play();
    const onPause = () => addedAudio.pause();
    const onSeek = () => {
      addedAudio.currentTime = video.currentTime;
    };

    const onTimeUpdate = () => {
      if (Math.abs(addedAudio.currentTime - video.currentTime) > 0.2) {
        addedAudio.currentTime = video.currentTime;
      }
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeek);
    video.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeek);
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [addedAudioRef]);

  useEffect(()=>{
  console.log("🔥 VideoPlayer Mounted");
  return ()=> console.log("💀 VideoPlayer Unmounted");
},[]);

  if (!src) return null;

  return (
  <div className="video-player-component">
  <div className="video-inner">
    <video
      ref={videoRef}
      src={src}
      autoPlay={autoPlay}
      controls={controls}
      onLoadedMetadata={(e) => {
        console.log("METADATA LOADED");
        onLoadedMetadata && onLoadedMetadata(e);
      }}
      {...rest}
      className="video-element"
    />
  </div>
</div>


  );
}

export default VideoPlayer;
