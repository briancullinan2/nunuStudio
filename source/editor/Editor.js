import { runningOnDesktop, isFullscreen } from "../core/utils/Environment.js";
import {
	Texture, BoxGeometry, MeshStandardMaterial, SpriteMaterial,
	MathUtils, Material, BufferGeometry, Shape,
	Object3D
} from "three";

/**
 * Main editor entry point.
 *
 * @class Editor
 */
function Editor() { }

/**
 * Initialize the editor code, creates all GUI elements, loads configuration data, starts all the event lsiteners required.
 *
 * Called when the application starts.
 *
 * @static
 * @method initialize
 */
Editor.initialize = async function () {
	const { Nunu } = await import("../core/Nunu.js");
	const { Settings } = await import("./Settings.js");
	const { FileSystem } = await import("../core/FileSystem.js");
	const { Global } = await import("./Global.js");
	const { VirtualClipboard } = await import("./utils/VirtualClipboard.js");
	const { Keyboard } = await import("../core/input/Keyboard.js");
	const { TextFile } = await import("../core/resources/TextFile.js");
	const { Loaders } = await import("./Loaders.js");
	const { Interface } = await import("./gui/Interface.js");
	const { EventManager } = await import("../core/utils/EventManager.js");
	const { CodeEditor } = await import("./gui/tab/code/CodeEditor.js");
	const { Locale } = await import("./locale/LocaleManager.js");
	const { AmbientLight } = await import("../core/objects/lights/AmbientLight");

	// Check WebGL Support
	if(!Nunu.webGLAvailable()) {
		Editor.alert(Locale.webglNotSupported);
		Editor.exit();
	}

	// Settings
	Editor.settings = new Settings();
	Editor.settings.load();

	// Register tern plugins
	Editor.ternDefinitions = [];
	Editor.ternDefinitions.push(JSON.parse(await FileSystem.readFile(Global.FILE_PATH + "tern/threejs.json")));
	Editor.ternDefinitions.push(JSON.parse(await FileSystem.readFile(Global.FILE_PATH + "tern/browser.json")));
	Editor.ternDefinitions.push(JSON.parse(await FileSystem.readFile(Global.FILE_PATH + "tern/ecmascript.json")));

	// Disable body overflow
	document.body.style.overflow = "hidden";
	document.body.style.fontFamily = "var(--font-main-family)";
	document.body.style.color = "var(--font-main-color)";
	document.body.style.fontSize = "var(--font-main-size)";

	// Disable context menu
	document.body.oncontextmenu = function () {
		return false;
	};

	// Watch for changes in the screen pixel ratio (drag between screens)
	window.matchMedia("screen and (min-resolution: 2dppx)").addListener(function () {
		Editor.resize();
	});

	if(Nunu.runningOnDesktop()) {
		var gui = window.require("nw.gui");
		Editor.clipboard = gui.Clipboard.get();
		Editor.args = gui.App.argv;

		// Handle window close event
		gui.Window.get().on("close", function () {
			if(confirm(Locale.unsavedChangesExit)) {
				Editor.exit();
			}
		});

		// Try to update the editor
		if(Editor.settings.general.autoUpdate) {
			Editor.updateNunu();
		}
	}
	else {
		// Clipboard
		Editor.clipboard = new VirtualClipboard();

		// Arguments
		Editor.args = [];

		var parameters = Nunu.getQueryParameters();
		for(var i in parameters) {
			Editor.args.push(parameters[i]);
		}

		// Prevent some key combinations
		var allowedKeys = [Keyboard.C, Keyboard.V, Keyboard.A, Keyboard.X];
		document.onkeydown = function (event) {
			// If F1-F11 or CTRL+Key prevent default action
			if(event.keyCode > Keyboard.F1 && event.keyCode < Keyboard.F11 || !event.altKey && event.ctrlKey && allowedKeys.indexOf(event.keyCode) === -1) {
				event.preventDefault();
			}
		};

		// Store settings when exiting the page
		window.onbeforeunload = function (event) {
			Editor.settings.store();

			var message = Locale.unsavedChangesExit;
			event.returnValue = message;
			return message;
		};
	}

	// Open ISP file if dragged to the window
	document.body.ondrop = function (event) {
		event.preventDefault();

		for(var i = 0; i < event.dataTransfer.files.length; i++) {
			var file = event.dataTransfer.files[i];
			var extension = FileSystem.getFileExtension(file.name);

			// Project file
			if(extension === "isp" || extension === "nsp") {
				if(Editor.confirm(Locale.changesWillBeLost + " " + Locale.loadProject)) {
					Editor.loadProgram(file, extension === "nsp");
					Editor.resetEditor();
				}
				break;
			}
			// Text file
			else if(TextFile.fileIsText(file)) {
				Loaders.loadText(file);
			}
		}
	};

	// Open file
	Editor.openFile = null;

	// Selected object
	Editor.selection = [];

	// Program
	Editor.program = null;

	// History
	Editor.history = null;

	// Initialize User Interface
	Editor.gui = new Interface();
	await Editor.gui.loading;
	Editor.gui.updateInterface();

	// Check is some project file passed as argument
	for(var i = 0; i < Editor.args.length; i++) {
		if(Editor.args[i].endsWith(".isp")) {
			await Editor.loadProgram(Editor.args[i], false);
			break;
		}
		else if(Editor.args[i].endsWith(".nsp")) {
			await Editor.loadProgram(Editor.args[i], true);
			break;
		}
	}

	// Create new program
	if(Editor.program === null) {
		Editor.createNewProgram();
	}

	// Event manager
	Editor.manager = new EventManager();
	Editor.manager.add(document.body, "keydown", function (event) {
		var key = event.keyCode;

		if(event.ctrlKey) {
			if(key === Keyboard.S) {
				if(Editor.openFile === null) {
					Editor.gui.saveProgram();
				}
				else {
					Editor.saveProgram(undefined, true);
				}
			}
			else if(key === Keyboard.L) {
				Editor.gui.loadProgram();
			}
			else if(key === Keyboard.W || key === Keyboard.F4) {
				Editor.gui.tab.closeActual();
			}
			else if(key === Keyboard.TAB || key === Keyboard.PAGE_DOWN) {
				Editor.gui.tab.selectNextTab();
			}
			else if(key === Keyboard.PAGE_UP) {
				Editor.gui.tab.selectPreviousTab();
			}
			else if(key === Keyboard.Z) {
				var tabs = Editor.gui.tab.getActiveTab();
				for(var i = 0; i < tabs.length; i++) {
					if(tabs[i] instanceof CodeEditor) {
						return;
					}
				}

				Editor.undo();
			}
			else if(key === Keyboard.Y) {
				var tabs = Editor.gui.tab.getActiveTab();
				for(var i = 0; i < tabs.length; i++) {
					if(tabs[i] instanceof CodeEditor) {
						return;
					}
				}

				Editor.redo();
			}
		}
		else if(key === Keyboard.DEL) {
			var tabs = Editor.gui.tab.getActiveTab();
			for(var i = 0; i < tabs.length; i++) {
				if(tabs[i] instanceof CodeEditor) {
					return;
				}
			}

			if(Editor.hasObjectSelected()) {
				var del = Editor.confirm(Locale.deleteObjects);
				if(del) {
					Editor.deleteObject();
				}
			}
		}
		else if(key === Keyboard.F2) {
			Editor.renameObject();
		}
		else if(key === Keyboard.F5) {
			Editor.runProject();
		}
	});
	Editor.manager.create();
};

