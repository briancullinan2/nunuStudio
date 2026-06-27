/**
 * The full GUI of the application.
 *
 * All objects are GUI objects are initialized in this object.
 *
 * @class Interface
 */
class Interface
{
	constructor()
	{
		this.loading = this.initialize()
	}

	async initialize()
	{
		const { TabContainer } = await import("../components/tabs/splittable/TabContainer.js");
		const { DocumentBody } = await import("../components/DocumentBody.js");
		const { TabGroupSplit } = await import("../components/tabs/splittable/TabGroupSplit.js");
		const { TabGroup } = await import("../components/tabs/TabGroup.js");
		const { AssetExplorer } = await import("./tab/asset/AssetExplorer.js");
		const { ConsoleTab } = await import("./tab/console/ConsoleTab.js");
		const { AnimationTab } = await import("./tab/animation/AnimationTab.js");
		const { ProfilingTab } = await import("./tab/profiling/ProfilingTab.js");
		const { TreeView } = await import("./tab/tree-view/TreeView.js");
		const { InspectorContainer } = await import("./tab/inspector/InspectorContainer.js");
		const { MainMenu } = await import("./MainMenu.js");

		/**
		 * Main tab container that has all the interface tabs.
		 *
		 * @attribute tab
		 * @type {TabContainer}
		 */
		this.tab = new TabContainer(DocumentBody);
		this.tab.attach(new TabGroupSplit());

		var main = this.tab.split(TabGroup.RIGHT).parent;
		main.tabPosition = 0.7;

		var left = main.elementA.split(TabGroup.BOTTOM).parent;
		left.tabPosition = 0.7;
		var leftBottom = left.elementB;

		var right = main.elementB.split(TabGroup.BOTTOM).parent;
		var rightTop = right.elementA;
		var rightBottom = right.elementB;

		this.assetExplorer = await leftBottom.addTab(AssetExplorer, false);

		this.console = await leftBottom.addTab(ConsoleTab, false);

		this.animation = await leftBottom.addTab(AnimationTab, false);

		if(DEVELOPMENT)
		{
			await leftBottom.addTab(ProfilingTab, false);
		}

		this.tree = await rightTop.addTab(TreeView, false);

		this.inspector = await rightBottom.addTab(InspectorContainer, false);

		this.menuBar = new MainMenu(DocumentBody);
		await this.menuBar.loading
	}

	/**
	 * Save program into file.
	 *
	 * Dpending on the plaftorm created the required GUI elements to select save file.
	 *
	 * @method saveProgram
	 */
	async saveProgram()
	{
		const { Nunu } = await import("../../core/Nunu.js");
		const { FileSystem } = await import("../../core/FileSystem.js");
		const { Editor } = await import("../Editor.js");

		if(Nunu.runningOnDesktop())
		{
			FileSystem.chooseFile(function (files)
			{
				Editor.saveProgram(files[0].path, true);
			}, ".nsp", true);
		}
		else
		{
			FileSystem.chooseFileName(function (fname)
			{
				Editor.saveProgram(fname, true);
			}, ".nsp", Editor.openFile !== null ? Editor.openFile : "file");
		}
	}

	/**
	 * Load new project from file.
	 *
	 * Creates the necessary GUI elements to select the file.
	 *
	 * @method loadProgram
	 */
	async loadProgram()
	{
		const { Editor } = await import("../Editor.js");
		const { Locale } = await import("../locale/LocaleManager.js");
		const { FileSystem } = await import("../../core/FileSystem.js");

		if(Editor.confirm(Locale.changesWillBeLost + " " + Locale.loadProject))
		{
			FileSystem.chooseFile(function (files)
			{
				if(files.length > 0)
				{
					Editor.loadProgram(files[0], files[0].name.endsWith(".nsp"));
				}
			}, ".isp, .nsp");
		}
	}

	/**
	 * Create new program.
	 *
	 * @method newProgram
	 */
	async newProgram()
	{
		const { Editor } = await import("../Editor.js");
		const { Locale } = await import("../locale/LocaleManager.js");

		if(Editor.confirm(Locale.changesWillBeLost + " " + Locale.createProject))
		{
			Editor.createNewProgram();
		}
	}

	updateInterface()
	{
		var width = window.innerWidth;
		var height = window.innerHeight;

		this.tab.position.set(0, this.menuBar.size.y);
		this.tab.size.set(width, height - this.menuBar.size.y);
		this.tab.updateInterface();
	}

}

export { Interface };
