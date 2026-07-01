import * as THREE from 'three';
import pako from 'pako';
import JSZip from 'jszip';

export class MinecraftExporter {
	constructor() {
		this.xyzScale = 0.015625; // Matching standard Q3 scaling bounds if needed
	}

	/**
	 * Exports a group/mesh into a native Minecraft 1.20+ .JSON block model.
	 * Scale Factor maps Three.js units directly into Minecraft's 16x16x16 localized box.
	 */
	parseJsonModel(rootObject, options = {}) {
		const scaleFactor = options.scaleFactor !== undefined ? options.scaleFactor : 16.0;
		const elements = [];

		rootObject.updateMatrixWorld(true);

		rootObject.traverse((child) => {
			if(child.isMesh && child.geometry) {
				if(!child.geometry.boundingBox) {
					child.geometry.computeBoundingBox();
				}

				const worldBox = child.geometry.boundingBox.clone().applyMatrix4(child.matrixWorld);

				// Map Three.js meters to Minecraft's 0-16 grid bounds
				const fromX = Math.max(0, Math.min(16, (worldBox.min.x * scaleFactor) + 8));
				const fromY = Math.max(0, Math.min(16, (worldBox.min.y * scaleFactor)));
				const fromZ = Math.max(0, Math.min(16, (worldBox.min.z * scaleFactor) + 8));

				const toX = Math.max(0, Math.min(16, (worldBox.max.x * scaleFactor) + 8));
				const toY = Math.max(0, Math.min(16, (worldBox.max.y * scaleFactor)));
				const toZ = Math.max(0, Math.min(16, (worldBox.max.z * scaleFactor) + 8));

				if(Math.abs(toX - fromX) < 0.01 || Math.abs(toY - fromY) < 0.01 || Math.abs(toZ - fromZ) < 0.01) {
					return;
				}

				const rotation = new THREE.Euler().setFromRotationMatrix(child.matrixWorld, 'YXZ');
				const degreesY = Math.round(rotation.y * (180 / Math.PI));

				const validRotations = [-45, -22.5, 0, 22.5, 45];
				const snappedRotationY = validRotations.reduce((prev, curr) =>
					Math.abs(curr - degreesY) < Math.abs(prev - degreesY) ? curr : prev
				);

				const element = {
					from: [parseFloat(fromX.toFixed(4)), parseFloat(fromY.toFixed(4)), parseFloat(fromZ.toFixed(4))],
					to: [parseFloat(toX.toFixed(4)), parseFloat(toY.toFixed(4)), parseFloat(toZ.toFixed(4))],
					faces: {
						down: { uv: [0, 0, 16, 16], texture: "#texture0", cullface: "down" },
						up: { uv: [0, 0, 16, 16], texture: "#texture0", cullface: "up" },
						north: { uv: [0, 0, 16, 16], texture: "#texture0" },
						south: { uv: [0, 0, 16, 16], texture: "#texture0" },
						west: { uv: [0, 0, 16, 16], texture: "#texture0" },
						east: { uv: [0, 0, 16, 16], texture: "#texture0" }
					}
				};

				if(snappedRotationY !== 0) {
					element.rotation = {
						origin: [
							parseFloat(((fromX + toX) / 2).toFixed(4)),
							parseFloat(((fromY + toY) / 2).toFixed(4)),
							parseFloat(((fromZ + toZ) / 2).toFixed(4))
						],
						axis: "y",
						angle: snappedRotationY
					};
				}

				elements.push(element);
			}
		});

		return {
			credit: "Generated via nunuStudio MinecraftExporter",
			textures: {
				particle: options.texturePath || "minecraft:block/stone",
				texture0: options.texturePath || "minecraft:block/stone"
			},
			elements: elements
		};
	}

	/**
	 * Voxelizes complex scene geometry into a dense 3D structural grid topology.
	 */
	voxelizeScene(sceneObject, voxelScale = 1.0) {
		const meshes = [];
		sceneObject.updateMatrixWorld(true);

		sceneObject.traverse((child) => {
			if(child.isMesh && child.geometry) {
				if(!child.geometry.boundingBox) child.geometry.computeBoundingBox();
				meshes.push({
					mesh: child,
					box: child.geometry.boundingBox.clone().applyMatrix4(child.matrixWorld)
				});
			}
		});

		if(meshes.length === 0) return null;

		const globalBox = meshes[0].box.clone();
		for(let i = 1; i < meshes.length; i++) globalBox.union(meshes[i].box);

		const min = globalBox.min;
		const max = globalBox.max;

		const sizeX = Math.ceil((max.x - min.x) / voxelScale);
		const sizeY = Math.ceil((max.y - min.y) / voxelScale);
		const sizeZ = Math.ceil((max.z - min.z) / voxelScale);

		const totalCells = sizeX * sizeY * sizeZ;
		const blockIds = new Uint8Array(totalCells);
		const sampleBox = new THREE.Box3();

		for(let x = 0; x < sizeX; x++) {
			for(let y = 0; y < sizeY; y++) {
				for(let z = 0; z < sizeZ; z++) {
					sampleBox.min.set(min.x + (x * voxelScale), min.y + (y * voxelScale), min.z + (z * voxelScale));
					sampleBox.max.set(min.x + ((x + 1) * voxelScale), min.y + ((y + 1) * voxelScale), min.z + ((z + 1) * voxelScale));

					for(const item of meshes) {
						if(sampleBox.intersectsBox(item.box)) {
							blockIds[(y * sizeZ + z) * sizeX + x] = 1; // Default: Stone block state
							break;
						}
					}
				}
			}
		}

		return this._compileRawNBT({ width: sizeX, height: sizeY, length: sizeZ, blocks: blockIds });
	}

