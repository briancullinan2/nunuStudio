import {
	ShaderMaterial,
	TextureLoader,
	RepeatWrapping,
	ClampToEdgeWrapping,
	DataTexture,
	RGBAFormat,
	UnsignedByteType,
	NearestFilter,
	LinearFilter,
	LinearMipmapLinearFilter,
	FrontSide,
	BackSide,
	DoubleSide,
	CustomBlending,
	OneFactor,
	ZeroFactor,
	DstColorFactor,
	OneMinusDstColorFactor,
	SrcAlphaFactor,
	OneMinusSrcAlphaFactor,
	SrcColorFactor,
	OneMinusSrcColorFactor,
	LessEqualDepth,
	GreaterEqualDepth,
	EqualDepth,
	GreaterDepth,
	LessDepth,
	AlwaysDepth
} from 'three';

/**
 * Q3GLShaderLoader
 * Bridges parsed Quake 3 shader stage parameters into native Three.js materials.
 */
export class Q3GLShaderLoader {
	constructor(manager) {
		this.manager = manager;
		this.textureLoader = new TextureLoader(this.manager);
		this.baseFolder = '';
		this.lightmapTexture = null;
		this.fallbackTexture = null;
		this.whiteTexture = null;
		this.useBasis = !window.location.search.includes('png');

		this.initFallbackTextures();
	}

	setBaseFolder(path) {
		this.baseFolder = path;
		return this;
	}

	setLightmap(texture) {
		this.lightmapTexture = texture;
		return this;
	}

	initFallbackTextures() {
		// Create 1x1 solid white canvas data texture replacement
		const whiteData = new Uint8Array([255, 255, 255, 255]);
		this.whiteTexture = new DataTexture(whiteData, 1, 1, RGBAFormat, UnsignedByteType);
		this.whiteTexture.minFilter = NearestFilter;
		this.whiteTexture.magFilter = NearestFilter;
		this.whiteTexture.needsUpdate = true;

		// Default 'no-shader' placeholder texturing logic
		this.fallbackTexture = this.whiteTexture;
		const fallbackUrl = `${this.baseFolder}/webgl/no-shader.png`;
		this.textureLoader.load(fallbackUrl, (tex) => {
			tex.magFilter = LinearFilter;
			tex.minFilter = LinearMipmapLinearFilter;
			tex.generateMipmaps = true;
			this.fallbackTexture = tex;
		}, undefined, () => {
			// Silently fallback to white on load errors
		});
	}

	/**
	 * Translates a parsed shader state into an array of Three.js ShaderMaterials (one per stage)
	 */
	buildMaterials(shader) {
		const materials = [];
		const side = this.translateCull(shader.cull, shader.sky);

		for(let i = 0; i < shader.stages.length; ++i) {
			const stage = shader.stages[i];
			const uniforms = {
				time: { value: 0.0 },
				map: { value: this.fallbackTexture },
				texture: { value: this.fallbackTexture }, // Alias target to catch Toji's custom scripts
				lightmap: { value: this.lightmapTexture || this.whiteTexture }
			};

			// Allocate runtime assignment tracking arrays for animMap logic
			let animTextures = [];
			if(stage.map === 'anim' && stage.animMaps) {
				stage.animMaps.forEach((mapUrl, index) => {
					animTextures[index] = this.fallbackTexture;
					this.resolveTexture(mapUrl, stage.clamp, (tex) => {
						animTextures[index] = tex;
					});
				});
			} else if(stage.map) {
				this.resolveTexture(stage.map, stage.clamp, (tex) => {
					uniforms.map.value = tex;
				});
			} else {
				uniforms.map.value = this.whiteTexture;
			}

			// Map standard blends
			const hasBlend = stage.hasBlendFunc || shader.blend;
			const blending = hasBlend ? CustomBlending : undefined;
			const blendSrc = this.translateBlend(stage.blendSrc, OneFactor);
			const blendDst = this.translateBlend(stage.blendDest, ZeroFactor);

			const material = new ShaderMaterial({
				name: `${shader.name}_stage${i}`,
				vertexShader: stage.shaderSrc ? stage.shaderSrc.vertex : this.getDefaultVertexShader(),
				fragmentShader: stage.shaderSrc ? stage.shaderSrc.fragment : this.getDefaultFragmentShader(stage),
				uniforms: uniforms,
				side: side,
				blending: blending,
				blendSrc: blendSrc,
				blendDst: blendDst,
				depthFunc: this.translateDepthFunc(stage.depthFunc),
				depthWrite: !!stage.depthWrite && !shader.sky,
				transparent: hasBlend
			});

			// Expose specialized update hooks required by loop animations
			material.userData = {
				animFreq: stage.animFreq || 0,
				animTextures: animTextures,
				isLightmapStage: !!stage.isLightmap
			};

			materials.push(material);
		}

		// Generate fallback material configurations if zero valid stages parsed
		if(materials.length === 0) {
			materials.push(this.buildDefaultMaterial(side));
		}

		return materials;
	}

	buildDefaultMaterial(side) {
		return new ShaderMaterial({
			vertexShader: this.getDefaultVertexShader(),
			fragmentShader: this.getDefaultFragmentShader({ isLightmap: false }),
			uniforms: {
				time: { value: 0.0 },
				map: { value: this.fallbackTexture },
				lightmap: { value: this.whiteTexture }
			},
			side: side,
			depthFunc: LessEqualDepth,
			depthWrite: true
		});
	}

