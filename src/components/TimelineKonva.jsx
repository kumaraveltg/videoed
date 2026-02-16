// TimelineKonva.jsx - IMPROVED with button context menu
import React, { useRef, useState, useEffect,memo } from "react";
import { Stage, Layer, Rect, Group, Line, Circle, Text } from "react-konva";
import { Image as KonvaImage } from "react-konva";
import TimelineRuler from "./TimelineRuler";

const TimelineKonva = ({
  tracks = [],
  videoDuration = 0,
  currentTime = 0,
  scrollLeft = 0,
  onTimeChange,
  onAddAction,
  onDeleteAction,
  onAddVideoRequest,
  onAddAudioRequest,
  timelinePxWidth,
  videoRef,
  visibleRange = { start: 0, end: 30 },
  onAudioTrackAction,onSplit,clips = [],  razorMode,setRazorMode,
  onAddSecondVideoRequest,  
  onSecondVideoTrackAction,
  onAddVideoOverlay,        
  onDeleteVideoOverlay, serverFilename,
  handleAddInsertVideo,onDeleteImageOverlay,onAddImageRequest,frameCache,loadingFrames,failedFrames
}) => {
  const stageRef = useRef();
  const PIXELS_PER_SECOND = 10;
  const FRAME_WIDTH = PIXELS_PER_SECOND;
  const trackHeight = 50;
  const timelineWidth = timelinePxWidth || videoDuration * PIXELS_PER_SECOND;

  const timeToX = (t) => t * PIXELS_PER_SECOND;
  const xToTime = (x) => {
    let time = x / PIXELS_PER_SECOND;
    if (time > videoDuration) time = videoDuration;
    if (time < 0) time = 0;
    return time;
  };

  const initCap = (str) =>
    str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

  

  // Frame component   src,
  const Frame = memo(({ 
  frameIndex,
  frameCache,
  isLoading,
  x, 
  y, 
  w, 
  h, 
  absoluteTime, 
  razorMode,
  onTimeChange, 
  videoRef,
  isFailed 
}) => {
  const [image, setImage] = useState(null);
  const [isHovered, setIsHovered] = useState(false);

  //console.log(`[Frame ${frameIndex}] Rendering at x=${x}, has cache: ${frameCache?.has(frameIndex)}, loading: ${isLoading}`);
  useEffect(() => {
    const cachedUrl = frameCache?.get(frameIndex);
    
    if (!cachedUrl) {
      setImage(null);
      return;
    }
    
    const img = new window.Image();
    img.src = cachedUrl;
    img.onload = () => setImage(img);
    img.onerror = () => {
      console.error(`[Frame ${frameIndex}] Image load error`);
      setImage(null);
    };
    
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [frameIndex, frameCache]);

  const handleClick = (e) => {
    e.cancelBubble = true;
    if (razorMode) return;
    if (!onTimeChange || !videoRef?.current) return;

    onTimeChange(absoluteTime);
    
    requestAnimationFrame(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = absoluteTime;
        videoRef.current.play().catch(() => {});
      }
    });
  };

  // ✅ Show placeholder when image is not loaded
  if (!image) {
    return (
      <Group>
        <Rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill={isFailed ? "#3d1f1f" : "#2a2a2a"}  // Red tint for failed frames
          stroke={isFailed ? "#ef4444" : "#444"}
          strokeWidth={1}
          listening={false}
        />
        
        {/* Loading/Error indicator */}
        <Text
          x={x + w/2}
          y={y + h/2}
          text={isFailed ? "✗" : isLoading ? "..." : "○"}
          fontSize={10}
          fill={isFailed ? "#ef4444" : isLoading ? "#60a5fa" : "#666"}
          align="center"
          verticalAlign="middle"
          offsetX={5}
          offsetY={5}
          listening={false}
        />
      </Group>
    );
  }

  // ✅ Render loaded image
  return (
    <>
      <KonvaImage
        image={image}
        x={x}
        y={y}
        width={w}
        height={h}
        onClick={handleClick}
        onTap={handleClick}
        onMouseEnter={() => !razorMode && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        opacity={isHovered ? 0.9 : 1}
        shadowBlur={isHovered ? 5 : 0}
        shadowColor="rgba(255,255,255,0.5)"
        listening={true}
      />
      
      {isHovered && !razorMode && (
        <>
          <Rect
            x={x}
            y={y - 24}
            width={w}
            height={22}
            fill="rgba(0,0,0,0.95)"
            cornerRadius={4}
            listening={false}
          />
          <Text
            x={x + 3}
            y={y - 20}
            text={`${Math.floor(absoluteTime / 60)}:${(Math.floor(absoluteTime % 60)).toString().padStart(2, '0')}`}
            fontSize={12}
            fill="#fff"
            fontFamily="monospace"
            fontStyle="bold"
            listening={false}
          />
        </>
      )}
    </>
  );
}, (prevProps, nextProps) => {
  // ✅ Custom comparison: only re-render if these specific props change
  return (
    prevProps.frameIndex === nextProps.frameIndex &&
    prevProps.x === nextProps.x &&
    prevProps.y === nextProps.y &&
    prevProps.razorMode === nextProps.razorMode &&
    prevProps.frameCache?.get(prevProps.frameIndex) === nextProps.frameCache?.get(nextProps.frameIndex)
  );
}); 
Frame.displayName = 'Frame';

  const handleScrub = (e) => {
    const stage = e.target.getStage();
    if (!stage) return;
    
    const pos = stage.getPointerPosition();
    if (!pos) return;

    const newTime = xToTime(pos.x);
    
    if (onTimeChange) {
      onTimeChange(newTime);
    }
    
    if (videoRef?.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const [contextMenu, setContextMenu] = useState(null);
  const menuRef = useRef(null);
  
  useEffect(() => {
    if (!contextMenu) return;

    const handleClickOutside = (e) => {
      console.log('Click detected, button:', e.button);
      
      if (menuRef.current && menuRef.current.contains(e.target)) {
        console.log('Clicked inside menu - keeping open');
        return;
      }
      
      console.log('Clicked outside - closing menu');
      setContextMenu(null);
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [contextMenu]);

  // Handle right-click on Stage (track area)
  const handleStageContextMenu = (e) => {
    console.log('🎯 Stage context menu triggered');
    e.evt.preventDefault();
    
    const stage = stageRef.current;
    if (!stage) return;
    
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    
    // Calculate which track was clicked
    const clickedY = pointerPos.y - 30; // Subtract ruler height
    const trackIndex = Math.floor(clickedY / trackHeight);
    
    if (trackIndex < 0 || trackIndex >= tracks.length) {
      console.log('❌ Click outside tracks');
      return;
    }
    
    const clickedTrack = tracks[trackIndex];
    console.log('✅ Clicked track:', clickedTrack.type, 'at index', trackIndex);
    
    if (clickedTrack.type !== "audio") {
      console.log('❌ Not audio track, ignoring');
      return;
    }
    
    const menuData = {
      x: e.evt.clientX,
      y: e.evt.clientY,
      trackId: clickedTrack.id
    };
    
    console.log('✅ Opening menu at:', e.evt.clientX, e.evt.clientY);
    setContextMenu(menuData);
  };

  // ✅ NEW: Handle button click/right-click
  const handleButtonInteraction = (track, e, isRightClick = false) => {
    console.log('🔘 Button interaction:', track.type, 'isRightClick:', isRightClick);
    
    if (isRightClick) {
      // Right-click on button
      e.preventDefault();
      e.stopPropagation();
      
      if (track.type === "videooverlay") {
      // ✅ Check if there are any overlay actions first
      if (track.actions && track.actions.length > 0) {
        console.log('✅ Opening context menu from button (videooverlay)');
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          trackId: track.id,
          trackType: 'videooverlay'
        });
      } else {
        console.log('⚠️ No overlays yet, ignoring right-click');
      }
      return;  
    }

      if (track.type === "audio") {
        console.log('✅ Opening context menu from button');
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          trackId: track.id
        });
      }
     else if (track.type === "secondvideo") { 
            console.log('✅ Opening context menu from button (secondvideo)');
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              trackId: track.id,
              trackType: 'secondvideo' // ✅ Add trackType
            });
          }
        }  
    else {
      // Left-click on button (existing behavior)
      if (track.type === "secondvideo")
        onAddSecondVideoRequest?.(track.id);
       else if (track.type === "videooverlay") {  
        onAddVideoOverlay?.(); 
    }  
       else if (track.type === "image")   
      onAddImageRequest?.(track.id);          
      else if (track.type === "audio")
        onAddAudioRequest?.(track.id);
      else if (track.type === "text" )  //
                onAddAction?.(track.id, currentTime);
      else if (track.type.toLowerCase().includes("video")) {
         onAddVideoRequest?.(track.id);  
     }   
    }
  };
  

 return (
  <div style={{ background: "#222", position: "relative" }}>
    <button 
      onClick={() => {
        console.log("🔘 Razor button clicked, current:", razorMode);
        setRazorMode(v => !v);
      }}
      style={{
        padding: '8px 16px',
        background: razorMode ? '#ef4444' : '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        fontWeight: 'bold',
        marginBottom: 10
      }}
    >
      {razorMode ? "✂️ Razor Active (Click to Disable)" : "✂️ Enable Razor Tool"}
    </button> 
    <input
      type="file"
      accept="video/*"
      hidden
      id="insert-video-input"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const position = prompt(
          `Insert at what position? (0 - ${videoDuration.toFixed(2)}s)\n` +
          `Current time: ${currentTime.toFixed(2)}s`,
          currentTime.toFixed(2)
        );
        
        if (position !== null) {
          handleAddInsertVideo(file, parseFloat(position));
        }
        
        e.target.value = "";
      }}
    />
     <button
      onClick={() => document.getElementById('insert-video-input').click()}
      disabled={!serverFilename}
      style={{
        padding: "8px 16px", 
         background: serverFilename ? "#10b981" : "#6b7280",
        color: "white",
        border: "none",
        borderRadius: 6,
        cursor: serverFilename ? "pointer" : "not-allowed", 
        fontWeight: "bold"
      }}
    >
      ➕ Insert Videos
    </button> 
    
    {razorMode && (
      <div style={{ 
        padding: 8, 
        background: '#fef3c7', 
        color: '#92400e',
        borderRadius: 4,
        marginBottom: 10,
        fontSize: 13
      }}>
        ⚠️ Click on the timeline to split at that position
      </div>
    )}
    
    {/* Timeline Ruler */}
    <TimelineRuler
      videoDuration={videoDuration}
      currentTime={currentTime}
      scrollLeft={scrollLeft}
      PIXELS_PER_SECOND={PIXELS_PER_SECOND}
      height={50}
      onTimeChange={onTimeChange}
    />

    {/* Main timeline */}
    <div style={{ display: "flex", borderTop: "1px solid #555" }}>
      {/* Add buttons */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          paddingTop: 30,
          flexShrink: 0,
          background: "#1a1a1a",
          borderRight: "1px solid #555",
        }}
      >
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
              onClick={(e) => handleButtonInteraction(track, e, false)}
              onContextMenu={(e) => handleButtonInteraction(track, e, true)}
              style={{
                width: 35,
                height: trackHeight - 6,
                marginBottom: 2,
                background: track.type === "audio" 
                  ? "#4a9c6d" 
                  : track.type === "secondvideo"
                  ? "#8b5cf6"   
                  : "#555",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: "bold",
                padding: 0,
                borderRadius: 3,
              }}
              title={
                track.type === "audio" 
                  ? "Left-click: Add Audio | Right-click: More options"
                  : track.type === "secondvideo"
                  ? "Left-click: Add Second Video | Right-click: Remove"  
                  : `Add ${initCap(track.type)}`
              }
            >
             {track.type === "secondvideo" ? "Sec.VI" : initCap(track.type).slice(0, 2)}
            </button>
          </div>
        ))}
      </div>

      {/* Konva Stage */}
      <div style={{ minWidth: 0, flex: 1, position: 'relative' }}>
        <Stage
          ref={stageRef}
          width={timelineWidth}
          height={tracks.length * trackHeight + 30}
          style={{ 
            display: 'block',
            background: '#1a1a1a'
          }}
          onMouseDown={(e) => {
            console.log("🎯🎯🎯 STAGE CLICKED - razorMode:", razorMode, "button:", e.evt.button);
            
            if (e.evt.button === 2) {
              console.log("⏭️ Right-click ignored");
              return;
            }
            
            if (razorMode) {
              console.log("✂️✂️✂️ RAZOR MODE ACTIVE - SPLITTING");
              const stage = e.target.getStage();
              const pos = stage.getPointerPosition();

              if (!pos) {
                console.log("❌ No position");
                return;
              }

              const time = (pos.x + scrollLeft) / PIXELS_PER_SECOND;
              console.log("✅✅✅ SPLIT TIME:", time);
              
              if (onSplit) {
                onSplit(time);
                console.log("✅ onSplit called");
              } else {
                console.log("❌ onSplit is undefined");
              }
              
              return;
            }
            
            console.log("🎬 Normal scrub mode");
            handleScrub(e);
          }}
          onMouseMove={(e) => {
            if (e.evt.buttons === 1 && !razorMode) {
              handleScrub(e);
            }
          }}
          onContextMenu={handleStageContextMenu}
        >
          {/* Current time indicator */}
          <Layer>
            <Line
              points={[
                timeToX(currentTime),
                0,
                timeToX(currentTime),
                tracks.length * trackHeight + 30,
              ]}
              stroke="#ff4444"
              strokeWidth={2}
              listening={false}
              shadowColor="#ff0000"
              shadowBlur={8}
              shadowOpacity={0.6}
            />
          </Layer> 

          {/* TRACKS - Disable listening in razor mode */}
          <Layer listening={!razorMode}>
            {tracks.map((track, rowIndex) => {
              const trackY = rowIndex * trackHeight + 30;
              let trackBgColor = "#333";
              if (track.type === "secondvideo") {
                trackBgColor = "#2d1b4e";  
              } else if (track.type === "videooverlay") {  
                    trackBgColor = "#1e3a5f";  
                  }
              return (
                <Group key={track.id} x={0} y={trackY}>
                  <Rect
                    x={0}
                    y={0}
                    width={timelineWidth}
                    height={trackHeight - 2}
                    fill={trackBgColor}
                    listening={false}
                  />

                  <Text
                    x={5}
                    y={5}
                    text={track.type === "secondvideo" ? "Second Video" : track.type === "videooverlay" ? "Video Overlay"  : initCap(track.type)}
                    fontSize={11}
                    fill={track.type === "secondvideo" ? "#c4b5fd" : track.type === "videooverlay"? "#93c5fd"  : "#888"}
                    fontFamily="Arial"
                    listening={false}
                  />

                  {track.actions?.map((action) => {
                    const start = action.start ?? 0;
                    const end = action.end ?? start + 1;
                    const duration = Math.max(0.2, end - start);
                    const actionX = timeToX(start);
                    const actionW = timeToX(duration);

                    const allFrames = action.allFrames || [];
                    
                    const viewportStart = Math.floor(visibleRange.start);
                    const viewportEnd = Math.ceil(visibleRange.end);

                    let color = "#999";
                    if (track.type === "text") color = "lightblue";
                    if (track.type === "audio") color = "lightgreen";
                    if (track.type === "image") color = "orange";
                    if (track.type === "video") color = "#4a5568";
                    if (track.type === "secondvideo") color = "#8b5cf6"; 
                    if (track.type === "videooverlay") color = "#3b82f6";
                    return (
                      <Group key={action.id} x={actionX} y={4}>
                        <Rect
                          x={0}
                          y={0}
                          width={actionW}
                          height={trackHeight - 10}
                          fill={color}
                          opacity={0.6}
                          cornerRadius={4}
                          stroke="#fff"
                          strokeWidth={1}
                          listening={false}
                        />

                        {track.type === "text" && (
                          <>
                            <Circle
                              x={actionW - 10}
                              y={8}
                              radius={6}
                              fill="red"
                              onClick={() => onDeleteAction(track.id, action.id)}
                            />
                            <Text
                              x={actionW - 13}
                              y={4}
                              text="×"
                              fontSize={12}
                              fill="#fff"
                              onClick={() => onDeleteAction(track.id, action.id)}
                            />
                          </>
                        )}
                        {/* ✅ ADD DELETE BUTTON FOR IMAGE */}
                        {track.type === "image" && (
                          <>
                            <Circle
                              x={actionW - 10}
                              y={8}
                              radius={6}
                              fill="red"
                              onClick={() => onDeleteImageOverlay?.(action.id)}
                            />
                            <Text
                              x={actionW - 13}
                              y={4}
                              text="×"
                              fontSize={12}
                              fill="#fff"
                              onClick={() => onDeleteImageOverlay?.(action.id)}
                            />
                          </>
                        )}
                        {track.type === "text" && action.text && (
                          <Text
                            x={5}
                            y={(trackHeight - 10) / 2 - 6}
                            text={action.text}
                            fontSize={12}
                            fill="#fff"
                            listening={false}
                          />
                        )}
                        {/* ✅ ADD IMAGE PREVIEW IN TIMELINE */}
                          {track.type === "image" && action.filename && (
                            <Text
                              x={5}
                              y={(trackHeight - 10) / 2 - 6}
                              text={`🖼️ ${action.filename.slice(0, 15)}...`}
                              fontSize={10}
                              fill="#fff"
                              listening={false}
                            />
                          )}
                        {/* {track.type === "video" && allFrames.length > 0 && (
                          <>
                            {allFrames.map((frameSrc, frameIndex) => {
                              const absoluteTime = frameIndex;
                              
                              if (absoluteTime < viewportStart || absoluteTime > viewportEnd) {
                                return null;
                              }
                              
                              const frameX = (absoluteTime - start) * FRAME_WIDTH;
                              
                              if (frameX < 0 || frameX >= actionW) {
                                return null;
                              }

                              return (
                                <Frame
                                  key={`${action.id}-frame-${frameIndex}`}
                                  src={frameSrc}
                                  x={frameX}
                                  y={0}
                                  w={FRAME_WIDTH}
                                  h={trackHeight - 10}
                                  absoluteTime={absoluteTime}
                                  frameIndex={frameIndex}
                                  razorMode={razorMode}
                                  onTimeChange={onTimeChange}
                                  videoRef={videoRef}
                                />
                              );
                            })}
                          </> 
                        )}  */}
                        {track.type === "video" && action.useVirtualFrames && (
                          <>
                          {/* {console.log('[Timeline] Rendering frames:', {
                            actionId: action.id,
                            start: action.start,
                            end: action.end,
                            duration: action.end - action.start,
                            frameCount: Math.ceil(action.end - action.start),
                            cacheSize: frameCache?.size,
                            visibleRange
                          })} */}
                          
                      <Group>
                        {Array.from({ length: Math.ceil(duration) }, (_, i) => {
                          const frameIndex = Math.floor(start) + i;
                          const isLoading = loadingFrames?.has(frameIndex);  // ✅ Check loading
                           const frameX = i * FRAME_WIDTH;  // Position relative to action start
                           const absoluteTime = start + i;
                           const isFailed = failedFrames?.has(frameIndex); 
                          return (
                             <React.Fragment key={`${action.id}-frame-${frameIndex}`}>
                            <Frame
                              frameIndex={frameIndex}      // ✅ Pass index
                              frameCache={frameCache}      // ✅ Pass cache
                              isLoading={isLoading}  
                              isFailed={isFailed}       // ✅ Pass loading state
                              x={frameX}
                              y={0}
                              w={FRAME_WIDTH}
                              h={trackHeight - 10}
                              absoluteTime={absoluteTime} 
                              razorMode={razorMode}
                              onTimeChange={onTimeChange}
                              videoRef={videoRef}
                            />
                            </React.Fragment>
                          );
                        })}
                      </Group>
                      </>
                    )}
                      </Group>
                    );
                  })}
                </Group>
              );
            })}
            
            {/* Clips visualization */}
            {clips.map(clip => {
              const videoTrackIndex = tracks.findIndex(t => t.type === "video");
              if (videoTrackIndex === -1) return null;
              
              const trackY = videoTrackIndex * trackHeight + 30;
              
              return (
                <Group key={clip.id}>
                  <Rect
                    x={clip.start * PIXELS_PER_SECOND}
                    y={trackY + 4}
                    width={(clip.end - clip.start) * PIXELS_PER_SECOND}
                    height={trackHeight - 10}
                    fill="transparent"
                    stroke="#00ff00"
                    strokeWidth={2}
                    dash={[5, 5]}
                    listening={false}
                  />
                  <Line
                    points={[
                      clip.start * PIXELS_PER_SECOND, trackY,
                      clip.start * PIXELS_PER_SECOND, trackY + trackHeight
                    ]}
                    stroke="#ff0000"
                    strokeWidth={2}
                    listening={false}
                  />
                </Group>
              );
            })}
          </Layer>
        </Stage>
      </div>         
    </div>
    
    {/* Context Menu */}
    // Update the context menu rendering in TimelineKonva.jsx
{contextMenu && (
  <div
    ref={menuRef}
    style={{
      position: "fixed",
      top: contextMenu.y,
      left: contextMenu.x,
      background: "#1b1b1b",
      border: "1px solid #444",
      borderRadius: 6,
      padding: 6,
      zIndex: 9999,
      width: 180,
      boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
    }}
    onMouseDown={(e) => e.stopPropagation()}
  >
    {contextMenu.trackType === 'videooverlay' ? (
      // ✅ Video overlay menu options
      [
        { label: "🗑 Remove Overlay", action: "remove" },
        { label: "⚙️ Adjust Position", action: "adjust" },
        { label: "🔊 Adjust Volume", action: "volume" },
      ].map((item) => (
        <div
          key={item.action}
          style={{
            padding: "8px 12px",
            cursor: "pointer",
            color: "#fff",
            fontSize: "13px",
            borderRadius: "4px",
            transition: "background 0.15s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#333"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          onClick={() => {
            if (item.action === "remove") {
              onDeleteVideoOverlay?.(contextMenu.trackId);
            }
            // Add handlers for adjust and volume later
            setContextMenu(null);
          }}
        >
          {item.label}
        </div>
      ))
    ) : contextMenu.trackType === 'secondvideo' ? (
      // Second video menu options
      [
        { label: "🗑 Remove Second Video", action: "remove" },
      ].map((item) => (
        <div
          key={item.action}
          style={{
            padding: "8px 12px",
            cursor: "pointer",
            color: "#fff",
            fontSize: "13px",
            borderRadius: "4px",
            transition: "background 0.15s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#333"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          onClick={() => {
            onSecondVideoTrackAction?.(item.action, contextMenu.trackId);
            setContextMenu(null);
          }}
        >
          {item.label}
        </div>
      ))
    ) : (
      // Audio track menu options (existing)
      [
        { label: "🔇 Mute", action: "mute" },
        { label: "🎵 Keep Video Audio", action: "keep" },
        { label: "🔁 Replace,Added Audio", action: "replaceMode" },
        { label: "🎚 Mix Both", action: "mix" },
        { label: "🗑 Delete Track", action: "delete" },
      ].map((item) => (
        <div
          key={item.action}
          style={{
            padding: "8px 12px",
            cursor: "pointer",
            color: "#fff",
            fontSize: "13px",
            borderRadius: "4px",
            transition: "background 0.15s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#333"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          onClick={() => {
            onAudioTrackAction?.(item.action, contextMenu.trackId);
            setContextMenu(null);
          }}
        >
          {item.label}
        </div>
      ))
    )}
  </div>
)}
  </div>
);
};

export default TimelineKonva;
