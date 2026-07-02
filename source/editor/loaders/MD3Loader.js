import * as THREE from 'three';
import { Q3BSPLoader } from './Q3BSPLoader.js';
import { Q3ShaderLoader } from './Q3ShaderLoader.js';
import { Q3GLShaderLoader } from './Q3GLShaderLoader.js';

/**
 * MD3Loader
 * Parses binary Quake 3 engine mesh files (.md3) into structured Three.js hierarchies.
 * Manages skeletal anchor tags as nested Objects and builds morph target loops for MD3 frames.
 */
export class MD3Loader extends THREE.Loader {
	constructor(manager) {
		super(manager !== undefined ? manager : THREE.DefaultLoadingManager);
		this.shaderLoader = new Q3ShaderLoader(this.manager);
		this.materialBuilder = new Q3GLShaderLoader(this.manager);

		this.baseFolder = 'https://quake.games/demoq3/pak0.pk3dir';
		this.shaderLoader.setBaseUrl(this.baseFolder);
		this.materialBuilder.setBaseFolder(this.baseFolder);

		this.shaderRegistry = Q3BSPLoader.q3ShaderRegistry || {};
		this.xyzScale = 0.015625; // MD3_XYZ_SCALE (1.0 / 64.0)
	}

	setBaseFolder(path) {
		this.baseFolder = path;
		this.shaderLoader.setBaseUrl(path);
		this.materialBuilder.setBaseFolder(path);
		return this;
	}

	load(url, onLoad, onProgress, onError) {
		const scope = this;
		const loader = new THREE.FileLoader(scope.manager);
		loader.setPath(scope.path);
		loader.setResponseType("arraybuffer");

		loader.load(url, function (buffer) {
			if(onLoad) onLoad(scope.parse(buffer));
		}, onProgress, onError);
	}