	resolveTexture(mapPath, clamp, onComplete) {
		if(!mapPath || mapPath === '$whiteimage') {
			onComplete(this.whiteTexture);
			return;
		}
		if(mapPath === '$lightmap') {
			onComplete(this.lightmapTexture || this.whiteTexture);
			return;
		}

		let resolvedUrl = `${this.baseFolder}/${mapPath}`;
		if(this.useBasis) {
			resolvedUrl = resolvedUrl.replace(/\.png/, '.basis');
			// If hooks into BasisTextureLoader or KTX2Loader exist on your system pipeline,
			// you should substitute this execution layer with this.basisLoader.load() instead.
		}

		this.textureLoader.load(resolvedUrl, (texture) => {
			texture.wrapS = clamp ? ClampToEdgeWrapping : RepeatWrapping;
			texture.wrapT = clamp ? ClampToEdgeWrapping : RepeatWrapping;
			texture.magFilter = LinearFilter;
			texture.minFilter = LinearMipmapLinearFilter;
			texture.generateMipmaps = true;
			texture.needsUpdate = true;
			onComplete(texture);
		}, undefined, () => {
			onComplete(this.fallbackTexture);
		});
	}

	/**
	 * Iterates generated materials to advance timing vectors and layout animated frames
	 */
	updateMaterials(materials, time) {
		for(let i = 0; i < materials.length; ++i) {
			const mat = materials[i];
			if(mat.uniforms.time) {
				mat.uniforms.time.value = time;
			}

			const ud = mat.userData;
			if(ud && ud.animFreq && ud.animTextures.length > 0) {
				const frameIndex = Math.floor(time * ud.animFreq) % ud.animTextures.length;
				mat.uniforms.map.value = ud.animTextures[frameIndex];
			}
		}
	}

	translateDepthFunc(depth) {
		if(!depth) return LessEqualDepth;
		switch(depth.toLowerCase()) {
			case 'gequal': return GreaterEqualDepth;
			case 'lequal': return LessEqualDepth;
			case 'equal': return EqualDepth;
			case 'greater': return GreaterDepth;
			case 'less': return LessDepth;
			case 'always': return AlwaysDepth;
			default: return LessEqualDepth;
		}
	}

	translateCull(cull, isSky) {
		if(isSky) return DoubleSide;
		if(!cull) return FrontSide;
		switch(cull.toLowerCase()) {
			case 'disable':
			case 'none': return DoubleSide;
			case 'front': return BackSide; // Inverted mapping logic matching source code transform target
			case 'back':
			default: return FrontSide;
		}
	}

	translateBlend(blend, fallback) {
		if(!blend) return fallback;
		switch(blend.toUpperCase()) {
			case 'GL_ONE': return OneFactor;
			case 'GL_ZERO': return ZeroFactor;
			case 'GL_DST_COLOR': return DstColorFactor;
			case 'GL_ONE_MINUS_DST_COLOR': return OneMinusDstColorFactor;
			case 'GL_SRC_ALPHA': return SrcAlphaFactor;
			case 'GL_ONE_MINUS_SRC_ALPHA': return OneMinusSrcAlphaFactor;
			case 'GL_SRC_COLOR': return SrcColorFactor;
			case 'GL_ONE_MINUS_SRC_COLOR': return OneMinusSrcColorFactor;
			default: return fallback;
		}
	}

	getDefaultVertexShader() {
		return `
        // Explicitly map Toji's expected layout variables to internal Three.js hooks
        attribute vec2 lightCoord;

        varying vec2 vTexCoord;
        varying vec2 vLightmapCoord;
        varying vec4 vColor;

        void main() {
            vTexCoord = uv;
            vLightmapCoord = lightCoord;
            vColor = color;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;
	}

	getDefaultFragmentShader(stage) {
		if(stage.isLightmap) {
			return `
            precision highp float;
            varying vec2 vTexCoord;
            varying vec4 vColor;

            // Declare both mappings so Toji's parsed code and your fallbacks resolve
            uniform sampler2D map;
            uniform sampler2D texture;

            void main() {
                // Safely alias whichever sampler uniform is populated
                vec4 diffuseColor = texture2D(map, vTexCoord);
                if (diffuseColor.a == 0.0) {
                    diffuseColor = texture2D(texture, vTexCoord);
                }
                gl_FragColor = vec4(diffuseColor.rgb * vColor.rgb, diffuseColor.a);
            }
        `;
		}
		return `
        precision highp float;
        varying vec2 vTexCoord;
        varying vec2 vLightmapCoord;

        uniform sampler2D map;
        uniform sampler2D texture;
        uniform sampler2D lightmap;

        void main() {
            vec4 diffuseColor = texture2D(map, vTexCoord);
            if (diffuseColor.rgb == vec3(0.0) && diffuseColor.a == 0.0) {
                diffuseColor = texture2D(texture, vTexCoord);
            }
            vec4 lightColor = texture2D(lightmap, vLightmapCoord);
            gl_FragColor = vec4(diffuseColor.rgb * lightColor.rgb, diffuseColor.a);
        }
    `;
	}
}
