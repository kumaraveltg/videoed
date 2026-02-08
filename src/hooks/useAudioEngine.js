import { useEffect, useRef } from "react";
import { AudioModeEngine } from "../components/AudioModeEngine";

 function useAudioEngine(videoRef, audioRef) {
  const engineRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current || !audioRef.current) return;

    engineRef.current = new AudioModeEngine(
      videoRef.current,
      audioRef.current
    );

    engineRef.current.sync();

    return () => {
      engineRef.current = null;
    };
  }, [videoRef, audioRef]);

  return engineRef;
}
export { useAudioEngine };