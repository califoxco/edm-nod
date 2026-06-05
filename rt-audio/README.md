# Camera Capture Test for Meta Ray-Ban

## Purpose
Test if a web app can access and use the camera on Meta Ray-Ban glasses.

## What This Tests

### ✅ Camera Capabilities:
1. **Camera Access** - Can `getUserMedia` API access device camera?
2. **Live Preview** - Can we display real-time camera feed?
3. **Photo Capture** - Can we take still photos?
4. **Camera Info** - What resolution, frame rate, and settings are available?
5. **Camera Enumeration** - How many cameras are available?

## Features

### Camera Control
- **Start Camera** - Requests camera permission and starts video stream
- **Take Photo** - Captures current frame as still image
- **Stop Camera** - Releases camera access
- **Download Photo** - Save captured photo to device

### Debug Information
Shows detailed camera specs:
- Camera label/name
- Resolution (width x height)
- Frame rate (fps)
- Facing mode (front/back)
- Device ID

## Expected Behavior

### On Desktop:
- ✅ Access to webcam
- ✅ Live preview works
- ✅ Photo capture works
- ✅ Download works

### On Mobile:
- ✅ Access to front/back cameras
- ✅ Live preview works
- ✅ Photo capture works
- ⚠️ Download may prompt save dialog

### On Meta Ray-Ban Glasses:
- **To Test:** Does the glasses have cameras accessible via web API?
- **Expected:** Likely YES - glasses have built-in cameras
- **Question:** Front-facing only, or can we select different cameras?

## How to Use

1. Open in browser: `rt-audio/index.html`
2. Click "Start Camera"
3. Allow camera access when prompted
4. View live preview
5. Click "Take Photo" to capture
6. Click "Download Photo" to save

## Technical Details

### API Used:
- `navigator.mediaDevices.getUserMedia()` - Camera access
- `navigator.mediaDevices.enumerateDevices()` - List available cameras
- `HTMLVideoElement` - Live preview
- `HTMLCanvasElement` - Photo capture
- `canvas.toBlob()` - Download photo

### Constraints:
```javascript
{
  video: {
    facingMode: 'environment', // or 'user' for front camera
    width: { ideal: 1280 },
    height: { ideal: 720 }
  },
  audio: false
}
```

## Privacy & Permissions

- Requires user permission to access camera
- Permission dialog appears on first use
- Camera access is indicated by browser (usually icon in address bar)
- Can revoke permission in browser settings

## Use Cases for Ray-Ban Glasses

If camera access works:
1. **AR Overlays** - Show information overlaid on camera view
2. **Photo Capture** - Take photos through web app
3. **QR Code Scanner** - Scan codes with glasses camera
4. **Object Recognition** - Identify objects in view (with ML)
5. **Visual Search** - Take photo and search for similar items

## Limitations

- Cannot access camera if another app is using it
- Resolution/quality depends on device hardware
- Frame rate may vary based on device performance
- Some browsers may restrict camera access on insecure origins (requires HTTPS)

## Browser Compatibility

- ✅ Chrome/Edge: Full support
- ✅ Firefox: Full support  
- ✅ Safari (iOS 11+): Requires HTTPS, user gesture
- ⚠️ Older browsers: May not support getUserMedia

## Test Results

**Desktop Browser:** ✅ Works
**Mobile Browser:** ✅ Works  
**Meta Ray-Ban Glasses:** ⏳ To be tested

Record your findings after testing on the glasses!
