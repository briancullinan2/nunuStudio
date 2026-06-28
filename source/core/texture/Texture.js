import { Source, Texture as TTexture, RGBAFormat, RGBFormat, LinearFilter } from "three";
import { Image } from "../resources/Image.js";

/**
 * Basic image texture object wraps a texture from a img DOM element
 *
 * Support for GIF animations without playback controls.
 *
 * @class Texture
 * @extends {Texture}
 * @module Textures
 * @param {Image | String} source
 * @param {number} mapping
 * @param {number} wrapS
 * @param {number} wrapT
 * @param {number} magFilter
 * @param {number} minFilter
 * @param {number} format
 * @param {number} type
 * @param {number} anisotropy
 * @param {number} encoding
 */
class Texture extends TTexture
{
	constructor(source, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy, encoding)
	{
		// Resolve source before calling super
		var resolvedSource;
		if(typeof source === "string")
		{
			resolvedSource = new Image(source);
		}
		else if(source === undefined)
		{
			resolvedSource = new Image();
		}
		else
		{
			resolvedSource = source;
		}

		const newImage = document.createElement("img");

		// Initialize with a minimal, valid 1x1 data layout to prevent WebGL 0x0 size crash
		super(new Source(newImage), mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy, encoding);

		this.element = newImage;

		/**
		 * Custom internal wrapper for the texture source image.
		 * Renamed from 'source' to avoid overwriting Three.js core functionality.
		 *
		 * @property customSource
		 * @type {Image}
		 */
		this.customSource = resolvedSource;

		var self = this;

		/**
		 * Name of the texture (doesn't need to be unique).
		 *
		 * @property name
		 * @type {string}
		 */
		this.name = "texture";
		this.category = "Image";

		/**
		 * Flag used to know is the texture has been disposed.
		 *
		 * Is used to control animation when using a gif as a texture.
		 *
		 * @property disposed
		 * @type {boolean}
		 * @default false
		 */
		this.disposed = false;

		this.format = this.customSource.hasTransparency() ? RGBAFormat : RGBFormat;

		this.updateSource();

		// Check if image is animated format and start an update cycle
		if(this.customSource.encoding === "gif")
		{
			this.generateMipmaps = false;
			this.magFilter = LinearFilter;
			this.minFilter = LinearFilter;

			function update()
			{
				if(!self.disposed)
				{
					self.needsUpdate = true;
					requestAnimationFrame(update);
				}
			}
			update();
		}
	}

	/**
	 * Should be called after updating the source of the texture.
	 *
	 * Will copy the source data to the texture for upload to the GPU.
	 *
	 * @method updateSource
	 */
	updateSource()
	{
		if(this.customSource !== null)
		{
			var self = this;

			this.element.crossOrigin = "anonymous";
			this.element.src = this.customSource.data;
			this.element.onload = function ()
			{
				if(self.source)
				{
					// Reassign the structural reference inside the Source wrapper
					// to force Three.js to query the real image dimensions
					self.source.data = self.element;
					self.source.needsUpdate = true;
				}
				self.needsUpdate = true;
			};
			this.element.onerror = function ()
			{
				console.log("nunuStudio: Failed to load image " + self.customSource.uuid + " data.");
				self.customSource.createSolidColor();
				self.element.src = self.customSource.data;

				if(self.source)
				{
					self.source.data = self.element;
					self.source.needsUpdate = true;
				}
				self.needsUpdate = true;
			};
		}
		else
		{
			console.warn("nunuStudio: Texture source is null.");

			this.customSource.createSolidColor();
			this.element.src = this.customSource.data;

			if(this.source)
			{
				this.source.data = this.element;
				this.source.needsUpdate = true;
			}
			this.needsUpdate = true;
		}
	}

	/**
	 * Dispose texture.
	 *
	 * @method dispose
	 */
	dispose()
	{
		super.dispose();

		this.disposed = true;
	}

	/**
	 * Create JSON description for texture, serializes image used in the texture
	 * Texture serialization is different inside nunuStudio, the Texture class does not serialize any image data.
	 *
	 * @param {Object} meta
	 * @method toJSON
	 */
	toJSON(meta)
	{
		var data = super.toJSON(meta);
		var image = this.customSource.toJSON(meta);

		data.element = image.uuid;

		return data;
	}
}

/**
 * UUID of this object instance. This gets automatically assigned, so this shouldn't be edited.
 *
 * @property uuid
 * @type {string}
 */
/**
 * How much a single repetition of the texture is offset from the beginning, in each direction U and V.
 *
 * @property offset
 * @type {Vector2}
 */
/**
 * How many times the texture is repeated across the surface, in each direction U and V.  If repeat is set greater than 1 in either direction, the corresponding Wrap parameter should also be set to .
 *
 * @property repeat
 * @type {Vector2}
 */
/**
 * Indicates where the center of rotation is. To rotate around the center point set this value to (0.5, 0.5).
 *
 * @property center
 * @type {Vector2}
 */
/**
 * How much the texture is rotated around the center point, in radians. Postive values are counter-clockwise.
 *
 * @property rotation
 * @type {number}
 * @default 0
 */
/**
 * False by default, which is the norm for PNG images. Set to true if the RGB values have been stored premultiplied by alpha.
 *
 * @property premultiplyAlpha
 * @type {boolean}
 */
/**
 * Flips the image's Y axis to match the WebGL texture coordinate space.
 *
 * @property flipY
 * @type {boolean}
 */
/**
 * Array of user-specified mipmaps (optional).
 *
 * @property mipmaps
 * @type {Array}
 */
/**
 * DOM element attached to the texture
 *
 * @property image
 * @type {Element}
 */


export { Texture };
