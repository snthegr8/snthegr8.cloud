import * as THREE from 'three';
import {
	applyBicycleColors,
	createBicycle,
	type BicycleColors,
	type BicycleParts,
} from './create-bicycle';
import { createCrossingPath, pickNextEnter, pickExit, type CrossingPath } from './paths';
import { BikeTrail } from './trail';
import { isMollieSessionDone, onMollieSessionDone } from '../mollie-signal';

export type BicycleSceneHandle = {
	destroy: () => void;
};

const readThemeColors = (): BicycleColors & { trail: string } => {
	const styles = getComputedStyle(document.documentElement);
	const brown = styles.getPropertyValue('--brown').trim() || '#3c3d37';
	const peach = styles.getPropertyValue('--peach').trim() || '#697565';
	const green = styles.getPropertyValue('--green').trim() || '#1e201e';
	return { frame: green, accent: peach, wheel: brown, trail: peach };
};

let active: BicycleSceneHandle | null = null;

const KMH_MIN = 4;
const KMH_MAX = 200;
/** Map whimsical km/h → world-units per second along the path. */
const speedFromKmh = (kmh: number) => {
	const u = THREE.MathUtils.clamp((kmh - KMH_MIN) / (KMH_MAX - KMH_MIN), 0, 1);
	return THREE.MathUtils.lerp(0.35, 5.8, u);
};

const rollKmh = () => KMH_MIN + Math.random() * (KMH_MAX - KMH_MIN);

/** First appearance delay after visit (seconds). */
const rollEntranceDelay = () => 3 + Math.random() * 9;

export const mountBicycleScene = (canvas: HTMLCanvasElement): BicycleSceneHandle => {
	if (active) {
		active.destroy();
		active = null;
	}

	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (reduceMotion) {
		canvas.style.display = 'none';
		const handle = { destroy: () => undefined };
		active = handle;
		return handle;
	}

	const renderer = new THREE.WebGLRenderer({
		canvas,
		alpha: true,
		antialias: true,
		powerPreference: 'low-power',
	});
	renderer.setClearColor(0x000000, 0);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
	camera.position.set(0, 0, 6.5);

	const ambient = new THREE.AmbientLight(0xffffff, 0.85);
	const key = new THREE.DirectionalLight(0xffffff, 0.65);
	key.position.set(2.5, 4, 5);
	const fill = new THREE.DirectionalLight(0xffffff, 0.25);
	fill.position.set(-3, -1, 2);
	scene.add(ambient, key, fill);

	let colors = readThemeColors();
	const parts: BicycleParts = createBicycle(colors);
	parts.group.visible = false;
	scene.add(parts.group);

	const trail = new BikeTrail(80);
	trail.setColor(colors.trail);
	scene.add(trail.line);

	let path: CrossingPath = createCrossingPath(camera);
	let t = 0;
	const trailWindow = 0.22;
	let travelSpeed = speedFromKmh(rollKmh());
	const up = new THREE.Vector3(0, 1, 0);
	const lookTarget = new THREE.Vector3();
	const tangent = new THREE.Vector3();
	const position = new THREE.Vector3();
	const prevTangent = new THREE.Vector3(1, 0, 0);

	/** Bike only appears after Mollie is done (or skipped); then waits 3–12s. */
	let enterAt = Number.POSITIVE_INFINITY;
	let hasEntered = false;

	const armEntrance = () => {
		if (hasEntered || Number.isFinite(enterAt)) return;
		enterAt = performance.now() + rollEntranceDelay() * 1000;
	};

	if (isMollieSessionDone()) {
		armEntrance();
	}
	const offMollieSession = onMollieSessionDone(armEntrance);

	const startNextCrossing = () => {
		path.curve.getPointAt(1, position);
		const enter = pickNextEnter(path.exit);
		const exit = pickExit(enter);
		const entryAlong = position.y;

		path = createCrossingPath(camera, {
			enter,
			exit,
			entryAlong: entryAlong + (Math.random() - 0.5) * 0.35,
		});
		t = 0;
		travelSpeed = speedFromKmh(rollKmh());
		trail.clear();
		prevTangent.set(0, 0, 0);
	};

	const resize = () => {
		const width = window.innerWidth;
		const height = window.innerHeight;
		renderer.setSize(width, height, false);
		camera.aspect = width / Math.max(height, 1);
		camera.updateProjectionMatrix();
	};

	resize();

	let raf = 0;
	let last = performance.now();
	let running = true;

	const tick = (now: number) => {
		raf = requestAnimationFrame(tick);
		if (!running || document.hidden) {
			last = now;
			return;
		}

		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;

		if (!hasEntered) {
			if (!isMollieSessionDone() || now < enterAt) {
				renderer.render(scene, camera);
				return;
			}
			hasEntered = true;
			parts.group.visible = true;
			t = 0;
			travelSpeed = speedFromKmh(rollKmh());
			trail.clear();
		}

		const length = Math.max(path.curve.getLength(), 0.001);
		t += (travelSpeed * dt) / length;

		if (t >= 1) {
			startNextCrossing();
		}

		const u = Math.min(Math.max(t, 0), 0.9999);
		path.curve.getPointAt(u, position);
		path.curve.getTangentAt(u, tangent).normalize();

		parts.group.position.copy(position);
		lookTarget.copy(position).add(tangent);
		parts.group.up.copy(up);
		parts.group.lookAt(lookTarget);

		if (prevTangent.lengthSq() > 0.01) {
			const cross = prevTangent.clone().cross(tangent);
			const lean = THREE.MathUtils.clamp(cross.z * 1.8, -0.3, 0.3);
			parts.group.rotateZ(-lean);
		}
		prevTangent.copy(tangent);

		const spinSign = Math.sign(tangent.x || tangent.y || 1);
		const spin = dt * (3.5 + travelSpeed * 2.4) * spinSign;
		parts.frontWheel.rotation.x += Math.abs(spin);
		parts.rearWheel.rotation.x += Math.abs(spin);

		const trailEnd = u;
		const trailStart = Math.max(0, trailEnd - trailWindow);
		trail.setFromCurve(path.curve, trailStart, trailEnd);

		renderer.render(scene, camera);
	};

	const onVisibility = () => {
		if (!document.hidden) last = performance.now();
	};

	const themeObserver = new MutationObserver(() => {
		colors = readThemeColors();
		applyBicycleColors(parts, colors);
		trail.setColor(colors.trail);
	});
	themeObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['data-theme'],
	});

	window.addEventListener('resize', resize);
	document.addEventListener('visibilitychange', onVisibility);
	raf = requestAnimationFrame(tick);

	const destroy = () => {
		running = false;
		cancelAnimationFrame(raf);
		offMollieSession();
		window.removeEventListener('resize', resize);
		document.removeEventListener('visibilitychange', onVisibility);
		themeObserver.disconnect();

		scene.remove(parts.group);
		scene.remove(trail.line);
		trail.dispose();
		parts.group.traverse((obj) => {
			if (obj instanceof THREE.Mesh) {
				obj.geometry.dispose();
				const mat = obj.material;
				if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
				else mat.dispose();
			}
		});
		renderer.dispose();
		if (active === handle) active = null;
	};

	const handle: BicycleSceneHandle = { destroy };
	active = handle;
	return handle;
};
