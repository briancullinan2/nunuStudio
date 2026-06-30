import { DirectionalLight, AmbientLight, Mesh, MeshPhongMaterial, BufferGeometry, Vector3 } from "three";
import { OrthographicCamera } from "../../../core/objects/cameras/OrthographicCamera.js";
import { PreviewRenderer } from "./PreviewRenderer.js";

/**
 * The geometry renderer is used to generate preview thumbnails.
 *
 * A basic phong material is used to preview the geometry.
 *
 * @class TextureRenderer
 * @extends {PreviewRenderer}
 */
class GeometryRenderer extends PreviewRenderer {
	constructor() {
		super();

		this.camera = new OrthographicCamera(3, 1);

		var directional = new DirectionalLight(0x777777, 1.0);
		directional.position.set(3000, 10000, 400);
		this.scene.add(directional);
		this.scene.add(new AmbientLight(0x888888));

		this.mesh = new Mesh(new BufferGeometry(), new MeshPhongMaterial({ color: 0xFFFFFF }));
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
		this.camera.size = radius * 2 * 1.25;

		var angle = Math.PI / 6;
		var distance = 50;

		// Sanitize context pipeline states before execution
		var width = this.canvas.width;
		var height = this.canvas.height;
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
		var distance = 50;

		this.camera.size = radius * 2 * 1.35;

		var width = this.canvas.width;
		var height = this.canvas.height;
		var halfWidth = Math.floor(width / 2);
		var halfHeight = Math.floor(height / 2);

		this.renderer.autoClear = false;

		// Ensure viewport covers full bounds for the global clear operation
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

		// Clean up and restore state context boundaries completely
		this.renderer.setViewport(0, 0, width, height);
		this.renderer.setScissor(0, 0, width, height);
		this.renderer.setScissorTest(false);
		this.renderer.autoClear = true;

		onRender(this.canvas.toDataURL());
	}

	static renderQuad = function (material, onRender) {
		if(GeometryRenderer.instance === undefined) {
			return;
		}
		GeometryRenderer.instance.renderQuad(material, onRender);
	};

	static render = function (material, onRender) {
		if(GeometryRenderer.instance === undefined) {
			return;
		}
		GeometryRenderer.instance.render(material, onRender);
	};
}

GeometryRenderer.instance = new GeometryRenderer();

export { GeometryRenderer };
