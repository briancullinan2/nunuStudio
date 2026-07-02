import { LinearFilter, CubeReflectionMapping, WebGLRenderer, Object3D, Mesh, SkinnedMesh, AnimationClip, MeshBasicMaterial, MeshPhongMaterial, ShapeGeometry, Matrix4, SRGBColorSpace } from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader";
import { AMFLoader } from "three/examples/jsm/loaders/AMFLoader";
import { DDSLoader } from "three/examples/jsm/loaders/DDSLoader";
import { PVRLoader } from "three/examples/jsm/loaders/PVRLoader";
import { KTXLoader } from "three/examples/jsm/loaders/KTXLoader";
import { TGALoader } from "three/examples/jsm/loaders/TGALoader";
import { GCodeLoader } from "three/examples/jsm/loaders/GCodeLoader";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader";
import { AssimpLoader } from "../editor/loaders/AssimpLoader.js";
import { TDSLoader } from "three/examples/jsm/loaders/TDSLoader";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader";
import { DRACOLoader } from "../editor/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader";
import { VTKLoader } from "three/examples/jsm/loaders/VTKLoader";
import { PRWMLoader } from "../editor/loaders/PRWMLoader.js";
import { VRMLLoader } from "three/examples/jsm/loaders/VRMLLoader";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { XLoader } from "../editor/loaders/XLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { PCDLoader } from "three/examples/jsm/loaders/PCDLoader";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";
import { VOXLoader } from "three/examples/jsm/loaders/VOXLoader";
import { Q3ShaderLoader } from "./loaders/Q3ShaderLoader.js";
import { Q3MapLoader } from "./loaders/Q3MapLoader.js";
import { Q3BSPLoader } from "./loaders/Q3BSPLoader.js";
import { IQMLoader } from "./loaders/IQMLoader.js";
import { MD3Loader } from "./loaders/MD3Loader.js";
import { PK3Loader } from "./loaders/PK3Loader.js";
import { InstancedMesh } from "../core/objects/mesh/InstancedMesh.js";
import { FileSystem } from "../core/FileSystem.js";
import { Nunu } from "../core/Nunu.js";
import { Group } from "../core/objects/misc/Group.js";
import { SpineAnimation } from "../core/objects/spine/SpineAnimation.js";
import { Audio } from "../core/resources/Audio.js";
import { Font } from "../core/resources/Font.js";
import { Image } from "../core/resources/Image.js";
import { TextFile } from "../core/resources/TextFile.js";
import { Video } from "../core/resources/Video.js";
import { CompressedTexture } from "../core/texture/CompressedTexture.js";
import { Texture } from "../core/texture/Texture.js";
import { VideoTexture } from "../core/texture/VideoTexture.js";
import { DocumentBody } from "./components/DocumentBody.js";
import { LoadingModal } from "./components/modal/LoadingModal.js";
import { Editor } from "./Editor.js";
import { Global } from "./Global.js";
import { AddResourceAction } from "./history/action/resources/AddResourceAction.js";
import { Locale } from "./locale/LocaleManager.js";
import { AWDLoader } from "./loaders/AWDLoader";
import { BabylonLoader } from "./loaders/BabylonLoader";

function Loaders() { }

/**
 * Load texture from file object, checks the type of the file, can be used to load all types of textures
 *
 * Supports browser supported format (png, jpeg, bmp, gif, etc), and GPU compressed formats (pvr, dds, ktx, etc).
 *
 * @static
 * @method loadTexture
 * @param {File} file
 * @param {Function} onLoad
 */
