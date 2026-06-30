import { TableForm } from "../../../components/TableForm.js";
import { Component } from "../../../components/Component.js";

/**
 * A panel inspector is used to inspect and change the attributes of an object.
 *
 * The panel has a form element that should be used to place the object attribute editing GUI.
 *
 * @constructor
 * @class Inspector
 * @extends {Component}
 * @param {Component} parent
 * @param {Object} object Object to be edited by this inspector panel.
 */
class Inspector extends Component {
	constructor(parent, object) {
		super(parent, "div");

		this.element.style.overflow = "auto";
		this.preventDragEvents();

		/**
		 * Object attached to this panel.
		 *
		 * @property object
		 * @type {Object3D}
		 */
		this.object = null;
		this.attach(object);

		/**
		 * Inspector form.
		 *
		 * @property form
		 * @type {TableForm}
		 */
		this.form = new TableForm(this);
		this.form.setAutoSize(false);
	}

	/**
	 * Attach object to panel.
	 *
	 * @method attach
	 * @param {Object3D} object
	 */
	attach(object) {
		this.object = object;
	}

	/**
	 * Update panel information to match the attached object.
	 *
	 * @method updateInspector
	 */
	updateInspector() { }

	updateSize() {
		super.updateSize();

		this.form.size.copy(this.size);
		this.form.updateInterface();
	}


	getSourceUrl(source) {
		if(source || this.object.source) {
			try {
				const url = new URL(source || this.object.source);
				const host = url.host; // e.g., "example.com" or "localhost:8080"

				// Extract the filename from the end of the pathname
				const segments = url.pathname.split('/').filter(Boolean);
				const fileName = segments.length > 0 ? segments[segments.length - 1] : "";

				// Assemble the pretty string: "example.com/.../file.glb"
				const displayString = fileName ? `${host}/.../${fileName}` : host;

				return `<a target="_new" href="${this.object.source}" title="${this.object.source}">${displayString}</a>`;
			} catch(e) {
				// Fallback if this.object.source is a relative path (not a full URL)
				const segments = this.object.source.split('/').filter(Boolean);
				const fileName = segments[segments.length - 1] || "";
				const folderName = segments[segments.length - 2] || "";
				const displayString = folderName ? `.../${folderName}/${fileName}` : fileName;

				return `<a target="_new" href="${this.object.source}" title="${this.object.source}">${displayString}</a>`;
			}
		}
		return '';
	}

}

export { Inspector };
