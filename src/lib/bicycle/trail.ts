import * as THREE from 'three';

const trailVertex = /* glsl */ `
  attribute vec4 color;
  varying vec4 vColor;
  void main() {
    vColor = color;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const trailFragment = /* glsl */ `
  varying vec4 vColor;
  void main() {
    if (vColor.a < 0.02) discard;
    gl_FragColor = vColor;
  }
`;

/**
 * Trail drawn as a sliding window along the bike's own path curve.
 * Guarantees a smooth continuous ribbon that starts as soon as the bike moves.
 */
export class BikeTrail {
	readonly line: THREE.Line;
	private readonly positions: Float32Array;
	private readonly colors: Float32Array;
	private readonly geometry: THREE.BufferGeometry;
	private readonly material: THREE.ShaderMaterial;
	private readonly sampleCount: number;
	private readonly tmp = new THREE.Vector3();
	private baseColor = new THREE.Color('#697565');

	constructor(sampleCount = 72) {
		this.sampleCount = sampleCount;
		this.positions = new Float32Array(sampleCount * 3);
		this.colors = new Float32Array(sampleCount * 4);

		this.geometry = new THREE.BufferGeometry();
		this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
		this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4));
		this.geometry.setDrawRange(0, 0);

		this.material = new THREE.ShaderMaterial({
			vertexShader: trailVertex,
			fragmentShader: trailFragment,
			transparent: true,
			depthWrite: false,
		});

		this.line = new THREE.Line(this.geometry, this.material);
		this.line.frustumCulled = false;
	}

	setColor(hex: string) {
		this.baseColor.set(hex);
	}

	clear() {
		this.geometry.setDrawRange(0, 0);
	}

	/**
	 * Redraw trail from `tStart` → `tEnd` along `curve` (both in 0..1).
	 * Call every frame with the bike's current progress.
	 */
	setFromCurve(curve: THREE.Curve<THREE.Vector3>, tStart: number, tEnd: number) {
		const start = THREE.MathUtils.clamp(tStart, 0, 1);
		const end = THREE.MathUtils.clamp(tEnd, 0, 1);
		if (end - start < 0.002) {
			this.clear();
			return;
		}

		const count = this.sampleCount;
		for (let i = 0; i < count; i++) {
			const u = start + ((end - start) * i) / (count - 1);
			curve.getPointAt(u, this.tmp);

			const pi = i * 3;
			this.positions[pi] = this.tmp.x;
			this.positions[pi + 1] = this.tmp.y;
			this.positions[pi + 2] = this.tmp.z;

			// Soft fade toward the tail (older = smaller i)
			const age = i / (count - 1);
			const alpha = Math.pow(age, 1.35) * 0.92;
			const ci = i * 4;
			this.colors[ci] = this.baseColor.r;
			this.colors[ci + 1] = this.baseColor.g;
			this.colors[ci + 2] = this.baseColor.b;
			this.colors[ci + 3] = alpha;
		}

		(this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
		(this.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
		this.geometry.setDrawRange(0, count);
		this.geometry.computeBoundingSphere();
	}

	dispose() {
		this.geometry.dispose();
		this.material.dispose();
	}
}