Loaders.loadTexture = function (file, onLoad) {
	// Load compressed texture from data parsed by the texture loaders.
	function loadCompressedTexture(data) {
		let texture = new CompressedTexture();

		if(data.isCubemap === true) {
			let faces = data.mipmaps.length / data.mipmapCount;

			texture.isCubeTexture = true;
			texture.image = [];

			for(let f = 0; f < faces; f++) {
				texture.image[f] = { mipmaps: [] };

				for(let i = 0; i < data.mipmapCount; i++) {
					texture.image[f].mipmaps.push(data.mipmaps[f * data.mipmapCount + i]);
					texture.image[f].format = data.format;
					texture.image[f].width = data.width;
					texture.image[f].height = data.height;
				}
			}

			texture.magFilter = LinearFilter;
			texture.minFilter = LinearFilter;
			texture.mapping = CubeReflectionMapping;
		}
		else {
			texture.image.width = data.width;
			texture.image.height = data.height;
			texture.mipmaps = data.mipmaps;
		}

		if(data.mipmapCount === 1) {
			texture.minFilter = LinearFilter;
		}

		texture.format = data.format;
		texture.needsUpdate = true;

		return texture;
	}

	let name = FileSystem.getFileName(file.name);
	let extension = FileSystem.getFileExtension(file.name);

	let reader = new FileReader();
	reader.onload = async function () {
		if(extension === "dds") {
			let loader = new DDSLoader();
			let texture = loadCompressedTexture(loader.parse(reader.result));
			texture.name = name;
			Editor.addAction(new AddResourceAction(texture, Editor.program, "textures"));
		}
		else if(extension === "pvr") {
			let loader = new PVRLoader();
			let texture = loadCompressedTexture(loader.parse(reader.result));
			texture.name = name;
			Editor.addAction(new AddResourceAction(texture, Editor.program, "textures"));
		}
		else if(extension === "ktx") {
			let loader = new KTXLoader();
			let texture = loadCompressedTexture(loader.parse(reader.result));
			texture.name = name;
			Editor.addAction(new AddResourceAction(texture, Editor.program, "textures"));
		}
		else if(extension === "tga") {
			let loader = new TGALoader();
			let jpeg = loader.parse(reader.result).toDataURL("image/jpeg", 1.0);

			let image = new Image(jpeg, "jpeg");
			Editor.addAction(new AddResourceAction(image, Editor.program, "images"));

			let texture = await Texture.create(image);
			texture.name = name;
			Editor.addAction(new AddResourceAction(texture, Editor.program, "textures"));
		}
		else if(extension === "basis") {
			let renderer = new WebGLRenderer({ alpha: true });

			let loader = new BasisTextureLoader();
			loader.setTranscoderPath(Global.FILE_PATH + "wasm/basis/");
			loader.detectSupport(renderer);
			loader._createTexture(reader.result).then(function (texture) {
				texture.colorSpace = SRGBColorSpace;
				texture.name = name;
				Editor.addAction(new AddResourceAction(texture, Editor.program, "textures"));
			}).catch(function (error) {
				Editor.alert("Error decoding basis texture.");
				console.error("nunuStudio: Error decoding basis texture.", error);
			});

			renderer.dispose();
		}
		else {
			let image = new Image(reader.result, extension);
			let texture = await Texture.create(image);
			texture.name = name;
			Editor.addAction(new AddResourceAction(image, Editor.program, "images"));
			Editor.addAction(new AddResourceAction(texture, Editor.program, "textures"));
		}

		if(onLoad !== undefined) {
			onLoad(texture);
		}
	};
	reader.readAsArrayBuffer(file);
};

/**
 * Load video file as texture from file object.
 *
 * @static
 * @method loadVideoTexture
 * @param {File} file
 * @param {Function} onLoad Callback function called after the resource is loaded.
 */
Loaders.loadVideoTexture = function (file, onLoad) {
	let name = FileSystem.getFileName(file.name);
	let extension = FileSystem.getFileExtension(file.name);

	let reader = new FileReader();
	reader.onload = function () {
		let video = new Video(reader.result, extension);
		video.name = name;

		let texture = new VideoTexture(video);
		texture.name = name;

		Editor.addAction(new AddResourceAction(video, Editor.program, "videos"));
		Editor.addAction(new AddResourceAction(texture, Editor.program, "textures"));

		if(onLoad !== undefined) {
			onLoad(texture);
		}
	};

	reader.readAsArrayBuffer(file);
};

// Load audio from file object
Loaders.loadAudio = function (file, onLoad) {
	let name = FileSystem.getFileName(file.name);
	let reader = new FileReader();

	reader.onload = function () {
		let audio = new Audio(reader.result);
		audio.name = name;

		if(onLoad !== undefined) {
			onLoad(audio);
		}

		Editor.addAction(new AddResourceAction(audio, Editor.program, "audio"));
	};

	reader.readAsArrayBuffer(file);
};

