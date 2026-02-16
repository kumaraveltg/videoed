import React, { useState, useEffect } from 'react';

function UnifiedPipelineForm({ 
  mainVideo,
  clips,
  tracks,
  audioMode,
  addedAudioFile,
  videoOverlays,
  imageOverlays,
  insertVideos,
  splitScreenConfig,
  onProcessComplete  ,videoDuration,setMainVideo,setFile,  
  setMainVideoSource,   
  setBlobUrl,   
  setVideoSrc, onClearTimeline
}) {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [backendError, setBackendError] = useState(null);

  const [selectedTasks, setSelectedTasks] = useState({
  trim: false,
  text_overlays: false,
  video_inserts: false,
  image_overlays: false,
  audio_control: false,
  insert_at_position: false,
  split_screen: false
  });
  const [outputQuality, setOutputQuality] = useState('medium');
  const [outputCrf, setOutputCrf] = useState(23);
  const [outputName, setOutputName] = useState('');  
  const [debugInfo, setDebugInfo] = useState(null);
  const [showFullPayload, setShowFullPayload] = useState(false);
  const [lastPayload, setLastPayload] = useState(null); 
  const [mainVideoPath, setMainVideoPath] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedAudioFilename, setUploadedAudioFilename] = useState(null); 
  const [showSucessModal,setShowSuccessModal]= useState(false);

  useEffect(() => {
    const uploadMainVideo = async () => {
      if (mainVideo && mainVideo instanceof File) {
        try {
          setUploading(true);
          setMainVideoPath(''); // Reset path
          console.log('📤 Uploading main video:', mainVideo.name);
          const serverPath = await uploadVideo(mainVideo);
          setMainVideoPath(serverPath);
          console.log('✅ Main video uploaded to:', serverPath);
        } catch (err) {
          console.error('❌ Upload failed:', err);
          setError(`Failed to upload video: ${err.message}`);
        } finally {
          setUploading(false);
        }
      }
    };
    
    uploadMainVideo();
  }, [mainVideo]);

  // Upload helper function
  const uploadVideo = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('http://localhost:8000/upload/local', { // ✅ CHANGED: Use /upload/local
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.filename; // ✅ CHANGED: Return filename, not filepath
  };

  // Auto-detect which tasks have data
  useEffect(() => {
    const hasClips = clips && clips.length > 0;
    const textTrack = tracks?.find(t => t.type === 'text');
    const hasText = textTrack?.actions?.length > 0;
    const hasVideoOv = videoOverlays && videoOverlays.length > 0;
    const hasImageOv = imageOverlays && imageOverlays.length > 0;
    const hasAudioChange = audioMode !== 'keep';
    const hasInserts = insertVideos && insertVideos.length > 0;
    const hasSplit = splitScreenConfig?.enabled || false;

    setSelectedTasks({
      trim: hasClips,
      text_overlays: hasText,
      video_inserts: hasVideoOv,
      image_overlays: hasImageOv,
      audio_control: hasAudioChange,
      insert_at_position: hasInserts,
      //split_screen: hasSplit
    });
  }, [clips, tracks, videoOverlays, imageOverlays, audioMode, insertVideos 
    //, splitScreenConfig
    ]);

  // Debug info
  useEffect(() => {
    const textTrack = tracks?.find(t => t.type === 'text');
    const audioTrack = tracks?.find(t => t.type === 'audio');
    
    setDebugInfo({
      mainVideo: mainVideo?.name || 'NOT SET',
      mainVideoPath: mainVideoPath || 'Not Yet Uploaded',
      hasClips: clips?.length || 0,
      hasTextOverlays: textTrack?.actions?.length || 0,
      hasVideoOverlays: videoOverlays?.length || 0,
      hasImageOverlays: imageOverlays?.length || 0,
      audioMode: audioMode || 'keep',
      hasAudioFile: !!addedAudioFile,
      audioFileName: addedAudioFile?.name || 'none',
      audioTrackActions: audioTrack?.actions?.length || 0,
      hasInsertVideos: insertVideos?.length || 0,
      //splitScreenEnabled: splitScreenConfig?.enabled || false
    });
  }, [mainVideo, mainVideoPath, clips, tracks, videoOverlays, imageOverlays, audioMode, addedAudioFile, insertVideos, splitScreenConfig]);

  // ✅ CORRECTED: Build payload from VideoEditor state
  const buildPayload = (tasksToUse) => {
  console.log('🔍 buildPayload received:', tasksToUse);
  
  // Safety check - use empty object if undefined
  const tasks = tasksToUse || {};
  
  console.log('🔍 Using tasks:', tasks);
  
  const payload = {
    main_video: mainVideoPath,
    output_name: `processed_${Date.now()}.mp4`,
    output_quality: "medium",
    output_crf: 23,  
  };

  console.log('📦 Payload main_video:', payload.main_video);

  // Insert at position
  if (tasks.insert_at_position && insertVideos?.length > 0) {
    console.log('✅ Adding insert_at_position task');
    payload.insert_at_position = {
      enabled: true,
      inserts: insertVideos.map(iv => ({
        filename: iv.filename || iv.uploadedPath || iv.path,
        position: iv.position
      }))
    };
  }

  // Trim
  if (tasks.trim && clips?.length > 0) {
    console.log('✅ Adding trim task');
    payload.trim = {
      enabled: true,
      cuts: clips
    };
  }

  // Text overlays
  const textTrack = tracks?.find(t => t.type === 'text');
  if (tasks.text_overlays && textTrack?.actions?.length > 0) {
    console.log('✅ Adding text_overlays task');
    payload.text_overlays = {
      enabled: true,
      overlays: textTrack.actions.map((action, idx) => {
        const start = parseFloat(action.start);
        const end = parseFloat(action.end);
        const fontSize = parseFloat(action.fontSize);
        const x = parseFloat(action.x);
        const y = parseFloat(action.y);
        
        const result = {
          text: String(action.text || "New Text"),
          start: Number.isFinite(start) ? start : 0,
          end: Number.isFinite(end) ? end : 5,
          fontsize: Number.isFinite(fontSize) ? fontSize : 24,
          fontcolor: String(action.color || "white"),
          position: "custom",
          x: Number.isFinite(x) ? x : 0,
          y: Number.isFinite(y) ? y : 50
        };
        
        console.log(`📝 Text overlay ${idx}:`, result);
        return result;
      })
    };
  }

  // Video inserts (PIP)
  if (tasks.video_inserts && videoOverlays?.length > 0) {
  console.log('✅ Adding video_inserts task');
  
  payload.multiple_inserts = {   
    enabled: true,
    inserts: videoOverlays.map(overlay => ({   
      insert_filename: overlay.serverFilename,
      start_time: overlay.start,
      end_time: overlay.end,
      x: overlay.position.x,
      y: overlay.position.y,
      width: overlay.size.width,
      height: overlay.size.height,
      opacity: overlay.opacity || 1.0,
      volume: overlay.volume || 0.5,
      z_index: overlay.zIndex || 1,
      loop: false,
      fade_in: 0.0,
      fade_out: 0.0
    }))
  };
}

  // Image overlays
  if (tasks.image_overlays && imageOverlays?.length > 0) {
    console.log('✅ Adding image_overlays task');
    
    const maxDuration = parseFloat(videoDuration) || 999999;
    
    payload.image_overlays = {
      enabled: true,
      overlays: imageOverlays.map((overlay, idx) => {
        const start = parseFloat(overlay.start);
        const end = parseFloat(overlay.end);
        const x = parseFloat(overlay.position?.x);
        const y = parseFloat(overlay.position?.y);
        const width = parseFloat(overlay.size?.width);
        const height = parseFloat(overlay.size?.height);
        const opacity = parseFloat(overlay.opacity);
        const fadeIn = parseFloat(overlay.fadeIn);
        const fadeOut = parseFloat(overlay.fadeOut);
        
        const validStart = Number.isFinite(start) ? Math.max(0, start) : 0;
        const validEnd = Number.isFinite(end) ? Math.min(end, maxDuration) : (validStart + 5);
        
        const result = {
          image_filename: String(overlay.serverFilename || 'unknown.png'),
          start: validStart,
          end: validEnd,
          x: Number.isFinite(x) ? Math.max(0, Math.round(x)) : 0,
          y: Number.isFinite(y) ? Math.max(0, Math.round(y)) : 0,
          width: Number.isFinite(width) ? Math.round(width) : 100,
          height: Number.isFinite(height) ? Math.round(height) : 100,
          opacity: Number.isFinite(opacity) ? opacity : 1.0,
          fade_in: Number.isFinite(fadeIn) ? fadeIn : 0.0,
          fade_out: Number.isFinite(fadeOut) ? fadeOut : 0.0
        };
        
        console.log(`🖼️ Image overlay ${idx}:`, result);
        
        // ✅ Final validation - make sure NO field is null/undefined
        Object.keys(result).forEach(key => {
          if (result[key] === null || result[key] === undefined || !Number.isFinite(result[key]) && typeof result[key] === 'number') {
            console.error(`❌ Invalid value for ${key}:`, result[key]);
            throw new Error(`Image overlay ${idx}: ${key} is invalid (${result[key]})`);
          }
        });
        
        return result;
      })
    };
  }

  // Audio control
  if (tasks.audio_control && audioMode !== 'keep') {
    console.log('✅ Adding audio_control task');
    payload.audio_control = {
      enabled: true,
      mode: audioMode,
      ...(audioMode === 'replace' && uploadedAudioFilename && {
        audio_filename: uploadedAudioFilename
      })
    };
  }

  // Split screen
  // if (tasks.split_screen && splitScreenConfig?.enabled) {
  //   console.log('✅ Adding split_screen task');
  //   payload.split_screen = {
  //     enabled: true,
  //     ...splitScreenConfig
  //   };
  // }

  console.log('📤 Final payload tasks:', payload.tasks);
  return payload;
};

  const getActiveTasks = () => {
    const tasks = [];
    if (selectedTasks.trim && clips?.length > 0) tasks.push(`Trim (${clips.length} clips)`);
    const textTrack = tracks?.find(t => t.type === 'text');
    if (selectedTasks.text_overlays && textTrack?.actions?.length > 0) {
      tasks.push(`Text (${textTrack.actions.length} overlays)`);
    }
    if (selectedTasks.video_inserts && videoOverlays?.length > 0) {
      tasks.push(`Video PIP (${videoOverlays.length} overlays)`);
    }
    if (selectedTasks.image_overlays && imageOverlays?.length > 0) {
      tasks.push(`Images (${imageOverlays.length} overlays)`);
    }
    if (selectedTasks.audio_control && audioMode !== 'keep') {
      tasks.push(`Audio (${audioMode})`);
    }
    if (selectedTasks.insert_at_position && insertVideos?.length > 0) {
      tasks.push(`Insert (${insertVideos.length} videos)`);
    }
    // if (selectedTasks.split_screen && splitScreenConfig?.enabled) {
    //   tasks.push('Split Screen');
    // }
    return tasks;
  };

  // ✅ CORRECTED: Handle processing with audio upload
 const handleProcess = async () => {
  if (!mainVideo) {
    console.error('❌ Please select a video file');
    alert('Please select a video file before processing');
    return;
  }

  if (!mainVideoPath) {
    setError('Video is still uploading. Please wait...');
    alert('Video is still uploading to server. Please wait a moment.');
    return;
  }

  const updatedSelectedTasks = {
    insert_at_position: insertVideos?.length > 0,
    trim: clips?.length > 0,
    text_overlays: tracks?.find(t => t.type === 'text')?.actions?.length > 0,
    video_inserts: videoOverlays?.length > 0,
    image_overlays: imageOverlays?.length > 0,
    audio_control: audioMode !== 'keep',
    //split_screen: splitScreenConfig?.enabled || false
  };

  console.log('🔍 updatedSelectedTasks BEFORE passing:', updatedSelectedTasks);


  
  
  // Auto-enable insert_at_position if insertVideos exist
  if (insertVideos?.length > 0) {
    updatedSelectedTasks.insert_at_position = true;
    console.log('✅ Auto-enabled insert_at_position task');
  }
  
  // Auto-enable trim if clips exist
  if (clips?.length > 0) {
    updatedSelectedTasks.trim = true;
    console.log('✅ Auto-enabled trim task');
  }
  
  // Auto-enable text_overlays if text actions exist
  const textTrack = tracks?.find(t => t.type === 'text');
  if (textTrack?.actions?.length > 0) {
    updatedSelectedTasks.text_overlays = true;
    console.log('✅ Auto-enabled text_overlays task');
  }
  
  // Auto-enable video_inserts if video overlays exist
  if (videoOverlays?.length > 0) {
    updatedSelectedTasks.video_inserts = true;
    console.log('✅ Auto-enabled video_inserts task');
  }
  
  // Auto-enable image_overlays if image overlays exist
  if (imageOverlays?.length > 0) {
    updatedSelectedTasks.image_overlays = true;
    console.log('✅ Auto-enabled image_overlays task');
  }
  
  // Auto-enable audio_control if audio mode is not 'keep'
  if (audioMode !== 'keep') {
    updatedSelectedTasks.audio_control = true;
    console.log('✅ Auto-enabled audio_control task');
  }
  
  // Auto-enable split_screen if enabled
  // if (splitScreenConfig?.enabled) {
  //   updatedSelectedTasks.split_screen = true;
  //   console.log('✅ Auto-enabled split_screen task');
  // }
  
  console.log('🔍 Updated selectedTasks:', updatedSelectedTasks);
  
  // Update state with auto-enabled tasks
  setSelectedTasks(updatedSelectedTasks);
  
  // Get active tasks for display
  const activeTasks = getActiveTasks();
  
  // ✅ Check if ANY task is enabled
  const hasEnabledTasks = Object.values(updatedSelectedTasks).some(val => val === true);
  
  console.log('🔍 Has enabled tasks:', hasEnabledTasks);
  console.log('🔍 Active tasks count:', activeTasks.length);
  
  if (!hasEnabledTasks || activeTasks.length === 0) {
    alert('⚠️ No tasks selected. Please add edits to your video.');
    return;
  }

  console.log('📋 Enabled Tasks:', Object.keys(updatedSelectedTasks).filter(k => updatedSelectedTasks[k]));
  console.log('📋 Active Tasks:', activeTasks);

  const confirm = window.confirm(
    `Process video with ${activeTasks.length} task(s)?\n\n` +
    activeTasks.join('\n') +
    `\n\nMain video: ${mainVideo.name}`
  );

  if (!confirm) return;

  setProcessing(true);
  setError(null);
  setBackendError(null);
  setResult(null);

  try {
    // ✅ Upload audio file if needed (BEFORE building payload)
     let currentAudioFilename = null;
    if (updatedSelectedTasks.audio_control && 
        audioMode === 'replace' && 
        addedAudioFile) {
      
      console.log('📤 Uploading audio file:', addedAudioFile.name);
      
      const formData = new FormData();
      formData.append('file', addedAudioFile);
      
      const audioResponse = await fetch('http://localhost:8000/upload/local', {
        method: 'POST',
        body: formData
      });
      
      if (!audioResponse.ok) {
        throw new Error('Audio upload failed');
      }
      
      const audioData = await audioResponse.json();
      currentAudioFilename = audioData.filename;
      setUploadedAudioFilename(audioData.filename);
      
      console.log('✅ Audio uploaded:', audioData.filename);
      
      // Wait for state to update
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log('📞 Calling buildPayload with:', updatedSelectedTasks);
    // ✅ Build payload with updated tasks
    const payload = buildPayload(updatedSelectedTasks);
    setLastPayload(payload);
    
    console.log('📤 FULL PAYLOAD BEING SENT:');
    console.log(JSON.stringify(payload, null, 2));
    
    console.log('🔍 Payload.tasks:', payload.tasks);
    console.log('🔍 Number of tasks in payload:', Object.keys(payload.tasks || {}).length);

    const response = await fetch('http://localhost:8000/video/unified-pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let data;
    try {
      data = await response.json();
    } catch (e) {
      throw new Error(`Server returned invalid JSON (Status ${response.status})`);
    }

    if (!response.ok) {
      console.error('❌ Backend Error Response:', data);
      setBackendError(data);
      throw new Error(data.error || data.detail?.[0]?.msg || data.detail || 'Processing failed');
    }

    console.log('✅ Processing complete:', data);
    setResult(data);
    
    if (onProcessComplete) {
      onProcessComplete(data);
    }

    alert(`✅ Video processing complete!\n\nOutput: ${data.output}`);

  } catch (err) {
    console.error('❌ Processing error:', err);
    setError(err.message);
    alert(`❌ Processing failed:\n\n${err.message}\n\nCheck console and error panel for details.`);
  } finally {
    setProcessing(false);
  }
};
 
 
  const activeTasks = getActiveTasks();

  //------------------------download--------------------

  const handleDownloadAndCleanup = async (result) => {
  try {
    if (!result || !result.output) {
      alert('Error: No video file to download');
      return;
    }
    
    console.log('📥 Downloading:', result.output);
    
    // Download the video
    const downloadResponse = await fetch(
      `http://localhost:8000/video/download/${result.output}`
    );
    
    if (!downloadResponse.ok) {
      throw new Error('Download failed');
    }
    
    // ✅ Clear the video from UI
    setResult(null);  // Reset result state 
    setMainVideo(null);
    setUploading(false); 
    setMainVideo(null);
    setFile(null); 
    setBlobUrl(null);
    setVideoSrc(null);  
    setMainVideoSource(null);
     
     if (onClearTimeline) {
       console.log('🧹 Calling onClearTimeline from download...');
      onClearTimeline(); // ✅ Clear timeline too
    }
    // Show success message
    setShowSuccessModal(true);
    setTimeout(() => {
      setShowSuccessModal(false);
    }, 3000);

    // Create blob and trigger download
    const blob = await downloadResponse.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.output;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    console.log('✅ Download successful');

     
 
    
    
    // Cleanup - delete file from uploads
    const cleanupResponse = await fetch('http://localhost:8000/video/cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: result.output
      })
    });
    
    if (cleanupResponse.ok) {
      const cleanupData = await cleanupResponse.json();
      console.log('🗑️', cleanupData.message);
    }
    
   
    
  } catch (error) {
    console.error('❌ Download error:', error);
    alert(`Download failed: ${error.message}`);
  }
};

  return (
    <div style={{
      marginTop: 30,
      padding: 20,
      background: '#1a1a1a',
      borderRadius: 8,
      border: '2px solid #3b82f6'
    }}>
      <h3 style={{ color: '#60a5fa', marginTop: 0 }}>
        🎬 Export - Process All Edits
      </h3>

      {/* Debug Panel */}
      {debugInfo && (
        <details style={{ 
          marginBottom: 15, 
          padding: 10, 
          background: '#2a2a2a',
          borderRadius: 4,
          fontSize: 12,
          fontFamily: 'monospace'
        }}>
          <summary style={{ 
            cursor: 'pointer', 
            color: '#9ca3af',
            fontWeight: 'bold',
            marginBottom: 10
          }}>
            🐛 Debug Info (click to expand)
          </summary>
          <div style={{ color: '#d1d5db', lineHeight: 1.6 }}>
            <div><strong>Main Video:</strong> {debugInfo.mainVideo}</div>
            <div><strong>Main Video Path:</strong> {debugInfo.mainVideoPath}</div>
            <div><strong>Clips:</strong> {debugInfo.hasClips}</div>
            <div><strong>Text Overlays:</strong> {debugInfo.hasTextOverlays}</div>
            <div><strong>Video Overlays:</strong> {debugInfo.hasVideoOverlays}</div>
            <div><strong>Image Overlays:</strong> {debugInfo.hasImageOverlays}</div>
            <div><strong>Audio Mode:</strong> {debugInfo.audioMode}</div>
            <div><strong>Audio File:</strong> {debugInfo.audioFileName}</div>
            <div><strong>Audio Track Actions:</strong> {debugInfo.audioTrackActions}</div>
            <div><strong>Insert Videos:</strong> {debugInfo.hasInsertVideos}</div>
          </div>
        </details>
      )}

      {/* Upload Status Indicator */}
      {uploading && (
        <div style={{
          marginBottom: 15,
          padding: 10,
          background: '#1e3a8a',
          border: '2px solid #3b82f6',
          borderRadius: 6,
          color: '#93c5fd',
          fontSize: 14,
          textAlign: 'center'
        }}>
          ⏳ Uploading video to server...
        </div>
      )}

      {mainVideoPath && !uploading && (
        <div style={{
          marginBottom: 15,
          padding: 10,
          background: '#065f46',
          border: '2px solid #10b981',
          borderRadius: 6,
          color: '#6ee7b7',
          fontSize: 12,
          wordBreak: 'break-all'
        }}>
          ✅ Video ready: {mainVideoPath}
        </div>
      )}

      {!mainVideo && (
        <p style={{ color: '#f59e0b', fontSize: 14 }}>
          ⚠️ Upload a main video to enable unified processing
        </p>
      )}

      {mainVideo && activeTasks.length === 0 && (
        <p style={{ color: '#9ca3af', fontSize: 14 }}>
          ℹ️ Add some edits to your video (trim, text, overlays, etc.) to enable processing
        </p>
      )}

      {mainVideo && activeTasks.length > 0 && (
        <>
          <div style={{
            padding: 15,
            background: '#2a2a2a',
            borderRadius: 6,
            marginBottom: 20
          }}>
            <h4 style={{ color: '#9ca3af', marginTop: 0, fontSize: 14 }}>
              📋 Active Tasks ({activeTasks.length})
            </h4>
            <ul style={{ margin: 0, paddingLeft: 20, color: '#d1d5db', fontSize: 14 }}>
              {activeTasks.map((task, idx) => (
                <li key={idx} style={{ marginBottom: 5 }}>
                  {task}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ color: '#d1d5db', display: 'block', marginBottom: 10 }}>
              Quality Preset:
            </label>
            <select
              value={outputQuality}
              onChange={(e) => setOutputQuality(e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                background: '#374151',
                border: '1px solid #4b5563',
                borderRadius: 6,
                color: '#fff',
                fontSize: 14
              }}
            >
              <option value="ultrafast">Ultra Fast (lowest quality)</option>
              <option value="fast">Fast</option>
              <option value="medium">Medium (recommended)</option>
              <option value="slow">Slow (best quality)</option>
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ color: '#d1d5db', display: 'block', marginBottom: 10 }}>
              CRF Quality: {outputCrf} (lower = better)
            </label>
            <input
              type="range"
              min="18"
              max="28"
              value={outputCrf}
              onChange={(e) => setOutputCrf(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontSize: 12, 
              color: '#9ca3af',
              marginTop: 5
            }}>
              <span>Best (18)</span>
              <span>Balanced (23)</span>
              <span>Compressed (28)</span>
            </div>
          </div>

          <button
            onClick={handleProcess}
            disabled={processing || !mainVideo || uploading || !mainVideoPath}
            style={{
              width: '100%',
              padding: '14px 28px',
              fontSize: 16,
              fontWeight: 'bold',
              background: (processing || uploading || !mainVideoPath) ? '#6b7280' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: (processing || uploading || !mainVideoPath) ? 'not-allowed' : 'pointer',
              opacity: (processing || uploading || !mainVideoPath) ? 0.6 : 1,
              transition: 'all 0.2s'
            }}
          >
            {uploading 
              ? '⏳ Uploading video...' 
              : processing 
              ? '⏳ Processing...' 
              : !mainVideoPath 
              ? '📤 Waiting for upload...'
              : `🎬 Process Video (${activeTasks.length} tasks)`
            }
          </button>
        </>
      )}  
      
      {result && (
        <div style={{
          marginTop: 20,
          padding: 15,
          background: '#065f46',
          border: '2px solid #10b981',
          borderRadius: 6
        }}>
          <h4 style={{ color: '#34d399', marginTop: 0 }}>✅ Processing Complete!</h4>
          <div style={{ fontSize: 14, color: '#d1fae5' }}>
            <p><strong>Output:</strong> {result.output}</p>
            <p><strong>Tasks Applied:</strong> {result.tasks_applied?.join(', ')}</p>
            {result.output_info && (
              <p>
                <strong>Duration:</strong> {result.output_info.duration?.toFixed(2)}s | 
                <strong> Resolution:</strong> {result.output_info.width}x{result.output_info.height}
              </p>
            )}
            
            {/* ✅ Download Button */}
            <button
              onClick={() => handleDownloadAndCleanup(result)}
              style={{
                marginTop: 15,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 'bold',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                width: '100%',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.target.style.background = '#059669'}
              onMouseOut={(e) => e.target.style.background = '#10b981'}
            >
              📥 Download Video
            </button>
          </div> 
        </div>
        
      )}
    </div>
    
  );
}

export default UnifiedPipelineForm;