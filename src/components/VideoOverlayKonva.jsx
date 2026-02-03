import React, { useRef, useEffect } from "react";
import { Stage, Layer, Group, Rect, Text, Transformer } from "react-konva";

const VideoOverlayKonva = ({
  videoWidth,
  videoHeight,
  videoDuration  ,
  tracks,
  selectedActionId,
  setSelectedActionId,
  onUpdateAction,
}) => {
  const transformerRef = useRef();
  const groupRefs = useRef({});

  // attach transformer to selected group
  useEffect(() => {
    const node = groupRefs.current[selectedActionId]?.current;
    if (!transformerRef.current) return;

    transformerRef.current.nodes(node ? [node] : []);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedActionId, tracks]);

  return (
    <Stage width={videoWidth} height={videoHeight}>
      <Layer>
        {tracks
          .filter(t => t.type === "text")
          .flatMap(t => t.actions)
          .map(action => {
            if (!groupRefs.current[action.id]) {
              groupRefs.current[action.id] = React.createRef();
            }

            const start = action.start ?? 0;
            const end = action.end ?? start + 2;
            const fontSize = action.fontSize ?? 24;

            const width =
              ((end - start) / videoDuration) * videoWidth;

            const x = (start / videoDuration) * videoWidth;
            const y = action.y ?? 50;

            return (
              <Group
                key={action.id}
                ref={groupRefs.current[action.id]}
                x={x}
                y={y}
                width={width}
                height={fontSize + 10}
                draggable
                onClick={() => setSelectedActionId(action.id)}
                onDragEnd={e => {
                  const newStart =
                    (e.target.x() / videoWidth) * videoDuration;
                  const duration = end - start;

                  onUpdateAction(action.id, {
                    start: newStart,
                    end: newStart + duration,
                    y: e.target.y(),
                  });
                }}
              >
                <Rect
                  width={width}
                  height={fontSize + 10}
                  fill="rgba(0,0,0,0.35)"
                  cornerRadius={4}
                />
                <Text
                  text={action.text}
                  fontSize={fontSize}
                  fill={action.color || "#fff"}
                  width={width}
                  height={fontSize + 10}
                  align="center"
                  verticalAlign="middle"
                />
              </Group>
            );
          })}

        {/* RESIZE HANDLES */}
        <Transformer
          ref={transformerRef}
          rotateEnabled={false}
          enabledAnchors={["middle-left", "middle-right"]}
          boundBoxFunc={(oldBox, newBox) => ({
            ...newBox,
            width: Math.max(40, newBox.width),
          })}
          onTransformEnd={() => {
            const group = groupRefs.current[selectedActionId]?.current;
            if (!group) return;

            const scaleX = group.scaleX();
            const newWidthPx = group.width() * scaleX;

            group.scaleX(1);

            const action = tracks
              .flatMap(t => t.actions)
              .find(a => a.id === selectedActionId);

            if (!action) return;

            const newDuration =
              (newWidthPx / videoWidth) * videoDuration;

            onUpdateAction(action.id, {
              end: action.start + Math.max(0.2, newDuration),
            });
          }}
        />
      </Layer>
    </Stage>
  );
};

export default VideoOverlayKonva;
