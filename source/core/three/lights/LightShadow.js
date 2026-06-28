import { LightShadow } from "three/src/lights/LightShadow.js";

/**
 * Serialize the shadow properties to a clean object.
 * Attached directly to Three.js core prototype.
 * * @method toJSON
 * @return {Object}
 */
LightShadow.prototype.toJSON = function (meta)
{
	return {
		bias: this.bias,
		radius: this.radius,
		mapSize: {
			x: this.mapSize.x,
			y: this.mapSize.y
		},
		camera: {
			top: this.camera.top,
			bottom: this.camera.bottom,
			far: this.camera.far,
			near: this.camera.near,
			left: this.camera.left,
			right: this.camera.right
		}
	};
};

/**
 * Hydrate the shadow properties from a data object.
 * Attached directly to Three.js core prototype.
 * * @method fromJSON
 * @param {Object} data
 */
LightShadow.prototype.fromJSON = function (data)
{
	if(data.bias !== undefined)
	{
		this.bias = data.bias;
	}
	if(data.radius !== undefined)
	{
		this.radius = data.radius;
	}
	if(data.mapSize !== undefined)
	{
		// Safe check for format variance (array vs object mapping)
		if(data.mapSize.x !== undefined)
		{
			this.mapSize.set(data.mapSize.x, data.mapSize.y);
		} else if(Array.isArray(data.mapSize))
		{
			this.mapSize.fromArray(data.mapSize);
		}
	}
	if(data.camera !== undefined)
	{
		const cam = data.camera;
		if(cam.top !== undefined) this.camera.top = cam.top;
		if(cam.bottom !== undefined) this.camera.bottom = cam.bottom;
		if(cam.left !== undefined) this.camera.left = cam.left;
		if(cam.right !== undefined) this.camera.right = cam.right;
		if(cam.near !== undefined) this.camera.near = cam.near;
		if(cam.far !== undefined) this.camera.far = cam.far;

		if(typeof this.camera.updateProjectionMatrix === "function")
		{
			this.camera.updateProjectionMatrix();
		}
	}
};

export { LightShadow };

