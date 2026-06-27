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
class AddResourceAction extends Action
{
	constructor(resource, manager, category)
	{
		super();

		this.resource = resource;
		this.manager = manager;
		this.category = category;
	}

	apply()
	{
		ResourceCrawler.addResource(this.manager, this.resource, this.category);

		AddResourceAction.updateGUI();
	}

	async revert()
	{
		const { RemoveResourceAction } = await import("./RemoveResourceAction.js");

		ResourceCrawler.removeResource(this.manager, this.resource, this.category);

		if(this.resource.dispose !== undefined)
		{
			this.resource.dispose();
		}

		RemoveResourceAction.updateGUI();
	}

}

AddResourceAction.updateGUI = function ()
{
	Editor.updateObjectsViewsGUI();
};
export { AddResourceAction };