/**
 * Run the project that is currently open in the editor.
 *
 * Opens a new tab, and sets the run button text.
 *
 * @static
 * @method runProject
 */
Editor.runProject = async function () {
	const { RunProject } = await import("./gui/tab/run/RunProject.js");
	const { Locale } = await import("./locale/LocaleManager.js");

	var tab = Editor.gui.tab.getTab(RunProject, Editor.program);

	if(tab === null) {
		tab = await Editor.gui.tab.addTab(RunProject, true);
		tab.select();
		Editor.gui.menuBar.run.setText(Locale.stop);
	}
	else {
		tab.close();
		Editor.gui.menuBar.run.setText(Locale.run);
	}
};

/**
 * Select single object.
 *
 * @method selectObject
 * @param {Object3D} object Object to select.
 */
Editor.selectObject = function (object) {
	for(var i = 0; i < Editor.selection.length; i++) {
		if(Editor.selection[i].gui !== undefined && Editor.selection[i].gui.node !== undefined) {
			Editor.selection[i].gui.node.setSelected(false);
		}
	}

	Editor.selection = [object];

	if(object.gui !== undefined && object.gui.node !== undefined) {
		if(object.gui.node.setSelected !== undefined) {
			object.gui.node.setSelected(true);
		}
		if(object.gui.node.expandToRoot !== undefined) {
			object.gui.node.expandToRoot();
		}
	}

	Editor.updateSelectionGUI();
};

/**
 * Add object to selection.
 *
 * @method addToSelection
 * @param {Object3D} object Object to add to selection.
 * @param {boolean} updateClient If false does not update the management client.
 */
