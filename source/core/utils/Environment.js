
/**
 * Check if app is running inside NWJS.
 *
 * @method runningOnDesktop
 * @return {boolean} True if running inside NWJS
 */
export function runningOnDesktop()
{
	return window.nw !== undefined;
};


/**
 * Check if there is some element on fullscreen mode.
 *
 * Returns true even the fullscreen element is not related with the app.
 *
 * @method isFullscreen
 * @return {boolean} True if there is some element in fullscreen mode.
 */
export function isFullscreen()
{
	return document.webkitIsFullScreen === true || document.mozFullScreen === true || document.webkitIsFullScreen === true || document.webkitIsFullScreen === true || document.fullscreen === true || false;
};