	/**
	 * INTERNAL: Compiles voxel blocks into Mojang specification uncompressed binary NBT arrays.
	 * Implements strict named-binary-tag schemas to completely avoid external heavy serializers.
	 */
	_compileRawNBT(grid) {
		const parts = [];

		// NBT tag header injection helpers
		const writeByte = (v) => parts.push(new Uint8Array([v]));
		const writeInt = (v) => {
			const b = new ArrayBuffer(4);
			new DataView(b).setInt32(0, v, false); // Big-Endian format mandatory
			parts.push(new Uint8Array(b));
		};
		const writeString = (str) => {
			const encoder = new TextEncoder();
			const bytes = encoder.encode(str);
			const b = new ArrayBuffer(2);
			new DataView(b).setUint16(0, bytes.length, false);
			parts.push(new Uint8Array(b), bytes);
		};

		// Tag compound root header initiation
		writeByte(10); // TAG_Compound
		writeString(""); // Root name assignment empty string block

		// 1. DataVersion tag element configuration
		writeByte(3); writeString("DataVersion"); writeInt(3463); // 1.20+ specification tag

		// 2. Size vector list bounds definition
		writeByte(9); writeString("size"); writeFloatListHeader(3);
		writeInt(grid.width); writeInt(grid.height); writeInt(grid.length);

		// 3. Simple static lookup definition block palette assignment
		writeByte(9); writeString("palette"); writeByte(10); // List of Compounds
		writeInt(2); // Palette items count: Air and Stone

		// Element 0: air
		writeByte(10); writeByte(8); writeString("Name"); writeString("minecraft:air"); writeByte(0);
		// Element 1: stone
		writeByte(10); writeByte(8); writeString("Name"); writeString("minecraft:stone"); writeByte(0);

		// 4. Matrix mapping block serialization array pipeline loops
		writeByte(9); writeString("blocks"); writeByte(10); // List of Compounds

		const blockEntries = [];
		for(let x = 0; x < grid.width; x++) {
			for(let y = 0; y < grid.height; y++) {
				for(let z = 0; z < grid.length; z++) {
					const idx = (y * grid.length + z) * grid.width + x;
					const state = grid.blocks[idx];
					if(state === 0) continue; // Skip air optimization spaces

					blockEntries.push({ x, y, z, state });
				}
			}
		}
		writeInt(blockEntries.length);

		for(const entry of blockEntries) {
			writeByte(10); // Entry block compound initialization

			// Pos list sub element tagging
			writeByte(9); writeString("pos"); writeFloatListHeader(3);
			writeInt(entry.x); writeInt(entry.y); writeInt(entry.z);

			// Numerical link straight back to block palette index state
			writeByte(3); writeString("state"); writeInt(entry.state);

			writeByte(0); // Terminate current single block tracking segment loop
		}

		// 5. Entities structural array placeholder block configurations
		writeByte(9); writeString("entities"); writeByte(10); writeInt(0);

		writeByte(0); // Root block closing definition tag boundary lock

		// Flatten payload elements arrays sequentially
		let totalSize = 0;
		parts.forEach(p => totalSize += p.length);
		const resultBuffer = new Uint8Array(totalSize);
		let offset = 0;
		parts.forEach(p => { resultBuffer.set(p, offset); offset += p.length; });

		return resultBuffer;

		function writeFloatListHeader(count) {
			writeByte(3); // Int elements types signature
			writeInt(count);
		}
	}


	async exportActiveCanvasToMinecraft(targetObject, fileName = "nunu_world") {
		const zip = new JSZip();

		// 1. Pack.mcmeta configuration payload
		const mcmeta = {
			pack: {
				pack_format: 48, // Standard Versioning specification indicator for 1.21+
				description: "Structures generated live inside the nunuStudio spatial viewport context"
			}
		};
		zip.file("pack.mcmeta", JSON.stringify(mcmeta, null, 2));

		// 2. Generate and store individual standalone JSON item/block models profiles
		const jsonModel = this.parseJsonModel(targetObject, { scaleFactor: 16.0 });
		zip.file("assets/minecraft/models/item/custom_block_model.json", JSON.stringify(jsonModel, null, 2));

		// 3. Process complete voxel grid terrain systems and extract compressed NBT data structures
		const rawNbtData = this.voxelizeScene(targetObject, 1.0);

		if(rawNbtData) {
			// Gzip compress the NBT layout before writing to archive boundaries
			const gzippedNbt = pako.gzip(rawNbtData);

			const namespace = fileName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
			zip.file(`data/${namespace}/structure/canvas_model.nbt`, gzippedNbt);
		}

		// 4. Compile the output file and push down to browser file downloads infrastructure hooks
		const packBlob = await zip.generateAsync({ type: "blob" });
		const downloadAnchor = document.createElement("a");

		downloadAnchor.href = URL.createObjectURL(packBlob);
		downloadAnchor.download = `${fileName}_datapack.zip`;
		document.body.appendChild(downloadAnchor);
		downloadAnchor.click();
		document.body.removeChild(downloadAnchor);
	}
}