Editor.addToSelection = function (object) {
	Editor.selection.push(object);

	if(object.gui !== undefined && object.gui.node !== undefined) {
		if(object.gui.node.setSelected !== undefined) {
			object.gui.node.setSelected(true);
		}
		if(object.gui.node.expandToRoot !== undefined) {
			object.gui.node.expandToRoot();
		}
	}

	Editor.updateSelectionGUI();
};

/**
 * Remove from selection.
 *
 * @method unselectObject
 * @param {Object3D} object Object to remove from selection.
 */
Editor.unselectObject = function (object) {
	for(var i = 0; i < Editor.selection.length; i++) {
		if(Editor.selection[i].uuid === object.uuid) {
			if(Editor.selection[i].gui !== undefined && Editor.selection[i].gui.node !== undefined) {
				if(Editor.selection[i].gui.node.setSelected !== undefined) {
					Editor.selection[i].gui.node.setSelected(false);
				}
			}

			Editor.selection.splice(i, 1);
			Editor.updateSelectionGUI();
			return;
		}
	}
};

/**
 * Get device pixel ratio based on the editor configuration.
 *
 * @static
 * @method getPixelRatio
 * @return {number} Device pixel ratio.
 */
Editor.getPixelRatio = function () {
	return Editor.settings.general.ignorePixelRatio ? 1.0 : window.devicePixelRatio;
};

/**
 * Check if a object is selected.
 *
 * @method isSelected
 * @param {Object3D} Check if object is selected.
 */
Editor.isSelected = function (object) {
	for(var i = 0; i < Editor.selection.length; i++) {
		if(Editor.selection[i].uuid === object.uuid) {
			return true;
		}
	}

	return false;
};

/**
 * Resize the editor to fit the document body.
 *
 * @static
 * @method resize
 */
Editor.resize = function () {
	if(!isFullscreen()) {
		Editor.gui.updateInterface();
	}
};

/**
 * Check if there is some object selected.
 *
 * @static
 * @method hasObjectSelected
 * @return {boolean} True if there is an object selected.
 */
Editor.hasObjectSelected = function () {
	return Editor.selection.length > 0;
};

/**
 * Clear object selection.
 *
 * @method clearSelection
 */
Editor.clearSelection = function () {
	for(var i = 0; i < Editor.selection.length; i++) {
		if(Editor.selection[i].gui !== undefined && Editor.selection[i].gui.node !== undefined) {
			if(Editor.selection[i].gui.node.setSelected !== undefined) {
				Editor.selection[i].gui.node.setSelected(false);
			}
		}
	}

	Editor.selection = [];
};

/**
 * Add action to history.
 *
 * Automatically calls the change method of GUI elements.
 *
 * @method addAction
 * @param {Action} action Action to add to the history.
 */
Editor.addAction = function (action) {
	Editor.history.add(action);
};

/**
 * Get currently active scene in the editor.
 *
 * @static
 * @method getScene
 * @return {Scene} The scene currently active in the editor, null if none available.
 */
Editor.getScene = function () {
	if(Editor.program.children.length > 0) {
		return Editor.program.children[0];
	}

	return null;
};

/**
 * Add objects to a parent, and creates an action in the editor history.
 *
 * If no parent is specified it adds to object to the current scene.
 *
 * @static
 * @method addObject
 * @param {Object3D} object Object to be added.
 * @param {Object3D} parent Parent object, if undefined the program scene is used.
 */
Editor.addObject = async function (object, parent) {
	const { AddAction } = await import("./history/action/objects/AddAction.js");
	const { ResourceCrawler } = await import("./history/ResourceCrawler.js");
	const { AddResourceAction } = await import("./history/action/resources/AddResourceAction.js");
	const { ActionBundle } = await import("./history/action/ActionBundle.js");

	if(parent === undefined) {
		parent = Editor.getScene();
	}

	var actions = [new AddAction(object, parent)];
	var resources = ResourceCrawler.searchObject(object, Editor.program);

	for(var category in resources) {
		for(var resource in resources[category]) {
			actions.push(new AddResourceAction(resources[category][resource], Editor.program, category));
		}
	}

	Editor.addAction(new ActionBundle(actions));
};


