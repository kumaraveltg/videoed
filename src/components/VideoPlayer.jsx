import { useRef } from "react";

function VideoPlayer({ src, autoPlay = false, controls = true ,onLoadedMetadata,...rest }) {
    const videoRef = useRef(null);
     const height = Number(videoRef.current?.videoHeight || 0);
     if (!src) return null;
    return (
        <div className="video-player-component" >
            <video
                ref={videoRef}
                src={src}
                autoPlay={autoPlay} 
                controls={controls}                
                onLoadedMetadata={(e) => onLoadedMetadata && onLoadedMetadata(e)}
                {...rest}
                style={{ width: "100%", height: height > 0 ? height : "auto" }}
            />
        </div>
    );
}
export default VideoPlayer;