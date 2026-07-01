// AssimpLoader.js

export class AssimpLoader {
	/**
	 * @param {Object} [manager] - The Three.js LoadingManager
	 * @param {string} [assimpjsUrl] - Absolute CDN or local path to assimpjs.js
	 */
	constructor(manager, assimpjsUrl) {
		// Fall back to the default internal Three.js manager if none is provided
		this.manager = manager || (window.THREE && window.THREE.DefaultLoadingManager);
		if(!this.manager) {
			throw new Error('AssimpLoader requires a THREE.LoadingManager or global THREE context.');
		}

		// Path to the third-party WebAssembly library wrapper
		this.assimpjsUrl = assimpjsUrl || 'https://cdn.jsdelivr.net/npm/assimpjs@1.0.4/dist/assimpjs.js';
		this.path = '';
	}

	/**
	 * Main entry point matching standard Three.js Loader signatures
	 */
	load(url, onLoad, onProgress, onError) {
		const scope = this;

		// Extract directory root for relative asset path lookup (textures, etc.)
		if(this.path === '') {
			const lastSlash = url.lastIndexOf('/');
			this.path = lastSlash !== -1 ? url.substring(0, lastSlash + 1) : '';
		}

		// Use standard FileLoader to get the primary model file as an ArrayBuffer
		const fileLoader = new THREE.FileLoader(this.manager);
		fileLoader.setResponseType('arraybuffer');
		fileLoader.setPath(this.setPath);

		fileLoader.load(url, async (buffer) => {
			try {
				// Prepare files array for the worker pipeline
				const filename = url.substring(url.lastIndexOf('/') + 1);
				const files = [{
					name: filename,
					buffer: new Uint8Array(buffer)
				}];

				// Extract base scene graph objects out via Worker context execution
				const workerPool = new WorkerModelLoader(scope.assimpjsUrl);
				const parsedScene = await workerPool.process(files);
				workerPool.dispose();

				// Convert structural raw node data blocks into standard Three.js Groups
				const convertedOutput = scope.parse(parsedScene);

				if(onLoad) onLoad(convertedOutput);
			} catch(err) {
				if(onError) onError(err);
				else console.error(err);
			}
		}, onProgress, onError);
	}

	setPath(value) {
		this.path = value;
		return this;
	}

	/**
	 * Translates raw worker graph descriptions into active THREE core mesh components
	 * @param {Object} parsedScene - Structure returned from the Web Worker boundary
	 */
	parse(parsedScene) {
		const group = new THREE.Group();

		if(!parsedScene || !parsedScene.mRootNode) {
			return group;
		}

		// Maps structural indices to corresponding material definitions
		const materialCache = (parsedScene.mMaterials || []).map(rawMat => {
			const material = new THREE.MeshPhongMaterial({ color: 0xdddddd });

			// Extract the material name property safely if present
			if(rawMat.mProperties) {
				const nameProp = rawMat.mProperties.find(p => p.mKey === "?mat.name");
				if(nameProp && nameProp.mData) {
					// String conversion fallback depending on how string was array-serialized
					material.name = String.fromCharCode.apply(null, nameProp.mData).replace(/[^\x20-\x7E]+/g, '');
				}
			}
			return material;
		});

		/**
		 * Recursive graph walker constructing Object3D instances from worker node descriptions
		 */
		const buildNode = (rawNode, parentGroup) => {
			const obj = new THREE.Object3D();
			obj.name = rawNode.mName || '';

			// Apply matrix transforms if present
			if(rawNode.mTransformation && rawNode.mTransformation.elements) {
				const elements = rawNode.mTransformation.elements;
				// Flatten row/column elements out to standard Column-Major order matrix alignment
				const matrix = new THREE.Matrix4();
				matrix.set(
					elements[0][0], elements[0][1], elements[0][2], elements[0][3],
					elements[1][0], elements[1][1], elements[1][2], elements[1][3],
					elements[2][0], elements[2][1], elements[2][2], elements[2][3],
					elements[3][0], elements[3][1], elements[3][2], elements[3][3]
				);
				obj.applyMatrix4(matrix);
			}

			// Append geometries bound directly to this node reference level
			if(rawNode.mMeshes) {
				rawNode.mMeshes.forEach(meshIndex => {
					const rawMesh = parsedScene.mMeshes[meshIndex];
					if(!rawMesh) return;

					const geometry = new THREE.BufferGeometry();

					// Set indices buffer attribute data tracking
					if(rawMesh.mIndexArray && rawMesh.mIndexArray.length > 0) {
						geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(rawMesh.mIndexArray), 1));
					}

					// Map primary vertex positions
					if(rawMesh.mVertexBuffer) {
						geometry.setAttribute('position', new THREE.BufferAttribute(rawMesh.mVertexBuffer, 3));
					}

					// Map normals path
					if(rawMesh.mNormalBuffer) {
						geometry.setAttribute('normal', new THREE.BufferAttribute(rawMesh.mNormalBuffer, 3));
					}

					// Assign cached material context or fallback default safely
					const material = materialCache[rawMesh.mMaterialIndex] || new THREE.MeshPhongMaterial({ color: 0x888888 });

					const mesh = new THREE.Mesh(geometry, material);
					obj.add(mesh);
				});
			}

