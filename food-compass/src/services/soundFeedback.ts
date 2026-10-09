interface WebKitWindow extends Window {
    webkitAudioContext?: typeof AudioContext;
}

// Generates an elegant two-tone arrival chime with zero network assets
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

// Optional: Short hands-free voice notification
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