	parse(buffer) {
		const view = new DataView(buffer);
		let ptr = 0;

		// --- HEADER SECTION ---
		const magic = view.getUint32(ptr, true); ptr += 4; // IDP3
		const version = view.getInt32(ptr, true); ptr += 4; // 15

		if(magic !== 860898377 || version !== 15) {
			console.error("MD3Loader: Invalid binary header sequence or unexpected internal version format.");
			return new THREE.Group();
		}

		ptr += 64; // skip internal name fields bounds checks

		const numFrames = view.getInt32(ptr, true); ptr += 4;
		const numTags = view.getInt32(ptr, true); ptr += 4;
		const numSurfaces = view.getInt32(ptr, true); ptr += 4;
		ptr += 4; // numSkins

		const ofsFrames = view.getInt32(ptr, true); ptr += 4;
		const ofsTags = view.getInt32(ptr, true); ptr += 4;
		const ofsSurfaces = view.getInt32(ptr, true); ptr += 4;

		const rootGroup = new THREE.Group();
		rootGroup.name = "MD3_ModelRoot";

		// --- FRAME TRACKING BOUNDS ---
		let framePtr = ofsFrames;
		const frames = [];
		for(let i = 0; i < numFrames; i++) {
			// Read bounding boxes min/max triplets
			const minX = view.getFloat32(framePtr, true);
			const minY = view.getFloat32(framePtr + 4, true);
			const minZ = view.getFloat32(framePtr + 8, true);
			const maxX = view.getFloat32(framePtr + 12, true);
			const maxY = view.getFloat32(framePtr + 16, true);
			const maxZ = view.getFloat32(framePtr + 20, true);

			frames.push({
				bboxMins: new THREE.Vector3(minX, minZ, -minY),
				bboxMaxs: new THREE.Vector3(maxX, maxZ, -maxY),
				radius: view.getFloat32(framePtr + 36, true)
			});
			framePtr += 56; // sizeof(md3Frame_t)
		}

		// --- TARGET CONNECTIONS TAG ANCHORS (Skeletal linkages e.g. tag_torso) ---
		let tagPtr = ofsTags;
		const decoder = new TextDecoder();
		const tagGroups = [];

		// Generate base attachment objects for the first frame
		for(let i = 0; i < numTags; i++) {
			const nameBytes = new Uint8Array(buffer, tagPtr, 64);
			const endIdx = nameBytes.indexOf(0);
			const tagName = decoder.decode(nameBytes.subarray(0, endIdx !== -1 ? endIdx : 64)).trim();

			let localPtr = tagPtr + 64;
			const originX = view.getFloat32(localPtr, true);
			const originY = view.getFloat32(localPtr + 4, true);
			const originZ = view.getFloat32(localPtr + 8, true);
			localPtr += 12;

			// Matrix values rotation orientation transforms mapping
			const r11 = view.getFloat32(localPtr, true);
			const r12 = view.getFloat32(localPtr + 4, true);
			const r13 = view.getFloat32(localPtr + 8, true); localPtr += 12;
			const r21 = view.getFloat32(localPtr, true);
			const r22 = view.getFloat32(localPtr + 4, true);
			const r23 = view.getFloat32(localPtr + 8, true); localPtr += 12;
			const r31 = view.getFloat32(localPtr, true);
			const r32 = view.getFloat32(localPtr + 4, true);
			const r33 = view.getFloat32(localPtr + 8, true);

			const tagAnchorGroup = new THREE.Group();
			tagAnchorGroup.name = tagName;

			// Map coordinate space transform updates Z-up to Y-up
			tagAnchorGroup.position.set(originX, originZ, -originY);

			const m4 = new THREE.Matrix4().set(
				r11, r13, -r12, 0,
				r31, r33, -r32, 0,
				-r21, -r23, r22, 0,
				0, 0, 0, 1
			);
			tagAnchorGroup.quaternion.setFromRotationMatrix(m4);

			rootGroup.add(tagAnchorGroup);
			tagGroups.push(tagAnchorGroup);

			tagPtr += 112; // sizeof(md3Tag_t)
		}

		// --- SURFACES DESERIALIZATION PIPELINE ---
		let surfPtr = ofsSurfaces;
		for(let s = 0; s < numSurfaces; s++) {
			const surfView = new DataView(buffer, surfPtr);

			const sNumFrames = surfView.getInt32(12, true);
			const sNumShaders = surfView.getInt32(16, true);
			const sNumVerts = surfView.getInt32(20, true);
			const sNumTriangles = surfView.getInt32(24, true);

			const ofsTriangles = surfView.getInt32(28, true);
			const ofsShaders = surfView.getInt32(32, true);
			const ofsSt = surfView.getInt32(36, true);
			const ofsXyzNormals = surfView.getInt32(40, true);
			const ofsEnd = surfView.getInt32(44, true);

			const nameBytes = new Uint8Array(buffer, surfPtr + 4, 64);
			const endIdx = nameBytes.indexOf(0);
			const surfName = decoder.decode(nameBytes.subarray(0, endIdx !== -1 ? endIdx : 64)).trim();

			// Extract Face Indices
			const indices = [];
			let triPtr = surfPtr + ofsTriangles;
			for(let t = 0; t < sNumTriangles; t++) {
				indices.push(
					view.getInt32(triPtr, true),
					view.getInt32(triPtr + 8, true), // Swap winding configuration to conform to Three.js specifications
					view.getInt32(triPtr + 4, true)
				);
				triPtr += 12;
			}

			// Extract Texture coordinates (ST maps)
			const uvs = [];
			let stPtr = surfPtr + ofsSt;
			for(let v = 0; v < sNumVerts; v++) {
				uvs.push(
					view.getFloat32(stPtr, true),
					1.0 - view.getFloat32(stPtr + 4, true)
				);
				stPtr += 8;
			}

			// Extract Morphed Geometric Keyframe Frame Vertex Vectors
			let xyzNormPtr = surfPtr + ofsXyzNormals;
			const framesPositions = [];
			const framesNormals = [];

			for(let f = 0; f < sNumFrames; f++) {
				const positions = [];
				const normals = [];

				for(let v = 0; v < sNumVerts; v++) {
					const x = view.getInt16(xyzNormPtr, true) * this.xyzScale;
					const y = view.getInt16(xyzNormPtr + 2, true) * this.xyzScale;
					const z = view.getInt16(xyzNormPtr + 4, true) * this.xyzScale;

					// Convert axes coordinate streams
					positions.push(x, z, -y);

					// Procedural unpacking of Zenith/Azimuth latitude-longitude normal byte allocations
					const encNormal = view.getUint16(xyzNormPtr + 6, true);
					const lat = ((encNormal >> 8) & 0xff) * (Math.PI / 128);
					const lng = (encNormal & 0xff) * (Math.PI / 128);

					normals.push(
						Math.cos(lat) * Math.sin(lng),
						Math.cos(lng),
						Math.sin(lat) * Math.sin(lng)
					);

					xyzNormPtr += 8;
				}
				framesPositions.push(positions);
				framesNormals.push(normals);
			}

			// --- MATERIAL RESOLUTION LINKING ---
			let shaderName = "noshader";
			if(sNumShaders > 0) {
				const shaderNameBytes = new Uint8Array(buffer, surfPtr + ofsShaders, 64);
				const sEndIdx = shaderNameBytes.indexOf(0);
				shaderName = decoder.decode(shaderNameBytes.subarray(0, sEndIdx !== -1 ? sEndIdx : 64)).trim();
			}

			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute('position', new THREE.Float32BufferAttribute(framesPositions[0], 3));
			geometry.setAttribute('normal', new THREE.Float32BufferAttribute(framesNormals[0], 3));
			geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
			geometry.setIndex(indices);

			// Construct Keyframe Morph Target Structural Tracks
			if(sNumFrames > 1) {
				geometry.morphAttributes.position = [];
				geometry.morphAttributes.normal = [];

				for(let f = 1; f < sNumFrames; f++) {
					const posAttr = new THREE.Float32BufferAttribute(framesPositions[f], 3);
					const normAttr = new THREE.Float32BufferAttribute(framesNormals[f], 3);
					posAttr.name = `frame_${f}`;
					normAttr.name = `frame_${f}`;

					geometry.morphAttributes.position.push(posAttr);
					geometry.morphAttributes.normal.push(normAttr);
				}
			}

			let materials = [];
			if(shaderName !== "noshader") {
				const lookup = shaderName.toLowerCase();
				const cachedShader = this.shaderRegistry[lookup];
				if(cachedShader) {
					materials = this.materialBuilder.buildMaterials(cachedShader);
				}
			}

			if(materials.length === 0) {
				materials.push(this.materialBuilder.buildDefaultMaterial(shaderName, THREE.DoubleSide));
				this.materialBuilder.resolveTexture(shaderName || (surfName + ".jpg"), false, (tex) => {
					materials[0].uniforms.map.value = tex;
				});
			}

			// Render passes stacked natively per surface mesh representation layer
			materials.forEach((material, stageIndex) => {
				const mesh = new THREE.Mesh(geometry, material);
				mesh.name = `${surfName}_stg${stageIndex}`;
				mesh.frustumCulled = false;
				mesh.castShadow = true;
				mesh.receiveShadow = true;

				mesh.userData = {
					shaderName: shaderName,
					numFrames: sNumFrames
				};

				rootGroup.add(mesh);
			});

			surfPtr += ofsEnd;
		}

		rootGroup.userData = {
			totalFrames: numFrames,
			tags: tagGroups,
			bounds: frames[0]
		};

		return rootGroup;
	}
}