// Load font from file object
Loaders.loadFont = function (file, onLoad) {
	let name = FileSystem.getFileName(file.name);
	let extension = FileSystem.getFileExtension(file.name);
	let reader = new FileReader();

	reader.onload = function () {
		if(extension === "json") {
			let font = new Font(JSON.parse(reader.result));
		}
		else {
			let font = new Font(reader.result);
			font.encoding = extension;
		}
		font.name = name;

		if(onLoad !== undefined) {
			onLoad(font);
		}

		Editor.addAction(new AddResourceAction(font, Editor.program, "fonts"));
	};

	if(extension === "json") {
		reader.readAsText(file);
	}
	else {
		reader.readAsArrayBuffer(file);
	}
};

/**
 * Load spine animation file from file.
 *
 * Also searches for the .atlas file on the file path.
 *
 * @static
 * @method loadSpineAnimation
 * @param {File} file File to load.
 */
Loaders.loadSpineAnimation = async function (file) {
	try {
		let path = FileSystem.getFilePath(file.path);

		let atlasFile = null;
		let files = FileSystem.getFilesDirectory(path);
		for(let i = 0; i < files.length; i++) {
			if(files[i].endsWith("atlas")) {
				atlasFile = path + files[i];
				break;
			}
		}

		if(atlasFile === null) {
			Editor.alert(Locale.failedLoadSpine);
			console.warn("nunuStudio: No atlas file found in the directory.");
			return;
		}

		let data = await FileSystem.readFile(file.path);
		let atlas = await FileSystem.readFile(atlasFile);

		let animation = await SpineAnimation.create(data, atlas, path);
		animation.name = FileSystem.getFileName(file.path);
		Editor.addObject(animation);
	}
	catch(e) {
		Editor.alert(Locale.failedLoadSpine + "(" + e + ")");
	}
};

/**
 * Load text from file and add it as a resource to the program.
 *
 * @static
 * @method loadText
 * @param {File} file File to load.
 */
Loaders.loadText = function (file) {
	let reader = new FileReader();
	let name = FileSystem.getFileNameWithExtension(file.name);
	let extension = FileSystem.getFileExtension(name);

	reader.onload = function () {
		let resource = new TextFile(reader.result, FileSystem.getFileExtension(name));
		resource.name = name;

		Editor.addAction(new AddResourceAction(resource, Editor.program, "resources"));


		// Quake 3 Shaders
		if(extension === "shader") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new Q3ShaderLoader();
					let parsedShaders = loader.parse(file.path || "inline://custom.shader", reader.result);

					// Hydrate your global and class-level registries immediately
					parsedShaders.forEach(shader => {
						if(shader && shader.name) {
							Q3BSPLoader.q3ShaderRegistry[shader.name.toLowerCase()] = shader;
						}
					});

					console.log(`nunuStudio: Parsed and registered ${parsedShaders.length} Quake 3 shader targets.`);

					// Since a .shader file populates material registries but contains no 3D geometry primitives,
					// we evoke an empty pass or send a confirmation signal down the asset loop.
					if(typeof callback === 'function') {
						await callback(new THREE.Group(), parent);
					}
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsText(file);
		}

	};

	reader.readAsText(file);
};

/**
 * Load a 3D file containing objects to be added to the scene.
 *
 * If no parent is specified it adds the objects to currently open scene.
 *
 * @method loadModel
 * @param {File} file File to be read and parsed.
 * @param {Object3D} parent Object to add the objects.
 */
