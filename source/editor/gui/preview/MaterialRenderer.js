import { Float32BufferAttribute, SphereGeometry, Mesh, Points, Line, Sprite, AmbientLight, PointLight, Material, SpriteMaterial, LineBasicMaterial, PointsMaterial } from "three";
import { OrthographicCamera } from "../../../core/objects/cameras/OrthographicCamera.js";
import { PreviewRenderer } from "./PreviewRenderer.js";

/**
 * The material renderer is used to generate preview thumbnails.
 *
 * @class MaterialRenderer
 * @extends {PreviewRenderer}
 */
class MaterialRenderer extends PreviewRenderer {
	constructor() {
		super();

		// Camera
		this.camera = new OrthographicCamera(2.15, 1);

		// Geometry
		this.geometry = new SphereGeometry(1, 16, 16);

		// FIX: Inject dummy color (size 4) and lightCoord (size 2) arrays
		// to prevent the custom vertex shader from choking on missing attributes
		const count = this.geometry.attributes.position.count;

		const colors = new Float32Array(count * 4);
		const lightCoords = new Float32Array(count * 2);

		for(let i = 0; i < count; i++) {
			// Fill with full white vertex colors (R, G, B, A)
			colors[i * 4] = 1.0;
			colors[i * 4 + 1] = 1.0;
			colors[i * 4 + 2] = 1.0;
			colors[i * 4 + 3] = 1.0;

			// Dummy UV coords for lightmaps
			lightCoords[i * 2] = this.geometry.attributes.uv.getX(i);
			lightCoords[i * 2 + 1] = this.geometry.attributes.uv.getY(i);
		}

		this.geometry.setAttribute('color', new Float32BufferAttribute(colors, 4));
		this.geometry.setAttribute('lightCoord', new Float32BufferAttribute(lightCoords, 2));

		// Mesh
		this.mesh = new Mesh(this.geometry);
		this.scene.add(this.mesh);

		// Points
		this.points = new Points(this.geometry);
		this.scene.add(this.points);

		// Line
		this.line = new Line(this.geometry);
		this.scene.add(this.line);

		// Sprite
		this.sprite = new Sprite();
		this.sprite.scale.set(2, 2, 1);
		this.scene.add(this.sprite);

		// Ambient light
		var ambient = new AmbientLight(0x999999);
		this.scene.add(ambient);

		// Point light
		var point = new PointLight(0x999999);
		point.position.set(-0.5, 1, 1.5);
		this.scene.add(point);
	}

	render(material, onRender) {
		if(material instanceof SpriteMaterial) {
			this.mesh.visible = false;
			this.sprite.visible = true;
			this.points.visible = false;
			this.line.visible = false;

			this.sprite.material = material;
			this.camera.position.set(0, 0, 0.5);
		}
		else if(material instanceof LineBasicMaterial) {
			this.mesh.visible = false;
			this.sprite.visible = false;
			this.points.visible = false;
			this.line.visible = true;

			this.line.material = material;
			this.camera.position.set(0, 0, 0.5);
		}
		else if(material instanceof PointsMaterial) {
			this.mesh.visible = false;
			this.sprite.visible = false;
			this.points.visible = true;
			this.line.visible = false;

			this.points.material = material;
			this.camera.position.set(0, 0, 0.5);
		}
		else {
			this.sprite.visible = false;
			this.mesh.visible = true;
			this.points.visible = false;
			this.line.visible = false;

			this.mesh.material = material;
			this.camera.position.set(0, 0, 1.5);
		}

		// Render
		this.renderer.render(this.scene, this.camera);

		// Callback
		onRender(this.canvas.toDataURL());
	}



	/**
	 * Create a DOM element with the material preview render.
	 *
	 * @static
	 * @method generateElement
	 * @param {Material} material Material to preview.
	 */
	static generateElement = function (material) {
		var preview = document.createElement("img");
		MaterialRenderer.render(material, function (url) {
			preview.src = url;
		});

		return preview;
	};

	static render = function (material, onRender) {
		if(MaterialRenderer.instance === undefined) {
		}

		MaterialRenderer.instance.render(material, onRender);
	};



}

MaterialRenderer.instance = new MaterialRenderer();
export { MaterialRenderer };
