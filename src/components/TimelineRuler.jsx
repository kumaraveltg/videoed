import React, { useRef, useState, useEffect } from "react";
import { Stage, Layer, Line, Rect, Text } from "react-konva";

const TimelineRuler = ({
  videoDuration = 0,
  currentTime = 0,
  scrollLeft = 0, // ✅ NEW: Receive parent scroll position
  PIXELS_PER_SECOND = 10,
  height = 50,
  onTimeChange = () => {},
}) => {
  const stageRef = useRef(null);
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const timelineWidth = Math.max(1000, videoDuration * PIXELS_PER_SECOND);
  const playheadX = currentTime * PIXELS_PER_SECOND;

  // ✅ FIX #1: Sync ruler scroll with parent timeline scroll
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = scrollLeft;
    }
  }, [scrollLeft]);

  const xToTime = (x) => {
    let t = x / PIXELS_PER_SECOND;
    if (t < 0) t = 0;
    if (t > videoDuration) t = videoDuration;
    return t;
  };

  const generateMarkers = () => {
    const markers = [];

    if (videoDuration === 0) return markers;

    let majorInterval = 10;
    let minorInterval = 1;

    if (videoDuration > 3600) {
      majorInterval = 300;
      minorInterval = 60;
    } else if (videoDuration > 1800) {
      majorInterval = 120;
      minorInterval = 30;
    } else if (videoDuration > 600) {
      majorInterval = 60;
      minorInterval = 10;
    } else if (videoDuration > 180) {
      majorInterval = 30;
      minorInterval = 5;
    }

    for (let i = 0; i <= videoDuration; i += majorInterval) {
      const x = i * PIXELS_PER_SECOND;
      const minutes = Math.floor(i / 60);
      const seconds = i % 60;

      const label =
        videoDuration > 60
          ? `${minutes}:${seconds.toString().padStart(2, "0")}`
          : `${i}s`;

      markers.push({
        x,
        label,
        height: 20,
        isMajor: true,
      });
    }

    for (let i = minorInterval; i < videoDuration; i += minorInterval) {
      if (i % majorInterval !== 0) {
        markers.push({
          x: i * PIXELS_PER_SECOND,
          label: null,
          height: 10,
          isMajor: false,
        });
      }
    }

    return markers;
  };

  const markers = generateMarkers();

  const handleInteraction = (e) => {
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;

    const newTime = xToTime(pointer.x);
    onTimeChange(newTime);
  };

  const handleMouseDown = (e) => {
    setDragging(true);
    handleInteraction(e);
  };

  const handleMouseMove = (e) => {
    if (dragging) {
      handleInteraction(e);
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setDragging(false);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);
  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: height,
        background: "#1a1a1a",
        borderBottom: "1px solid #555",
        userSelect: "none",
        overflowX: "hidden", 
        overflowY: "hidden",
      }}
    >
      <Stage
        ref={stageRef}
        width={timelineWidth}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{
          cursor: dragging ? "grabbing" : "pointer",
        }}
      >
        <Layer>
          {/* Background */}
          <Rect x={0} y={0} width={timelineWidth} height={height} fill="#2a2a2a" />

          {/* Time markers */}
          {markers.map((marker, idx) => (
            <React.Fragment key={`marker-${idx}`}>
              {/* Tick mark */}
              <Line
                points={[
                  marker.x,
                  height - marker.height,
                  marker.x,
                  height,
                ]}
                stroke={marker.isMajor ? "#fff" : "#666"}
                strokeWidth={marker.isMajor ? 2 : 1}
              />
              
              {/* Label (major markers only) */}
              {marker.label && (
                <Text
                  x={marker.x + 4}
                  y={height - marker.height - 18}
                  text={marker.label}
                  fontSize={11}
                  fill="#ccc"
                  fontFamily="monospace"
                />
              )}
            </React.Fragment>
          ))}

          {/* Playhead line */}
          <Line
            points={[playheadX, 0, playheadX, height]}
            stroke="#ff4444"
            strokeWidth={3}
            shadowColor="#ff0000"
            shadowBlur={10}
            shadowOpacity={0.5}
            listening={false} // Don't interfere with clicks
          />

          {/* Playhead triangle indicator */}
          <Line
            points={[
              playheadX - 6, 0,
              playheadX + 6, 0,
              playheadX, 8
            ]}
            fill="#ff4444"
            closed
            stroke="#ff4444"
            listening={false}
          />

          {/* Current time display */}
          {videoDuration > 0 && (
            <Rect
              x={playheadX + 10}
              y={5}
              width={70}
              height={20}
              fill="rgba(0,0,0,0.8)"
              cornerRadius={3}
              listening={false}
            />
          )}
          {videoDuration > 0 && (
            <Text
              x={playheadX + 15}
              y={9}
              text={`${Math.floor(currentTime / 60)}:${Math.floor(currentTime % 60)
                .toString()
                .padStart(2, "0")}`}
              fontSize={12}
              fill="#fff"
              fontFamily="monospace"
              listening={false}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
};

export default TimelineRuler;