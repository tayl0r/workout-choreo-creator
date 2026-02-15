# Bass Frequency Visualizer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a synced bass-only waveform visualizer below the main timeline to help identify kick drums for choreography timing.

**Architecture:** Client-side OfflineAudioContext applies a low-pass filter (~150 Hz) to the decoded AudioBuffer. The filtered buffer is loaded into a second muted WaveSurfer instance. Cursor position and zoom are synced from the main instance.

**Tech Stack:** WaveSurfer.js v7, Web Audio API (OfflineAudioContext, BiquadFilterNode)

---

### Task 1: Add bass filter utility function

**Files:**
- Modify: `client/src/components/timeline/TimelineVisualizer.tsx` (add function before component)

**Step 1: Add the `filterBass` helper above the component**

This function takes an AudioBuffer, runs it through an OfflineAudioContext with a lowpass BiquadFilter at 150 Hz, and returns the filtered AudioBuffer.

```typescript
async function filterBass(buffer: AudioBuffer): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate,
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;

  const lowpass = offlineCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 150;
  lowpass.Q.value = 0.7;

  source.connect(lowpass);
  lowpass.connect(offlineCtx.destination);
  source.start(0);

  return offlineCtx.startRendering();
}
```

Add this right after the `formatTime` function and before the `TimelineVisualizerProps` interface.

**Step 2: Verify types compile**

Run: `pnpm --filter client exec tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```
git add client/src/components/timeline/TimelineVisualizer.tsx
git commit -m "feat: add bass frequency filter utility using OfflineAudioContext"
```

---

### Task 2: Add bass WaveSurfer instance and container

**Files:**
- Modify: `client/src/components/timeline/TimelineVisualizer.tsx`

**Step 1: Add refs and state for the bass visualizer**

Add after existing refs (line ~20):

```typescript
const bassWaveformRef = useRef<HTMLDivElement>(null);
const bassWsRef = useRef<WaveSurfer | null>(null);
```

**Step 2: Add the bass waveform container div in JSX**

Insert a new div directly below the main waveform div (after the closing `</div>` of the `relative` div at ~line 215), before the transport controls div:

```tsx
{/* Bass waveform */}
<div className="relative" style={{ height: 80, borderTop: '1px solid var(--border)' }}>
  <div
    className="absolute top-1 left-2 text-[10px] font-mono uppercase z-10 pointer-events-none"
    style={{ color: 'var(--text-secondary)', opacity: 0.6 }}
  >
    bass
  </div>
  <div ref={bassWaveformRef} className="w-full h-full" style={{ background: 'var(--bg-primary)' }} />
</div>
```

**Step 3: Verify types compile**

Run: `pnpm --filter client exec tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```
git add client/src/components/timeline/TimelineVisualizer.tsx
git commit -m "feat: add bass waveform container and refs"
```

---

### Task 3: Create bass WaveSurfer on audio decode

**Files:**
- Modify: `client/src/components/timeline/TimelineVisualizer.tsx`

**Step 1: Add decode handler to create bass WaveSurfer**

Inside the main WaveSurfer creation `useEffect` (the one that creates `ws`), add a `decode` event handler after the `ready` handler. The `decode` event in WaveSurfer v7 provides the decoded `AudioBuffer`:

```typescript
ws.on('decode', async (duration: number) => {
  // Get the decoded audio buffer from wavesurfer
  const decodedData = ws.getDecodedData();
  if (!decodedData || !bassWaveformRef.current) return;

  try {
    const bassBuffer = await filterBass(decodedData);

    // Convert AudioBuffer to WAV blob for the bass WaveSurfer
    const wavBlob = audioBufferToWav(bassBuffer);

    // Destroy previous bass instance if exists
    if (bassWsRef.current) {
      bassWsRef.current.destroy();
    }

    const bassWs = WaveSurfer.create({
      container: bassWaveformRef.current,
      waveColor: '#886633',
      progressColor: '#dd8833',
      cursorColor: '#dd8833',
      cursorWidth: 2,
      height: 80,
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
      normalize: true,
      interact: true,
      media: document.createElement('audio'), // dummy, won't play
    });

    bassWs.loadBlob(wavBlob);

    // Clicking bass waveform seeks the main player
    bassWs.on('click', (relativeX: number) => {
      if (wavesurferRef.current) {
        wavesurferRef.current.seekTo(relativeX);
      }
    });

    bassWsRef.current = bassWs;
  } catch (err) {
    console.warn('Bass filter failed:', err);
  }
});
```

