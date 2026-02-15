#!/usr/bin/env python3
"""Beat detection script using librosa.

Takes a WAV file path as argument. Outputs JSON to stdout with bpm and beat timestamps.
Install dependencies: pip install librosa numpy
"""

import sys
import json
import numpy as np
import librosa


def detect_beats(filepath: str) -> dict:
    y, sr = librosa.load(filepath, sr=None)
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    beat_times = [round(float(b), 3) for b in beat_times]
    bpm = round(float(np.atleast_1d(tempo)[0]), 1)

    return {"bpm": bpm, "beats": beat_times}


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python beat_detect.py <filepath>", file=sys.stderr)
        sys.exit(1)

    result = detect_beats(sys.argv[1])
    print(json.dumps(result))
