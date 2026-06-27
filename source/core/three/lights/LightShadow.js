import { LightShadow } from "three/src/lights/LightShadow.js";

export class CustomLightShadow extends LightShadow
{
	/**
	 * Serialize the shadow properties to a clean object.
	 * @method toJSON
	 * @return {Object}
	 */
	toJSON()
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
	}

	/**
	 * Hydrate the shadow properties from a data object.
	 * @method fromJSON
	 * @param {Object} data
	 */
	fromJSON(data)
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
			this.mapSize.set(data.mapSize.x, data.mapSize.y);
		}
		if(data.camera !== undefined)
		{
			const cam = data.camera;
			this.camera.top = cam.top;
			this.camera.bottom = cam.bottom;
			this.camera.left = cam.left;
			this.camera.right = cam.right;
			this.camera.near = cam.near;
			this.camera.far = cam.far;
		}
	}
}