			parentGroup.add(obj);

			// Recurse children down through tree structure steps
			if(rawNode.mChildren) {
				rawNode.mChildren.forEach(childNode => buildNode(childNode, obj));
			}
		};

		buildNode(parsedScene.mRootNode, group);
		return group;
	}
}

// AssimpWorkerModule.js

export class WorkerModelLoader {
	constructor(assimpjsUrl) {
		this.assimpjsUrl = assimpjsUrl;
		this.workerUrl = this._createWorkerUrl();
	}

	/**
	 * Executes the Web Worker execution string creation via function extraction
	 */
	_createWorkerUrl() {
		// We wrap the entire worker lifecycle in a single self-contained function block.
		// Webpack will safely parse this, but cannot break its internal scope.
		const workerExecutionBlock = function () {
			// Internal scope markers
			let shortened = false;
			let compressed = false;
			const ASSBIN_CHUNK_AINODE = 0x123c;
			const ASSBIN_CHUNK_AIBONE = 0x123a;
			const ASSBIN_CHUNK_AIMESH = 0x1237;
			const ASSBIN_CHUNK_AIMATERIALPROPERTY = 0x123e;
			const ASSBIN_CHUNK_AIMATERIAL = 0x123d;
			const ASSBIN_CHUNK_AINODEANIM = 0x1238;
			const ASSBIN_CHUNK_AIANIMATION = 0x123b;
			const ASSBIN_CHUNK_AITEXTURE = 0x1236;
			const ASSBIN_CHUNK_AILIGHT = 0x1235;
			const ASSBIN_CHUNK_AICAMERA = 0x1234;
			const ASSBIN_CHUNK_AISCENE = 0x1239;

			const ASSBIN_MESH_HAS_POSITIONS = 0x1;
			const ASSBIN_MESH_HAS_NORMALS = 0x2;
			const ASSBIN_MESH_HAS_TANGENTS_AND_BITANGENTS = 0x4;
			const ASSBIN_MESH_HAS_TEXCOORD_BASE = 0x100;
			const ASSBIN_MESH_HAS_COLOR_BASE = 0x10000;
			const AI_MAX_NUMBER_OF_COLOR_SETS = 1;
			const AI_MAX_NUMBER_OF_TEXTURECOORDS = 4;

			function ASSBIN_MESH_HAS_TEXCOORD(n) { return ASSBIN_MESH_HAS_TEXCOORD_BASE << n; }
			function ASSBIN_MESH_HAS_COLOR(n) { return ASSBIN_MESH_HAS_COLOR_BASE << n; }

			function aiScene() {
				this.mRootNode = null; this.mMeshes = []; this.mMaterials = [];
				this.mAnimations = []; this.mTextures = []; this.mLights = []; this.mCameras = [];
			}
			function aiNode() { this.mName = ''; this.mTransformation = []; this.mChildren = []; this.mMeshes = []; }
			function aiMesh() {
				this.mNumVertices = 0; this.mNumFaces = 0; this.mNumBones = 0; this.mMaterialIndex = 0;
				this.mVertexBuffer = null; this.mNormalBuffer = null; this.mIndexArray = []; this.mBones = [];
				this.mTexCoordsBuffers = []; this.mNumUVComponents = []; this.mFaces = []; this.mColors = [[]];
			}
			function aiFace() { this.mNumIndices = 0; this.mIndices = []; }
			function aiBone() { this.mName = ''; this.mNumWeights = 0; this.mOffsetMatrix = 0; this.mWeights = []; }
			function aiMaterialProperty() { this.mKey = ""; this.mSemantic = 0; this.mData = []; this.mDataLength = 0; }
			function aiMaterial() { this.mNumProperties = 0; this.mProperties = []; }
			function aiNodeAnim() { this.mNodeName = ""; this.mPositionKeys = []; this.mRotationKeys = []; this.mScalingKeys = []; }
			function aiAnimation() { this.mName = ""; this.mDuration = 0; this.mTicksPerSecond = 0; this.mChannels = []; }
			function aiTexture() { this.mWidth = 0; this.mHeight = 0; this.achFormatHint = []; this.pcData = []; }
			function aiLight() { this.mName = ''; this.mType = 0; this.mColorDiffuse = null; }
			function aiCamera() { this.mName = ''; this.mPosition = null; }
			function aiMatrix4() { this.elements = [[], [], [], []]; }

			function extendStream(stream) {
				stream.readOffset = 0;
				stream.Seek = function (off, ori) {
					if(ori === 0) stream.readOffset += off;
					if(ori === 1) stream.readOffset = off;
				};
				stream.ReadBytes = function (buff, size, n) {
					let bytes = size * n;
					for(let i = 0; i < bytes; i++) {
						buff[i] = this.getUint8(this.readOffset);
						this.readOffset += 1;
					}
				};
				stream.subArray32 = function (start, end) {
					return new Float32Array(this.buffer.slice(start, end));
				};
			}

			function readFloat(stream) {
				let val = stream.getFloat32(stream.readOffset, true);
				stream.readOffset += 4;
				return val;
			}
			function Read_double(stream) {
				let val = stream.getFloat64(stream.readOffset, true);
				stream.readOffset += 8;
				return val;
			}
			function Read_uint16_t(stream) {
				let val = stream.getUint16(stream.readOffset, true);
				stream.readOffset += 2;
				return val;
			}
			function Read_unsigned_int(stream) {
				let val = stream.getUint32(stream.readOffset, true);
				stream.readOffset += 4;
				return val;
			}
			function Read_uint32_t(stream) { return Read_unsigned_int(stream); }

			function Read_aiString(stream) {
				let stringlengthbytes = Read_unsigned_int(stream);
				let data = [];
				stream.ReadBytes(data, 1, stringlengthbytes);
				let str = '';
				data.forEach(function (i) { str += String.fromCharCode(i); });
				return str.replace(/[^\x20-\x7E]+/g, '');
			}

			function Read_aiMatrix4x4(stream) {
				let m = new aiMatrix4();
				for(let i = 0; i < 4; ++i) {
					for(let i2 = 0; i2 < 4; ++i2) {
						m.elements[i][i2] = readFloat(stream);
					}
				}
				return m;
			}

			function Read_aiVector3D(stream) { return { x: readFloat(stream), y: readFloat(stream), z: readFloat(stream) }; }
			function Read_aiQuaternion(stream) { return { w: readFloat(stream), x: readFloat(stream), y: readFloat(stream), z: readFloat(stream) }; }
			function Read_aiVertexWeight(stream) { return { mVertexId: Read_unsigned_int(stream), mWeight: readFloat(stream) }; }
			function Read_aiVectorKey(stream) { return { mTime: Read_double(stream), mValue: Read_aiVector3D(stream) }; }
			function Read_aiQuatKey(stream) { return { mTime: Read_double(stream), mValue: Read_aiQuaternion(stream) }; }

			function ReadArray_aiVertexWeight(stream, data, size) { for(let i = 0; i < size; i++) data[i] = Read_aiVertexWeight(stream); }
			function ReadArray_aiVectorKey(stream, data, size) { for(let i = 0; i < size; i++) data[i] = Read_aiVectorKey(stream); }
			function ReadArray_aiQuatKey(stream, data, size) { for(let i = 0; i < size; i++) data[i] = Read_aiQuatKey(stream); }

			function ReadBinaryNode(stream, parent, depth) {
				let chunkID = Read_uint32_t(stream);
				if(chunkID !== ASSBIN_CHUNK_AINODE) throw "Node signature mismatch";
				Read_uint32_t(stream);
				let node = new aiNode();
				node.mName = Read_aiString(stream);
				node.mTransformation = Read_aiMatrix4x4(stream);
				node.mNumChildren = Read_unsigned_int(stream);
				node.mNumMeshes = Read_unsigned_int(stream);

				if(node.mNumMeshes) {
					node.mMeshes = [];
					for(let i = 0; i < node.mNumMeshes; ++i) node.mMeshes[i] = Read_unsigned_int(stream);
				}
				if(node.mNumChildren) {
					node.mChildren = [];
					for(let i = 0; i < node.mNumChildren; ++i) node.mChildren[i] = ReadBinaryNode(stream, node, depth + 1);
				}
				return node;
			}

			function ReadBinaryBone(stream, b) {
				let chunkID = Read_uint32_t(stream);
				if(chunkID !== ASSBIN_CHUNK_AIBONE) throw "Bone signature mismatch";
				Read_uint32_t(stream);
				b.mName = Read_aiString(stream);
				b.mNumWeights = Read_unsigned_int(stream);
				b.mOffsetMatrix = Read_aiMatrix4x4(stream);
				b.mWeights = [];
				ReadArray_aiVertexWeight(stream, b.mWeights, b.mNumWeights);
				return b;
			}

			function ReadBinaryMesh(stream, mesh) {
				let chunkID = Read_uint32_t(stream);
				if(chunkID !== ASSBIN_CHUNK_AIMESH) throw "Mesh signature mismatch";
				Read_uint32_t(stream);
				mesh.mPrimitiveTypes = Read_unsigned_int(stream);
				mesh.mNumVertices = Read_unsigned_int(stream);
				mesh.mNumFaces = Read_unsigned_int(stream);
				mesh.mNumBones = Read_unsigned_int(stream);
				mesh.mMaterialIndex = Read_unsigned_int(stream);
				mesh.mNumUVComponents = [];
				let c = Read_unsigned_int(stream);

				if(c & ASSBIN_MESH_HAS_POSITIONS) {
					mesh.mVertexBuffer = stream.subArray32(stream.readOffset, stream.readOffset + mesh.mNumVertices * 3 * 4);
					stream.Seek(mesh.mNumVertices * 3 * 4, 0);
				}
				if(c & ASSBIN_MESH_HAS_NORMALS) {
					mesh.mNormalBuffer = stream.subArray32(stream.readOffset, stream.readOffset + mesh.mNumVertices * 3 * 4);
					stream.Seek(mesh.mNumVertices * 3 * 4, 0);
				}
				if(c & ASSBIN_MESH_HAS_TANGENTS_AND_BITANGENTS) {
					stream.Seek(mesh.mNumVertices * 3 * 4 * 2, 0); // skip buffer pointers
				}

				for(let n = 0; n < AI_MAX_NUMBER_OF_COLOR_SETS; ++n) {
					if(!(c & ASSBIN_MESH_HAS_COLOR(n))) break;
					stream.Seek(mesh.mNumVertices * 4 * 4, 0);
				}

				mesh.mTexCoordsBuffers = [];
				for(let n = 0; n < AI_MAX_NUMBER_OF_TEXTURECOORDS; ++n) {
					if(!(c & ASSBIN_MESH_HAS_TEXCOORD(n))) break;
					mesh.mNumUVComponents[n] = Read_unsigned_int(stream);
					mesh.mTexCoordsBuffers[n] = [];
					for(let uv = 0; uv < mesh.mNumVertices; uv++) {
						mesh.mTexCoordsBuffers[n].push(readFloat(stream));
						mesh.mTexCoordsBuffers[n].push(readFloat(stream));
						readFloat(stream);
					}
				}

				mesh.mFaces = [];
				mesh.mIndexArray = [];
				for(let i = 0; i < mesh.mNumFaces; ++i) {
					let f = mesh.mFaces[i] = new aiFace();
					f.mNumIndices = Read_uint16_t(stream);
					f.mIndices = [];
					for(let a = 0; a < f.mNumIndices; ++a) {
						f.mIndices[a] = (mesh.mNumVertices < (1 << 16)) ? Read_uint16_t(stream) : Read_unsigned_int(stream);
					}
					if(f.mNumIndices === 3) {
						mesh.mIndexArray.push(f.mIndices[0], f.mIndices[1], f.mIndices[2]);
					} else if(f.mNumIndices === 4) {
						mesh.mIndexArray.push(f.mIndices[0], f.mIndices[1], f.mIndices[2]);
						mesh.mIndexArray.push(f.mIndices[2], f.mIndices[3], f.mIndices[0]);
					}
				}

				if(mesh.mNumBones) {
					mesh.mBones = [];
					for(let a = 0; a < mesh.mNumBones; ++a) {
						mesh.mBones[a] = new aiBone();
						ReadBinaryBone(stream, mesh.mBones[a]);
					}
				}
			}

			function ReadBinaryMaterialProperty(stream, prop) {
				let chunkID = Read_uint32_t(stream);
				if(chunkID !== ASSBIN_CHUNK_AIMATERIALPROPERTY) throw "Material property signature mismatch";
				Read_uint32_t(stream);
				prop.mKey = Read_aiString(stream);
				prop.mSemantic = Read_unsigned_int(stream);
				prop.mIndex = Read_unsigned_int(stream);
				prop.mDataLength = Read_unsigned_int(stream);
				prop.mType = Read_unsigned_int(stream);
				prop.mData = [];
				stream.ReadBytes(prop.mData, 1, prop.mDataLength);
			}

			function ReadBinaryMaterial(stream, mat) {
				let chunkID = Read_uint32_t(stream);
				if(chunkID !== ASSBIN_CHUNK_AIMATERIAL) throw "Material signature mismatch";
				Read_uint32_t(stream);
				mat.mNumProperties = Read_unsigned_int(stream);
				if(mat.mNumProperties) {
					mat.mProperties = [];
					for(let i = 0; i < mat.mNumProperties; ++i) {
						mat.mProperties[i] = new aiMaterialProperty();
						ReadBinaryMaterialProperty(stream, mat.mProperties[i]);
					}
				}
			}

			function ReadBinaryNodeAnim(stream, nd) {
				let chunkID = Read_uint32_t(stream);
				if(chunkID !== ASSBIN_CHUNK_AINODEANIM) throw "Node animation signature mismatch";
				Read_uint32_t(stream);
				nd.mNodeName = Read_aiString(stream);
				nd.mNumPositionKeys = Read_unsigned_int(stream);
				nd.mNumRotationKeys = Read_unsigned_int(stream);
				nd.mNumScalingKeys = Read_unsigned_int(stream);
				Read_unsigned_int(stream); // preState
				Read_unsigned_int(stream); // postState

				if(nd.mNumPositionKeys) { nd.mPositionKeys = []; ReadArray_aiVectorKey(stream, nd.mPositionKeys, nd.mNumPositionKeys); }
				if(nd.mNumRotationKeys) { nd.mRotationKeys = []; ReadArray_aiQuatKey(stream, nd.mRotationKeys, nd.mNumRotationKeys); }
				if(nd.mNumScalingKeys) { nd.mScalingKeys = []; ReadArray_aiVectorKey(stream, nd.mScalingKeys, nd.mNumScalingKeys); }
			}

			function ReadBinaryAnim(stream, anim) {
				let chunkID = Read_uint32_t(stream);
				if(chunkID !== ASSBIN_CHUNK_AIANIMATION) throw "Animation signature mismatch";
				Read_uint32_t(stream);
				anim.mName = Read_aiString(stream);
				anim.mDuration = Read_double(stream);
				anim.mTicksPerSecond = Read_double(stream);
				anim.mNumChannels = Read_unsigned_int(stream);
				if(anim.mNumChannels) {
					anim.mChannels = [];
					for(let a = 0; a < anim.mNumChannels; ++a) {
						anim.mChannels[a] = new aiNodeAnim();
						ReadBinaryNodeAnim(stream, anim.mChannels[a]);
					}
				}
			}

			function ReadBinaryScene(stream, scene) {
				let chunkID = Read_uint32_t(stream);
				if(chunkID !== ASSBIN_CHUNK_AISCENE) throw "Scene signature mismatch";
				Read_uint32_t(stream);
				Read_unsigned_int(stream); // flags
				scene.mNumMeshes = Read_unsigned_int(stream);
				scene.mNumMaterials = Read_unsigned_int(stream);
				scene.mNumAnimations = Read_unsigned_int(stream);
				scene.mNumTextures = Read_unsigned_int(stream);
				scene.mNumLights = Read_unsigned_int(stream);
				scene.mNumCameras = Read_unsigned_int(stream);

				scene.mRootNode = ReadBinaryNode(stream, null, 0);

				if(scene.mNumMeshes) {
					scene.mMeshes = [];
					for(let i = 0; i < scene.mNumMeshes; ++i) {
						scene.mMeshes[i] = new aiMesh();
						ReadBinaryMesh(stream, scene.mMeshes[i]);
					}
				}
				if(scene.mNumMaterials) {
					scene.mMaterials = [];
					for(let i = 0; i < scene.mNumMaterials; ++i) {
						scene.mMaterials[i] = new aiMaterial();
						ReadBinaryMaterial(stream, scene.mMaterials[i]);
					}
				}
				if(scene.mNumAnimations) {
					scene.mAnimations = [];
					for(let i = 0; i < scene.mNumAnimations; ++i) {
						scene.mAnimations[i] = new aiAnimation();
						ReadBinaryAnim(stream, scene.mAnimations[i]);
					}
				}
			}

			function parseAssbinBuffer(buffer) {
				let pScene = new aiScene();
				let stream = new DataView(buffer);
				extendStream(stream);
				stream.Seek(44, 0); // Signature
				Read_unsigned_int(stream); Read_unsigned_int(stream);
				Read_unsigned_int(stream); Read_unsigned_int(stream);
				shortened = Read_uint16_t(stream) > 0;
				compressed = Read_uint16_t(stream) > 0;
				if(shortened) throw "Shortened binaries not supported.";
				stream.Seek(256 + 128 + 64, 0); // Skip headers

				if(compressed) throw "Compressed streams require upfront zlib inflation.";
				ReadBinaryScene(stream, pScene);
				return pScene;
			}

			// Message boundary handling loop
			self.onmessage = async function (e) {
				const { type, files, assimpjsUrl } = e.data;
				if(type === 'PROCESS_MODEL') {
					try {
						self.importScripts(assimpjsUrl);
						const ajs = await self.assimpjs();
						const fileList = new ajs.FileList();

						files.forEach(f => {
							fileList.AddFile(f.name, f.buffer);
						});

						const result = ajs.ConvertFileList(fileList, 'assbin');
						if(!result.IsSuccess() || result.FileCount() === 0) {
							throw new Error("Conversion error code: " + result.GetErrorCode());
						}

						const assbinFile = result.GetFile(0);
						const assbinBuffer = assbinFile.GetContent().buffer;
						const parsedScene = parseAssbinBuffer(assbinBuffer);

						self.postMessage({ type: 'SUCCESS', scene: parsedScene }, [assbinBuffer]);
					} catch(err) {
						self.postMessage({ type: 'ERROR', error: err.message });
					}
				}
			};
		};

		// Extract raw code string out from execution wrapper boundary context cleanly
		const functionBodyCode = workerExecutionBlock.toString();

		// Wrap execution code in an IIFE block to prevent literal extraction translation loss
		const cleanWorkerString = `(${functionBodyCode})();`;

		const blob = new Blob([cleanWorkerString], { type: 'application/javascript' });
		return URL.createObjectURL(blob);
	}

	/**
	 * Processing payload transport boundary method.
	 */
	async process(fileObjects) {
		return new Promise((resolve, reject) => {
			const worker = new Worker(this.workerUrl);

			worker.onmessage = (e) => {
				const { type, scene, error } = e.data;
				if(type === 'SUCCESS') resolve(scene);
				else reject(new Error(error));
				worker.terminate();
			};

			worker.onerror = (err) => {
				reject(err);
				worker.terminate();
			};

			const transferables = fileObjects.map(f => f.buffer.buffer);
			worker.postMessage({
				type: 'PROCESS_MODEL',
				files: fileObjects,
				assimpjsUrl: this.assimpjsUrl
			}, transferables);
		});
	}

	dispose() {
		if(this.workerUrl) URL.revokeObjectURL(this.workerUrl);
	}
}
