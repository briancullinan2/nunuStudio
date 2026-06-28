<img src="https://raw.githubusercontent.com/tentone/nunuStudio/master/source/page/src/assets/github/logo.png">

[![GitHub version](https://badge.fury.io/gh/tentone%2FnunuStudio.svg)](https://badge.fury.io/gh/tentone%2FnunuStudio)[![npm version](https://badge.fury.io/js/nunu-studio.svg)](https://badge.fury.io/js/nunu-studio)[![GitHub issues](https://img.shields.io/github/issues/tentone/nunuStudio.svg)](https://github.com/tentone/nunuStudio/issues) [![GitHub stars](https://img.shields.io/github/stars/tentone/nunuStudio.svg)](https://github.com/tentone/nunuStudio/stargazers)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Ftentone%2FnunuStudio.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Ftentone%2FnunuStudio?ref=badge_shield)


- nunuStudio is an open source  game engine for the web it allows designers and web developers to easily develop 3D experiences for the web.
- Powered by [three.js](https://github.com/mrdoob/three.js) can run directly in the web or be exported as desktop application trough [nwjs.io](https://nwjs.io).
- Fully featured visual editor, supports a wide range of file formats, the tools are open source and completely free to use for both personal and commercial usage.
- Visual scene editor, code editor, visual tools to edit textures, materials, particle emitters and a powerful scripting API that allows the creation of complex applications using [JavaScript](https://www.javascript.com/) or [Python](https://www.python.org/).
- Fully featured [web version](https://www.nunustudio.org/build/editor/index.html) of the editor is available on the project page.
- The web version is tested with [Firefox](https://www.mozilla.org/en-US/firefox/new/), [Chrome](https://www.google.com/chrome/) and [Microsoft Edge](https://www.microsoft.com/en-us/edge), mobile browsers are supported as well.

<img src="https://raw.githubusercontent.com/tentone/nunuStudio/master/source/page/src/assets/github/web.png">

- [API Documentation](https://nunustudio.org/docs) with full details about the inner working of every module are available. These can also be generated from the project source code by running `npm run docs`.
- Basic tutorials are available on the [project page](https://www.nunustudio.org/learn). The basic tutorials explain step-by-step how to use the editor.
- To build the project first install [Node.js LTS](https://nodejs.org/en/) and NPM:
  - The building system generates minified builds for the runtime and for the editor
  - Documentation generation uses [YuiDocs](https://yui.github.io/yuidoc/)
  - Install dependencies from npm by running `npm install --legacy-peer-deps`
  - Build  editor, runtime and documentation, run `npm run build`
- Webpage of the project is built using [Angular](https://angular.io/) and is hosted on [GitHub Pages](https://pages.github.com/)


## Added by Brian (Me)


### TODO:
* DONE: Offline capable.
* DONE: Maximum frame rate limiter with a setting.
* DONE: Default maximum camera distance, and a setting.
* DONE: Improving the mouse menu hover, I found it sometimes disappears too quickly.
* DONE: Fixing the texture on the "Move Gripper"/TransformGizmoTranslate to be two sided.
* DONE: Throttling UI updates when loading large models into the scene and the project explorer.
* DONE: Remove the use of canvas.size to prevent layout recalculations when adding elements even though the window size hasn't changed. This causes speed problems when loading a model with thousands of vertices, like an entire Quake 3 map.

---

* TODO: Offline mode setting.
* TODO: Add keyboard -> racetrace -> angle -> move with arrow keys.
* TODO: Change the ray tracer to be based on the active canvas orientation instead of the window.
* TODO: Expose the loadObject() function externally to load external assets that users can double-click to add or clone to the scene.
* TODO: Most excitingly, I'm attaching my Objaverse-XL pipeline to the asset search bar, allowing anyone to add any object they search for out of 9 million models streamed from GitHub and Sketchfab!
* TODO: Add mobile/responsive support.




### Fixing async call chain
FileSytem.loadFile + variants
App.loadProgram
Script.compileCode will not work in SCP mode, needs my Void Zero interpreter
new Audio()
new Font() the thing that started this all because of Offline Mode
new Image
Image.toJSON
Resource.export
new Video
Editor.initialize
Editor.loadProgram
Editor.updateNunu
Loaders.loadSpineAnimation
Loaders.loadModel
ProjectExporters.exportWebProjectZip
Settings.load
Editor.runProject
Editor.addObject
Editor.addObjects
Editor.renameObject
Editor.deleteObject
Editor.copyObject
Editor.cutObject
Editor.pasteObject
Editor.redo
Editor.undo
Editor.createDefaultResouces
Editor.createNewProgram
Editor.saveProgramPath
Editor.saveProgram
Editor.setProgram
Editor.loadProgram
new SceneEditor
extends TabComponent
new TabComponent
SceneEditor.updateCameraControls
SceneEditor.updateSettings
SceneEditor.focusObject
SceneEditor.update
SceneEditor.createMeasurement
SceneEditor.render
SceneEditor.selectObjectWithMouse
SceneEditor.setCameraMode
SceneEditor.selectTool
SceneEditor.updateSelection
new Interface
extends Interface
Interface.saveProgram
Interface.loadProgram
Interface.newProgram

ParticleEmitter.reload
TransformGizmo.updatePose
AddResourcesAction.revert
TransformControls.setMode
TransformGizmoRotate.transformObject


projectMenu.addOption(Locale.executeScript callback inside MainMenu FileSystem.chooseFile(async and FileSystem.chooseFile does NOT need async because fire and forget onLoad callback will still allow access to the chooser

text.addOption(Global.FILE_PATH + "icons/text/text.png", async function ()
has a call to the font loader in SideBar.addOption (to be determined)


ResourceManager.addResource
ResourceManager.removeImage
ResourceManager.removeVideo
ResourceManager.removeTexture
ResourceManager.addFont
ResourceManager.addAudio
ResourceManager.removeAudio
Program.receiveDataApp
Program.clone


TabGroup.addTab
TabGroup, this.buttons.element.ondrop


\b(?:extends\s+(?:Object|TabComponent|Interface|Audio|Video|SceneEditor|TransformControls|TransformGizmoRotate)|new\s+(?:Audio|Font|Image|Video|SceneEditor|TabComponent|Interface|TransformControls|TransformGizmoRotate)|(?:loadFile|loadProgram|compileCode|toJSON|\.export|initialize|updateNunu|loadSpineAnimation|loadModel|exportWebProjectZip|load|runProject|addObject|addObjects|renameObject|deleteObject|copyObject|cutObject|pasteObject|redo|undo|createDefaultResouces|createNewProgram|saveProgramPath|saveProgram|setProgram|updateCameraControls|updateSettings|focusObject|update|createMeasurement|render|selectObjectWithMouse|setCameraMode|selectTool|updateSelection|newProgram|addOption|chooseFile|addResource|removeImage|removeVideo|removeTexture|addFont|addAudio|removeAudio|receiveDataApp|clone|reload|addTab|updatePose|revert|setMode|transformObject))\b


This awesome auto package upgrader and a couple of automated tests/*.
### UPGRADE PIPELINE STATUS REPORT

| (index) | name | outcome | version |
| --- | --- | --- | --- |
| 0 | '@as-com/pson' | 'HELD (FALLBACK)' | '3.0.1' |
| 1 | '@esotericsoftware/spine-core' | 'UPGRADED' | 'latest' |
| 2 | '@esotericsoftware/spine-threejs' | 'UPGRADED' | 'latest' |
| 3 | '@tweenjs/tween.js' | 'UPGRADED' | 'latest' |
| 4 | 'brython' | 'UPGRADED' | 'latest' |
| 5 | 'cannon-es' | 'UPGRADED' | 'latest' |
| 6 | 'codemirror' | 'UPGRADED' | '6.65.7' |
| 7 | 'draco3d' | 'UPGRADED' | 'latest' |
| 8 | 'draco3dgltf' | 'UPGRADED' | 'latest' |
| 9 | 'escher.js' | 'UPGRADED' | 'latest' |
| 10 | 'glsl-editor' | 'HELD (FALLBACK)' | '1.0.0' |
| 11 | 'iterator-result' | 'HELD (FALLBACK)' | '1.0.0' |
| 12 | 'jshint' | 'UPGRADED' | 'latest' |
| 13 | 'jszip' | 'UPGRADED' | 'latest' |
| 14 | 'math-ds' | 'HELD (FALLBACK)' | '1.2.1' |
| 15 | 'sparse-octree' | 'UPGRADED' | 'latest' |
| 16 | 'tern' | 'HELD (FALLBACK)' | '0.24.3' |
| 17 | 'three' | 'HELD (FALLBACK)' | '^0.119.1' |
| 18 | 'three-bmfont-text' | 'HELD (FALLBACK)' | '3.0.1' |
| 19 | 'three-to-cannon' | 'UPGRADED' | 'latest' |
| 20 | 'troika-three-text' | 'UPGRADED' | 'latest' |
| 21 | '@babel/core' | 'UPGRADED' | 'latest' |
| 22 | '@babel/plugin-transform-classes' | 'UPGRADED' | 'latest' |
| 23 | '@babel/preset-env' | 'UPGRADED' | 'latest' |
| 24 | '@babel/runtime' | 'HELD (FALLBACK)' | '^7.29.7' |
| 25 | '@shoutem/webpack-prepend-append' | 'HELD (FALLBACK)' | '1.0.1' |
| 26 | '@types/node' | 'UPGRADED' | 'latest' |
| 27 | '@types/webpack' | 'UPGRADED' | 'latest' |
| 28 | 'acorn' | 'UPGRADED' | 'latest' |
| 29 | 'ajv' | 'UPGRADED' | 'latest' |
| 30 | 'babel-loader' | 'UPGRADED' | 'latest' |
| 31 | 'babel-polyfill' | 'HELD (FALLBACK)' | '6.26.0' |
| 32 | 'copy-webpack-plugin' | 'UPGRADED' | 'latest' |
| 33 | 'cordova' | 'UPGRADED' | 'latest' |
| 34 | 'css-loader' | 'UPGRADED' | 'latest' |
| 35 | 'eslint' | 'UPGRADED' | 'latest' |
| 36 | 'eslint-plugin-import' | 'UPGRADED' | 'latest' |
| 37 | 'eslint-plugin-jsdoc' | 'UPGRADED' | 'latest' |
| 38 | 'git-revision-webpack-plugin' | 'HELD (FALLBACK)' | '5.0.0' |
| 39 | 'html-webpack-plugin' | 'UPGRADED' | 'latest' |
| 40 | 'http-server' | 'HELD (FALLBACK)' | '14.1.1' |
| 41 | 'jsdoc' | 'UPGRADED' | 'latest' |
| 42 | 'nwjs-builder-phoenix' | 'HELD (FALLBACK)' | '1.15.0' |
| 43 | 'puppeteer' | 'HELD (FALLBACK)' | '25.2.1' |
| 44 | 'raw-loader' | 'HELD (FALLBACK)' | '4.0.2' |
| 45 | 'style-loader' | 'UPGRADED' | 'latest' |
| 46 | 'uglifyjs-webpack-plugin' | 'HELD (FALLBACK)' | '2.2.0' |
| 47 | 'vitest' | 'HELD (FALLBACK)' | '4.1.9' |
| 48 | 'webpack' | 'UPGRADED' | 'latest' |
| 49 | 'webpack-cleanup-plugin' | 'HELD (FALLBACK)' | '0.5.1' |
| 50 | 'webpack-cli' | 'UPGRADED' | 'latest' |
| 51 | 'webpack-dev-server' | 'UPGRADED' | 'latest' |
| 52 | 'webpack-merge' | 'UPGRADED' | 'latest' |
| 53 | 'webpack-merge-and-include-globally' | 'HELD (FALLBACK)' | '2.3.4' |
| 54 | 'webpack-node-externals' | 'HELD (FALLBACK)' | '3.0.0' |
| 55 | 'yuidocjs' | 'HELD (FALLBACK)' | '0.10.2' |



## Screenshots

<img src="https://raw.githubusercontent.com/tentone/nunuStudio/master/source/page/src/assets/github/2.png"><img src="https://raw.githubusercontent.com/tentone/nunuStudio/master/source/page/src/assets/github/3.png">
<img src="https://raw.githubusercontent.com/tentone/nunuStudio/master/source/page/src/assets/github/4.png"><img src="https://raw.githubusercontent.com/tentone/nunuStudio/master/source/page/src/assets/github/1.png">
<img src="https://raw.githubusercontent.com/tentone/nunuStudio/master/source/page/src/assets/github/5.png"><img src="https://raw.githubusercontent.com/tentone/nunuStudio/master/source/page/src/assets/github/6.png">



## Features

- Visual application editor
  - Drag and drop files directly into the project (images, video, models, ...)
  - Manage project resources.
  - Edit material, textures, shaders, code, ...
- Built on [three.js](https://threejs.org/) library w/ physics by [cannon.js](https://schteppe.github.io/cannon.js/)
  - Real time lighting and shadow map support
  - three.js libraries can be imported into the editor
  - Wide range of file formats supported (gltf, dae, obj, fbx, 3ds, ...)
- [NW.js](https://nwjs.io/) and [Cordova](https://cordova.apache.org/) exports for desktop and mobile deployment
- Compatible with [WebXR](https://www.w3.org/TR/webxr/) for Virtual Reality and Augmented Reality

## Build
The project uses [Webpack](https://webpack.js.org/) to build and bundle its code base.
  - The building system generates minified builds for the runtime and for the editor
  - JavaScript is optimized and minified using [Uglify](https://www.npmjs.com/package/uglify-js)
  - Documentation generation uses [YuiDocs](https://yui.github.io/yuidoc/)

Steps needed to build the project:
1. To build the project first install [Java](https://www.oracle.com/java/technologies/javase-jdk8-downloads.html), [Node.js](https://nodejs.org/en/) and NPM and ensure that java command is working properly.
2. Install dependencies from npm by running `npm install`.
    1. If running on Node >=16 run `npm install --legacy-peer-deps` instead
3. Install the dependencies for the project webpage running `cd source/page && npm install`
4. Building/running
    1. Building: to build editor, runtime and documentation, run `npm run build`
    2. Running: To start the editor locally for development and testing run `npm run start`

## Embedding Application

- Application developed with can be embedded into already existing web pages, and are compatible with frameworks like [Angular](https://angular.io/) or [React](https://reactjs.org/).
- To embed applications in HTML pages the following code can be used, the application is bootstrapped using the `loadApp(file, id)` method.

```html
<html>
    <head>
        <script src="nunu.min.js"></script>
    </head>
    <body onload="Nunu.App.loadApp('pong.nsp', 'canvas')">
        <canvas width="800" height="480" id="canvas"></canvas>
    </body>
</html>
```

## Vue.js with Nuxtjs

 - Build `nunu.min.js` and place into `static/js` folder of your nuxt instance
 - Place canvas element into your `template` area where you want it, for example:
```vue
<template>
  <div>
    <canvas
      id="canvas"
      width="800"
      height="480"
    />
</div>
</template>
```
 - Add the script to your head function of the page you want the 3D integration on (or place is into your global head)
```js
head() {
return {
      script: [
        {
          hid: 'Nunu',
          src: 'assets/js/nunu.min.js',
          defer: true,
          callback: () => {
            Nunu.App.loadApp('assets/file.nsp', 'canvas') //add file to load in here
          },
        },
      ],
    },
  }
```

 - You are now able to address `Nunu` as usual within the app.


## License

- The project is distributed under a MIT license that allow for commercial usage of the platform without any cost.
- The license is available on the project GitHub page

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Ftentone%2FnunuStudio.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Ftentone%2FnunuStudio?ref=badge_large)
