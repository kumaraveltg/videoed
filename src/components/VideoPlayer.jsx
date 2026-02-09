import { useRef, useEffect, useState } from "react";

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

  if (!src) return null;

  return (
    <div className="video-player-component">
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        controls={controls}
        onLoadedMetadata={(e) => {
          setHeight(e.target.videoHeight);
          onLoadedMetadata && onLoadedMetadata(e);
        }}
        {...rest}
        style={{ width: "100%", height: height > 0 ? height : "auto" }}
      />
    </div>
  );
}

export default VideoPlayer;
