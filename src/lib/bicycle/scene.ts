import * as THREE from 'three';
import {
  applyBicycleColors,
  createBicycle,
  type BicycleColors,
  type BicycleParts,
} from './create-bicycle';
import { createCrossingPath, getBounds, pickNextEnter, pickExit, type CrossingPath } from './paths';
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

const KMH_MIN = 30;
const KMH_MAX = 60;
const MAX_LAPS = 2;
const RIDE_SCALE = 0.55;
const PARK_SCALE = 0.22;
const PARK_DURATION = 1.35;
const WHEELIE_MAX = 0.72;
const WHEELIE_LERP = 10;
const DRIVE_ACCEL = 5.2;
const DRIVE_MAX = 3.1;
const DRIVE_REVERSE_MAX = 1.7;
const DRIVE_FRICTION = 2.8;
const STEER_RATE = 2.6;
const DESKTOP_MQ = '(min-width: 960px)';
/** Persists across navigations; clears when the tab closes. */
const SESSION_KEY = 'bike-tab-session';
/** World-space padding from the frustum edge when parked (~viewport edge inset). */
const PARK_EDGE_PAD = 0.038;

type BikeSession = {
  lapsDone: number;
  phase: 'ride' | 'done';
};

const readSession = (): BikeSession => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return { lapsDone: 0, phase: 'ride' };
    const parsed = JSON.parse(raw) as Partial<BikeSession>;
    const lapsDone = Math.max(0, Math.min(MAX_LAPS, Number(parsed.lapsDone) || 0));
    const phase = parsed.phase === 'done' || lapsDone >= MAX_LAPS ? 'done' : 'ride';
    return { lapsDone, phase };
  } catch {
    return { lapsDone: 0, phase: 'ride' };
  }
};

const writeSession = (session: BikeSession) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
};

/** Map whimsical km/h → world-units per second along the path. */
const speedFromKmh = (kmh: number) => {
  const u = THREE.MathUtils.clamp((kmh - KMH_MIN) / (KMH_MAX - KMH_MIN), 0, 1);
  return THREE.MathUtils.lerp(0.35, 5.8, u);
};

const rollKmh = () => KMH_MIN + Math.random() * (KMH_MAX - KMH_MIN);

/** First appearance delay after visit (seconds). */
const rollEntranceDelay = () => 3 + Math.random() * 9;