Editor.finishAddingAsset = async function (object3D) {

	if(!(object3D && Editor.program && object3D instanceof Object3D)) {
		return;
	}


	// Recurse into groups/hierarchies to catch split models or collections
	object3D.traverse(function (child) {
		var mats, i, j, mapType;

		// Steal Material references
		if(child.material) {
			mats = Array.isArray(child.material) ? child.material : [child.material];
			for(i = 0; i < mats.length; i++) {
				if(mats[i].uuid && !Editor.program.materials[mats[i].uuid]) {
					Editor.program.materials[mats[i].uuid] = mats[i];
				}
			}
		}

		// Steal Geometry definitions
		if(child.geometry && child.geometry.uuid) {
			if(!Editor.program.geometries[child.geometry.uuid]) {
				Editor.program.geometries[child.geometry.uuid] = child.geometry;
			}
		}

		// Steal Textures if tied to standard diffuse maps, normals, etc.
		if(child.material) {
			mats = Array.isArray(child.material) ? child.material : [child.material];
			var mapTypes = ["map", "bumpMap", "normalMap", "specularMap", "emissiveMap", "roughnessMap", "metalnessMap"];

			for(i = 0; i < mats.length; i++) {
				for(j = 0; j < mapTypes.length; j++) {
					mapType = mapTypes[j];
					if(mats[i][mapType] && mats[i][mapType].uuid) {
						if(!Editor.program.textures[mats[i][mapType].uuid]) {
							Editor.program.textures[mats[i][mapType].uuid] = mats[i][mapType];
						}
					}
				}
			}
		}
	});


	if(Editor.gui.assetExplorer) {
		Editor.gui.assetExplorer.updateObjectsView();
	}

};


/**
 * Intercepts an incoming 3D object/model hierarchy to strip out materials,
 * geometries, and textures directly into the global program registries without
 * adding the structural 3D entity container nodes to the active viewport scene graph.
 *
 * @static
 * @method addAsset
 * @param {Object3D} object3D The model or collection hierarchy.
 */
Editor.addAsset = async function (object3D) {
	console.log("nunuStudio [Editor]: Bypassing scene placement for model asset:", object3D);

	if(object3D instanceof File) {
		const { Loaders } = await import("./Loaders.js");

		await Loaders.loadModel(object3D, null, this.finishAddingAsset);
	}

};



/**
 * Add objects array to a parent, and creates an action in the editor history.
 *
 * If no parent is specified it adds to object to the current scene.
 *
 * @static
 * @method addObjects
 * @param {Array} object Object to be added.
 * @param {Object3D} parent Parent object, if undefined the program scene is used.
 */
Editor.addObjects = async function (objects, parent) {
	const { AddAction } = await import("./history/action/objects/AddAction.js");
	const { ResourceCrawler } = await import("./history/ResourceCrawler.js");
	const { AddResourceAction } = await import("./history/action/resources/AddResourceAction.js");
	const { ActionBundle } = await import("./history/action/ActionBundle.js");

	if(parent === undefined) {
		parent = Editor.getScene();
	}

	var actions = [];

	for(var i = 0; i < objects.length; i++) {
		actions.push(new AddAction(objects[i], parent));

		var resources = ResourceCrawler.searchObject(objects[i], Editor.program);

		for(var category in resources) {
			for(var resource in resources[category]) {
				actions.push(new AddResourceAction(resources[category][resource], Editor.program, category));
			}
		}
	}

	Editor.addAction(new ActionBundle(actions));
};

/**
 * Rename object, if none passed as argument selected object is used.
 *
 * @static
 * @method renameObject
 * @param {Object3D} object Object to be renamed.
 */
Editor.renameObject = async function (object) {
	const { Locale } = await import("./locale/LocaleManager.js");
	const { ChangeAction } = await import("./history/action/ChangeAction.js");

	if(object === undefined) {
		if(Editor.hasObjectSelected()) {
			object = Editor.selection[0];
		}
		else {
			return;
		}
	}

	if(!object.locked) {
		var name = Editor.prompt(Locale.renameObject, object.name);
		if(name !== null && name !== "") {
			Editor.addAction(new ChangeAction(object, "name", name));
		}
	}
};

/**
 * Delete object from the editor, and creates an action in the editor history.
 *
 * @method deleteObject
 * @param {Array} objects List of objects.
 */
