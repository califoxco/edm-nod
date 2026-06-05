# Real-Time Audio Capture Test

## Purpose
Test if a web app can access audio playing through the Meta Ray-Ban glasses.

## Important Findings

### ❌ Cannot Access System Audio Directly
Browsers **cannot** access:
- Music/audio playing from other apps (Spotify, YouTube, etc.)
- System audio output
- Audio routed through the device speakers/headphones

This is a **security feature** - browsers are sandboxed and cannot capture system-level audio.

### ✅ Can Access Microphone Input
Browsers **can** access:
- Device microphone input via `getUserMedia` API
- Ambient sound picked up by the mic
- Audio playing from speakers if mic picks it up (loopback)

## How It Works

### Method: Microphone Capture
- Uses `navigator.mediaDevices.getUserMedia()`
- Requests microphone permission
- Captures ambient audio through device microphone
- Analyzes audio using Web Audio API
- Visualizes with waveform and frequency bars

### What You'll See:
1. **Volume Meter**: Shows current audio level (0-100%)
2. **Waveform**: Real-time audio waveform visualization
3. **Frequency Bars**: Frequency spectrum visualization

## Limitations for Rhythm Game

### The Problem:
To build a rhythm game that syncs with music playing on the device:
- **Can't directly access** the music file/stream playing from Spotify, YouTube, etc.
- **Can only hear** what the microphone picks up from the environment

### Workarounds:

1. **Audio Loopback (Not Ideal)**
   - Play music through device speakers
   - Microphone picks up the sound
   - Problems: latency, background noise, quality loss

2. **Upload Audio File (Current Approach)**
   - User provides their own audio file
   - Game loads and plays it directly
   - This is what we're doing in the EDM Nod game ✅

3. **Web Audio API Playback (Best)**
   - Load audio file into the game
   - Play through Web Audio API
   - Full control over timing and synchronization
   - This is the recommended approach ✅

## Testing Instructions

1. Open `index.html` in browser or deploy to GitHub Pages
2. Click "Test Microphone Input"
3. Allow microphone access when prompted
4. Make noise (clap, talk, play music nearby)
5. Watch the visualizer respond to sound

## Browser Compatibility

- ✅ Chrome/Edge: Full support
- ✅ Firefox: Full support
- ✅ Safari (iOS 14.3+): Requires user gesture, permission
- ⚠️ Older browsers: May not support getUserMedia

## Conclusion

**For EDM Nod game:**
- Keep current approach: users provide audio files
- Cannot access Spotify/system audio due to browser security
- Microphone capture is possible but not suitable for precise rhythm gaming

**Alternative:** Consider building a companion app or browser extension with elevated permissions (but not possible for web-only solution).
