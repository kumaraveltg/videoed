import React, { useRef, useEffect, useState } from "react";
import { Stage, Layer, Rect, Text, Group } from "react-konva";

const TimelineKonva = ({ tracks, videoDuration , onChange, onAddAction, onSelectAction }) => {
  const stageRef = useRef();
  // pixels per second for timeline. Adjust if you want denser/sparser timeline.
  const PIXELS_PER_SECOND = 10;

  const [timelineWidth, setTimelineWidth] = useState(() => Math.max(800, Math.ceil(videoDuration * PIXELS_PER_SECOND)));

  // update timeline width when videoDuration changes so timeline matches video length
  useEffect(() => {
    setTimelineWidth(Math.max(800, Math.ceil(videoDuration * PIXELS_PER_SECOND)));
  }, [videoDuration]);

  const scaleTime = (seconds) => (seconds / videoDuration) * timelineWidth;
  const trackHeight = 50;

  return (
    <Stage
      width={timelineWidth}
      height={tracks.length * trackHeight}
      ref={stageRef}
      style={{ border: "1px solid #555", background: "#222", marginTop: 20 }}
    >
      {/* Layer for track actions */}
      <Layer>
        {/* Timeline grid: seconds */}
        {[...Array(Math.ceil(videoDuration))].map((_, i) => (
          <Text key={i} x={scaleTime(i)} y={0} text={`${i}s`} fontSize={12} fill="#fff" />
        ))}

        {tracks.map((track, rowIndex) => (
          <Group key={track.id} y={rowIndex * trackHeight}>
            {/* Track background */}
            <Rect x={0} y={0} width={timelineWidth} height={trackHeight - 2} fill="#333" />

            {/* Track actions */}
            {track.actions.map((action) => {
              const x = scaleTime(action.start);
              const w = scaleTime(action.end - action.start);
              const yOffset = action.y || 5;

              let color = "#888";
              if (track.type === "text") color = "lightblue";
              else if (track.type === "audio") color = "lightgreen";
              else if (track.type === "image") color = "orange";

              return (
                <Group
                  key={action.id}
                  x={x}
                  y={yOffset}
                  draggable
                  dragBoundFunc={(pos) => {
                    let newX = Math.max(0, Math.min(pos.x, timelineWidth - w));
                    let newY = Math.max(0, Math.min(pos.y, trackHeight - 40));
                    return { x: newX, y: newY };
                  }}
                  onClick={() => onSelectAction(action)}
                  onDragEnd={(e) => {
                    const newStart = (e.target.x() / timelineWidth) * videoDuration;
                    const newY = e.target.y();
                    onChange(track.id, action.id, newStart, newY);
                  }}
                >
                  <Rect width={w} height={trackHeight - 10} fill={color} cornerRadius={5} stroke="#fff" strokeWidth={1} />
                  <Text text={track.type === "text" ? action.text : action.name || "Item"} fontSize={12} fill="#000" padding={4} />
                </Group>
              );
            })}
          </Group>
        ))}
      </Layer>

      {/* Layer for plus buttons (on top of everything) */}
      <Layer>
        {tracks.map((track, rowIndex) => (
          <Group
            key={`plus-${track.id}`}
            x={timelineWidth - 40}
            y={rowIndex * trackHeight + 5}
            onClick={() => onAddAction(track.id, 0)}
            onMouseEnter={e => e.target.getStage().container().style.cursor = 'pointer'}
            onMouseLeave={e => e.target.getStage().container().style.cursor = 'default'}
          >
            <Rect width={35} height={trackHeight - 10} fill="#555" cornerRadius={5} />
            <Text
              text="+"
              fontSize={18}
              fill="#fff"
              width={35}
              height={trackHeight - 10}
              align="center"
              verticalAlign="middle"
            />
          </Group>
        ))}
      </Layer>
    </Stage>
  );
};

export default TimelineKonva;