Editor.deleteObject = async function (object) {
	const { Program } = await import("../core/objects/Program.js");
	const { RemoveAction } = await import("./history/action/objects/RemoveAction.js");
	const { RemoveResourceAction } = await import("./history/action/resources/RemoveResourceAction.js");
	const { Font } = await import("../core/resources/Font.js");
	const { Audio } = await import("../core/resources/Audio.js");
	const { Video } = await import("../core/resources/Video.js");
	const { Resource } = await import("../core/resources/Resource.js");
	const { ActionBundle } = await import("./history/action/ActionBundle.js");

	var selected = object === undefined ? Editor.selection : [object];

	// List of delete actions
	var actions = [];

	// Delect selection
	for(var i = 0; i < selected.length; i++) {
		// Object3D
		if(selected[i].isObject3D && !selected[i].locked && !(selected[i] instanceof Program)) {
			actions.push(new RemoveAction(selected[i]));
		}
		// Material
		else if(selected[i] instanceof Material) {
			Editor.addAction(new RemoveResourceAction(selected[i], Editor.program, "materials"));
		}
		// Texture
		else if(selected[i] instanceof Texture) {
			Editor.addAction(new RemoveResourceAction(selected[i], Editor.program, "textures"));
		}
		// Font
		else if(selected[i] instanceof Font) {
			Editor.addAction(new RemoveResourceAction(selected[i], Editor.program, "fonts"));
		}
		// Audio
		else if(selected[i] instanceof Audio) {
			Editor.addAction(new RemoveResourceAction(selected[i], Editor.program, "audio"));
		}
		// Video
		else if(selected[i] instanceof Video) {
			Editor.addAction(new RemoveResourceAction(selected[i], Editor.program, "videos"));
		}
		// Geometries
		else if(selected[i] instanceof BufferGeometry || selected[i] instanceof BufferGeometry) {
			Editor.addAction(new RemoveResourceAction(selected[i], Editor.program, "geometries"));
		}
		// Shapes
		else if(selected[i] instanceof Shape) {
			Editor.addAction(new RemoveResourceAction(selected[i], Editor.program, "shapes"));
		}
		// Resources
		else if(selected[i] instanceof Resource) {
			Editor.addAction(new RemoveResourceAction(selected[i], Editor.program, "resources"));
		}
		// Unknown
		else {
			console.warn("nunuStudio: Cant delete type of object.");
		}
	}

	// Check if any action was added
	if(actions.length > 0) {
		Editor.addAction(new ActionBundle(actions));
	}
};

/**
 * Copy selected object to the clipboard.
 *
 * Uses the JSON serialization of the object.
 *
 * @static
 * @method copyObject
 * @param {Object3D} object Object to copy.
 */
Editor.copyObject = async function (object) {
	const { Program } = await import("../core/objects/Program.js");
	const { Scene } = await import("../core/objects/Scene.js");

	var objects = object === undefined ? Editor.selection : [object];

	// filter out locked objects and program/scene
	objects = objects.filter(function (object) {
		return !(object.locked || object instanceof Program || object instanceof Scene);
	});

	if(objects.length === 0) {
		return;
	}

	Editor.clipboard.set(
		JSON.stringify(objects.map(function (object) {
			return object.toJSON();
		})),
		"text"
	);

};

/**
 * Cut selected object, copy to the clipboard and delete it.
 *
 * Uses the JSON serialization of the object.
 *
 * @static
 * @method copyObject
 * @param {Object3D} object Object to copy.
 */
Editor.cutObject = async function (object) {
	const { Program } = await import("../core/objects/Program.js");
	const { Scene } = await import("../core/objects/Scene.js");

	var objects = object === undefined ? Editor.selection : [object];

	// filter out locked objects and program/scene
	objects = objects.filter(function (object) {
		return !(object.locked || object instanceof Program || object instanceof Scene);
	});

	if(objects.length === 0) {
		return;
	}

	Editor.clipboard.set(
		JSON.stringify(objects.map(function (object) {
			return object.toJSON();
		})
		));

	Editor.deleteObject();

};

/**
 * Paste object as children of target object.
 *
 * @static
 * @method pasteObject
 * @param {Object3D} parent
 */
Editor.pasteObject = async function (target) {
	const { Locale } = await import("./locale/LocaleManager.js");
	const { ObjectLoader } = await import("../core/loaders/ObjectLoader.js");

	try {
		var content = Editor.clipboard.get("text");
		var data = JSON.parse(content);

		// Create object from data(objects)
		var objs = [];
		for(var i = 0; i < data.length; i++) {
			var obj = await new ObjectLoader().parse(data[i]);
			obj.traverse(function (child) {
				child.uuid = MathUtils.generateUUID();
			});
			objs.push(obj);
		}

		// Add objs to target
		if(target !== undefined && !target.locked) {
			Editor.addObjects(objs, target);
		}
		else {
			Editor.addObjects(objs);
		}

	}
	catch(e) {
		Editor.alert(Locale.errorPaste);
	}
};

/**
 * Redo history action.
 *
 * @method redo
 */
Editor.redo = async function () {
	const { Locale } = await import("./locale/LocaleManager.js");

	if(Editor.history.redo()) {
		Editor.updateObjectsViewsGUI();
	}
	else {
		Editor.alert(Locale.nothingToRedo);
	}
};

/**
 * Undo history action.
 *
 * @method undo
 */
