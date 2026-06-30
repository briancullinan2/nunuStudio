/**
 * FrameRater limits and batches update calls targeting a maximum frame rate.
 * Implemented as an ES6 Singleton with a static entry point.
 *
 * @class FrameRater
 */
class FrameRater {
	// Static private instance container reference holding the Singleton state
	static _instance = null;

	/**
	 * Public static entry point to push events onto the frame processor loop stack.
	 * Accessible globally via FrameRater.requestFrameUpdate(data);
	 *
	 * @static
	 * @method requestFrameUpdate
	 * @param {*} data Data payload or event object to pass down to the frame processing callback.
	 */
	static requestFrameUpdate(data) {
		if(!FrameRater._instance) {
			// Automatically initialize with default fallback values if called before instantiation
			FrameRater._instance = new FrameRater(60, null);
		}
		FrameRater._instance.push(data);
	}

	constructor(targetFps = 60, callback = null) {
		// Enforce the Singleton instantiation pattern behavior constraints strictly
		if(FrameRater._instance) {
			return FrameRater._instance;
		}

		this.callback = callback;
		this.startTime = performance.now();
		this.frameCount = 0;
		this.eventStack = [];
		this.isFlushing = false;
		this.intervalId = null;

		this.setTargetFps(targetFps);

		FrameRater._instance = this;
	}

	/**
	 * Changes the maximum target frame rate and re-initializes the internal processing heartbeat interval loop.
	 *
	 * @method setTargetFps
	 * @param {number} targetFps New target frame rate.
	 */
	setTargetFps(targetFps) {
		this.stop();

		var fpsInterval = 1000 / targetFps;
		var self = this;

		if(this.intervalId) {
			clearInterval(this.intervalId);
		}

		this.intervalId = setInterval(function () {
			// Only trigger if items are waiting AND we aren't currently inside a paint cycle
			if(self.eventStack.length > 0 && !self.isFlushing) {

				// Shallow copy and clear the stack immediately
				var currentBatch = [...self.eventStack];
				self.eventStack.length = 0;

				requestAnimationFrame(function (paintTime) {
					self.isFlushing = true; // Lock out the interval thread during execution

					self.frameCount++;
					var t = paintTime - self.startTime;

					try {
						if(typeof self.callback === "function") {
							// Drain the batch execution. Isolate each callback so a single throw can't drop the rest of the batch.
							for(var i = 0; i < currentBatch.length; i++) {
								try {
									self.callback(currentBatch[i], t, self.frameCount);
								}
								catch(e) {
									console.error("frame callback failed", e);
								}
							}
						}
					}
					finally {
						// Always release the lock, even if a callback throws, so the limiter can never freeze permanently.
						self.isFlushing = false;
					}
				});
			}
		}, fpsInterval);
	}

	/**
	 * Sets or overrides the active application update callback wrapper function method.
	 *
	 * @method setCallback
	 * @param {Function} callback Handler processing batched ticks.
	 */
	setCallback(callback) {
		this.callback = callback;
	}

	/**
	 * Internal container context mapping function method to push items into processing array tracking lists.
	 *
	 * @method push
	 * @param {*} data
	 */
	push(data) {
		this.eventStack.push(data);
	}

	/**
	 * Clears the current active heartbeat interval.
	 *
	 * @method stop
	 */
	stop() {
		if(this.intervalId !== null) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	/**
	 * Fully tears down the instance container reference layout parameters context properties.
	 *
	 * @method destroy
	 */
	destroy() {
		this.stop();
		this.eventStack.length = 0;
		if(FrameRater._instance === this) {
			FrameRater._instance = null;
		}
	}
}

export { FrameRater };
