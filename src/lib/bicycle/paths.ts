import * as THREE from 'three';

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]!;

export type Edge = 'left' | 'right' | 'top' | 'bottom';

export type Bounds = {
	/** Fully off-screen outer bounds (bike starts/ends here). */
	xOutMin: number;
	xOutMax: number;
	yOutMin: number;
	yOutMax: number;
	/** Visible playfield for hills. */
	xMin: number;
	xMax: number;
	yMin: number;
	yMax: number;
	z: number;
	width: number;
	height: number;
};

export type CrossingPath = {
	curve: THREE.CatmullRomCurve3;
	enter: Edge;
	exit: Edge;
};

export const getBounds = (camera: THREE.PerspectiveCamera, depth = -2.5): Bounds => {
	const distance = Math.abs(camera.position.z - depth);
	const vFov = THREE.MathUtils.degToRad(camera.fov);
	const height = 2 * Math.tan(vFov / 2) * distance;
	const width = height * camera.aspect;
	// Large pad so the whole bike clears the viewport before the path ends
	const pad = Math.max(width, height) * 0.28;
	const inset = 0.16;

	return {
		xOutMin: -width / 2 - pad,
		xOutMax: width / 2 + pad,
		yOutMin: -height / 2 - pad,
		yOutMax: height / 2 + pad,
		xMin: -width / 2 + width * inset,
		xMax: width / 2 - width * inset,
		yMin: -height / 2 + height * inset,
		yMax: height / 2 - height * inset,
		z: depth,
		width,
		height,
	};
};

const isXEdge = (edge: Edge) => edge === 'left' || edge === 'right';

/** After leaving `exit`, re-enter from the opposite horizontal edge. */
export const pickNextEnter = (exit: Edge): Edge => (exit === 'left' ? 'right' : 'left');

/** Always exit toward the opposite left/right edge. */
export const pickExit = (enter: Edge): Edge => (enter === 'left' ? 'right' : 'left');

type Hill = { center: number; width: number; steepness: number };

const sampleHills = (t: number, hills: Hill[]) => {
	let offset = 0;
	for (const hill of hills) {
		const local = (t - hill.center) / hill.width;
		if (local > -1 && local < 1) {
			offset += hill.steepness * 0.5 * (1 + Math.cos(Math.PI * local));
		}
	}
	return offset;
};

const makeHills = (amplitude: number, count = Math.floor(rand(2, 5))): Hill[] =>
	Array.from({ length: count }, () => ({
		center: rand(0.18, 0.82),
		width: rand(0.14, 0.3),
		steepness: (Math.random() > 0.4 ? 1 : -1) * rand(amplitude * 0.35, amplitude),
	}));

const edgeOutPoint = (bounds: Bounds, edge: Edge, along: number) => {
	switch (edge) {
		case 'left':
			return new THREE.Vector3(bounds.xOutMin, along, bounds.z);
		case 'right':
			return new THREE.Vector3(bounds.xOutMax, along, bounds.z);
		case 'top':
			return new THREE.Vector3(along, bounds.yOutMax, bounds.z);
		case 'bottom':
			return new THREE.Vector3(along, bounds.yOutMin, bounds.z);
	}
};

const edgeVisiblePoint = (bounds: Bounds, edge: Edge, along: number) => {
	switch (edge) {
		case 'left':
			return new THREE.Vector3(bounds.xMin, along, bounds.z);
		case 'right':
			return new THREE.Vector3(bounds.xMax, along, bounds.z);
		case 'top':
			return new THREE.Vector3(along, bounds.yMax, bounds.z);
		case 'bottom':
			return new THREE.Vector3(along, bounds.yMin, bounds.z);
	}
};

const clampAlong = (bounds: Bounds, edge: Edge, along: number) => {
	if (isXEdge(edge)) {
		return THREE.MathUtils.clamp(along, bounds.yMin, bounds.yMax);
	}
	return THREE.MathUtils.clamp(along, bounds.xMin, bounds.xMax);
};

const randomAlong = (bounds: Bounds, edge: Edge) => {
	if (isXEdge(edge)) return rand(bounds.yMin, bounds.yMax);
	return rand(bounds.xMin, bounds.xMax);
};

/**
 * Progressive left↔right crossing with randomized hills.
 * Starts and ends fully off-screen horizontally.
 */
export const createCrossingPath = (
	camera: THREE.PerspectiveCamera,
	opts?: { enter?: Edge; exit?: Edge; entryAlong?: number },
): CrossingPath => {
	const bounds = getBounds(camera);
	const enter = opts?.enter ?? pick(['left', 'right'] as const);
	const exit = opts?.exit ?? pickExit(enter === 'left' || enter === 'right' ? enter : 'left');

	const safeEnter: Edge = enter === 'left' || enter === 'right' ? enter : 'left';
	const safeExit: Edge = exit === 'left' || exit === 'right' ? exit : pickExit(safeEnter);

	const entryAlong = clampAlong(
		bounds,
		safeEnter,
		opts?.entryAlong ?? randomAlong(bounds, safeEnter),
	);
	const exitAlong = clampAlong(bounds, safeExit, randomAlong(bounds, safeExit));

	const start = edgeOutPoint(bounds, safeEnter, entryAlong);
	const enterGate = edgeVisiblePoint(bounds, safeEnter, entryAlong);
	const exitGate = edgeVisiblePoint(bounds, safeExit, exitAlong);
	const end = edgeOutPoint(bounds, safeExit, exitAlong);

	const amp = Math.min(bounds.width, bounds.height) * rand(0.12, 0.28);
	const hills = makeHills(amp);
	const samples = 36;
	const points: THREE.Vector3[] = [start, enterGate];

	for (let i = 1; i < samples; i++) {
		const u = i / samples;
		const base = enterGate.clone().lerp(exitGate, u);
		const hill = sampleHills(u, hills);
		base.y = THREE.MathUtils.clamp(base.y + hill, bounds.yMin, bounds.yMax);
		base.z = bounds.z + Math.sin(u * Math.PI) * 0.1;
		points.push(base);
	}

	points.push(exitGate, end);

	return {
		curve: new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.12),
		enter: safeEnter,
		exit: safeExit,
	};
};
