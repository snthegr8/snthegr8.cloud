type Listener = () => void;

let speaking = false;
/** False until Mollie has finished, skipped this visit, or is disabled (mobile / reduced motion). */
let sessionDone = false;
const speakingListeners = new Set<(speaking: boolean) => void>();
const sessionListeners = new Set<Listener>();

export const isMollieSpeaking = () => speaking;

export const isMollieSessionDone = () => sessionDone;

export const setMollieSpeaking = (value: boolean) => {
	if (speaking === value) return;
	speaking = value;
	for (const listener of speakingListeners) listener(value);
};

/** Call once Mollie is done speaking, skipped this visit, or will not appear. */
export const completeMollieSession = () => {
	speaking = false;
	if (sessionDone) return;
	sessionDone = true;
	for (const listener of speakingListeners) listener(false);
	for (const listener of sessionListeners) listener();
};

export const onMollieSpeakingChange = (listener: (speaking: boolean) => void) => {
	speakingListeners.add(listener);
	return () => {
		speakingListeners.delete(listener);
	};
};

export const onMollieSessionDone = (listener: Listener) => {
	if (sessionDone) listener();
	sessionListeners.add(listener);
	return () => {
		sessionListeners.delete(listener);
	};
};
