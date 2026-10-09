// src/services/soundFeedback.ts

interface WebKitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export type TurnDirection = 'left' | 'right' | 'straight' | 'wrong_way';

/**
 * 1. SPATIAL EARBUD AUDIO (Stereo Panning)
 * Pans audio left/right into earbuds based on relative heading angle
 */
export function playSpatialDirectionChime(needleAngle: number) {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as WebKitWindow).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Calculate stereo pan: -1.0 (full left) to +1.0 (full right)
    let pan = 0;
    if (needleAngle > 0 && needleAngle <= 180) {
      pan = Math.min(1, needleAngle / 90); // Turn right -> Pan right
    } else if (needleAngle > 180 && needleAngle < 360) {
      pan = -Math.min(1, (360 - needleAngle) / 90); // Turn left -> Pan left
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Check if StereoPanner is supported
    const hasStereoPanner = typeof ctx.createStereoPanner === 'function';
    const panner = hasStereoPanner ? ctx.createStereoPanner() : null;

    osc.type = 'sine';
    // Clear higher tone (880Hz) when on course, warm tone (587Hz) when turning
    const isCenter = Math.abs(pan) < 0.2;
    osc.frequency.setValueAtTime(isCenter ? 880 : 587.33, ctx.currentTime);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    if (panner) {
      panner.pan.setValueAtTime(pan, ctx.currentTime);
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      osc.connect(gain);
      gain.connect(ctx.destination);
    }

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.45);
  } catch (err) {
    console.error('Spatial audio playback failed:', err);
  }
}

/**
 * 2. FORK & JUNCTION VOICE PROMPTS (Audio Whisper)
 * Speaks natural earbud whispers when approaching intersections
 */
export function speakJunctionWhisper(needleAngle: number) {
  if (!('speechSynthesis' in window)) return;

  let text = 'Continue straight.';
  if (needleAngle > 15 && needleAngle <= 60) text = 'Bear right at the fork.';
  else if (needleAngle > 60 && needleAngle <= 120) text = 'Turn right at the junction.';
  else if (needleAngle > 120 && needleAngle <= 240) text = 'Destination is behind you.';
  else if (needleAngle > 240 && needleAngle <= 300) text = 'Turn left at the junction.';
  else if (needleAngle > 300 && needleAngle < 345) text = 'Bear left at the fork.';

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  utterance.pitch = 1.1;
  window.speechSynthesis.speak(utterance);
}

/**
 * 4. WRONG-TURN "DRIFT GUARD" (Sound Alert)
 * Distinct warning buzzer when walking down the wrong road
 */
export function playDriftWarningSound() {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as WebKitWindow).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    // Dissonant descending alert
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance('Path is drifting. Reverse course.');
      utterance.rate = 1.2;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  } catch (err) {
    console.error('Drift warning audio failed:', err);
  }
}

/**
 * 5. DISTINCT MELODIC CHIMES (Rising vs. Falling Chords)
 * Cuts through pocket fabric and street traffic for users without earbuds
 */
export function playPocketMelodicChime(direction: TurnDirection) {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as WebKitWindow).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Triangle wave provides rich harmonics that penetrate denim pockets
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    if (direction === 'right') {
      // ↗ RISING CHORD: Low -> High (Turn Right) C5 -> G5
      playTone(523.25, 0, 0.22);
      playTone(783.99, 0.16, 0.35);
    } else if (direction === 'left') {
      // ↘ FALLING CHORD: High -> Low (Turn Left) G5 -> C5
      playTone(783.99, 0, 0.22);
      playTone(523.25, 0.16, 0.35);
    } else if (direction === 'straight') {
      // • SINGLE CRISP BELL: On Course (A5)
      playTone(880.0, 0, 0.32);
    } else if (direction === 'wrong_way') {
      // × LOW WARNING: Wrong Way / Drift (F3 -> D3)
      playTone(174.61, 0, 0.2);
      playTone(146.83, 0.15, 0.35);
    }
  } catch (err) {
    console.error('Pocket audio error:', err);
  }
}

/**
 * 5a. PUNCHY HANDS-FREE VOICE PROMPTS
 * Fast, high-clarity 2-word prompts that cut through street noise
 */
export function speakPunchyVoicePrompt(direction: TurnDirection) {
  if (!('speechSynthesis' in window)) return;

  const phraseMap: Record<TurnDirection, string> = {
    left: 'Turn left.',
    right: 'Turn right.',
    straight: 'Straight ahead.',
    wrong_way: 'Turn around.',
  };

  const utterance = new SpeechSynthesisUtterance(phraseMap[direction]);
  utterance.rate = 1.2; // Fast for snappy pocket calls
  utterance.pitch = 1.25; // Higher pitch penetrates pocket fabric
  utterance.volume = 1.0;
  window.speechSynthesis.speak(utterance);
}

/**
 * ARRIVAL CHIME & VOICE
 */
export function playArrivalChime() {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as WebKitWindow).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    // Two-tone rising chord (E5 -> B5)
    playTone(659.25, 0, 0.4);
    playTone(987.77, 0.25, 0.6);
  } catch (err) {
    console.error('Audio playback error:', err);
  }
}

export function speakArrival(restaurantName: string, dish: string) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(
      `You have arrived at ${restaurantName}. Look for the ${dish}.`
    );
    utterance.rate = 1.0;
    utterance.pitch = 1.1;
    window.speechSynthesis.speak(utterance);
  }
}