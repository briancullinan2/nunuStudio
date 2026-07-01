import {
	FileLoader,
	TextureLoader,
	RepeatWrapping,
	ClampToEdgeWrapping,
	MathUtils
} from 'three';

/**
 * Shader Tokenizer
 */
class ShaderTokenizer {
	constructor(src) {
		// Strip out comments
		src = src.replace(/\/\/.*$/mg, '');
		src = src.replace(/\/\*[^*\/]*\*\//mg, '');
		this.tokens = src.match(/[^\s\n\r\"]+/mg);
		this.offset = 0;
	}

	EOF() {
		if(this.tokens === null) { return true; }
		let token = this.tokens[this.offset];
		while(token === '' && this.offset < this.tokens.length) {
			this.offset++;
			token = this.tokens[this.offset];
		}
		return this.offset >= this.tokens.length;
	}

	next() {
		if(this.tokens === null) { return; }
		let token = '';
		while(token === '' && this.offset < this.tokens.length) {
			token = this.tokens[this.offset++];
		}
		return token;
	}

	prev() {
		if(this.tokens === null) { return; }
		let token = '';
		while(token === '' && this.offset >= 0) {
			token = this.tokens[this.offset--];
		}
		return token;
	}
}

/**
 * Q3ShaderLoader
 * Parses Quake 3 shader files (.shader) and outputs definitions maps
 * compatible with Three.js material workflows.
 */
export class Q3ShaderLoader {
	constructor(manager) {
		this.manager = manager;
		this.fileLoader = new FileLoader(this.manager);
		this.textureLoader = new TextureLoader(this.manager);
		this.baseUrl = '';
	}

	setBaseUrl(url) {
		this.baseUrl = url;
		return this;
	}

	load(url, onLoad, onProgress, onError) {
		this.fileLoader.load(url, (text) => {
			const shaders = this.parse(url, text);
			if(onLoad) onLoad(shaders);
		}, onProgress, onError);
	}

	parse(url, src) {
		const shaders = [];
		const tokens = new ShaderTokenizer(src);

		while(!tokens.EOF()) {
			const name = tokens.next();
			if(!name) continue;
			const shader = this.parseShader(name, tokens);
			if(shader) {
				shader.url = url;
				if(shader.stages) {
					for(let i = 0; i < shader.stages.length; ++i) {
						shader.stages[i].shaderSrc = this.buildShaderSource(shader, shader.stages[i]);
					}
				}
				shaders.push(shader);
			}
		}

		return shaders;
	}

	parseShader(name, tokens) {
		const brace = tokens.next();
		if(brace !== '{') {
			return null;
		}

		const shader = {
			name: name,
			cull: 'back',
			sky: false,
			blend: false,
			opaque: false,
			sort: 0,
			vertexDeforms: [],
			stages: []
		};

		while(!tokens.EOF()) {
			let token = tokens.next().toLowerCase();
			if(token === '}') { break; }

			switch(token) {
				case '{': {
					const stage = this.parseStage(tokens);

					if(stage.isLightmap && (stage.hasBlendFunc)) {
						stage.blendSrc = 'GL_DST_COLOR';
						stage.blendDest = 'GL_ZERO';
					}

					if(stage.alphaGen === 'lightingspecular') {
						stage.blendSrc = 'GL_ONE';
						stage.blendDest = 'GL_ZERO';
						stage.hasBlendFunc = false;
						stage.depthWrite = true;
						shader.stages = [];
					}

					if(stage.hasBlendFunc) {
						shader.blend = true;
					} else {
						shader.opaque = true;
					}

					shader.stages.push(stage);
				} break;

				case 'cull':
					shader.cull = tokens.next();
					break;

				case 'deformvertexes': {
					let deform = {
						type: tokens.next().toLowerCase()
					};

					switch(deform.type) {
						case 'wave':
							deform.spread = 1.0 / parseFloat(tokens.next());
							deform.waveform = this.parseWaveform(tokens);
							break;
						default:
							deform = null;
							break;
					}

					if(deform) { shader.vertexDeforms.push(deform); }
				} break;

				case 'sort': {
					const sort = tokens.next().toLowerCase();
					switch(sort) {
						case 'portal': shader.sort = 1; break;
						case 'sky': shader.sort = 2; break;
						case 'opaque': shader.sort = 3; break;
						case 'banner': shader.sort = 6; break;
						case 'underwater': shader.sort = 8; break;
						case 'additive': shader.sort = 9; break;
						case 'nearest': shader.sort = 16; break;
						default: shader.sort = parseInt(sort, 10); break;
					}
				} break;

				case 'surfaceparm': {
					const param = tokens.next().toLowerCase();
					switch(param) {
						case 'sky':
							shader.sky = true;
							break;
						default:
							break;
					}
				} break;

				default:
					break;
			}
		}

		if(!shader.sort) {
			shader.sort = (shader.opaque ? 3 : 9);
		}

		return shader;
	}

	parseStage(tokens) {
		const stage = {
			map: null,
			clamp: false,
			tcGen: 'base',
			rgbGen: 'identity',
			rgbWaveform: null,
			alphaGen: '1.0',
			alphaFunc: null,
			alphaWaveform: null,
			blendSrc: 'GL_ONE',
			blendDest: 'GL_ZERO',
			hasBlendFunc: false,
			tcMods: [],
			animMaps: [],
			animFreq: 0,
			depthFunc: 'lequal',
			depthWrite: true
		};

		while(!tokens.EOF()) {
			const token = tokens.next();
			if(token === '}') { break; }

			switch(token.toLowerCase()) {
				case 'clampmap':
					stage.clamp = true;
				case 'map':
					stage.map = tokens.next().replace(/(\.jpg|\.tga)/, '.png');
					break;

				case 'animmap':
					stage.map = 'anim';
					stage.animFreq = parseFloat(tokens.next());
					let nextMap = tokens.next();
					while(nextMap && nextMap.match(/(\.jpg|\.tga)/)) {
						stage.animMaps.push(nextMap.replace(/(\.jpg|\.tga)/, '.png'));
						nextMap = tokens.next();
					}
					tokens.prev();
					break;

				case 'rgbgen':
					stage.rgbGen = tokens.next().toLowerCase();
					switch(stage.rgbGen) {
						case 'wave':
							stage.rgbWaveform = this.parseWaveform(tokens);
							if(!stage.rgbWaveform) { stage.rgbGen = 'identity'; }
							break;
					}
					break;

				case 'alphagen':
					stage.alphaGen = tokens.next().toLowerCase();
					switch(stage.alphaGen) {
						case 'wave':
							stage.alphaWaveform = this.parseWaveform(tokens);
							if(!stage.alphaWaveform) { stage.alphaGen = '1.0'; }
							break;
						default:
							break;
					}
					break;

				case 'alphafunc':
					stage.alphaFunc = tokens.next().toUpperCase();
					break;

				case 'blendfunc':
					stage.blendSrc = tokens.next();
					stage.hasBlendFunc = true;
					if(!stage.depthWriteOverride) {
						stage.depthWrite = false;
					}
					switch(stage.blendSrc) {
						case 'add':
							stage.blendSrc = 'GL_ONE';
							stage.blendDest = 'GL_ONE';
							break;

						case 'blend':
							stage.blendSrc = 'GL_SRC_ALPHA';
							stage.blendDest = 'GL_ONE_MINUS_SRC_ALPHA';
							break;

						case 'filter':
							stage.blendSrc = 'GL_DST_COLOR';
							stage.blendDest = 'GL_ZERO';
							break;

						default:
							stage.blendDest = tokens.next();
							break;
					}
					break;

				case 'depthfunc':
					stage.depthFunc = tokens.next().toLowerCase();
					break;

				case 'depthwrite':
					stage.depthWrite = true;
					stage.depthWriteOverride = true;
					break;

				case 'tcmod': {
					const tcMod = {
						type: tokens.next().toLowerCase()
					};
					switch(tcMod.type) {
						case 'rotate':
							tcMod.angle = parseFloat(tokens.next()) * (Math.PI / 180);
							break;
						case 'scale':
							tcMod.scaleX = parseFloat(tokens.next());
							tcMod.scaleY = parseFloat(tokens.next());
							break;
						case 'scroll':
							tcMod.sSpeed = parseFloat(tokens.next());
							tcMod.tSpeed = parseFloat(tokens.next());
							break;
						case 'stretch':
							tcMod.waveform = this.parseWaveform(tokens);
							if(!tcMod.waveform) { tcMod.type = null; }
							break;
						case 'turb':
							tcMod.turbulance = {
								base: parseFloat(tokens.next()),
								amp: parseFloat(tokens.next()),
								phase: parseFloat(tokens.next()),
								freq: parseFloat(tokens.next())
							};
							break;
						default:
							tcMod.type = null;
							break;
					}
					if(tcMod.type) {
						stage.tcMods.push(tcMod);
					}
				} break;

				case 'tcgen':
					stage.tcGen = tokens.next();
					break;
				default:
					break;
			}
		}

		if(stage.blendSrc === 'GL_ONE' && stage.blendDest === 'GL_ZERO') {
			stage.hasBlendFunc = false;
			stage.depthWrite = true;
		}

		stage.isLightmap = (stage.map === '$lightmap');

		return stage;
	}

	parseWaveform(tokens) {
		return {
			funcName: tokens.next().toLowerCase(),
			base: parseFloat(tokens.next()),
			amp: parseFloat(tokens.next()),
			phase: parseFloat(tokens.next()),
			freq: parseFloat(tokens.next())
		};
	}

	buildShaderSource(shader, stage) {
		return {
			vertex: this.buildVertexShader(shader, stage),
			fragment: this.buildFragmentShader(shader, stage)
		};
	}

	buildVertexShader(stageShader, stage) {
		const builder = new ShaderBuilder();

		builder.addAttribs({
			position: 'vec3',
			normal: 'vec3',
			color: 'vec4',
		});

		builder.addVaryings({
			vTexCoord: 'vec2',
			vColor: 'vec4',
		});

		builder.addUniforms({
			modelViewMatrix: 'mat4',
			projectionMatrix: 'mat4',
			time: 'float',
		});

		if(stage.isLightmap) {
			builder.addAttribs({ lightCoord: 'vec2' });
		} else {
			builder.addAttribs({ uv: 'vec2' });
		}

		builder.addLines(['vec3 defPosition = position;']);

		for(let i = 0; i < stageShader.vertexDeforms.length; ++i) {
			const deform = stageShader.vertexDeforms[i];

			switch(deform.type) {
				case 'wave': {
					const name = 'deform' + i;
					const offName = 'deformOff' + i;

					builder.addLines([
						'float ' + offName + ' = (position.x + position.y + position.z) * ' + deform.spread.toFixed(4) + ';'
					]);

					const phase = deform.waveform.phase;
					deform.waveform.phase = phase.toFixed(4) + ' + ' + offName;
					builder.addWaveform(name, deform.waveform);
					deform.waveform.phase = phase;

					builder.addLines([
						'defPosition += normal * ' + name + ';'
					]);
				} break;
				default:
					break;
			}
		}

		builder.addLines(['vec4 worldPosition = modelViewMatrix * vec4(defPosition, 1.0);']);
		builder.addLines(['vColor = color;']);

		if(stage.tcGen === 'environment') {
			builder.addLines([
				'vec3 viewer = normalize(-worldPosition.xyz);',
				'float d = dot(normal, viewer);',
				'vec3 reflected = normal * 2.0 * d - viewer;',
				'vTexCoord = vec2(0.5, 0.5) + reflected.xy * 0.5;'
			]);
		} else {
			if(stage.isLightmap) {
				builder.addLines(['vTexCoord = lightCoord;']);
			} else {
				builder.addLines(['vTexCoord = uv;']);
			}
		}

		for(let i = 0; i < stage.tcMods.length; ++i) {
			const tcMod = stage.tcMods[i];
			switch(tcMod.type) {
				case 'rotate':
					builder.addLines([
						'float r = ' + tcMod.angle.toFixed(4) + ' * time;',
						'vTexCoord -= vec2(0.5, 0.5);',
						'vTexCoord = vec2(vTexCoord.s * cos(r) - vTexCoord.t * sin(r), vTexCoord.t * cos(r) + vTexCoord.s * sin(r));',
						'vTexCoord += vec2(0.5, 0.5);',
					]);
					break;
				case 'scroll':
					builder.addLines([
						'vTexCoord += vec2(' + tcMod.sSpeed.toFixed(4) + ' * time, ' + tcMod.tSpeed.toFixed(4) + ' * time);'
					]);
					break;
				case 'scale':
					builder.addLines([
						'vTexCoord *= vec2(' + tcMod.scaleX.toFixed(4) + ', ' + tcMod.scaleY.toFixed(4) + ');'
					]);
					break;
				case 'stretch':
					builder.addWaveform('stretchWave', tcMod.waveform);
					builder.addLines([
						'stretchWave = 1.0 / stretchWave;',
						'vTexCoord *= stretchWave;',
						'vTexCoord += vec2(0.5 - (0.5 * stretchWave), 0.5 - (0.5 * stretchWave));',
					]);
					break;
				case 'turb': {
					const tName = 'turbTime' + i;
					builder.addLines([
						'float ' + tName + ' = ' + tcMod.turbulance.phase.toFixed(4) + ' + time * ' + tcMod.turbulance.freq.toFixed(4) + ';',
						'vTexCoord.s += sin( ( ( position.x + position.z ) * 1.0 / 128.0 * 0.125 + ' + tName + ' ) * 6.283) * ' + tcMod.turbulance.amp.toFixed(4) + ';',
						'vTexCoord.t += sin( ( position.y * 1.0 / 128.0 * 0.125 + ' + tName + ' ) * 6.283) * ' + tcMod.turbulance.amp.toFixed(4) + ';'
					]);
				} break;
				default:
					break;
			}
		}

		switch(stage.alphaGen) {
			case 'lightingspecular':
				builder.addAttribs({ lightCoord: 'vec2' });
				builder.addVaryings({ vLightCoord: 'vec2' });
				builder.addLines(['vLightCoord = lightCoord;']);
				break;
			default:
				break;
		}

		builder.addLines(['gl_Position = projectionMatrix * worldPosition;']);

		return builder.getSource();
	}

	buildFragmentShader(stageShader, stage) {
		const builder = new ShaderBuilder();

		builder.addVaryings({
			vTexCoord: 'vec2',
			vColor: 'vec4',
		});

		builder.addUniforms({
			map: 'sampler2D',
			time: 'float',
		});

		builder.addLines(['vec4 texColor = texture2D(map, vTexCoord.st);']);

		switch(stage.rgbGen) {
			case 'vertex':
				builder.addLines(['vec3 rgb = texColor.rgb * vColor.rgb;']);
				break;
			case 'wave':
				builder.addWaveform('rgbWave', stage.rgbWaveform);
				builder.addLines(['vec3 rgb = texColor.rgb * rgbWave;']);
				break;
			default:
				builder.addLines(['vec3 rgb = texColor.rgb;']);
				break;
		}

		switch(stage.alphaGen) {
			case 'wave':
				builder.addWaveform('alpha', stage.alphaWaveform);
				break;
			case 'lightingspecular':
				builder.addUniforms({
					lightmap: 'sampler2D'
				});
				builder.addVaryings({
					vLightCoord: 'vec2',
					vLight: 'float'
				});
				builder.addLines([
					'vec4 light = texture2D(lightmap, vLightCoord.st);',
					'rgb *= light.rgb;',
					'rgb += light.rgb * texColor.a * 0.6;',
					'float alpha = 1.0;'
				]);
				break;
			default:
				builder.addLines(['float alpha = texColor.a;']);
				break;
		}

		if(stage.alphaFunc) {
			switch(stage.alphaFunc) {
				case 'GT0':
					builder.addLines(['if(alpha == 0.0) { discard; }']);
					break;
				case 'LT128':
					builder.addLines(['if(alpha >= 0.5) { discard; }']);
					break;
				case 'GE128':
					builder.addLines(['if(alpha < 0.5) { discard; }']);
					break;
				default:
					break;
			}
		}

		builder.addLines(['gl_FragColor = vec4(rgb, alpha);']);

		return builder.getSource();
	}
}

/**
 * Shader Builder Utility (Updated to standard GLSL ES 300 / compatible hooks)
 */
class ShaderBuilder {
	constructor() {
		this.attrib = {};
		this.varying = {};
		this.uniform = {};
		this.functions = {};
		this.statements = [];
	}

	addAttribs(attribs) {
		for(const name in attribs) {
			this.attrib[name] = 'attribute ' + attribs[name] + ' ' + name + ';';
		}
	}

	addVaryings(varyings) {
		for(const name in varyings) {
			this.varying[name] = 'varying ' + varyings[name] + ' ' + name + ';';
		}
	}

	addUniforms(uniforms) {
		for(const name in uniforms) {
			this.uniform[name] = 'uniform ' + uniforms[name] + ' ' + name + ';';
		}
	}

	addFunction(name, lines) {
		this.functions[name] = lines.join('\n');
	}

	addLines(statements) {
		for(let i = 0; i < statements.length; ++i) {
			this.statements.push(statements[i]);
		}
	}

	getSource() {
		let src = 'precision highp float;\n';

		for(const i in this.attrib) { src += this.attrib[i] + '\n'; }
		for(const i in this.varying) { src += this.varying[i] + '\n'; }
		for(const i in this.uniform) { src += this.uniform[i] + '\n'; }
		for(const i in this.functions) { src += this.functions[i] + '\n'; }

		src += 'void main(void) {\n\t';
		src += this.statements.join('\n\t');
		src += '\n}\n';

		return src;
	}

	addWaveform(name, wf, timeVar = 'time') {
		if(!wf) {
			this.statements.push('float ' + name + ' = 0.0;');
			return;
		}

		if(typeof wf.phase === 'number') {
			wf.phase = wf.phase.toFixed(4);
		}

		let funcName;
		switch(wf.funcName) {
			case 'sin':
				this.statements.push('float ' + name + ' = ' + wf.base.toFixed(4) + ' + sin((' + wf.phase + ' + ' + timeVar + ' * ' + wf.freq.toFixed(4) + ') * 6.283) * ' + wf.amp.toFixed(4) + ';');
				return;
			case 'square':
				funcName = 'square';
				this.addSquareFunc();
				break;
			case 'triangle':
				funcName = 'triangle';
				this.addTriangleFunc();
				break;
			case 'sawtooth':
				funcName = 'fract';
				break;
			case 'inversesawtooth':
				funcName = '1.0 - fract';
				break;
			default:
				this.statements.push('float ' + name + ' = 0.0;');
				return;
		}
		this.statements.push('float ' + name + ' = ' + wf.base.toFixed(4) + ' + ' + funcName + '(' + wf.phase + ' + ' + timeVar + ' * ' + wf.freq.toFixed(4) + ') * ' + wf.amp.toFixed(4) + ';');
	}

	addSquareFunc() {
		this.addFunction('square', [
			'float square(float val) {',
			'   return (mod(floor(val * 2.0) + 1.0, 2.0) * 2.0) - 1.0;',
			'}'
		]);
	}

	addTriangleFunc() {
		this.addFunction('triangle', [
			'float triangle(float val) {',
			'   return abs(2.0 * fract(val) - 1.0);',
			'}'
		]);
	}
}
