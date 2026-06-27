
/**
 * Check if app is running inside NWJS.
 *
 * @method runningOnDesktop
 * @return {boolean} True if running inside NWJS
 */
export function runningOnDesktop() {
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
export function isFullscreen() {
    return document.webkitIsFullScreen === true || document.mozFullScreen === true || document.webkitIsFullScreen === true || document.webkitIsFullScreen === true || document.fullscreen === true || false;
};


/**
 * Create a object to access the context of this script.
 *
 * Also includes the access to three cannon and engine methods.
 *
 * @method createContextObject
 * @return {Object} Context object for the script to access data.
 */
export function createContextObject(scriptObject) {
    var context = {};

    Object.assign(context, CANNON);
    Object.assign(context, THREE);
    Object.assign(context, NUNU);

    var mathProps = ["E", "LN2", "LN10", "LOG2E", "LOG10E", "PI", "SQRT1_2", "SQRT2", "abs", "acos", "acosh", "asin", "asinh", "atan", "atan2", "atanh", "cbrt", "ceil", "clz32", "cos", "cosh", "exp", "expm1", "floor", "fround", "hypot", "imul", "log", "log1p", "log2", "log10", "max", "min", "pow", "random", "round", "sign", "sin", "sinh", "sqrt", "tan", "tanh", "trunc"];
    var math = {};
    for (var i of mathProps) {
        math[i] = window.Math[i];
    }
    Object.assign(math, THREE.MathUtils);

    Object.assign(context,
        {
            self: scriptObject,
            program: scriptObject.program,
            scene: scriptObject.scene,
            THREE: THREE,
            CANNON: CANNON,
            Math: math,
            Keyboard: scriptObject.program.keyboard,
            Mouse: scriptObject.program.mouse
        });

    return context;
}