Editor.undo = async function () {
	const { Locale } = await import("./locale/LocaleManager.js");

	if(Editor.history.undo()) {
		Editor.updateObjectsViewsGUI();
	}
	else {
		Editor.alert(Locale.nothingToUndo);
	}
};

/**
 * Create default resouces to be used when creating new objects.
 *
 * @static
 * @method createDefaultResouces
 */
Editor.createDefaultResouces = async function () {
	const { Global } = await import("./Global.js");
	const { Image } = await import("../core/resources/Image.js");
	const { Font } = await import("../core/resources/Font.js");
	const { Audio } = await import("../core/resources/Audio.js");

	Editor.defaultImage = new Image(Global.FILE_PATH + "uv_color.jpg");
	Editor.defaultFont = new Font(Global.FILE_PATH + "default.json");
	Editor.defaultAudio = new Audio(Global.FILE_PATH + "default.mp3");

	Editor.defaultTexture = new Texture(Editor.defaultImage);
	Editor.defaultTexture.name = "texture";

	Editor.defaultTextureParticle = new Texture(new Image(Global.FILE_PATH + "particle.png"));
	Editor.defaultTextureParticle.name = "particle";

	Editor.defaultImageTerrain = new Image(Global.FILE_PATH + "terrain.png");
	Editor.defaultImageTerrain.name = "terrain";

	Editor.defaultGeometry = new BoxGeometry(1, 1, 1);
	Editor.defaultGeometry.name = "box";

	Editor.defaultMaterial = new MeshStandardMaterial({ roughness: 0.6, metalness: 0.2 });
	Editor.defaultMaterial.name = "standard";

	Editor.defaultSpriteMaterial = new SpriteMaterial({ map: Editor.defaultTexture, color: 0xFFFFFF });
	Editor.defaultSpriteMaterial.name = "sprite";

	Editor.defaultTextureLensFlare = [];
	for(var i = 0; i < 4; i++) {
		var texture = new Texture(new Image(Global.FILE_PATH + "lensflare/lensflare" + i + ".png"));
		texture.name = "lensflare" + i;
		Editor.defaultTextureLensFlare.push(texture);
	}
};

Editor.updateSettings = function () {
	Editor.gui.tab.updateSettings();
};

/**
 * Update all object views
 *
 * @static
 * @method updateObjectsViewsGUI
 */
Editor.updateObjectsViewsGUI = function () {
	Editor.gui.tab.updateObjectsView();
	Editor.gui.tab.updateMetadata();
};

/**
 * Update tabs after changing selection.
 *
 * @static
 * @method updateSelectionGUI
 */
Editor.updateSelectionGUI = function () {
	Editor.gui.tab.updateMetadata();
	Editor.gui.tab.updateSelection();
};

/**
 * Reset the editor state.
 *
 * @static
 * @method resetEditor
 */
Editor.resetEditor = function () {
	Editor.clearSelection();

	Editor.gui.tab.updateObjectsView();
	Editor.gui.tab.updateMetadata();
	Editor.gui.tab.updateSelection();
};

/**
 * Create a program and set to the editor.
 *
 * @method createNewProgram
 */
Editor.createNewProgram = async function () {
	const { Program } = await import("../core/objects/Program.js");

	var program = new Program();

	await Editor.createDefaultResouces();
	Editor.setProgram(program);
	await Editor.addDefaultScene(Editor.defaultMaterial);
	Editor.setOpenFile(null);
};

/**
 * Create a scene using a default template.
 *
 * This is the scene used when creating a new program or scene inside the editor.
 *
 * @method addDefaultScene
 * @param {Material} material Default material used by objects, if empty a new material is created
 */
Editor.addDefaultScene = async function (material) {
	const { Scene } = await import("../core/objects/Scene.js");
	const { Sky } = await import("../core/objects/misc/Sky.js");
	const { Mesh } = await import("../core/objects/mesh/Mesh.js");
	const { SceneEditor } = await import("./gui/tab/scene-editor/SceneEditor.js");

	if(material === undefined) {
		material = new MeshStandardMaterial({ roughness: 0.6, metalness: 0.2 });
		material.name = "default";
	}

	// Create new scene
	var scene = new Scene();

	// Sky
	var sky = new Sky();
	sky.autoUpdate = false;
	scene.add(sky);

	// Box
	var model = new Mesh(Editor.defaultGeometry, material);
	model.name = "box";
	scene.add(model);

	// Floor
	var ground = new BoxGeometry(20, 1, 20);
	ground.name = "ground";

	model = new Mesh(ground, material);
	model.position.set(0, -1.0, 0);
	model.name = "ground";
	scene.add(model);

	// Add scene to program
	Editor.addObject(scene, Editor.program);

	// Open scene
	var tab = await Editor.gui.tab.addTab(SceneEditor, true);
	tab.attach(scene);
};

