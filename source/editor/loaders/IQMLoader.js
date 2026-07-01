/* eslint-disable camelcase */
import * as THREE from 'three';
import { Q3BSPLoader } from './Q3BSPLoader.js';
import { Q3ShaderLoader } from './Q3ShaderLoader.js';
import { Q3GLShaderLoader } from './Q3GLShaderLoader.js';

// IQM Constants Definition
const IQM_MAGIC = "INTERQUAKEMODEL\0";
const IQM_VERSION = 2;

const IQM_POSITION = 0;
const IQM_TEXCOORD = 1;
const IQM_NORMAL = 2;
const IQM_TANGENT = 3;
const IQM_BLENDINDEXES = 4;
const IQM_BLENDWEIGHTS = 5;
const IQM_COLOR = 6;

const IQM_UBYTE = 1;
const IQM_FLOAT = 7;

/**
 * IQMLoader
 * Deserializes InterQuakeModel (.iqm) binary specifications into GPU-accelerated
 * SkinnedMesh bone weight architectures conforming to traditional Three.js standards.
 */
export class IQMLoader extends THREE.Loader {
	constructor(manager) {
		super(manager !== undefined ? manager : THREE.DefaultLoadingManager);
		this.shaderLoader = new Q3ShaderLoader(this.manager);
		this.materialBuilder = new Q3GLShaderLoader(this.manager);

		this.baseFolder = 'https://quake.games/demoq3/pak0.pk3dir';
		this.shaderLoader.setBaseUrl(this.baseFolder);
		this.materialBuilder.setBaseFolder(this.baseFolder);

		this.shaderRegistry = Q3BSPLoader.q3ShaderRegistry || {};
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
		const decoder = new TextDecoder();

		// Check Magic
		let magicStr = "";
		for(let i = 0; i < 16; i++) {
			const charCode = view.getUint8(i);
			if(charCode === 0) break;
			magicStr += String.fromCharCode(charCode);
		}

		if(magicStr !== "INTERQUAKEMODEL") {
			console.error("IQMLoader: Invalid magic descriptor head found.");
			return new THREE.Group();
		}

		const version = view.getUint32(16, true);
		if(version !== IQM_VERSION) {
			console.error(`IQMLoader: Unsupported structure version (${version}). Required: ${IQM_VERSION}`);
			return new THREE.Group();
		}

		// --- EXTRACT HEADER SCHEMATICS ---
		const filesize = view.getUint32(20, true);
		const flags = view.getUint32(24, true);
		const num_text = view.getUint32(28, true);
		const ofs_text = view.getUint32(32, true);
		const num_meshes = view.getUint32(36, true);
		const ofs_meshes = view.getUint32(40, true);
		const num_vertexarrays = view.getUint32(44, true);
		const num_vertexes = view.getUint32(48, true);
		const ofs_vertexarrays = view.getUint32(52, true);
		const num_triangles = view.getUint32(56, true);
		const ofs_triangles = view.getUint32(60, true);
		const num_joints = view.getUint32(68, true);
		const ofs_joints = view.getUint32(72, true);
		const num_poses = view.getUint32(76, true);
		const ofs_poses = view.getUint32(80, true);
		const num_anims = view.getUint32(84, true);
		const ofs_anims = view.getUint32(88, true);
		const num_frames = view.getUint32(92, true);

		// --- RESOLVE STRING TABLE POINTERS ---
		const textBuffer = new Uint8Array(buffer, ofs_text, num_text);
		const getString = (offset) => {
			if(offset >= num_text) return "";
			let end = offset;
			while(end < num_text && textBuffer[end] !== 0) end++;
			return decoder.decode(textBuffer.subarray(offset, end));
		};

		// --- DESERIALIZE BONE SKELETON LAYER ---
		const bones = [];
		const bindMatrices = [];
		const inverseBindMatrices = [];

		let jointPtr = ofs_joints;
		for(let i = 0; i < num_joints; i++) {
			const nameOffset = view.getUint32(jointPtr, true);
			const parentIndex = view.getInt32(jointPtr + 4, true);

			const tx = view.getFloat32(jointPtr + 8, true);
			const ty = view.getFloat32(jointPtr + 12, true);
			const tz = view.getFloat32(jointPtr + 16, true);

			const qx = view.getFloat32(jointPtr + 20, true);
			const qy = view.getFloat32(jointPtr + 24, true);
			const qz = view.getFloat32(jointPtr + 28, true);
			const qw = view.getFloat32(jointPtr + 32, true);

			const sx = view.getFloat32(jointPtr + 36, true);
			const sy = view.getFloat32(jointPtr + 40, true);
			const sz = view.getFloat32(jointPtr + 44, true);

			const bone = new THREE.Bone();
			bone.name = getString(nameOffset);

			// Map spaces matching standard custom orientation bounds
			bone.position.set(tx, tz, -ty);
			bone.quaternion.set(qx, qz, -qy, qw).normalize();
			bone.scale.set(sx, sz, sy);

			bones.push(bone);

			// Compute structural bind transforms alignment matching 3x4 layout conversions
			const localMatrix = new THREE.Matrix4().compose(
				new THREE.Vector3(tx, tz, -ty),
				new THREE.Quaternion(qx, qz, -qy, qw).normalize(),
				new THREE.Vector3(sx, sz, sy)
			);

			bindMatrices.push(localMatrix);
			jointPtr += 48; // sizeof(iqmJoint_t)
		}

		// Parent bone linkages tree mapping resolution
		jointPtr = ofs_joints;
		const rootGroup = new THREE.Group();
		rootGroup.name = "IQM_ModelRoot";

		for(let i = 0; i < num_joints; i++) {
			const parentIndex = view.getInt32(jointPtr + 4, true);
			if(parentIndex >= 0 && parentIndex < num_joints) {
				bones[parentIndex].add(bones[i]);
			} else {
				rootGroup.add(bones[i]); // Root level bones attaches straight to group container
			}
			jointPtr += 48;
		}

		// Calculate absolute workspace global matrices
		rootGroup.updateMatrixWorld(true);
		for(let i = 0; i < num_joints; i++) {
			inverseBindMatrices.push(bones[i].matrixWorld.clone().invert());
		}

		// --- EXTRACT VERTEX ARRAY BUFFERS ---
		const arrays = {};
		let vaPtr = ofs_vertexarrays;
		for(let i = 0; i < num_vertexarrays; i++) {
			const type = view.getUint32(vaPtr, true);
			const flags = view.getUint32(vaPtr + 4, true);
			const format = view.getUint32(vaPtr + 8, true);
			const size = view.getUint32(vaPtr + 12, true);
			const offset = view.getUint32(vaPtr + 16, true);

			let arrayData = null;
			const elementCount = num_vertexes * size;

			if(format === IQM_FLOAT) {
				arrayData = new Float32Array(buffer, offset, elementCount);
			} else if(format === IQM_UBYTE) {
				arrayData = new Uint8Array(buffer, offset, elementCount);
			}

			if(arrayData) {
				arrays[type] = { size, format, data: arrayData };
			}
			vaPtr += 20; // sizeof(iqmVertexArray_t)
		}

		// --- EXTRACT INDICES ---
		const totalIndices = num_triangles * 3;
		const rawIndices = new Uint32Array(buffer, ofs_triangles, totalIndices);
		const indices = [];
		for(let i = 0; i < totalIndices; i += 3) {
			indices.push(rawIndices[i], rawIndices[i + 2], rawIndices[i + 1]); // Convert face winding
		}

		// --- SUB-MESH SURFACE COMPILATION LOOP ---
		let meshPtr = ofs_meshes;

		const sharedSkeleton = num_joints > 0 ? new THREE.Skeleton(bones, inverseBindMatrices) : null;

		for(let m = 0; m < num_meshes; m++) {
			const nameOffset = view.getUint32(meshPtr, true);
			const materialOffset = view.getUint32(meshPtr + 4, true);
			const firstVertex = view.getUint32(meshPtr + 8, true);
			const vertexCount = view.getUint32(meshPtr + 12, true);
			const firstTriangle = view.getUint32(meshPtr + 16, true);
			const triangleCount = view.getUint32(meshPtr + 20, true);

			const meshName = getString(nameOffset);
			const shaderName = getString(materialOffset);

			const geometry = new THREE.BufferGeometry();

			// Slice out sub-range local mesh boundaries attributes safely
			const sliceAttribute = (arrayConfig, itemSize) => {
				if(!arrayConfig) return null;
				const src = arrayConfig.data;
				const start = firstVertex * itemSize;
				const count = vertexCount * itemSize;
				return src.slice(start, start + count);
			};

			// Positions coordinate transform translation
			const posData = sliceAttribute(arrays[IQM_POSITION], 3);
			if(posData) {
				const positions = new Float32Array(posData.length);
				for(let i = 0; i < posData.length; i += 3) {
					positions[i] = posData[i];
					positions[i + 1] = posData[i + 2];
					positions[i + 2] = -posData[i + 1];
				}
				geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
			}

			// Normals space realignment
			const normData = sliceAttribute(arrays[IQM_NORMAL], 3);
			if(normData) {
				const normals = new Float32Array(normData.length);
				for(let i = 0; i < normData.length; i += 3) {
					normals[i] = normData[i];
					normals[i + 1] = normData[i + 2];
					normals[i + 2] = -normData[i + 1];
				}
				geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
			}

			// UV Layouts mappings profile
			const uvData = sliceAttribute(arrays[IQM_TEXCOORD], 2);
			if(uvData) {
				const uvs = new Float32Array(uvData.length);
				for(let i = 0; i < uvData.length; i += 2) {
					uvs[i] = uvData[i];
					uvs[i + 1] = 1.0 - uvData[i + 1];
				}
				geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
			}

			// Tangent attribute translation profile
			const tanData = sliceAttribute(arrays[IQM_TANGENT], 4);
			if(tanData) {
				const tangents = new Float32Array(tanData.length);
				for(let i = 0; i < tanData.length; i += 4) {
					tangents[i] = tanData[i];
					tangents[i + 1] = tanData[i + 2];
					tangents[i + 2] = -tanData[i + 1];
					tangents[i + 3] = tanData[i + 3];
				}
				geometry.setAttribute('tangent', new THREE.BufferAttribute(tangents, 4));
			}

			// Skin Joint Blends attributes compilation (Indices/Weights allocation profiles)
			if(num_joints > 0) {
				const idxData = sliceAttribute(arrays[IQM_BLENDINDEXES], 4);
				const wgtData = sliceAttribute(arrays[IQM_BLENDWEIGHTS], 4);

				if(idxData) {
					const skinIndex = new Uint16Array(idxData.length);
					skinIndex.set(idxData); // Maps standard bones array mappings sequence directly
					geometry.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
				}

				if(wgtData) {
					const skinWeight = new Float32Array(wgtData.length);
					if(arrays[IQM_BLENDWEIGHTS].format === IQM_UBYTE) {
						for(let i = 0; i < wgtData.length; i++) skinWeight[i] = wgtData[i] / 255.0;
					} else {
						skinWeight.set(wgtData);
					}
					geometry.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
				}
			}

			// Index offsets range matching localized vertex slicing
			const subIndices = [];
			const startIndex = firstTriangle * 3;
			const endIndex = startIndex + (triangleCount * 3);
			for(let i = startIndex; i < endIndex; i++) {
				subIndices.push(indices[i] - firstVertex);
			}
			geometry.setIndex(subIndices);

			geometry.computeBoundingBox();
			geometry.computeBoundingSphere();

			// Material Pipeline Binding Target Identification
			let materials = [];
			if(shaderName && shaderName !== "") {
				const lookup = shaderName.toLowerCase();
				const cachedShader = this.shaderRegistry[lookup];
				if(cachedShader) {
					materials = this.materialBuilder.buildMaterials(cachedShader);
				}
			}

			if(materials.length === 0) {
				materials.push(this.materialBuilder.buildDefaultMaterial(THREE.DoubleSide));
				this.materialBuilder.resolveTexture(shaderName || (meshName + ".jpg"), false, (tex) => {
					materials[0].uniforms.map.value = tex;
				});
			}

			materials.forEach((material, stageIndex) => {
				// Ensure skinning uniforms are explicitly declared on custom material definitions
				material.skinning = num_joints > 0;

				const sMesh = new THREE.SkinnedMesh(geometry, material);
				sMesh.name = `${meshName || "surface"}_stg${stageIndex}`;
				sMesh.frustumCulled = false;
				sMesh.castShadow = true;
				sMesh.receiveShadow = true;

				if(num_joints > 0 && sharedSkeleton) {
					sMesh.bind(sharedSkeleton, sMesh.matrixWorld);
				}

				rootGroup.add(sMesh);
			});

			meshPtr += 24; // sizeof(iqmMesh_t)
		}

		rootGroup.userData = {
			numFrames: num_frames,
			numJoints: num_joints,
			skeleton: sharedSkeleton
		};

		return rootGroup;
	}
}


// =============================================================================
// RUNTIME IQM FILE INTERCEPT DROP HOOKS INTEGRATION
// =============================================================================
export function injectIQMDropper(extension, file, name, FileSystem, callback, errorCondition) {
	if(extension === "iqm") {
		let reader = new FileReader();
		reader.onload = async function () {
			try {
				let loader = new IQMLoader();

				if(file.path) {
					let baseDir = file.path.substring(0, file.path.lastIndexOf('/'));
					loader.setBaseFolder(baseDir);
				}

				// Attach shared pipeline shader registry map bounds context
				loader.shaderRegistry = Q3BSPLoader.q3ShaderRegistry || {};

				let iqmGroup = loader.parse(reader.result);
				iqmGroup.name = FileSystem.getFileName(name);

				await callback(iqmGroup, window.Nunu ? window.Nunu.getScene() : null);
			}
			catch(e) {
				errorCondition(e);
			}
		};
		reader.readAsArrayBuffer(file);
		return true;
	}
	return false;
}
