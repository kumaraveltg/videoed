import { useRef } from "react";

function VideoPlayer({ src, autoPlay = false, controls = true ,onLoadedMetadata }) {
    const videoRef = useRef(null);
    return (
        <div className="video-player-component">
            <video
                ref={videoRef}
                src={src}
                autoPlay={autoPlay} 
                controls={controls}
                onLoadedMetadata={(e) => onLoadedMetadata && onLoadedMetadata(e)}
                style={{ width: "100%", height: "auto" }}
            />
        </div>
    );
}
export default VideoPlayer;