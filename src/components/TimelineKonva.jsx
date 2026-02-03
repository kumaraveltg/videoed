import React, { useRef, useState, useEffect } from "react";
import { Stage, Layer, Rect, Group, Line, Circle ,Text } from "react-konva";
import { Image as KonvaImage } from "react-konva"; 

const TimelineKonva = ({
  tracks = [],
  videoDuration = 0,
  currentTime = 0,
  onTimeChange,
  onChange,
  onAddAction,
  onSelectAction,
  onDeleteAction,
  onVideoUpload,
}) => {
  const stageRef = useRef();
  const PIXELS_PER_SECOND = 10;
  const FRAME_WIDTH = PIXELS_PER_SECOND;
  const trackHeight = 50;
  const TIMELINE_START_X = 40;
  const timelineWidth = Math.max(800, videoDuration * PIXELS_PER_SECOND);

  const timeToX = (t) => t * PIXELS_PER_SECOND;
  const xToTime = (x) => Math.max(0, Math.min(videoDuration, x / PIXELS_PER_SECOND));

 
  const initCap = (str) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();



  const TimelineRuler = ({ videoDuration, PIXELS_PER_SECOND, timelineWidth }) => {
  const ticks = [];
  const LABEL_SPACING = 2; // seconds between labels
  const TICK_HEIGHT = 5;

  for (let sec = 0; sec <= videoDuration; sec += LABEL_SPACING) {
    const x = sec * PIXELS_PER_SECOND;
    ticks.push({ x, label: `${sec}` });
  }

  return (
    <Layer>
      {ticks.map((tick, i) => (
        <React.Fragment key={i}>
          {/* Tick Line */}
          <Line points={[tick.x, 0, tick.x, TICK_HEIGHT]} stroke="white" strokeWidth={1} />
          {/* Label */}
          <Text x={tick.x + 2} y={TICK_HEIGHT + 2} text={tick.label} fontSize={9} fill="white" />
        </React.Fragment>
      ))}
      {/* Horizontal line under ruler */}
      <Line points={[0, TICK_HEIGHT, timelineWidth, TICK_HEIGHT]} stroke="white" strokeWidth={1} />
    </Layer>
  );
};

const Frame = ({ src, x, y, w, h }) => {
  const [image, setImage] = useState(null);

  useEffect(() => {
    const img = new window.Image();
    img.src = src;
    img.onload = () => setImage(img);
  }, [src]);

  if (!image) return null;

  return (
    <KonvaImage
      image={image}
      x={x}
      y={y}
      width={w}
      height={h}
      listening={false}
    />
  );
};
 

  return (
    <div style={{ display: "flex", background: "#222", border: "1px solid #555", paddingTop: 10}}>
      {/* + buttons */}
      <div style={{ display: "flex", flexDirection: "column", paddingTop: 30}}>
        {tracks.map((track) => (
                <div
              key={track.id}
              style={{
                height: trackHeight,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
          <button
            key={track.id}
            onClick={() => onAddAction(track.id, 0)}
            style={{
              width: 35,
              height: trackHeight - 6,
              marginBottom: 2,
              background: "#555",
              color: "#fff",
              border: "none",
              cursor: "pointer",  
               display: "flex",              // ✅ key
              alignItems: "center",          // vertical center
              justifyContent: "center",      // horizontal center

              fontSize: 12,
              fontWeight: "bold",
              padding: 0, 
            }} title={`Add ${initCap(track.type)}`}
          >
              {initCap(track.type).slice(0, 2)}
          </button>
        </div>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
        <Stage
          ref={stageRef}
          width={timelineWidth}
          height={tracks.length * trackHeight + 30}
        >
          <TimelineRuler videoDuration={videoDuration} PIXELS_PER_SECOND={PIXELS_PER_SECOND} timelineWidth={timelineWidth} />
          
          {/* TRACKS */}
          <Layer>
          {tracks.map((track, rowIndex) => {
            const trackY = rowIndex * trackHeight + 30;

            return (
              <Group key={track.id} x={0} y={trackY}>
            {/* Track background */}
            <Rect
              x={0}
              y={0}
              width={timelineWidth}
              height={trackHeight - 2}
              fill="#333"
            />

              {/* Track actions (multiple blocks) */}
              {track.actions?.map((action) => {
                const start = action.start ?? 0;
                const end = action.end ?? start + 1;

                const duration = Math.max(0.2, end - start);
                const x = timeToX(start);
                const w = timeToX(duration);

                let color = "#999";
                if (track.type === "text") color = "lightblue";
                if (track.type === "audio") color = "lightgreen";
                if (track.type === "image") color = "orange";

                return (
                  <Group key={action.id} x={x} y={4}>
                  <Rect
                    key={action.id}
                    x={0}
                    y={0}
                    width={w}
                    height={trackHeight - 10}
                    fill={color} 
                    opacity={0.6}
                    cornerRadius={4}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                  {/* Text inside the block */}
                {/* {track.type === "text" && (
                  <Text
                    text={action.text}
                    fontSize={action.fontSize || 14}
                    fontFamily={action.fontFamily || "Arial"}
                    fill={action.fill || "white"}
                    x={4} // small padding inside block
                    y={4}
                    width={w - 8}
                    height={trackHeight - 18}
                    ellipsis
                  />
                )} */}
                  {/* Delete button */}
              {track.type === "text" && (
                <Circle
                  x={w - 10} // right side of the block
                  y={8} // top inside the block
                  radius={6}
                  fill="red"
                  onClick={() => onDeleteAction(track.id, action.id)}
                  style={{ cursor: "pointer" }}
                />
              )}
               {track.type === "video" &&
              action.frames
                ?.slice(0, Math.floor(w / FRAME_WIDTH))
                .map((src, i) => (
                  <Frame
                    key={`${action.id}-frame-${i}`}
                    src={src}
                    x={i * FRAME_WIDTH}
                    y={0}
                    w={FRAME_WIDTH}
                    h={trackHeight - 10}
                  />
                ))}
                </Group>
                
                );
                
              })}
            </Group> 
          );     
                   }
                    
                    )}
        </Layer>

        </Stage>
      </div>
    </div>
  );
};

export default TimelineKonva;
