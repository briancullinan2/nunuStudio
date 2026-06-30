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
		// Resolve source layout or construct placeholders immediately
		var resolvedSource;
		if(source instanceof Image)
		{
			resolvedSource = source;
		}
		else if(typeof source === "string")
		{
			resolvedSource = new Image(source);
		}
		else
		{
			resolvedSource = new Image();
		}

		const newImage = document.createElement("img");

		// Initialize with standard empty image element to maintain WebGL pipeline structures
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
	 * Asynchronous static factory method to safely resolve image loading properties
	 * before establishing standard operational configuration cycles.
	 *
	 * @static
	 * @method create
	 */
	static async create(source, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy, encoding)
	{
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

		// Check for underlying resource loader lifecycle instances
		if(resolvedSource && resolvedSource.loading instanceof Promise)
		{
			await resolvedSource.loading;
		}

		return new Texture(resolvedSource, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy, encoding);
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

export { Texture };
