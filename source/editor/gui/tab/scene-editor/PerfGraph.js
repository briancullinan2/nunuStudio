import { CanvasTexture, SpriteMaterial, Sprite, OrthographicCamera, Scene } from "three";

/**
 * Independent lightweight performance tracking utility.
 * Renders directly inside the active WebGL context with no DOM insertions.
 *
 * @class PerformanceGraph
 */
class PerformanceGraph {
	constructor(sceneParent) {
		this.scene = sceneParent;
		this.canvas = sceneParent.canvas;
		this.maxFps = sceneParent.maxFps || 60;
		this.frameHistory = new Array(80).fill(0);
		this.lastFrameTime = performance.now();

		// 1. Create a larger, clear canvas layout in memory
		this.offscreenCanvas = document.createElement("canvas");
		this.offscreenCanvas.width = 128;
		this.offscreenCanvas.height = 128;
		this.ctx = this.offscreenCanvas.getContext("2d");

		// 2. Set up a Three.js texture fed directly by the off-screen canvas data
		this.texture = new CanvasTexture(this.offscreenCanvas);

		// 3. Create a clean overlay scene and an adaptive HUD camera
		this.hudScene = new Scene();
		this.hudCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

		// 4. Create a flat sprite anchored in 3D space
		var material = new SpriteMaterial({ map: this.texture, depthTest: false, depthWrite: false });
		this.sprite = new Sprite(material);

		// Match the base dimensions of the 256x128 panel texture
		this.sprite.scale.set(128, 128, 1);
		this.hudScene.add(this.sprite);
	}

	setCanvas(canvas, maxFps) {
		this.canvas = canvas;
		this.maxFps = maxFps;
	}

	/**
	 * Calculates data deltas and uploads the updated pixel matrix to the GPU.
	 *
	 * @method render
	 * @param {WebGLRenderer} renderer The active engine rendering context.
	 */
	render(renderer) {
		var currentTime = performance.now();
		var delta = currentTime - this.lastFrameTime;
		this.lastFrameTime = currentTime;

		var currentFps = Math.min(Math.round(1000 / delta), 999);

		this.frameHistory.shift();
		this.frameHistory.push(currentFps);

		// Clear and draw background design onto off-screen canvas space
		this.ctx.fillStyle = "rgba(26, 26, 26, 0.85)";
		this.ctx.fillRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);

		// Draw crisp HUD text layout info (doubled font size for absolute clarity)
		this.ctx.fillStyle = "#00ff88";
		this.ctx.font = "bold 22px monospace";
		this.ctx.fillText(currentFps + " FPS", 12, 32);

		// Draw line chart performance map tracking coordinates
		this.ctx.strokeStyle = "#00ff88";
		this.ctx.lineWidth = 2.5;
		this.ctx.beginPath();

		for(var i = 0; i < this.frameHistory.length; i++) {
			var val = this.frameHistory[i];
			var heightPercentage = Math.min(val / this.maxFps, 1.0);

			// Map line drawing cleanly beneath the text block space boundaries
			var y = this.offscreenCanvas.height - (heightPercentage * (this.offscreenCanvas.height - 48)) - 4;
			var x = (i / (this.frameHistory.length - 1)) * this.offscreenCanvas.width;

			if(i === 0) {
				this.ctx.moveTo(x, y);
			} else {
				this.ctx.lineTo(x, y);
			}
		}
		this.ctx.stroke();

		// Tell Three.js to re-upload the canvas buffer pixels directly to the GPU
		this.texture.needsUpdate = true;

		var width = this.scene.canvas.resolution.x;
		var height = this.scene.canvas.resolution.y;
		renderer.setViewport(0, 0, width, height);
		renderer.setScissor(0, 0, width, height);

		if(width && height) {
			// Update the orthographic projection matrix to work in true 1:1 pixel coordinates
			this.hudCamera.left = 0;
			this.hudCamera.right = width;
			this.hudCamera.top = height;
			this.hudCamera.bottom = 0;
			this.hudCamera.updateProjectionMatrix();

			// Set the absolute pixel placement: Bottom-Left corner with 15px margin padding
			var padding = 15;
			var posX = padding + (this.sprite.scale.x / 2);
			var posY = padding + (this.sprite.scale.y / 2);
			this.sprite.position.set(posX, posY, 0);
		}

		// Draw it over the viewport using the layout renderer
		renderer.clear(false, true, false); // Clear depth buffer so it displays on top
		renderer.render(this.hudScene, this.hudCamera);
	}
}

export { PerformanceGraph };
