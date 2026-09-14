import * as THREE from 'three';

export type BicycleColors = {
	frame: string;
	accent: string;
	wheel: string;
};

export type BicycleParts = {
	group: THREE.Group;
	frontWheel: THREE.Group;
	rearWheel: THREE.Group;
	materials: THREE.MeshStandardMaterial[];
};

const tube = (
	from: THREE.Vector3,
	to: THREE.Vector3,
	radius: number,
	material: THREE.MeshStandardMaterial,
) => {
	const direction = new THREE.Vector3().subVectors(to, from);
	const length = direction.length();
	const geometry = new THREE.CylinderGeometry(radius, radius, length, 8);
	const mesh = new THREE.Mesh(geometry, material);
	mesh.position.copy(from).add(to).multiplyScalar(0.5);
	mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
	return mesh;
};

const makeMaterial = (color: string) =>
	new THREE.MeshStandardMaterial({
		color: new THREE.Color(color),
		roughness: 0.85,
		metalness: 0.08,
		flatShading: true,
	});

const makeWheel = (material: THREE.MeshStandardMaterial, spokeMaterial: THREE.MeshStandardMaterial) => {
	const group = new THREE.Group();

	const tire = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 8, 24), material);
	tire.rotation.y = Math.PI / 2;
	group.add(tire);

	const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8), spokeMaterial);
	hub.rotation.z = Math.PI / 2;
	group.add(hub);

	for (let i = 0; i < 8; i++) {
		const angle = (i / 8) * Math.PI * 2;
		const spoke = new THREE.Mesh(
			new THREE.CylinderGeometry(0.008, 0.008, 0.76, 4),
			spokeMaterial,
		);
		spoke.position.set(0, Math.cos(angle) * 0.02, Math.sin(angle) * 0.02);
		spoke.rotation.z = angle;
		group.add(spoke);
	}

	return group;
};

/** Clean procedural bicycle mockup facing +Z by default. */
export const createBicycle = (colors: BicycleColors): BicycleParts => {
	const group = new THREE.Group();
	const materials: THREE.MeshStandardMaterial[] = [];

	const frameMat = makeMaterial(colors.frame);
	const accentMat = makeMaterial(colors.accent);
	const wheelMat = makeMaterial(colors.wheel);
	materials.push(frameMat, accentMat, wheelMat);

	const rearHub = new THREE.Vector3(0, 0.42, -0.55);
	const bottomBracket = new THREE.Vector3(0, 0.38, -0.05);
	const seatCluster = new THREE.Vector3(0, 0.92, -0.42);
	const headTubeTop = new THREE.Vector3(0, 0.95, 0.45);
	const headTubeBottom = new THREE.Vector3(0, 0.55, 0.52);
	const frontHub = new THREE.Vector3(0, 0.42, 0.72);

	group.add(tube(rearHub, bottomBracket, 0.028, frameMat));
	group.add(tube(bottomBracket, seatCluster, 0.03, frameMat));
	group.add(tube(seatCluster, headTubeTop, 0.026, frameMat));
	group.add(tube(bottomBracket, headTubeBottom, 0.026, frameMat));
	group.add(tube(headTubeTop, headTubeBottom, 0.032, frameMat));
	group.add(tube(headTubeBottom, frontHub, 0.024, frameMat));
	group.add(tube(rearHub, seatCluster, 0.022, frameMat));

	const seat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.28), accentMat);
	seat.position.set(0, 1.02, -0.42);
	seat.rotation.x = -0.15;
	group.add(seat);

	const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 8), accentMat);
	bar.rotation.z = Math.PI / 2;
	bar.position.copy(headTubeTop).add(new THREE.Vector3(0, 0.08, 0.02));
	group.add(bar);

	const stem = tube(headTubeTop, bar.position.clone(), 0.016, frameMat);
	group.add(stem);

	const crank = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 6), accentMat);
	crank.rotation.z = Math.PI / 2;
	crank.position.copy(bottomBracket);
	group.add(crank);

	const pedalL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.04), accentMat);
	pedalL.position.set(-0.12, 0.38, -0.05);
	group.add(pedalL);
	const pedalR = pedalL.clone();
	pedalR.position.x = 0.12;
	group.add(pedalR);

	const rearWheel = makeWheel(wheelMat, accentMat);
	rearWheel.position.copy(rearHub);
	group.add(rearWheel);

	const frontWheel = makeWheel(wheelMat, accentMat);
	frontWheel.position.copy(frontHub);
	group.add(frontWheel);

	group.scale.setScalar(0.55);
	group.rotation.y = Math.PI;

	return { group, frontWheel, rearWheel, materials };
};

export const applyBicycleColors = (parts: BicycleParts, colors: BicycleColors) => {
	const [frameMat, accentMat, wheelMat] = parts.materials;
	frameMat.color.set(colors.frame);
	accentMat.color.set(colors.accent);
	wheelMat.color.set(colors.wheel);
};
