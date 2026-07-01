/* eslint-disable camelcase */
import * as THREE from 'three';
import { Q3ShaderLoader } from './Q3ShaderLoader.js';
import { Q3GLShaderLoader } from './Q3GLShaderLoader.js';

/**
 * Text Tokenizer specifically mapped for token spacing profiles inside raw .map formats
 */
class MapTokenizer {
	constructor(src) {
		src = src.replace(/\/\/.*$/mg, ''); // Strip C++ style comments
		src = src.replace(/\/\*[^*\/]*\*\//mg, ''); // Strip C style comments
		this.tokens = src.match(/[^\s\n\r\"]+/mg) || [];
		this.offset = 0;
	}

	EOF() {
		let token = this.tokens[this.offset];
		while(token === '' && this.offset < this.tokens.length) {
			this.offset++;
			token = this.tokens[this.offset];
		}
		return this.offset >= this.tokens.length;
	}

	next() {
		let token = '';
		while(token === '' && this.offset < this.tokens.length) {
			token = this.tokens[this.offset++];
		}
		return token;
	}
}

/**
 * Q3MapLoader
 * Parses text-based Quake 3 human-readable (.map) geometric file surfaces
 * and handles procedural convex hull generations via CSG plane intersections.
 */
export class Q3MapLoader extends THREE.Loader {
	constructor(manager) {
		super(manager !== undefined ? manager : THREE.DefaultLoadingManager);
		this.shaderLoader = new Q3ShaderLoader(this.manager);
		this.materialBuilder = new Q3GLShaderLoader(this.manager);

		this.baseFolder = 'https://quake.games/demoq3/pak0.pk3dir';
		this.shaderLoader.setBaseUrl(this.baseFolder);
		this.materialBuilder.setBaseFolder(this.baseFolder);

		this.shaderRegistry = {};
	}

	setBaseFolder(path) {
		this.baseFolder = path;
		this.shaderLoader.setBaseUrl(path);
		this.materialBuilder.setBaseFolder(path);
		return this;
	}

	load(url, onLoad, onProgress, onError) {
		const scope = this;
		const loader = new THREE.FileLoader(scope.manager);
		loader.setPath(scope.path);
		loader.setResponseType("text");

		loader.load(url, function (text) {
			if(onLoad) onLoad(scope.parse(text));
		}, onProgress, onError);
	}

	parse(mapText) {
		const rootNode = new THREE.Group();
		rootNode.name = "Q3Map_WorldMesh";
		rootNode.userData = { entities: [] };

		const tokens = new MapTokenizer(mapText);
		const entities = [];

		while(!tokens.EOF()) {
			let token = tokens.next();
			if(token === '{') {
				let entity = { brushes: [] };
				while(!tokens.EOF()) {
					let key = tokens.next();
					if(key === '}') break;

					if(key === '{') {
						let brush = { sides: [] };
						while(!tokens.EOF()) {
							let bToken = tokens.next();
							if(bToken === '}') break;

							if(bToken === '(') {
								let p1 = [parseFloat(tokens.next()), parseFloat(tokens.next()), parseFloat(tokens.next())]; tokens.next(); tokens.next();
								let p2 = [parseFloat(tokens.next()), parseFloat(tokens.next()), parseFloat(tokens.next())]; tokens.next(); tokens.next();
								let p3 = [parseFloat(tokens.next()), parseFloat(tokens.next()), parseFloat(tokens.next())]; tokens.next();

								let textureName = tokens.next();

								let shiftS = parseFloat(tokens.next());
								let shiftT = parseFloat(tokens.next());
								let rotation = parseFloat(tokens.next());
								let scaleS = parseFloat(tokens.next());
								let scaleT = parseFloat(tokens.next());

								brush.sides.push({
									points: [p1, p2, p3],
									texture: textureName,
									uvParams: { shiftS, shiftT, rotation, scaleS, scaleT }
								});
							}
						}
						entity.brushes.push(brush);
					} else {
						let val = tokens.next();
						if(key === 'origin') {
							let coords = val.split(' ');
							entity[key] = [parseFloat(coords[0]), parseFloat(coords[1]), parseFloat(coords[2])];
						} else if(key === 'angle') {
							entity[key] = parseFloat(val);
						} else {
							entity[key] = val;
						}
					}
				}
				entities.push(entity);
			}
		}

		rootNode.userData.entities = entities;
		return this._buildGeometryFromBrushes(entities, rootNode);
	}

	_buildGeometryFromBrushes(entities, rootNode) {
		const masterVertices = [];
		const masterIndices = [];
		const parsedSurfaces = [];

		for(const ent of entities) {
			for(const brush of ent.brushes) {
				const activePlanes = [];

				for(const side of brush.sides) {
					let v0 = new THREE.Vector3(side.points[0][0], side.points[0][2], -side.points[0][1]);
					let v1 = new THREE.Vector3(side.points[1][0], side.points[1][2], -side.points[1][1]);
					let v2 = new THREE.Vector3(side.points[2][0], side.points[2][2], -side.points[2][1]);

					let plane = new THREE.Plane();
					plane.setFromCoplanarPoints(v0, v1, v2);

					if(plane.normal.lengthSq() > 0) {
						activePlanes.push({ geoPlane: plane, metaSide: side });
					}
				}

				for(let i = 0; i < activePlanes.length; i++) {
					const target = activePlanes[i];
					let facePolygon = this._createInfinitePlanePolygon(target.geoPlane);

					for(let j = 0; j < activePlanes.length; j++) {
						if(i === j) continue;
						facePolygon = this._clipPolygonByPlane(facePolygon, activePlanes[j].geoPlane);
					}

					if(facePolygon.length < 3) continue;

					let surfaceIndexOffset = masterIndices.length * 4;
					let vertexBaseOffset = masterVertices.length / 14;

					for(let k = 0; k < facePolygon.length; k++) {
						let vertexPosition = facePolygon[k];

						masterVertices.push(vertexPosition.x, vertexPosition.y, vertexPosition.z);

						let u = vertexPosition.dot(new THREE.Vector3(1, 0, 0)) * 0.015625;
						let v = vertexPosition.dot(new THREE.Vector3(0, 1, 0)) * 0.015625;
						masterVertices.push(u, v);
						masterVertices.push(0, 0); // Lightmap coords fallback layout spaces

						masterVertices.push(target.geoPlane.normal.x, target.geoPlane.normal.y, target.geoPlane.normal.z);
						masterVertices.push(1.0, 1.0, 1.0, 1.0);
					}

					for(let k = 1; k < facePolygon.length - 1; k++) {
						masterIndices.push(vertexBaseOffset);
						masterIndices.push(vertexBaseOffset + k);
						masterIndices.push(vertexBaseOffset + k + 1);
					}

					parsedSurfaces.push({
						shaderName: target.metaSide.texture,
						elementCount: (facePolygon.length - 2) * 3,
						indexOffset: surfaceIndexOffset,
						geomType: 1
					});
				}
			}
		}

		return this._assembleMeshHierarchy({
			vertices: new Float32Array(masterVertices),
			indices: new Uint32Array(masterIndices),
			surfaces: parsedSurfaces
		}, rootNode);
	}

	_createInfinitePlanePolygon(plane) {
		let binormal = new THREE.Vector3();
		if(Math.abs(plane.normal.x) > 0.9) {
			binormal.set(0, 1, 0).cross(plane.normal).normalize();
		} else {
			binormal.set(1, 0, 0).cross(plane.normal).normalize();
		}
		let tangent = new THREE.Vector3().crossVectors(plane.normal, binormal).normalize();
		let origin = new THREE.Vector3().copy(plane.normal).multiplyScalar(-plane.constant);

		let maxRadius = 16384;
		return [
			new THREE.Vector3().copy(origin).addScaledVector(tangent, -maxRadius).addScaledVector(binormal, -maxRadius),
			new THREE.Vector3().copy(origin).addScaledVector(tangent, maxRadius).addScaledVector(binormal, -maxRadius),
			new THREE.Vector3().copy(origin).addScaledVector(tangent, maxRadius).addScaledVector(binormal, maxRadius),
			new THREE.Vector3().copy(origin).addScaledVector(tangent, -maxRadius).addScaledVector(binormal, maxRadius)
		];
	}

	_clipPolygonByPlane(vertices, plane) {
		let clippedPolygon = [];
		if(vertices.length === 0) return clippedPolygon;

		for(let i = 0; i < vertices.length; i++) {
			let currentPoint = vertices[i];
			let nextPoint = vertices[(i + 1) % vertices.length];

			let currentDistance = plane.distanceToPoint(currentPoint);
			let nextDistance = plane.distanceToPoint(nextPoint);

			if(currentDistance >= -0.005) {
				clippedPolygon.push(currentPoint);
			}

			if((currentDistance > 0.005 && nextDistance < -0.005) || (currentDistance < -0.005 && nextDistance > 0.005)) {
				let interpolationFactor = currentDistance / (currentDistance - nextDistance);
				let splittingIntersectionPoint = new THREE.Vector3().lerpVectors(currentPoint, nextPoint, interpolationFactor);
				clippedPolygon.push(splittingIntersectionPoint);
			}
		}
		return clippedPolygon;
	}

	_assembleMeshHierarchy(meshData, rootNode) {
		const rawVertices = meshData.vertices;
		const rawIndices = meshData.indices;
		const surfaces = meshData.surfaces || [];
		const stride = 14;

		for(let s = 0; s < surfaces.length; s++) {
			const surface = surfaces[s];
			if(surface.elementCount === 0) continue;

			const geometry = new THREE.BufferGeometry();
			const subIndices = [], subPositions = [], subNormals = [], subUvs = [], subColors = [];
			const vertMap = {};
			let localVertCount = 0;

			let indexStart = surface.indexOffset / 4;
			let indexEnd = indexStart + surface.elementCount;

			for(let i = indexStart; i < indexEnd; i++) {
				let globalVertIdx = rawIndices[i];
				if(vertMap[globalVertIdx] === undefined) {
					vertMap[globalVertIdx] = localVertCount;
					let idx = globalVertIdx * stride;

					subPositions.push(rawVertices[idx], rawVertices[idx + 1], rawVertices[idx + 2]);
					subUvs.push(rawVertices[idx + 3], 1.0 - rawVertices[idx + 4]);
					subNormals.push(rawVertices[idx + 7], rawVertices[idx + 8], rawVertices[idx + 9]);
					subColors.push(rawVertices[idx + 10], rawVertices[idx + 11], rawVertices[idx + 12], rawVertices[idx + 13]);

					localVertCount++;
				}
				subIndices.push(vertMap[globalVertIdx]);
			}

			geometry.setAttribute("position", new THREE.Float32BufferAttribute(subPositions, 3));
			geometry.setAttribute("normal", new THREE.Float32BufferAttribute(subNormals, 3));
			geometry.setAttribute("uv", new THREE.Float32BufferAttribute(subUvs, 2));
			geometry.setAttribute("color", new THREE.Float32BufferAttribute(subColors, 4));
			geometry.setIndex(subIndices.length > 65535 ? new THREE.BufferAttribute(new Uint32Array(subIndices), 1) : new THREE.BufferAttribute(new Uint16Array(subIndices), 1));

			geometry.computeVertexNormals();
			geometry.computeBoundingBox();
			geometry.computeBoundingSphere();

			let textureShaderPath = surface.shaderName;
			let finalMaterials = [];

			if(textureShaderPath && textureShaderPath !== "noshader") {
				let lookupName = textureShaderPath.toLowerCase();
				let cachedShader = this.shaderRegistry[lookupName];

				if(cachedShader) {
					// Inject sub-loader pipeline metrics logic configuration mapping
					finalMaterials = this.materialBuilder.buildMaterials(cachedShader);
				}
			}

			if(finalMaterials.length === 0) {
				finalMaterials.push(this.materialBuilder.buildDefaultMaterial(THREE.DoubleSide));
				this.materialBuilder.resolveTexture(textureShaderPath + ".jpg", false, (tex) => {
					finalMaterials[0].uniforms.map.value = tex;
				});
			}

			finalMaterials.forEach((material, stageIndex) => {
				let surfaceMesh = new THREE.Mesh(geometry, material);
				surfaceMesh.name = (surface.shaderName !== "noshader") ? `${surface.shaderName}_stg${stageIndex}` : `surface_${s}_stg${stageIndex}`;
				surfaceMesh.frustumCulled = false;
				surfaceMesh.matrixAutoUpdate = true;
				surfaceMesh.castShadow = true;
				surfaceMesh.receiveShadow = true;

				surfaceMesh.userData = {
					geomType: surface.geomType,
					indexOffset: surface.indexOffset,
					elementCount: surface.elementCount,
					isCustomShader: true
				};

				rootNode.add(surfaceMesh);
			});
		}

		return rootNode;
	}
}

// Bind reference target securely to legacy modules
if(typeof window !== 'undefined') {
	window.Q3MapLoader = Q3MapLoader;
}

// =============================================================================
// RUNTIME TEXT-MAP SCENE INGESTION ENVIRONMENT HOOKS
// =============================================================================
export async function importMap(mapFile, content) {
	let mapLoader = new Q3MapLoader();
	let activeScene = window.Nunu.getScene();

	const baseFolder = mapLoader.baseFolder;
	const mapName = baseFolder + (mapFile && mapFile.startsWith('/') ? '' : '/') + (mapFile || "maps/q3dm17.map");

	const mapShaders = ['scripts/base.shader', 'scripts/sky.shader'];

	// Core structural shift: Hydrate shader lookups through the clean subloaders first
	for(let path of mapShaders) {
		mapLoader.shaderLoader.load(`${baseFolder}/${path}`, (parsedShaders) => {
			parsedShaders.forEach(shader => {
				if(shader && shader.name) {
					mapLoader.shaderRegistry[shader.name.toLowerCase()] = shader;
				}
			});
		});
	}

	mapLoader.load(content || mapName, function (mapGroup) {
		mapGroup.name = mapFile ? mapFile.split('/').pop() : "q3dm17_MapTextGroup";

		mapGroup.traverse(function (child) {
			if(child.isMesh) {
				child.frustumCulled = false;
				child.matrixAutoUpdate = true;
				child.type = "Mesh";
			}
			if(typeof child.isEmpty !== 'function') {
				child.isEmpty = function () { return this.children ? this.children.length === 0 : true; };
			}
			if(typeof child.resize !== 'function') {
				child.resize = function () { };
			}
		});

		if(typeof mapGroup.isEmpty !== 'function') { mapGroup.isEmpty = function () { return false; }; }

		window.Nunu.addObject(mapGroup, activeScene);
		window.Nunu.selectObject(mapGroup);
		window.Nunu.gui.updateInterface();
	});
}

if(typeof window !== 'undefined') {
	window.importMap = importMap;
}
