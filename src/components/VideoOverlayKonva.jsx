import React, { useRef, useEffect, useState } from "react";
import { Stage, Layer, Group, Rect, Text, Transformer, Image as KonvaImage } from "react-konva";

const VideoOverlayKonva = ({
  videoWidth,
  videoHeight,
  videoDuration,
  tracks,
  selectedActionId,
  setSelectedActionId,
  onUpdateAction,
  currentTime, imageOverlays = [], onUpdateImageOverlay,
}) => {
  const transformerRef = useRef();
  const groupRefs = useRef({});
  const [images, setImages] = useState({});

  // attach transformer to selected group
  useEffect(() => {
    const node = groupRefs.current[selectedActionId]?.current;
    if (!transformerRef.current) return;

    transformerRef.current.nodes(node ? [node] : []);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedActionId, tracks]);

  // Load images for image overlays
  useEffect(() => {
    const imageTrack = tracks.find(t => t.type === "image");
    if (!imageTrack) return;

    imageTrack.actions.forEach(action => {
      if (!action.src || images[action.id]) return;

      const img = new window.Image();
      img.src = action.src;
      img.onload = () => {
        setImages(prev => ({
          ...prev,
          [action.id]: img
        }));
      };
    });
  }, [tracks, images]);

  return (
    <Stage width={videoWidth} height={videoHeight}>
      <Layer>
        {/* TEXT OVERLAYS */}
        {tracks
          .filter(t => t.type === "text")
          .flatMap(t => t.actions)
          .filter(action => {
            // ✅ Only show if within time range
            const start = action.start ?? 0;
            const end = action.end ?? start + 2;
            return currentTime >= start && currentTime <= end;
          })
          .map(action => {
            if (!groupRefs.current[action.id]) {
              groupRefs.current[action.id] = React.createRef();
            }

            const start = action.start ?? 0;
            const end = action.end ?? start + 2;
            const fontSize = action.fontSize ?? 24;

            const width = ((end - start) / videoDuration) * videoWidth;
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
                onTap={() => setSelectedActionId(action.id)}
                onDragEnd={e => {
                  const newStart = (e.target.x() / videoWidth) * videoDuration;
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

        {/* IMAGE OVERLAYS */}
        {imageOverlays
    .filter(overlay => {
      // ✅ Only show if within time range
      const start = overlay.start ?? 0;
      const end = overlay.end ?? start + 5;
      return currentTime >= start && currentTime <= end;
    })
    .map(overlay => {
      if (!groupRefs.current[overlay.id]) {
        groupRefs.current[overlay.id] = React.createRef();
      }

      const x = overlay.position?.x ?? 20;
      const y = overlay.position?.y ?? 20;
      const width = overlay.size?.width ?? 150;
      const height = overlay.size?.height ?? 150;
      const opacity = overlay.opacity ?? 1;

      const image = images[overlay.id];
      if (!image) {
        console.log('⚠️ Image not loaded yet for overlay:', overlay.id);
        return null;
      }

      console.log('✅ Rendering image overlay:', overlay.id, { x, y, width, height });

      return (
        <Group
          key={overlay.id}
          ref={groupRefs.current[overlay.id]}
          x={x}
          y={y}
          draggable
          onClick={(e) => {
            console.log('🖼️ Image clicked:', overlay.id);
            e.cancelBubble = true;
            setSelectedActionId(overlay.id);
          }}
          onTap={(e) => {
            console.log('🖼️ Image tapped:', overlay.id);
            e.cancelBubble = true;
            setSelectedActionId(overlay.id);
          }}
          onDragStart={() => {
            console.log('🖼️ Image drag started:', overlay.id);
          }}
          onDragEnd={e => {
            console.log('🖼️ Image drag ended:', overlay.id, {
              x: e.target.x(),
              y: e.target.y()
            });
            
            onUpdateImageOverlay(overlay.id, {
              position: {
                x: e.target.x(),
                y: e.target.y(),
              },
            });
          }}
        >
          <KonvaImage
            image={image}
            width={width}
            height={height}
            opacity={opacity}
          />
          
          {/* Selection border */}
          {selectedActionId === overlay.id && (
            <Rect
              width={width}
              height={height}
              stroke="#3b82f6"
              strokeWidth={2}
              dash={[5, 5]}
              listening={false}
            />
          )}
        </Group>
      );
    })}

        {/* RESIZE HANDLES */}
        <Transformer
          ref={transformerRef}
          rotateEnabled={false}
          keepRatio={false}
          enabledAnchors={(() => {
            const selectedAction = tracks
              .flatMap(t => t.actions)
              .find(a => a.id === selectedActionId);
            
            if (!selectedAction) return [];
            
            return selectedAction.type === "text"
              ? ["middle-left", "middle-right"]
              : ["top-left", "top-right", "bottom-left", "bottom-right"];
          })()}
          boundBoxFunc={(oldBox, newBox) => ({
            ...newBox,
            width: Math.max(20, newBox.width),
            height: Math.max(20, newBox.height),
          })}
          onTransformEnd={() => {
            console.log('🔧 Transform ended for:', selectedActionId);
            
            const group = groupRefs.current[selectedActionId]?.current;
            if (!group) {
              console.log('❌ No group found');
              return;
            }

            const action = tracks
              .flatMap(t => t.actions)
              .find(a => a.id === selectedActionId);

            if (!action) {
              console.log('❌ No action found');
              return;
            }

            console.log('📊 Action type:', action.type);

            // Handle text overlay resize (duration-based)
            if (action.type === "text") {
              const scaleX = group.scaleX();
              const newWidthPx = group.width() * scaleX;
              
              group.scaleX(1);

              const newDuration = (newWidthPx / videoWidth) * videoDuration;

              console.log('📝 Text resize:', { newDuration });

              onUpdateAction(action.id, {
                end: action.start + Math.max(0.2, newDuration),
              });
            }
            
           
           // Handle image overlay resize (size-based)
        else if (action.type === "image") {
          const scaleX = group.scaleX();
          const scaleY = group.scaleY();

          const newWidth = action.size.width * scaleX;
          const newHeight = action.size.height * scaleY;

          console.log('🖼️ Image resize:', { 
            scaleX, 
            scaleY, 
            oldWidth: action.size.width,
            oldHeight: action.size.height,
            newWidth, 
            newHeight 
          });

          // Reset scale to 1
          group.scaleX(1);
          group.scaleY(1);

          // ✅ Use onUpdateImageOverlay instead of onUpdateAction
          if (onUpdateImageOverlay) {
            onUpdateImageOverlay(action.id, {
              size: {
                width: Math.max(20, newWidth),
                height: Math.max(20, newHeight),
              },
            });
          }}} 
                }
        />
      </Layer>
    </Stage>
  );
};

export default VideoOverlayKonva;