const isHomepage = () => window.location.pathname === '/' || window.location.pathname === '';
const isDesktop = () => window.matchMedia(DESKTOP_MQ).matches;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

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
  parts.group.scale.setScalar(RIDE_SCALE);
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
  const parkFrom = new THREE.Vector3();
  const parkTo = new THREE.Vector3();
  const drivePos = new THREE.Vector3();
  const driveLook = new THREE.Vector3();
  const keys = { up: false, down: false, left: false, right: false };
  let driveHeading = Math.PI;
  let driveSpeed = 0;
  let driveReady = false;

  const session = readSession();

  /** Bike only appears after Mollie is done (or skipped); then waits 3–12s. */
  let enterAt = Number.POSITIVE_INFINITY;
  let hasEntered = false;
  let lapsDone = session.lapsDone;
  let mode: 'ride' | 'parking' | 'parked' | 'gone' = 'ride';
  let parkElapsed = 0;
  let parkFromScale = RIDE_SCALE;
  let wheelie = 0;
  let wheelieTarget = 0;

  const hit = document.createElement('button');
  hit.type = 'button';
  hit.className = 'bicycle-park-hit';
  hit.setAttribute('aria-hidden', 'true');
  hit.tabIndex = -1;
  document.body.appendChild(hit);

  const setHitActive = (on: boolean) => {
    hit.classList.toggle('is-on', on);
    if (!on) wheelieTarget = 0;
  };

  const onHitEnter = () => {
    if (mode === 'parked') wheelieTarget = WHEELIE_MAX;
  };
  const onHitLeave = () => {
    wheelieTarget = 0;
  };
  hit.addEventListener('pointerenter', onHitEnter);
  hit.addEventListener('pointerleave', onHitLeave);

  const isTypingTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
  };

  const setKey = (code: string, pressed: boolean) => {
    switch (code) {
      case 'ArrowUp':
      case 'KeyW':
        keys.up = pressed;
        return true;
      case 'ArrowDown':
      case 'KeyS':
        keys.down = pressed;
        return true;
      case 'ArrowLeft':
      case 'KeyA':
        keys.left = pressed;
        return true;
      case 'ArrowRight':
      case 'KeyD':
        keys.right = pressed;
        return true;
      default:
        return false;
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (mode !== 'parked' || !isHomepage() || isTypingTarget(event.target)) return;
    if (!setKey(event.code, true)) return;
    event.preventDefault();
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (!setKey(event.code, false)) return;
    if (mode === 'parked' && isHomepage()) event.preventDefault();
  };

  const clearKeys = () => {
    keys.up = keys.down = keys.left = keys.right = false;
  };

  const persist = (next: BikeSession) => {
    lapsDone = next.lapsDone;
    writeSession(next);
  };

  const armEntrance = () => {
    if (hasEntered || Number.isFinite(enterAt)) return;
    // Same tab session already saw the bike — resume without the long wait.
    const delay = lapsDone > 0 ? 0.4 : rollEntranceDelay();
    enterAt = performance.now() + delay * 1000;
  };

  const parkTarget = (out: THREE.Vector3) => {
    const bounds = getBounds(camera);
    const padX = bounds.width * PARK_EDGE_PAD;
    const padY = bounds.height * PARK_EDGE_PAD;
    out.set(bounds.width / 2 - padX, -bounds.height / 2 + padY, bounds.z);
  };

  const clampDrivePos = () => {
    const bounds = getBounds(camera);
    const padX = bounds.width * PARK_EDGE_PAD;
    const padY = bounds.height * PARK_EDGE_PAD;
    drivePos.x = THREE.MathUtils.clamp(drivePos.x, -bounds.width / 2 + padX, bounds.width / 2 - padX);
    drivePos.y = THREE.MathUtils.clamp(drivePos.y, -bounds.height / 2 + padY, bounds.height / 2 - padY);
    drivePos.z = bounds.z;
  };

  const faceDrive = () => {
    driveLook.set(
      drivePos.x + Math.cos(driveHeading),
      drivePos.y + Math.sin(driveHeading),
      drivePos.z,
    );
    parts.group.up.copy(up);
    parts.group.lookAt(driveLook);
  };

  const syncHitPosition = () => {
    const ndc = drivePos.clone().project(camera);
    const x = (ndc.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-ndc.y * 0.5 + 0.5) * window.innerHeight;
    hit.style.left = `${x}px`;
    hit.style.top = `${y}px`;
    hit.style.right = 'auto';
    hit.style.bottom = 'auto';
    hit.style.transform = 'translate(-55%, -45%)';
  };

  const applyParkedPose = () => {
    parkTarget(parkTo);
    drivePos.copy(parkTo);
    driveHeading = Math.PI;
    driveSpeed = 0;
    driveReady = true;
    clearKeys();
    parts.group.position.copy(drivePos);
    parts.group.scale.setScalar(PARK_SCALE);
    parts.group.visible = true;
    trail.clear();
    faceDrive();
    setHitActive(true);
    syncHitPosition();
  };

  const beginPark = () => {
    mode = 'parking';
    parkElapsed = 0;
    parkFrom.copy(parts.group.position);
    parkFromScale = parts.group.scale.x;
    parkTarget(parkTo);
    trail.clear();
    driveReady = false;
    setHitActive(false);
    persist({ lapsDone: MAX_LAPS, phase: 'done' });
  };

  const finishLaps = () => {
    persist({ lapsDone: MAX_LAPS, phase: 'done' });
    if (isDesktop() && isHomepage()) {
      beginPark();
      return;
    }
    mode = 'gone';
    parts.group.visible = false;
    trail.clear();
    setHitActive(false);
  };

  if (session.phase === 'done' || lapsDone >= MAX_LAPS) {
    hasEntered = true;
    if (isDesktop() && isHomepage()) {
      mode = 'parked';
    } else {
      mode = 'gone';
    }
  } else {
    if (isMollieSessionDone()) {
      armEntrance();
    }
  }
  const offMollieSession = onMollieSessionDone(() => {
    if (mode === 'ride' && !hasEntered) armEntrance();
  });

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

    const done = mode === 'parked' || mode === 'parking' || mode === 'gone' || lapsDone >= MAX_LAPS;
    if (!done) return;

    if (isDesktop() && isHomepage()) {
      if (mode === 'gone' || mode === 'parked') {
        mode = 'parked';
        if (!driveReady) {
          applyParkedPose();
        } else {
          clampDrivePos();
          parts.group.visible = true;
          parts.group.scale.setScalar(PARK_SCALE);
          setHitActive(true);
          syncHitPosition();
        }
      } else if (mode === 'parking') {
        parkTarget(parkTo);
      }
      return;
    }

    mode = 'gone';
    parts.group.visible = false;
    trail.clear();
    setHitActive(false);
  };

  resize();
  if (mode === 'parked') {
    applyParkedPose();
  } else if (mode === 'gone') {
    parts.group.visible = false;
    setHitActive(false);
  }

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

    if (mode === 'gone') {
      renderer.render(scene, camera);
      return;
    }

    if (!hasEntered) {
      if (!isMollieSessionDone() || now < enterAt) {
        renderer.render(scene, camera);
        return;
      }
      hasEntered = true;
      parts.group.visible = true;
      parts.group.scale.setScalar(RIDE_SCALE);
      t = 0;
      travelSpeed = speedFromKmh(rollKmh());
      trail.clear();
    }

    if (mode === 'parking') {
      parkElapsed += dt;
      const u = easeOutCubic(Math.min(1, parkElapsed / PARK_DURATION));
      parts.group.position.lerpVectors(parkFrom, parkTo, u);
      parts.group.scale.setScalar(THREE.MathUtils.lerp(parkFromScale, PARK_SCALE, u));
      drivePos.copy(parts.group.position);
      driveHeading = Math.PI;
      faceDrive();
      if (u >= 1) {
        mode = 'parked';
        applyParkedPose();
        persist({ lapsDone: MAX_LAPS, phase: 'done' });
      }
      renderer.render(scene, camera);
      return;
    }

    if (mode === 'parked') {
      if (!driveReady) applyParkedPose();

      if (keys.up) {
        driveSpeed = Math.min(DRIVE_MAX, driveSpeed + DRIVE_ACCEL * dt);
      } else if (keys.down) {
        driveSpeed = Math.max(-DRIVE_REVERSE_MAX, driveSpeed - DRIVE_ACCEL * dt);
      } else if (driveSpeed > 0) {
        driveSpeed = Math.max(0, driveSpeed - DRIVE_FRICTION * dt);
      } else if (driveSpeed < 0) {
        driveSpeed = Math.min(0, driveSpeed + DRIVE_FRICTION * dt);
      }

      const moving = Math.abs(driveSpeed) > 0.04;
      const steerSign = moving ? Math.sign(driveSpeed) : 1;
      if (keys.left) driveHeading += STEER_RATE * dt * steerSign;
      if (keys.right) driveHeading -= STEER_RATE * dt * steerSign;

      drivePos.x += Math.cos(driveHeading) * driveSpeed * dt;
      drivePos.y += Math.sin(driveHeading) * driveSpeed * dt;
      clampDrivePos();

      parts.group.position.copy(drivePos);
      parts.group.scale.setScalar(PARK_SCALE);
      faceDrive();

      if (moving) {
        const lean = THREE.MathUtils.clamp(
          ((keys.left ? 1 : 0) - (keys.right ? 1 : 0)) * steerSign * 0.22,
          -0.28,
          0.28,
        );
        parts.group.rotateZ(lean);
        const spin = dt * (4 + Math.abs(driveSpeed) * 3.2) * Math.sign(driveSpeed || 1);
        parts.frontWheel.rotation.x += Math.abs(spin);
        parts.rearWheel.rotation.x += Math.abs(spin);
        wheelieTarget = 0;
        wheelie = 0;
      } else {
        wheelie += (wheelieTarget - wheelie) * Math.min(1, dt * WHEELIE_LERP);
        if (wheelie > 0.001) {
          parts.group.rotateX(-wheelie);
          parts.rearWheel.rotation.x += dt * 6;
        }
      }

      syncHitPosition();
      renderer.render(scene, camera);
      return;
    }

    const length = Math.max(path.curve.getLength(), 0.001);
    t += (travelSpeed * dt) / length;

    if (t >= 1) {
      const nextLaps = lapsDone + 1;
      persist({ lapsDone: nextLaps, phase: nextLaps >= MAX_LAPS ? 'done' : 'ride' });
      if (nextLaps >= MAX_LAPS) {
        finishLaps();
        renderer.render(scene, camera);
        return;
      }
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
    else clearKeys();
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
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearKeys);
  document.addEventListener('visibilitychange', onVisibility);
  raf = requestAnimationFrame(tick);

  const destroy = () => {
    running = false;
    cancelAnimationFrame(raf);
    offMollieSession();
    window.removeEventListener('resize', resize);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', clearKeys);
    document.removeEventListener('visibilitychange', onVisibility);
    hit.removeEventListener('pointerenter', onHitEnter);
    hit.removeEventListener('pointerleave', onHitLeave);
    hit.remove();
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