/**
 * Save the program into a project directory, with all resources split across multiple files.
 *
 * @static
 * @method saveProgramPath
 * @param {string} path Target directory to export the files into.
 */
Editor.saveProgramPath = async function (path) {
	const { StaticPair } = await import("@as-com/pson");
	const { ResourceContainer } = await import("../core/resources/ResourceContainer.js");
	const { FileSystem } = await import("../core/FileSystem.js");

	var pson = new StaticPair();
	var data = Editor.program.toJSON();

	for(var i = 0; i < ResourceContainer.libraries.length; i++) {
		var lib = ResourceContainer.libraries[i];
		var resources = data[lib];
		data[lib] = [];

		if(resources.length > 0) {
			FileSystem.makeDirectory(path + "\\" + lib);

			for(var j = 0; j < resources.length; j++) {
				var fname = path + "\\" + lib + "\\" + resources[j].uuid;

				data[lib].push({
					uuid: resources[j].uuid,
					format: "chunk",
					path: fname
				});

				FileSystem.writeFileArrayBuffer(fname, pson.toArrayBuffer(resources[j]));
			}
		}
	}

	FileSystem.writeFileArrayBuffer(path + "\\app.nsp", pson.toArrayBuffer(data));
};

/**
 * Save program to file (.nsp or .isp).
 *
 * @static
 * @method saveProgram
 * @param {string} fname
 * @param {boolean} binary If true the file is saved as nsp.
 * @param {boolean} keepDirectory
 * @param {boolean} supressMessage
 */
Editor.saveProgram = async function (fname, binary, keepDirectory, suppressMessage) {
	const { StaticPair } = await import("@as-com/pson");
	const { FileSystem } = await import("../core/FileSystem.js");
	const { Locale } = await import("./locale/LocaleManager.js");

	try {
		if(fname === undefined && Editor.openFile !== null) {
			fname = Editor.openFile;
		}

		if(binary === true) {
			fname = fname.replace(".isp", ".nsp");

			var pson = new StaticPair();
			var data = pson.toArrayBuffer(Editor.program.toJSON());
			FileSystem.writeFileArrayBuffer(fname, data);
		}
		else {
			fname = fname.replace(".nsp", ".isp");

			var json = JSON.stringify(Editor.program.toJSON(), null, "\t");
			FileSystem.writeFile(fname, json);
		}

		if(keepDirectory !== true && Editor.openFile !== fname) {
			Editor.setOpenFile(fname);
		}

		if(suppressMessage !== true) {
			Editor.alert(Locale.projectSaved);
		}
	}
	catch(e) {
		Editor.alert(Locale.errorSavingFile + "\n(" + e + ")");
		console.error("nunuStudio: Error saving file", e);
	}
};

/**
 * Set a program to be edited, create new history object and clear editor windows.
 *
 * @static
 * @method setProgram
 * @param {Program} program
 */
Editor.setProgram = async function (program) {
	const { History } = await import("./history/History.js");
	const { SceneEditor } = await import("./gui/tab/scene-editor/SceneEditor.js");

	if(Editor.program !== program) {
		if(Editor.program !== null) {
			Editor.program.dispose();
		}

		Editor.program = program;

		// Tree view
		Editor.gui.tree.attach(Editor.program);
		Editor.gui.assetExplorer.attach(Editor.program);

		// History
		Editor.history = new History(Editor.settings.general.historySize);

		// Clear tabs
		Editor.gui.tab.clear();

		// Reset editor
		Editor.resetEditor();

		// Add new scene tab to interface
		if(program.children.length > 0) {
			var scene = await Editor.gui.tab.addTab(SceneEditor, true);
			scene.attach(program.children[0]);
		}
	}
};

/**
 * Load program from file.
 *
 * Programs can be stored as textual json files, or PSON files (binary).
 *
 * @static
 * @method loadProgram
 * @param {File} file
 * @param {boolean} binary Indicates if the file is binary.
 */
