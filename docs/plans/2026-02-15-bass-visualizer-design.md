# Bass Frequency Visualizer

## Purpose

Add a second waveform visualizer below the existing timeline that shows only low-frequency (bass) content, helping identify kick drums and bass drops for choreography timing.

## Approach: Client-side OfflineAudioContext Filtering

### Data Flow

1. Main WaveSurfer loads audio as today
2. On `decode` event, grab the `AudioBuffer`
3. Create `OfflineAudioContext` matching buffer's sample rate, channels, length
4. Route buffer through `BiquadFilterNode` (lowpass, ~150 Hz cutoff)
5. Render offline context to get filtered `AudioBuffer`
6. Create second WaveSurfer in a new div below main one, load filtered buffer via `loadBlob()` (muted)
7. Sync cursor position on `timeupdate`, sync zoom level

### Visual

- Bass waveform below main one, same width, shorter height (~80px vs 128px)
- Warm orange/amber color scheme to distinguish from main teal
- Small "BASS" label in corner
- No beat markers (already on main waveform)
- Clicking bass waveform seeks the main player

### File Changes

Single file: `client/src/components/timeline/TimelineVisualizer.tsx`

### What Doesn't Change

Transport controls, beat markers, zoom controls, play/pause all remain on the main waveform only.
