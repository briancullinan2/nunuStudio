import { ResourceManager } from "../../../../core/resources/ResourceManager.js";
import { Resource } from "../../../../core/resources/Resource.js";
import { ResourceCrawler } from "../../ResourceCrawler.js";
import { Action } from "../Action.js";
import { Editor } from "../../../Editor.js";

/**
 * Add resource to the resource manager.
 *
 * @class AddResourceAction
 * @param {Resource} resource Resource to add.
 * @param {ResourceManager} manager Manager to insert the resource into.
 * @param {string} category Category of the resource.
 */
class AddResourceAction extends Action {
	// Native ES6 static property declarations
	static _lastGuiCallTime = 0;
	static _guiThrottleTimeout = null;

	constructor(resource, manager, category) {
		super();

		this.resource = resource;
		this.manager = manager;
		this.category = category;
	}

	apply() {
		ResourceCrawler.addResource(this.manager, this.resource, this.category);

		AddResourceAction.throttledUpdateGUI();
	}

	async revert() {
		const { RemoveResourceAction } = await import("./RemoveResourceAction.js");

		ResourceCrawler.removeResource(this.manager, this.resource, this.category);

		if(this.resource.dispose !== undefined) {
			this.resource.dispose();
		}

		AddResourceAction.throttledUpdateGUI();
	}

	/**
	 * Standard un-throttled immediate view update.
	 *
	 * @static
	 * @method updateGUI
	 */
	static updateGUI() {
		Editor.updateObjectsViewsGUI();
	}

	/**
	 * High-frequency performance protector that throttles interface calculations
	 * to a maximum boundary of once per second (1000ms).
	 *
	 * @static
	 * @method throttledUpdateGUI
	 */
	static throttledUpdateGUI() {
		if(window.isLoadingBSP) {
			return;
		}

		// Cancel the existing timer if it's already running
		if(AddResourceAction._guiThrottleTimeout) {
			clearTimeout(AddResourceAction._guiThrottleTimeout);
		}

		// Set a new timer to execute 300ms from this call
		AddResourceAction._guiThrottleTimeout = setTimeout(function () {
			AddResourceAction._guiThrottleTimeout = null;
			AddResourceAction.updateGUI();
		}, 300);
	}
}

export { AddResourceAction };
