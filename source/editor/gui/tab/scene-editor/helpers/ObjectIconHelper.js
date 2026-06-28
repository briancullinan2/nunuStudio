import { Object3D, Sprite, SpriteMaterial } from "three";
import { Texture } from "../../../../../core/texture/Texture.js";

/**
 * Object icon helper is used to display the icon of an object.
 *
 * @class ObjectIconHelper
 * @extends {Sprite}
 * @param {Object3D} object
 * @param {SpriteMaterial} material Pre-resolved material instance.
 */
class ObjectIconHelper extends Sprite
{
	constructor(object, material)
	{
		// super receives a completely resolved material from the factory
		super(material);

		/**
		 * Object attached to the helper
		 *
		 * @attribute object
		 * @type {Object3D}
		 */
		this.object = object;

		/**
		 * Size of the helper.
		 *
		 * @attribute size
		 * @type {number}
		 */
		this.size = 0.1;

		this.matrixAutoUpdate = false;
	}

	/**
	 * Cache of icon helper materials.
	 *
	 * @static
	 * @attribute MATERIALS
	 * @type {Map}
	 */

	/**
	 * Static factory method to resolve the icon material asynchronously before instantiation.
	 *
	 * @static
	 * @method create
	 * @param {Object3D} object Target object.
	 * @param {string} icon Icon URL string.
	 */
	static async create(object, icon)
	{
		const material = await ObjectIconHelper.getMaterial(icon);
		return new ObjectIconHelper(object, material);
	}

	/**
	 * Get the sprite material for a icon url.
	 *
	 * @static
	 * @method getMaterial
	 * @param {string} icon Icon URL.
	 */
	static async getMaterial(icon)
	{
		if(ObjectIconHelper.MATERIALS.has(icon))
		{
			return ObjectIconHelper.MATERIALS.get(icon);
		}

		// Texture.create expects a string or an Image instance based on our factory signature
		const texture = await Texture.create(icon);

		var material = new SpriteMaterial(
			{
				map: texture,
				transparent: true,
				depthTest: false,
				depthWrite: false,
				sizeAttenuation: false,
				alphaTest: 0.2
			});

		material.ratio = 1.0;

		// Access the underlying HTML Image element bound inside our custom Texture setup
		const element = texture.element;

		if(element)
		{
			const updateRatio = function ()
			{
				material.ratio = this.naturalWidth / this.naturalHeight;
				texture.needsUpdate = true;
			};

			if(element.complete && element.naturalWidth > 0)
			{
				updateRatio.call(element);
			}
			else
			{
				element.addEventListener("load", updateRatio);
			}
		}

		ObjectIconHelper.MATERIALS.set(icon, material);

		return material;
	}

	update()
	{
		// Position
		this.matrix.elements[12] = this.object.matrixWorld.elements[12];
		this.matrix.elements[13] = this.object.matrixWorld.elements[13];
		this.matrix.elements[14] = this.object.matrixWorld.elements[14];

		// Scale
		this.matrix.elements[0] = this.size;
		this.matrix.elements[5] = this.size / this.material.ratio;
		this.matrix.elements[10] = this.size;
	}
}

ObjectIconHelper.MATERIALS = new Map();

export { ObjectIconHelper };
