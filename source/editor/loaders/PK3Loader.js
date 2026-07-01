import * as THREE from 'three';
import JSZip from 'jszip';
import { Q3ShaderLoader } from './Q3ShaderLoader.js';
import { Q3BSPLoader } from './Q3BSPLoader.js';
import { MD3Loader } from './MD3Loader.js';
import { IQMLoader } from './IQMLoader.js';

export class PK3Loader extends THREE.Loader {
	constructor(manager) {
		super(manager !== undefined ? manager : THREE.DefaultLoadingManager);
		this.vfs = {}; // Virtual File System mapping relative internal paths to Blobs
		this.shaderLoader = new Q3ShaderLoader(this.manager);
		this.shaderRegistry = Q3BSPLoader.q3ShaderRegistry || {};
	}

	load(url, onLoad, onProgress, onError) {
		const scope = this;
		const loader = new THREE.FileLoader(scope.manager);
		loader.setPath(scope.path);
		loader.setResponseType("arraybuffer");

		loader.load(url, async function (buffer) {
			try {
				onLoad(await scope.parse(buffer));
			} catch(e) {
				if(onError) onError(e);
			}
		}, onProgress, onError);
	}

	async parse(arrayBuffer) {
		const zip = await JSZip.loadAsync(arrayBuffer);
		const fileEntries = [];
		const shaderFiles = [];

		// 1. Unzip archive and catalog file entries into our Virtual File System
		for(const [relativePath, zipEntry] of Object.entries(zip.files)) {
			if(zipEntry.dir) continue;

			const lowerPath = relativePath.toLowerCase();
			const ext = lowerPath.split('.').pop();
			const buffer = await zipEntry.async("arraybuffer");

			// Store raw data into localized virtual filesystem
			this.vfs[lowerPath] = {
				buffer: buffer,
				ext: ext,
				blobUrl: URL.createObjectURL(new Blob([buffer]))
			};

			fileEntries.push(lowerPath);

			if(ext === "shader") {
				shaderFiles.push(lowerPath);
			}
		}

		// 2. Pre-hydrate the global Shader Registries using string data streams
		const textDecoder = new TextDecoder();
		for(const shaderPath of shaderFiles) {
			const rawText = textDecoder.decode(this.vfs[shaderPath].buffer);
			const parsed = this.shaderLoader.parse(`zip://${shaderPath}`, rawText);
			parsed.forEach(shader => {
				if(shader && shader.name) {
					this.shaderRegistry[shader.name.toLowerCase()] = shader;
				}
			});
		}

		// 3. Find and isolate the first available BSP structural map definition
		const targetBspPath = fileEntries.find(p => p.endsWith(".bsp"));
		if(!targetBspPath) {
			console.warn("PK3Loader: Archive completed extraction processing successfully, but no valid target .bsp compiled map layout was found inside.");
			return new THREE.Group();
		}

		console.log(`PK3Loader: Mounting first targeted map layout block: ${targetBspPath}`);

		// 4. Initialize the BSP loader using our local file assets overrides
		const bspLoader = new Q3BSPLoader(this.manager);
		bspLoader.shaderRegistry = this.shaderRegistry;

		// Redirect internal texture lookups to use our local VFS Blob URLs
		bspLoader.materialBuilder.resolveTexture = (texturePath, isLightmap, onTextureLoaded) => {
			const cleanTexPath = texturePath.toLowerCase().replace(/^\//, "");
			const vfsMatch = this.vfs[cleanTexPath] || this.vfs[cleanTexPath + ".png"] || this.vfs[cleanTexPath + ".jpg"] || this.vfs[cleanTexPath + ".tga"];

			if(vfsMatch) {
				const texLoader = new THREE.TextureLoader();
				texLoader.load(vfsMatch.blobUrl, (texture) => {
					texture.wrapS = THREE.RepeatWrapping;
					texture.wrapT = THREE.RepeatWrapping;
					texture.flipY = false;
					if(onTextureLoaded) onTextureLoaded(texture);
				});
			} else {
				if(onTextureLoaded) onTextureLoaded(window.defaultTexture || new THREE.Texture());
			}
		};

		// Construct the geometry out of the isolated entry
		const mapGroup = bspLoader.parse(this.vfs[targetBspPath].buffer);
		mapGroup.name = targetBspPath.split('/').pop();

		// Expose our virtual disk mappings to child objects (e.g., player models looking for textures)
		mapGroup.userData = mapGroup.userData || {};
		mapGroup.userData.vfs = this;

		return mapGroup;
	}
}
