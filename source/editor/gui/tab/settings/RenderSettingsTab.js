import { Locale } from "../../../locale/LocaleManager.js";
import { RendererConfigurationFormSnippet } from "../../form-snippet/RendererConfigurationFormSnippet.js";
import { Global } from "../../../Global.js";
import { Editor } from "../../../Editor.js";
import { TabComponent } from "../../../components/tabs/TabComponent.js";
import { TableForm } from "../../../components/TableForm.js";
import { CheckBox } from "../../../components/input/CheckBox.js";
import { Slider } from "../../../components/input/Slider.js";

class RenderSettingsTab extends TabComponent {
	constructor(parent, closeable, container, index) {
		super(parent, closeable, container, index, Locale.render, Global.FILE_PATH + "icons/misc/particles.png");

		this.element.style.overflow = "auto";

		var self = this;

		this.form = new TableForm(this);
		this.form.setAutoSize(false);
		this.form.defaultTextWidth = 125;

		// Renderer settings
		this.form.addText("Renderer Quality");
		this.form.nextRow();

		// Use project settings
		this.form.addText("Follow project").setAltText("If checked the project rendering settings will be used, its better to preview the final result.");
		this.followProject = new CheckBox(this.form);
		this.followProject.size.set(18, 18);
		this.followProject.setOnChange(function () {
			Editor.settings.render.followProject = self.followProject.getValue();
		});
		this.form.add(this.followProject);
		this.form.nextRow();


		this.form.addText("Show FPS graph").setAltText("If checked a performance graph showing frames per second will be rendered on the corner of the editor view.");
		this.showFpsGraph = new CheckBox(this.form);
		this.showFpsGraph.size.set(18, 18);
		this.showFpsGraph.setOnChange(function () {
			Editor.settings.render.showFpsGraph = self.showFpsGraph.getValue();
		});
		this.form.add(this.showFpsGraph);
		this.form.nextRow();


		// Maximum FPS rate
		this.form.addText("Maximum FPS rate");
		this.maxFpsRate = new Slider(this.form);
		this.maxFpsRate.size.set(120, 18);
		this.maxFpsRate.setRange(1, 240);
		this.maxFpsRate.setStep(1.0);
		if(Editor.settings.render.maxFpsRate === undefined || isNaN(Editor.settings.render.maxFpsRate)) {
			Editor.settings.render.maxFpsRate = 59.0;
		}
		this.maxFpsRate.setValue(Editor.settings.render.maxFpsRate);
		this.maxFpsRate.setOnChange(function () {
			Editor.settings.render.maxFpsRate = self.maxFpsRate.getValue();
		});
		this.form.add(this.maxFpsRate);
		this.form.nextRow();

		// Space
		this.form.addText("");
		this.form.nextRow();

		// Editor rendering quality
		this.form.addText("Editor Rendering Quality");
		this.form.nextRow();
		this.rendererConfiguration = new RendererConfigurationFormSnippet(this.form, Editor.settings.render);
	}

	activate() {
		this.followProject.setValue(Editor.settings.render.followProject);
		this.showFpsGraph.setValue(Editor.settings.render.showFpsGraph);
		this.maxFpsRate.setValue(Editor.settings.render.maxFpsRate);
		this.rendererConfiguration.attach(Editor.settings.render);
	}

	updateSize() {
		super.updateSize();

		this.form.size.copy(this.size);
		this.form.updateInterface();
	}

}
export { RenderSettingsTab };
