import { Mesh, MeshNormalMaterial, BufferGeometry, Vector3, Vector2 } from "three";
import { OrthographicCamera } from "../../../core/objects/cameras/OrthographicCamera.js";
import { PreviewRenderer } from "./PreviewRenderer.js";

/**
 * The geometry renderer is used to generate preview thumbnails.
 *
 * A normal material is used to maximize spatial feature contrast for computer vision models.
 *
 * @class GeometryRenderer
 * @extends {PreviewRenderer}
 */
class GeometryRenderer extends PreviewRenderer {
	constructor() {
		super();

		this.camera = new OrthographicCamera(3, 1);

		// Replaced flat Phong material with Normal Material to generate dense structural feature gradients
		this.mesh = new Mesh(new BufferGeometry(), new MeshNormalMaterial());
		this.scene.add(this.mesh);
	}

	render(geometry, onRender) {
		geometry.computeBoundingBox();
		geometry.computeBoundingSphere();

		var box = geometry.boundingBox;
		var sphere = geometry.boundingSphere;

		var center = new Vector3();
		box.getCenter(center);

		this.mesh.geometry = geometry;
		this.mesh.position.copy(center).multiplyScalar(-1);

		var radius = sphere.radius;

		// Coverage math: 1 / 0.9 = 1.1111... to target exactly 90% frame occupation
		this.camera.size = radius * 2 * 1.111;

		var angle = Math.PI / 6;

		// Dynamic camera distance ensures the object fits perfectly within near/far clipping planes
		var distance = radius * 2 + 10;

		// Save original renderer state to prevent breaking the main app loop
		var originalPixelRatio = this.renderer.getPixelRatio();
		var originalSize = new Vector2(0, 0);
		this.renderer.getSize(originalSize);
		var originalAutoClear = this.renderer.autoClear;

		// Upscale internal canvas backbuffer resolution for high-fidelity data extraction
		var scaleFactor = 3; // Set higher (e.g., 2 or 3) for oversized crisp feature tracking
		var width = this.canvas.width * scaleFactor;
		var height = this.canvas.height * scaleFactor;

		if(this.renderer.getPixelRatio() !== 1) {
			this.renderer.setPixelRatio(1);
		}
		this.renderer.setSize(width, height, false);

		this.renderer.setViewport(0, 0, width, height);
		this.renderer.setScissor(0, 0, width, height);
		this.renderer.setScissorTest(false);

		this.camera.position.set(
			0,
			distance * Math.sin(angle),
			distance * Math.cos(angle)
		);
		this.camera.lookAt(0, 0, 0);

		this.camera.updateProjectionMatrix();
		this.renderer.render(this.scene, this.camera);

		onRender(this.canvas.toDataURL());

		// Restore original renderer state
		this.renderer.setPixelRatio(originalPixelRatio);
		this.renderer.setSize(originalSize.width, originalSize.height, false);
		this.renderer.autoClear = originalAutoClear;
	}

	renderQuad(geometry, onRender) {
		geometry.computeBoundingBox();
		geometry.computeBoundingSphere();

		var box = geometry.boundingBox;
		var sphere = geometry.boundingSphere;

		var center = new Vector3();
		box.getCenter(center);

		this.mesh.geometry = geometry;
		this.mesh.position.copy(center).multiplyScalar(-1);

		var radius = sphere.radius;
		var distance = radius * 2 + 10;

		// Target exactly 90% viewport coverage inside individual split screens
		this.camera.size = radius * 2 * 1.111;

		// Save original renderer state
		var originalPixelRatio = this.renderer.getPixelRatio();
		var originalSize = new Vector2(0, 0);
		this.renderer.getSize(originalSize);
		var originalAutoClear = this.renderer.autoClear;

		// Upscale internal canvas backbuffer resolution for high-fidelity data extraction
		var scaleFactor = 3;
		var width = this.canvas.width * scaleFactor;
		var height = this.canvas.height * scaleFactor;

		if(this.renderer.getPixelRatio() !== 1) {
			this.renderer.setPixelRatio(1);
		}
		this.renderer.setSize(width, height, false);

		var halfWidth = Math.floor(width / 2);
		var halfHeight = Math.floor(height / 2);

		this.renderer.autoClear = false;

		this.renderer.setViewport(0, 0, width, height);
		this.renderer.setScissor(0, 0, width, height);
		this.renderer.setScissorTest(false);
		this.renderer.clear();

		var angle30 = Math.PI / 6;
		var angleAnt = -Math.PI / 4;

		var views = [
			{
				// Quad 1: Top Left - Top-Down Bird's Eye View
				x: 0, y: halfHeight, w: halfWidth, h: halfHeight,
				pos: new Vector3(0, distance, 0.001)
			},
			{
				// Quad 2: Top Right - Standard 30° Angular Front View
				x: halfWidth, y: halfHeight, w: halfWidth, h: halfHeight,
				pos: new Vector3(0, distance * Math.sin(angle30), distance * Math.cos(angle30))
			},
			{
				// Quad 3: Bottom Left - 45° Upward Angular Ant View
				x: 0, y: 0, w: halfWidth, h: halfHeight,
				pos: new Vector3(0, distance * Math.sin(angleAnt), distance * Math.cos(angleAnt))
			},
			{
				// Quad 4: Bottom Right - Profile Right Side View
				x: halfWidth, y: 0, w: halfWidth, h: halfHeight,
				pos: new Vector3(distance, 0, 0)
			}
		];

		for(var i = 0; i < views.length; i++) {
			var view = views[i];

			this.renderer.setViewport(view.x, view.y, view.w, view.h);
			this.renderer.setScissor(view.x, view.y, view.w, view.h);
			this.renderer.setScissorTest(true);

			this.camera.position.copy(view.pos);
			this.camera.lookAt(0, 0, 0);
			this.camera.updateProjectionMatrix();

			this.renderer.render(this.scene, this.camera);
		}

		onRender(this.canvas.toDataURL());

		// Restore original renderer state
		this.renderer.setViewport(0, 0, originalSize.width, originalSize.height);
		this.renderer.setScissor(0, 0, originalSize.width, originalSize.height);
		this.renderer.setScissorTest(false);
		this.renderer.setPixelRatio(originalPixelRatio);
		this.renderer.setSize(originalSize.width, originalSize.height, false);
		this.renderer.autoClear = originalAutoClear;
	}

	static renderQuad = function (geometry, onRender) {
		if(GeometryRenderer.instance === undefined) {
			return;
		}
		GeometryRenderer.instance.renderQuad(geometry, onRender);
	};

	static render = function (geometry, onRender) {
		if(GeometryRenderer.instance === undefined) {
			return;
		}
		GeometryRenderer.instance.render(geometry, onRender);
	};
}

GeometryRenderer.instance = new GeometryRenderer();

export { GeometryRenderer };
