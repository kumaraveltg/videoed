import React, { useRef, useEffect, useState } from "react";
import { Stage, Layer, Group, Rect, Text, Transformer, Image as KonvaImage } from "react-konva";

const VideoOverlayKonva = ({
  videoWidth: containerWidth,
  videoHeight: containerHeight,
  videoDuration,
  tracks = [],
  selectedActionId,
  setSelectedActionId,
  onUpdateAction,
  currentTime,
  imageOverlays = [],
  onUpdateImageOverlay,
  videoRef
}) => {
  const transformerRef = useRef();
  const groupRefs = useRef({});
  const [images, setImages] = useState({});

  // Attach transformer to selected group
  useEffect(() => {
    if (!transformerRef.current || !selectedActionId) return;

    const groupRef = groupRefs.current[selectedActionId];
    if (!groupRef || !groupRef.current) return;

    transformerRef.current.nodes([groupRef.current]);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedActionId, tracks, imageOverlays]);

  // Load images for image overlays
  useEffect(() => {
    imageOverlays.forEach((overlay) => {
      if (!overlay.src || images[overlay.id]) return;
      const img = new window.Image();
      img.src = overlay.src;
      img.onload = () => {
        setImages(prev => ({ ...prev, [overlay.id]: img }));
      };
    });
  }, [imageOverlays, images]); 

  return (
    <Stage
      width={containerWidth}
      height={containerHeight}
      style={{ 
        position: "absolute", 
        top: 0, 
        left: 0, 
        pointerEvents: "auto"
      }}
    >
      <Layer>
        {/* TEXT OVERLAYS - Timeline based */}
        {tracks
          .filter(t => t.type === "text")
          .flatMap(t => t.actions || [])
          .filter(action => {
            const start = action.start ?? 0;
            const end = action.end ?? start + 2;
            const isVisible = currentTime >= start && currentTime <= end;
            
            // ✅ DEBUG: Log each text action
            console.log(`📝 Text "${action.text}": start=${start}s, end=${end}s, currentTime=${currentTime}s, visible=${isVisible}`);
            
            return isVisible;
          })
          .map(action => {
            if (!groupRefs.current[action.id]) groupRefs.current[action.id] = React.createRef();

            const fontSize = action.fontSize ?? 24;
            const width = Math.max(100, fontSize * (action.text?.length || 5) * 0.6);
            
            const x = action.x ?? 50;
            const y = action.y ?? 50;

            console.log(`✅ Rendering text "${action.text}" at (${x}, ${y})`);

            return (
              <Group
                key={action.id}
                ref={groupRefs.current[action.id]}
                x={x}
                y={y}
                draggable
                onClick={() => setSelectedActionId(action.id)}
                onTap={() => setSelectedActionId(action.id)}
                onDragEnd={e => {
                  onUpdateAction(action.id, {
                    x: e.target.x(),
                    y: e.target.y()
                  });
                }}
              >
                <Rect
                  width={width}
                  height={fontSize + 10}
                  fill="rgba(0,0,0,0.5)"
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
                  padding={5}
                />
              </Group>
            );
          })}

        {/* IMAGE OVERLAYS - Timeline based */}
        {imageOverlays
          .filter(overlay => {
            const start = overlay.start ?? 0;
            const end = overlay.end ?? start + 5;
            const isVisible = currentTime >= start && currentTime <= end;
            
            // ✅ DEBUG: Log each image overlay
            console.log(`🖼️ Image ${overlay.id}: start=${start}s, end=${end}s, currentTime=${currentTime}s, visible=${isVisible}, hasImage=${!!images[overlay.id]}`);
            
            return isVisible;
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
              console.log(`⚠️ Image not loaded for overlay ${overlay.id}`);
              return null;
            }

            console.log(`✅ Rendering image ${overlay.id} at (${x}, ${y})`);

            return (
              <Group
                key={overlay.id}
                ref={groupRefs.current[overlay.id]}
                x={x}
                y={y}
                draggable
                onClick={e => { 
                  e.cancelBubble = true; 
                  setSelectedActionId(overlay.id); 
                }}
                onTap={e => { 
                  e.cancelBubble = true; 
                  setSelectedActionId(overlay.id); 
                }}
                onDragEnd={e => {
                  onUpdateImageOverlay(overlay.id, {
                    position: {
                      x: e.target.x(),
                      y: e.target.y()
                    }
                  });
                }}
              >
                <KonvaImage
                  image={image}
                  width={width}
                  height={height}
                  opacity={opacity}
                />
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

        {/* TRANSFORMER */}
        <Transformer
          ref={transformerRef}
          rotateEnabled={false}
          keepRatio={false}
          enabledAnchors={
            (() => {
              const allActions = tracks.flatMap(t => t.actions || []);
              const textAction = allActions.find(a => a.id === selectedActionId);
              const imageOverlay = imageOverlays.find(o => o.id === selectedActionId);
              
              const selected = textAction || imageOverlay;
              if (!selected) return [];
              
              const isText = selected.type === "text" || textAction;
              
              return isText
                ? ["middle-left", "middle-right"]
                : ["top-left", "top-right", "bottom-left", "bottom-right"];
            })()
          }
          boundBoxFunc={(oldBox, newBox) => ({
            ...newBox,
            width: Math.max(20, newBox.width),
            height: Math.max(20, newBox.height)
          })}
          onTransformEnd={() => {
            const group = groupRefs.current[selectedActionId]?.current;
            if (!group) return;

            const allActions = tracks.flatMap(t => t.actions || []);
            const textAction = allActions.find(a => a.id === selectedActionId);
            const imageOverlay = imageOverlays.find(o => o.id === selectedActionId);
            
            const action = textAction || imageOverlay;
            if (!action) return;

            if (textAction) {
              group.scaleX(1);
              group.scaleY(1);
            } else if (imageOverlay) {
              const scaleX = group.scaleX();
              const scaleY = group.scaleY();
              const newWidth = (action.size?.width ?? 150) * scaleX;
              const newHeight = (action.size?.height ?? 150) * scaleY;
              group.scaleX(1);
              group.scaleY(1);
              
              if (onUpdateImageOverlay) {
                onUpdateImageOverlay(action.id, {
                  size: { width: Math.max(20, newWidth), height: Math.max(20, newHeight) }
                });
              }
            }
          }}
        />
      </Layer>
    </Stage>
  );
};

export default VideoOverlayKonva;