Editor.loadProgram = async function (file, binary) {
	const { LoadingModal } = await import("./components/modal/LoadingModal.js");
	const { DocumentBody } = await import("./components/DocumentBody.js");
	const { ObjectLoader } = await import("../core/loaders/ObjectLoader.js");
	const { StaticPair } = await import("@as-com/pson");
	const { Locale } = await import("./locale/LocaleManager.js");
	const { FileSystem } = await import("../core/FileSystem.js");

	var modal = new LoadingModal(DocumentBody);
	modal.show();

	async function onload() {
		try {
			var loader = new ObjectLoader();

			var program;

			if(binary === true) {
				var pson = new StaticPair();
				var data = pson.decode(reader.result);
				program = await loader.parse(data);
			}
			else {
				program = await loader.parse(JSON.parse(reader.result));
			}

			Editor.setOpenFile(file);
			Editor.setProgram(program);

			Editor.alert(Locale.projectLoaded);
		}
		catch(e) {
			Editor.alert(Locale.errorLoadingFile + "\n(" + e + ")");
			console.error("nunuStudio: Error loading file", e);
		}

		modal.destroy();
	};

	if(file instanceof File) {
		var reader = new FileReader();
		reader.onload = onload;
		if(binary === true) {
			reader.readAsArrayBuffer(file);
		}
		else {
			reader.readAsText(file);
		}
	}
	else if(typeof file === "string") {
		var reader = {};
		if(binary === true) {
			reader.result = await FileSystem.readFileArrayBuffer(file);
		}
		else {
			reader.result = await FileSystem.readFile(file);
		}
		onload();
	}
};

/**
 * Set currently open file (also updates the editor title), if running in browser is not used.
 *
 * Used for the editor to remember the file location that it is currently working on.
 *
 * @static
 * @method setOpenFile
 * @param {string} file Path of file currently open.
 */
Editor.setOpenFile = async function (file) {
	const { Nunu } = await import("../core/Nunu.js");

	if(file !== undefined && file !== null) {
		if(file instanceof window.File) {
			if(runningOnDesktop()) {
				Editor.openFile = file.path;
			}
			else {
				Editor.openFile = file.name;
			}
		}
		else {
			Editor.openFile = file;
		}

		document.title = Nunu.NAME + " " + VERSION + " (" + TIMESTAMP + ") (" + Editor.openFile + ")";
	}
	else {
		Editor.openFile = null;
		document.title = Nunu.NAME + " " + VERSION + " (" + TIMESTAMP + ")";
	}
};

/**
 * Show a confirm dialog with a message.
 *
 * @static
 * @method confirm
 * @param {string} message
 * @return {boolean} True or false depending on the confirm result.
 */
Editor.confirm = function (message) {
	return window.confirm(message);
};

/**
 * Show a alert dialog with a message.
 *
 * @static
 * @method confirm
 * @param {string} message
 */
Editor.alert = function (message) {
	window.alert(message);
};

/**
 * Prompt the user for a value.
 *
 * @static
 * @method confirm
 * @param {string} message
 * @param {string} defaultValue
 * @return {string} Value inserted by the user.
 */
Editor.prompt = function (message, defaultValue) {
	return window.prompt(message, defaultValue);
};

/**
 * Try to update nunuStudio editor version using build from github repo.
 *
 * The version timestamp (TIMESTAMP) is parsed compared to the local timestamp.
 *
 * @static
 * @method updateNunu
 */
Editor.updateNunu = async function (silent) {
	const { FileSystem } = await import("../core/FileSystem.js");
	const { Locale } = await import("./locale/LocaleManager.js");

	if(silent === undefined) {
		silent = true;
	}

	try {
		var url = "https:// raw.githubusercontent.com/tentone/nunuStudio/master/build/nunu.editor.min.js";

		const data = await FileSystem.readFile(url, false);
		var token = "TIMESTAMP";
		var pos = data.search(token);
		var timestamp = data.slice(pos + token.length + 2, pos + token.length + 14);

		if(parseInt(timestamp) > parseInt(Editor.TIMESTAMP)) {
			FileSystem.writeFile("nunu.min.js", data);
			Editor.alert(Locale.updatedRestart);
		}
		else {
			if(!silent) {
				Editor.alert(Locale.alreadyUpdated);
			}
		}
	}
	catch(e) {
		if(!silent) {
			Editor.alert(Locale.updateFailed);
		}
	}
};

/**
 * Get the renderer configuration used for the editor elements.
 *
 * Is defined in the settings tab and can be overrided by the project settings.
 *
 * @static
 * @method getRendererConfig
 */
Editor.getRendererConfig = function () {
	return Editor.settings.render.followProject ? Editor.program.rendererConfig : Editor.settings.render;
};

/**
 * Exit the editor and close all windows.
 *
 * @static
 * @method exit.
 */
Editor.exit = function () {
	if(runningOnDesktop()) {
		Editor.settings.store();

		var gui = window.require("nw.gui");
		var win = gui.Window.get();

		gui.App.closeAllWindows();
		win.close(true);
		gui.App.quit();
	}
};

export { Editor };
