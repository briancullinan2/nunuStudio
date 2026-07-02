import { Vector2 } from "three";
import { Component } from "./Component.js";


/**
 * Body to represent the document.body
 *
 * It does not extend the Component class, but has the same base attributes and can be used as a parent for components.
 *
 * @static
 * @class DocumentBody
 */
let DocumentBody =
{
	parent: null,
	element: document.getElementById('nunu'),
	mode: Component.TOP_LEFT,
	isComponent: true,
	visible: true,
	position: new Vector2(0, 0),
	_size: new Vector2(0, 0),
	// Top-level layout cache memory object to eliminate browser style/layout thrashing reflows
	innerWidth: window.innerWidth,
	innerHeight: window.innerHeight,
	setCanvas: function (canvas) {
		DocumentBody.canvas = canvas;
		setTimeout(DocumentBody.updateLayout, 300);
	},
	updateLayout: function (entries) {
		DocumentBody.innerWidth = document.body.clientWidth || window.innerWidth;
		DocumentBody.innerHeight = document.body.clientHeight || window.innerHeight;
		DocumentBody.canvas ||= DocumentBody.element.querySelector('canvas');
		if(DocumentBody.canvas) {
			const rect = DocumentBody.canvas.getBoundingClientRect();
			DocumentBody.canvasTop = rect.top;
			DocumentBody.canvasLeft = rect.left;
			DocumentBody.canvasWidth = rect.width;
			DocumentBody.canvasHeight = rect.height;
		}

	}
};

Object.defineProperties(DocumentBody,
	{
		size:
		{
			get: function () {
				// Reads from the lightweight cache instead of forcing a full browser style recalc loop
				this._size.set(DocumentBody.innerWidth, DocumentBody.innerHeight);
				return this._size;
			},
			set: function () { }
		}
	});

let layoutObserver = new ResizeObserver(DocumentBody.updateLayout);
layoutObserver.observe(document.body);

export { DocumentBody };
