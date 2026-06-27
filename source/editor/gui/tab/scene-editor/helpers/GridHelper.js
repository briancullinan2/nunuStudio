import { LineSegments, BufferGeometry, LineBasicMaterial, Float32BufferAttribute } from "three";

/**
 * Grid helper is used to visualize a grid in the editor.
 *
 * Size, spacing and color of the grid can be customized.
 *
 * @class GridHelper
 * @extends {LineSegments}
 * @param {BufferGeometry} geometry The fully constructed grid geometry passed from the factory.
 * @param {number} color Hex color of the grid lines.
 * @param {number} size Total size of the grid.
 * @param {number} spacing Spacing between lines.
 */
class GridHelper extends LineSegments
{
	constructor(geometry, color, size, spacing)
	{
		super(geometry, new LineBasicMaterial(
			{
				color: color !== undefined ? color : 0x888888,
				depthWrite: false,
				transparent: true,
				opacity: 0.5
			}));

		this.size = size;
		this.spacing = spacing;
	}

	/**
	 * Synchronous factory method to initialize the grid cleanly.
	 * * @static
	 * @method create
	 * @param {number} [size] Total size of the grid.
	 * @param {number} [spacing] Spacing between lines.
	 * @param {number} [color] Hex color code.
	 * @return {GridHelper}
	 */
	static create(size, spacing, color)
	{
		var resolvedSize = size !== undefined ? size : 100;
		var resolvedSpacing = spacing !== undefined ? spacing : 1;

		var geometry = new BufferGeometry();

		var divisions = Math.round(resolvedSize / resolvedSpacing) * 2;
		var step = resolvedSize * 2 / divisions;
		var vertices = [];

		for(var i = 0, k = -resolvedSize; i <= divisions; i++, k += step)
		{
			vertices.push(-resolvedSize, 0, k, resolvedSize, 0, k);
			vertices.push(k, 0, -resolvedSize, k, 0, resolvedSize);
		}

		geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));

		return new GridHelper(geometry, color, resolvedSize, resolvedSpacing);
	}

	setSize(size)
	{
		this.size = size;
	}

	setSpacing(spacing)
	{
		this.spacing = spacing;
	}

	/**
	 * Rebuilds the geometry dynamically on runtime changes.
	 *
	 * @method update
	 */
	update()
	{
		this.geometry.deleteAttribute("position");

		var divisions = Math.round(this.size / this.spacing) * 2;
		var step = this.size * 2 / divisions;
		var vertices = [];

		for(var i = 0, k = -this.size; i <= divisions; i++, k += step)
		{
			vertices.push(-this.size, 0, k, this.size, 0, k);
			vertices.push(k, 0, -this.size, k, 0, this.size);
		}

		this.geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
	}
}

export { GridHelper };