Loaders.loadModel = async function (file, parent, successCallback, errorCallback) {
	let name = file.name;
	let extension = FileSystem.getFileExtension(name);
	let path = file.path !== undefined ? FileSystem.getFilePath(file.path) : "";
	let modal = new LoadingModal(DocumentBody);
	let asyncResolve;
	let asyncReject;
	successCallback ||= Editor.addObject;
	const callback = (obj, parent) => {
		if(successCallback && obj) {
			successCallback(obj, parent);
		}
		modal.destroy();
		if(asyncResolve) {
			return asyncResolve();
		}
	};
	const errorCondition = (f) => {
		if(errorCallback) {
			errorCallback(f);
		} else {
			Editor.alert(Locale.errorLoadingFile + ': ' + name + "\n(" + f + ")");
			modal.destroy();
			console.error("nunuStudio: Error loading file", f);
		}

		return asyncResolve();
	};

	if(successCallback === Editor.addObject) {
		modal.show();
	}

	const loadPromise = new Promise((resolve, reject) => {
		asyncResolve = resolve;
		asyncReject = reject;
	});

	try {
		// GCode
		if(extension === "gcode") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new GCodeLoader();
					let obj = loader.parse(reader.result);
					await callback(obj, parent);
				}
				catch(f) {
					errorCondition(f);
				}
			};

			reader.readAsText(file);
		}

		// Quake 3 BSP Map Binary
		else if(extension === "bsp") {
			let reader = new FileReader();
			window.isLoadingBSP = true;

			reader.onload = async function () {
				try {
					let loader = new Q3BSPLoader();

					if(file.path) {
						let baseDir = file.path.substring(0, file.path.lastIndexOf('/'));
						loader.setBaseFolder(baseDir);
					}

					// 1. Force a clean synchronous or completely awaited generation pass.
					// Ensure parse() natively appends objects to its group and returns them completed.
					let bspGroup = loader.parse(reader.result);
					bspGroup.name = FileSystem.getFileName(name);

					// Ensure metadata parameters match expected nunuStudio serializable structures
					bspGroup.type = "Group";
					bspGroup.folded = false;
					bspGroup.locked = false;

					// 2. Pass the fully populated group to the asset transaction framework.
					// This allows the ResourceCrawler to detect both the structures and the geometries simultaneously.
					await callback(bspGroup, parent);
					window.isLoadingBSP = false;

				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsArrayBuffer(file);
		}

		// Quake 3 MD3 Mesh Model Binary
		else if(extension === "md3") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new MD3Loader();

					// Set runtime context paths relative to current asset source targets
					if(file.path) {
						let baseDir = file.path.substring(0, file.path.lastIndexOf('/'));
						loader.setBaseFolder(baseDir);
					}

					// Share the shared pipeline shader registry map records
					loader.shaderRegistry = Q3BSPLoader.q3ShaderRegistry;

					// Parse the model binary ArrayBuffer layout
					let md3Group = loader.parse(reader.result);
					md3Group.name = FileSystem.getFileName(name);

					await callback(md3Group, parent);
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsArrayBuffer(file);
		}

		// InterQuakeModel Skeleton/Mesh Binary
		else if(extension === "iqm") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new IQMLoader();

					// Set runtime context paths relative to current asset source targets
					if(file.path) {
						let baseDir = file.path.substring(0, file.path.lastIndexOf('/'));
						loader.setBaseFolder(baseDir);
					}

					// Share the shared pipeline shader registry map records
					loader.shaderRegistry = Q3BSPLoader.q3ShaderRegistry;

					// Parse the model skeletal ArrayBuffer binary layout
					let iqmGroup = loader.parse(reader.result);
					iqmGroup.name = FileSystem.getFileName(name);

					await callback(iqmGroup, parent);
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsArrayBuffer(file);
		}

		// Quake 3 Raw Human-Readable Map Text (and auto-checking associated groups)
		else if(extension === "map") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new Q3MapLoader();

					if(file.path) {
						let baseDir = file.path.substring(0, file.path.lastIndexOf('/'));
						loader.setBaseFolder(baseDir);
					}

					// Share the runtime structural registry map bounds directly
					loader.shaderRegistry = Q3BSPLoader.q3ShaderRegistry;

					let mapGroup = loader.parse(reader.result);
					mapGroup.name = FileSystem.getFileName(name);

					await callback(mapGroup, parent);
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsText(file);
		}

		// Quake 3 PK3 Asset Archive Pack
		else if(extension === "pk3") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					console.log(`nunuStudio: Processing incoming PK3 package archive drop...`);
					let loader = new PK3Loader();

					// Extract virtual contents and compute the first active BSP model group
					let mapGroup = await loader.parse(reader.result);
					mapGroup.name = FileSystem.getFileName(name);

					// Standard runtime mesh cleanups
					mapGroup.traverse(function (child) {
						if(child.isMesh) {
							child.frustumCulled = false;
							child.matrixAutoUpdate = true;
						}
					});

					await callback(mapGroup, parent);
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsArrayBuffer(file);
		}

		// Wavefront OBJ
		else if(extension === "obj") {
			let materials = null;

			// Look for MTL file
			if(Nunu.runningOnDesktop()) {
				try {
					let mtl = FileSystem.getNameWithoutExtension(file.path) + ".mtl";

					if(FileSystem.fileExists(mtl)) {
						console.log("nunuStudio: MTL file found.", path);
						let mtlLoader = new MTLLoader();
						mtlLoader.setPath(path);
						materials = mtlLoader.parse(await FileSystem.readFile(mtl), path);
					}
				}
				catch(f) {
					errorCondition(f);
				}
			}

			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new OBJLoader();

					if(materials !== null) {
						loader.setMaterials(materials);
					}

					let obj = loader.parse(reader.result);
					obj.name = FileSystem.getFileName(name);
					await callback(obj, parent);
				}
				catch(e) {
					errorCondition(e);
				}
			};

			reader.readAsText(file);
		}
		// 3MF
		else if(extension === "3mf") {
			let reader = new FileReader();
			reader.onload = function () {
				try {
					let loader = new ThreeMFLoader();
					loader.parse(reader.result, async function (obj) {
						await callback(obj, parent);
					});
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsArrayBuffer(file);
		}
		// VOX
		else if(extension === "vox") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new VOXLoader();
					let chunks = loader.parse(reader.result);

					let name = FileSystem.getFileName(file) || "vox";

					let geometry = new THREE.BoxGeometry(1, 1, 1);
					geometry.name = name;

					let material = new MeshPhongMaterial();
					material.name = name;

					let matrix = new Matrix4();

					let group = new Group();
					group.name = name;

					for(let i = 0; i < chunks.length; i++) {
						let chunk = chunks[i];
						let size = chunk.size;
						let data = chunk.data;

						let mesh = new InstancedMesh(geometry, material, data.length / 4);
						for(let j = 0, k = 0; j < data.length; j += 4, k++) {
							let x = data[j + 0] - size.x / 2;
							let y = data[j + 1] - size.y / 2;
							let z = data[j + 2] - size.z / 2;
							mesh.setMatrixAt(k, matrix.setPosition(x, z, - y));
						}
						group.add(mesh);

					}

					await callback(group, parent);
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsArrayBuffer(file);
		}
		// AWD
		else if(extension === "awd") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new AWDLoader();
					loader._baseDir = path;
					let awd = loader.parse(reader.result);
					await callback(awd, parent);
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsArrayBuffer(file);
		}
		// AMF
		else if(extension === "amf") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new AMFLoader();
					let amf = loader.parse(reader.result);
					await callback(amf, parent);
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsArrayBuffer(file);
		}
		// Assimp
		else if(extension === "assimp") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new AssimpLoader(undefined, Global.FILE_PATH + 'wasm/assimp/assimpjs.js');
					let assimp = loader.parse(reader.result, path);
					await callback(assimp.object, parent);
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsArrayBuffer(file);
		}
		// Babylon
		else if(extension === "babylon") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new BabylonLoader();
					let json = JSON.parse(reader.result);
					let babylon = loader.parse(json, path);
					babylon.type = "Group";
					babylon.traverse(function (object) {
						if(object instanceof Mesh) {
							object.material = new MeshPhongMaterial();
						}
					});
					await callback(babylon, parent);
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsText(file);
		}
		// Blender
		// else if (extension === "blend")
		// {
		// 	let reader = new FileReader();
		// 	reader.onload = function()
		// 	{
		// 		try
		// 		{
		// 			JSBLEND(reader.result).then(function(blend)
		// 			{
		// 				let container = new Group();
		// 				container.name = FileSystem.getNameWithoutExtension(name);
		// 				blend.three.loadScene(container);
		// 				await callback(container, parent);
		// 			});
		// 		}
		// 		catch (e)
		// 		{
		// 			errorCondition(e);
		// 		}
		// 	};
		// 	reader.readAsArrayBuffer(file);
		// }
		// 3DS
		else if(extension === "3ds") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new TDSLoader();
					loader.setPath(path);
					let group = loader.parse(reader.result);
					await callback(group, parent);
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsArrayBuffer(file);
		}
		// Collada
		else if(extension === "dae") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new ColladaLoader();
					let collada = loader.parse(reader.result, path);

					let scene = collada.scene;
					let animations = collada.animations;

					if(animations.length > 0) {
						scene.traverse(function (child) {
							if(child instanceof SkinnedMesh) {
								child.animations = animations;
							}
						});
					}

					await callback(scene, parent);
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsText(file);
		}
		// Draco
		else if(extension === "drc") {
			let reader = new FileReader();
			reader.onload = function () {
				try {
					let loader = new DRACOLoader();
					loader.setDecoderPath(Global.FILE_PATH + "wasm/draco/");
					loader.setDecoderConfig({ type: "wasm" });
					loader.decodeDracoFile(reader.result, async function (geometry) {
						loader.releaseDecoderModule();

						if(geometry.isBufferGeometry === true) {
							let normals = geometry.getAttribute("normal");
							if(normals === undefined) {
								geometry.computeVertexNormals();
							}
						}

						let mesh = new Mesh(geometry, Editor.defaultMaterial);
						await callback(mesh, parent);
					});
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsArrayBuffer(file);
		}
		// GLTF
		else if(extension === "gltf" || extension === "glb") {
			let reader = new FileReader();
			reader.onload = function () {
				try {
					let dracoLoader = new DRACOLoader();
					dracoLoader.setDecoderPath(Global.FILE_PATH + "wasm/draco/gltf/");
					dracoLoader.setDecoderConfig({ type: "wasm" });

					let loader = new GLTFLoader();
					loader.dracoLoader = dracoLoader;
					loader.parse(reader.result, path, async function (gltf) {
						dracoLoader.dispose();

						let scene = gltf.scene;
						scene.type = "Group";
						scene.name = FileSystem.getNameWithoutExtension(name);

						let animations = gltf.animations;
						if(animations.length > 0) {
							scene.traverse(function (child) {
								if(child instanceof SkinnedMesh) {
									child.animations = animations;
								}
							});
						}

						await callback(scene, parent);
					});
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsArrayBuffer(file);
		}
		// PLY
		else if(extension === "ply") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new PLYLoader();
					let modelName = FileSystem.getNameWithoutExtension(name);

					let geometry = loader.parse(reader.result);
					geometry.name = modelName;

					let mesh = new Mesh(geometry, Editor.defaultMaterial);
					mesh.name = modelName;
					await callback(mesh, parent);
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsText(file);
		}
		// VTK
		else if(extension === "vtk" || extension === "vtp") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new VTKLoader();
					let modelName = FileSystem.getNameWithoutExtension(name);
					let geometry = loader.parse(reader.result);
					geometry.name = modelName;

					let mesh = new Mesh(geometry, Editor.defaultMaterial);
					mesh.name = modelName;
					await callback(mesh, parent);
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsArrayBuffer(file);
		}
		// PRWM
		else if(extension === "prwm") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new PRWMLoader();
					let modelName = FileSystem.getNameWithoutExtension(name);

					let geometry = loader.parse(reader.result);
					geometry.name = modelName;

					let mesh = new Mesh(geometry, Editor.defaultMaterial);
					mesh.name = modelName;
					await callback(mesh, parent);
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsArrayBuffer(file);
		}

		// VRML
		else if(extension === "wrl" || extension === "vrml") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new VRMLLoader();
					let scene = loader.parse(reader.result);

					for(let i = 0; i < scene.children.length; i++) {
						if(successCallback) {
							await successCallback(scene.children[i], parent);
						}
					}
					if(successCallback) {
						await callback();
					}
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsText(file);
		}
		// FBX
		else if(extension === "fbx") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new FBXLoader();
					let object = loader.parse(reader.result, path);

					if(object.animations !== undefined && object.animations.length > 0) {
						object.traverse(function (child) {
							if(child instanceof SkinnedMesh) {
								child.animations = object.animations;
							}
						});
					}

					await callback(object, parent);
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsArrayBuffer(file);
		}
		// X
		else if(extension === "x") {
			function convertAnimation(baseAnime, name) {
				let animation = {};
				animation.fps = baseAnime.fps;
				animation.name = name;
				animation.hierarchy = [];

				for(let i = 0; i < baseAnime.hierarchy.length; i++) {
					let firstKey = -1;

					let frame = {};
					frame.name = baseAnime.hierarchy[i].name;
					frame.parent = baseAnime.hierarchy[i].parent;
					frame.keys = [];

					for(let m = 1; m < baseAnime.hierarchy[i].keys.length; m++) {
						if(baseAnime.hierarchy[i].keys[m].time > 0) {
							if(firstKey === -1) {
								firstKey = m - 1;
								frame.keys.push(baseAnime.hierarchy[i].keys[m - 1]);
							}

							frame.keys.push(baseAnime.hierarchy[i].keys[m]);
						}

						animation.length = baseAnime.hierarchy[i].keys[m].time;

						if(m >= baseAnime.hierarchy[i].keys.length - 1) {
							break;
						}

					}

					animation.hierarchy.push(frame);
				}

				return animation;
			}

			let reader = new FileReader();
			reader.onload = function () {
				try {
					let loader = new XLoader();
					loader.baseDir = path;
					loader.parse(reader.result, async function (object) {
						for(let i = 0; i < object.FrameInfo.length; i++) {
							let model = object.FrameInfo[i];

							if(model instanceof SkinnedMesh) {
								if(object.XAnimationObj !== undefined && object.XAnimationObj.length > 0) {
									let animations = object.XAnimationObj;
									for(let j = 0; j < animations.length; j++) {
										model.animationSpeed = 1000;
										model.animations.push(AnimationClip.parseAnimation(convertAnimation(animations[j], animations[j].name), model.skeleton.bones));
									}
								}
							}

							if(successCallback) {
								await successCallback(model, parent);
							}
						}

						if(successCallback) {
							await callback();
						}
					});
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsArrayBuffer(file);
		}
		// PCD
		else if(extension === "pcd") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new PCDLoader();
					let pcd = loader.parse(reader.result, file.name);
					pcd.material.name = "points";

					await callback(pcd, parent);
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsArrayBuffer(file);
		}
		// SVG
		else if(extension === "svg") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new SVGLoader();
					let paths = loader.parse(reader.result);

					let group = new Group();
					let position = 0;

					for(let i = 0; i < paths.length; i++) {
						let material = new MeshBasicMaterial({ color: paths[i].color });
						let shapes = paths[i].toShapes(true);

						for(let j = 0; j < shapes.length; j++) {
							let shape = shapes[j];
							let geometry = new ShapeGeometry(shape);
							let mesh = new Mesh(geometry, material);
							mesh.position.z = position;
							position += 0.1;
							group.add(mesh);
						}
					}

					await callback(group, parent);
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsText(file);
		}
		// STL
		else if(extension === "stl") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new STLLoader();

					let modelName = FileSystem.getNameWithoutExtension(name);
					let geometry = loader.parse(reader.result);
					geometry.name = modelName;

					await callback(new Mesh(geometry, Editor.defaultMaterial), parent);
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsArrayBuffer(file);
		}
		// threejs JSON
		else if(extension === "json") {
			let reader = new FileReader();
			reader.onload = async function () {
				try {
					let loader = new JSONLoader();
					let data = loader.parse(JSON.parse(reader.result));
					let materials = data.materials;
					let geometry = data.geometry;

					// Material
					let material = null;
					if(materials === undefined || materials.length === 0) {
						material = Editor.defaultMaterial;
					}
					else if(materials.length === 1) {
						material = materials[0];
					}
					else if(materials.length > 1) {
						material = materials;
					}

					// Mesh
					let mesh = null;
					if(geometry.bones.length > 0) {
						mesh = new SkinnedMesh(geometry, material);
					}
					else {
						mesh = new Mesh(geometry, material);
					}

					await callback(mesh, parent);
				}
				catch(e) {
					errorCondition(e);
				}
			};
			reader.readAsText(file);
		}
		else {
			Editor.alert(Locale.unknownFileFormat + ':' + name);
			modal.destroy();
			console.warn("nunuStudio: Unknown file format");
			if(errorCallback) {
				errorCallback(f);
			}
			if(asyncResolve) {
				asyncResolve();
			}
		}
	}
	catch(e) {
		errorCondition(e);
	}

	return loadPromise;
};

export { Loaders };
