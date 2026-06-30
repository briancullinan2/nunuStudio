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
		const now = performance.now();
		const remaining = 1000 - (now - AddResourceAction._lastGuiCallTime);

		// Scenario A: First call or enough time has passed -> Update immediately!
		if(remaining <= 0 && !window.isLoadingBSP) {
			if(AddResourceAction._guiThrottleTimeout) {
				clearTimeout(AddResourceAction._guiThrottleTimeout);
				AddResourceAction._guiThrottleTimeout = null;
			}
			AddResourceAction._lastGuiCallTime = now;
			AddResourceAction.updateGUI();
		}
		// Scenario B: Called too quickly -> Queue up a guaranteed trailing edge update
		else if(!AddResourceAction._guiThrottleTimeout && !window.isLoadingBSP) {
			AddResourceAction._guiThrottleTimeout = setTimeout(function () {
				AddResourceAction._lastGuiCallTime = performance.now();
				AddResourceAction._guiThrottleTimeout = null;
				AddResourceAction.updateGUI();
			}, remaining);
		}
	}
}

export { AddResourceAction };