**Step 2: Add the `audioBufferToWav` helper**

Add this after the `filterBass` function. This converts an AudioBuffer to a WAV Blob so WaveSurfer can load it:

```typescript
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels and write samples
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
```

**Step 3: Clean up bass WaveSurfer in the cleanup function**

In the existing cleanup return function of the main useEffect, add before `wavesurferRef.current = null`:

```typescript
if (bassWsRef.current) {
  bassWsRef.current.destroy();
  bassWsRef.current = null;
}
```

**Step 4: Verify types compile**

Run: `pnpm --filter client exec tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```
git add client/src/components/timeline/TimelineVisualizer.tsx
git commit -m "feat: create bass WaveSurfer from filtered audio on decode"
```

---

### Task 4: Sync cursor position and zoom

**Files:**
- Modify: `client/src/components/timeline/TimelineVisualizer.tsx`

**Step 1: Sync cursor position from main to bass**

In the existing `timeupdate` handler (the `ws.on('timeupdate', ...)` block), add syncing to the bass instance:

```typescript
ws.on('timeupdate', (time: number) => {
  setCurrentTime(time);
  // Sync bass waveform cursor
  if (bassWsRef.current) {
    const dur = ws.getDuration();
    if (dur > 0) {
      bassWsRef.current.seekTo(time / dur);
    }
  }
});
```

**Step 2: Sync zoom to bass waveform**

In the zoom `useEffect`, add bass zoom syncing:

```typescript
useEffect(() => {
  if (wavesurferRef.current && isReady) {
    wavesurferRef.current.zoom(zoom * 50);
  }
  if (bassWsRef.current && isReady) {
    bassWsRef.current.zoom(zoom * 50);
  }
}, [zoom, isReady]);
```

**Step 3: Sync scroll position between waveforms**

Add a new useEffect after the zoom effect. WaveSurfer v7 renders into a shadow DOM with a scrollable wrapper. We need to sync horizontal scroll:

```typescript
useEffect(() => {
  if (!isReady) return;
  const mainWrapper = waveformRef.current?.querySelector('div[data-testid="waveform"]')?.parentElement
    ?? waveformRef.current?.firstElementChild as HTMLElement | null;
  const bassWrapper = bassWaveformRef.current?.querySelector('div[data-testid="waveform"]')?.parentElement
    ?? bassWaveformRef.current?.firstElementChild as HTMLElement | null;
  if (!mainWrapper || !bassWrapper) return;

  const syncScroll = () => {
    bassWrapper.scrollLeft = mainWrapper.scrollLeft;
  };
  mainWrapper.addEventListener('scroll', syncScroll);
  return () => mainWrapper.removeEventListener('scroll', syncScroll);
}, [isReady, zoom]);
```

**Step 4: Verify types compile**

Run: `pnpm --filter client exec tsc --noEmit`
Expected: No errors

**Step 5: Manual smoke test**

Run: `pnpm dev`
- Load a song in the timeline
- Verify bass waveform appears below main waveform with orange/amber coloring
- Verify "BASS" label shows in top-left corner
- Play audio and verify both cursors move together
- Zoom in/out and verify both waveforms zoom together
- Click on bass waveform and verify main player seeks

**Step 6: Commit**

```
git add client/src/components/timeline/TimelineVisualizer.tsx
git commit -m "feat: sync cursor, zoom, and scroll between main and bass waveforms"
```

---

### Task 5: Type-check and final verification

**Step 1: Full type check**

Run: `pnpm --filter client exec tsc --noEmit`
Expected: No errors

**Step 2: Run existing e2e tests to check for regressions**

Run: `pnpm exec playwright test`
Expected: All existing tests pass (moves tests don't touch timeline)

**Step 3: Commit if any fixes were needed**

Only if adjustments were required from the checks above.
