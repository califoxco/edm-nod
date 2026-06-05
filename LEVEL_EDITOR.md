# Level Editor Guide

## Opening the Editor

Open `editor.html` in your browser (or visit the deployed version at GitHub Pages).

## Creating a Level

1. **Fill in Level Info**
   - **Level ID**: Unique identifier (e.g., `my-awesome-song`)
   - **Level Name**: Display name (e.g., `My Awesome Song`)
   - **BPM**: Beats per minute of your track

2. **Import Audio**
   - Click "Choose File" under "Audio Track"
   - Select your MP3 or WAV file
   - Waveform will appear in the timeline

3. **Add Beats**
   - Click on the **Down ↓** track to add down-nod beats
   - Click on the **Up ↑** track to add up-nod beats
   - Click on existing beats to remove them
   - Use "Snap to Grid" for precise timing

4. **Playback**
   - Click "▶ Play" to preview your level
   - The playhead shows current position
   - Adjust zoom with + / - buttons

5. **Export**
   - Click "Export Level" when done
   - Downloads `level.json`
   - Follow the instructions to rename your audio file

## Adding Levels to the Game

### Manual Method (Current)

1. Create a folder: `assets/YOUR-LEVEL-ID/`
2. Put these files in the folder:
   - `level.json` (exported from editor)
   - `audio.mp3` or `audio.wav` (your audio file, renamed)

3. Update `app.js` to include your level:

```javascript
var LEVELS = {
  'test-level-1': { ... },
  'your-level-id': {
    id: 'your-level-id',
    name: 'Your Level Name',
    bpm: 124,
    duration: 180,
    audioFile: 'assets/your-level-id/audio.mp3',
    beatPattern: [ /* copy from level.json */ ]
  }
};
```

4. Update `index.html` to add level button:

```html
<button class="level-item focusable" data-action="select-level" data-level-id="your-level-id">
  <div class="level-name">Your Level Name</div>
  <div class="level-meta">180s • 124 BPM</div>
</button>
```

### Future: Automatic Loading

A level loader will be implemented to automatically scan the `assets/` folder and load all levels without manual code updates.

## Tips

- **Snap to Grid**: Enable for precise beat placement
- **Grid Division**: 
  - 1/4 beat = fine control
  - 1/2 beat = standard (recommended)
  - 1 beat = coarse placement
- **Zoom**: Zoom in for detailed editing, zoom out to see the full timeline
- **Test Early**: Export and test your level in the game frequently
- **BPM Reference**:
  - House: 120-130 BPM
  - Dubstep: 140 BPM
  - Drum & Bass: 160-180 BPM
  - Techno: 120-140 BPM

## Keyboard Shortcuts

(Coming soon)
- Space: Play/Pause
- Delete: Remove selected beat
- Ctrl+Z: Undo
- Ctrl+S: Export
