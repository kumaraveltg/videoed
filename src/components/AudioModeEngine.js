export const AUDIO_MODES = {
  MUTE: "mute",
  KEEP: "keep",
  REPLACE: "replace",
  MIX: "mix",
};

export class AudioModeEngine {
  constructor(videoEl, addedAudioEl) {
    if (!videoEl || !addedAudioEl) {
      throw new Error("AudioModeEngine: Missing video or audio element");
    }

    console.log("[AudioModeEngine] Constructor called");
    console.log("  → Video src:", videoEl.src?.substring(0, 50));
    console.log("  → Audio src:", addedAudioEl.src?.substring(0, 50));
    console.log("  → Video readyState:", videoEl.readyState);
    console.log("  → Audio readyState:", addedAudioEl.readyState);

    this.video = videoEl;
    this.addedAudio = addedAudioEl;
    this.currentMode = AUDIO_MODES.KEEP;
    this.hasUserInteracted = false;

    // ✅ Create Web Audio context
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      console.log("[AudioModeEngine] Audio context state:", this.ctx.state);
      
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          console.log("[AudioModeEngine] Audio context resumed");
        });
      }
    } catch (error) {
      console.error("[AudioModeEngine] Failed to create audio context:", error);
      throw error;
    }

    // ✅ Create media sources
    try {
      console.log("[AudioModeEngine] Creating media element sources...");
      this.videoSource = this.ctx.createMediaElementSource(this.video);
      this.audioSource = this.ctx.createMediaElementSource(this.addedAudio);
      console.log("[AudioModeEngine] ✅ Media sources created");
    } catch (error) {
      console.error("[AudioModeEngine] Failed to create media sources:", error);
      throw error;
    }

    // ✅ Create gain nodes for volume control
    this.mainGain = this.ctx.createGain();
    this.addedGain = this.ctx.createGain();
    this.masterGain = this.ctx.createGain();

    console.log("[AudioModeEngine] Connecting audio graph...");
    
    // Connect the audio graph
    this.videoSource.connect(this.mainGain);
    this.audioSource.connect(this.addedGain);
    
    this.mainGain.connect(this.masterGain);
    this.addedGain.connect(this.masterGain);
    
    this.masterGain.connect(this.ctx.destination);

    // ✅ CRITICAL FIX: DO NOT mute the elements!
    // Once connected to Web Audio API, the elements must remain unmuted
    // for the audio to flow through the graph
    this.video.muted = false;
    this.addedAudio.muted = false;
    
    // ✅ Set volume to 1 to ensure audio flows
    this.video.volume = 1.0;
    this.addedAudio.volume = 1.0;

    console.log("[AudioModeEngine] ✅ Initialized successfully");
    console.log("  → Main gain:", this.mainGain.gain.value);
    console.log("  → Added gain:", this.addedGain.gain.value);
    console.log("  → Video muted:", this.video.muted);
    console.log("  → Audio muted:", this.addedAudio.muted);
  }

  smooth(node, value) {
    const now = this.ctx.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.linearRampToValueAtTime(value, now + 0.08);
  }

  forceSyncAudio() {
    const diff = Math.abs(this.video.currentTime - this.addedAudio.currentTime);
    if (diff > 0.05) {
      console.log("[AudioModeEngine] Force sync - correcting", diff.toFixed(3), "s drift");
      this.addedAudio.currentTime = this.video.currentTime;
    }
  }

  setMode(mode) {
    console.log("[AudioModeEngine] setMode called:", mode);
    console.log("  → Context state:", this.ctx.state);
    console.log("  → Video time:", this.video.currentTime.toFixed(2));
    console.log("  → Audio time:", this.addedAudio.currentTime.toFixed(2));
    console.log("  → Video paused:", this.video.paused);
    console.log("  → Audio paused:", this.addedAudio.paused);
    
    if (this.ctx.state === 'suspended') {
      console.log("  → Resuming suspended audio context...");
      this.ctx.resume().then(() => {
        console.log("  → Context resumed successfully");
      });
    }
    
    this.forceSyncAudio();
    this.currentMode = mode;

    switch (mode) {
      case AUDIO_MODES.MUTE:
        console.log("  → Applying MUTE (0%, 0%)");
        this.smooth(this.mainGain, 0);
        this.smooth(this.addedGain, 0);
        
        if (!this.addedAudio.paused) {
          this.addedAudio.pause();
        }
        break;

      case AUDIO_MODES.KEEP:
        console.log("  → Applying KEEP (100%, 0%)");
        this.smooth(this.mainGain, 1);
        this.smooth(this.addedGain, 0);
        
        if (!this.addedAudio.paused) {
          this.addedAudio.pause();
        }
        break;

      case AUDIO_MODES.REPLACE:
        console.log("  → Applying REPLACE (0%, 100%)");
        this.smooth(this.mainGain, 0);
        this.smooth(this.addedGain, 1);
        
        this.matchPlaybackState();
        break;

      case AUDIO_MODES.MIX:
        console.log("  → Applying MIX (70%, 70%)");
        this.smooth(this.mainGain, 0.7);
        this.smooth(this.addedGain, 0.7);
        
        this.matchPlaybackState();
        break;

      default:
        console.warn("[AudioModeEngine] Unknown mode:", mode);
    }
    
    setTimeout(() => {
      console.log("  → Final state:");
      console.log("    - Main gain:", this.mainGain.gain.value.toFixed(2));
      console.log("    - Added gain:", this.addedGain.gain.value.toFixed(2));
      console.log("    - Video paused:", this.video.paused);
      console.log("    - Audio paused:", this.addedAudio.paused);
      console.log("    - Video time:", this.video.currentTime.toFixed(2));
      console.log("    - Audio time:", this.addedAudio.currentTime.toFixed(2));
      console.log("    - Video muted:", this.video.muted);
      console.log("    - Audio muted:", this.addedAudio.muted);
    }, 150);
  }

  matchPlaybackState() {
    console.log("  → [matchPlaybackState] Syncing playback state...");
    
    this.addedAudio.currentTime = this.video.currentTime;
    console.log("    - Synced to:", this.video.currentTime.toFixed(2));
    
    if (!this.video.paused) {
      console.log("    - Video is playing, starting audio...");
      
      if (this.addedAudio.paused) {
        this.addedAudio.play()
          .then(() => {
            console.log("    - ✅ Audio started successfully");
            this.hasUserInteracted = true;
          })
          .catch(e => {
            console.warn("    - ⚠️ Audio play failed:", e.message);
          });
      } else {
        console.log("    - Audio already playing");
      }
    } else {
      console.log("    - Video is paused");
      
      if (!this.addedAudio.paused) {
        console.log("    - Pausing audio to match");
        this.addedAudio.pause();
      } else {
        console.log("    - Audio already paused");
      }
    }
  }

  sync() {
    console.log("[AudioModeEngine] Setting up playback sync");
    
    this.video.addEventListener("play", () => {
      console.log("[Sync] 🎬 Video play event");
      console.log("  → Video time:", this.video.currentTime.toFixed(2));
      console.log("  → Current mode:", this.currentMode);
      console.log("  → Audio paused:", this.addedAudio.paused);
      
      this.hasUserInteracted = true;
      
      if (this.ctx.state === 'suspended') {
        console.log("  → Resuming audio context...");
        this.ctx.resume();
      }
      
      if (this.currentMode === AUDIO_MODES.REPLACE || this.currentMode === AUDIO_MODES.MIX) {
        this.forceSyncAudio();
        
        if (this.addedAudio.paused) {
          console.log("  → Starting added audio...");
          this.addedAudio.play()
            .then(() => console.log("  → ✅ Audio playing"))
            .catch(e => console.error("  → ❌ Audio play failed:", e.message));
        } else {
          console.log("  → Audio already playing");
        }
      } else {
        console.log("  → Skipping audio (mode:", this.currentMode, ")");
      }
    });
    
    this.video.addEventListener("pause", () => {
      console.log("[Sync] ⏸ Video pause event");
      
      if (!this.addedAudio.paused) {
        console.log("  → Pausing audio");
        this.addedAudio.pause();
      }
    });
    
    this.video.addEventListener("seeked", () => {
      console.log("[Sync] ⏩ Video seeked to:", this.video.currentTime.toFixed(2));
      this.forceSyncAudio();
      
      if (!this.video.paused && this.addedAudio.paused) {
        if (this.currentMode === AUDIO_MODES.REPLACE || this.currentMode === AUDIO_MODES.MIX) {
          console.log("  → Resuming audio after seek");
          this.addedAudio.play().catch(e => 
            console.warn("  → Failed to resume audio:", e.message)
          );
        }
      }
    });

    this.video.addEventListener("playing", () => {
      console.log("[Sync] ▶️ Video playing event (after buffering)");
      
      if (this.currentMode === AUDIO_MODES.REPLACE || this.currentMode === AUDIO_MODES.MIX) {
        if (this.addedAudio.paused) {
          console.log("  → Audio wasn't playing, starting it...");
          this.forceSyncAudio();
          this.addedAudio.play().catch(e => 
            console.warn("  → Failed to start audio:", e.message)
          );
        }
      }
    });

    let lastSyncTime = 0;
    this.video.addEventListener("timeupdate", () => {
      if (this.currentMode !== AUDIO_MODES.REPLACE && this.currentMode !== AUDIO_MODES.MIX) {
        return;
      }

      if (this.video.paused) {
        return;
      }

      const now = Date.now();
      
      if (now - lastSyncTime < 200) return;
      lastSyncTime = now;
      
      const diff = Math.abs(this.video.currentTime - this.addedAudio.currentTime);
      
      if (diff > 0.15) {
        console.log("[Sync] ⚠️ Correcting drift:", diff.toFixed(3), "seconds");
        this.addedAudio.currentTime = this.video.currentTime;
        
        if (this.addedAudio.paused && !this.video.paused) {
          console.log("[Sync] Audio stopped unexpectedly, restarting...");
          this.addedAudio.play().catch(e => 
            console.warn("Failed to restart audio:", e.message)
          );
        }
      }
    });
  }
}