import { BufferGeometry, Matrix4, Mesh, Vector2, Vector3, Float32BufferAttribute } from "three";
import { BSPNode } from "./BSPNode.js";
import { BSPPolygon } from "./BSPPolygon.js";
import { BSPVertex } from "./BSPVertex.js";

function BSP(geometry) {
	var polygon;
	var polygons = [];

	if (geometry instanceof BufferGeometry) {
		this.matrix = new Matrix4();
	}
	else if (geometry instanceof Mesh) {
		geometry.updateMatrix();
		this.matrix = geometry.matrix.clone();
		geometry = geometry.geometry;
	}
	else if (geometry instanceof BSPNode) {
		this.tree = geometry;
		this.matrix = new Matrix4();
		return this;
	}
	else {
		throw new Error("nunuStudio: Given geometry is unsupported");
	}

	const posAttr = geometry.getAttribute("position");
	const normalAttr = geometry.getAttribute("normal");
	const uvAttr = geometry.getAttribute("uv");
	const indexAttr = geometry.getIndex();

	const getVertex = (idx) => {
		const vx = posAttr.getX(idx);
		const vy = posAttr.getY(idx);
		const vz = posAttr.getZ(idx);

		let normal = null;
		if (normalAttr) {
			normal = new Vector3(normalAttr.getX(idx), normalAttr.getY(idx), normalAttr.getZ(idx));
		}

		let uv = null;
		if (uvAttr) {
			uv = new Vector2(uvAttr.getX(idx), uvAttr.getY(idx));
		}

		const bspVert = new BSPVertex(vx, vy, vz, normal, uv);
		bspVert.applyMatrix4(this.matrix);
		return bspVert;
	};

	if (indexAttr) {
		for (let i = 0; i < indexAttr.count; i += 3) {
			polygon = new BSPPolygon();
			polygon.vertices.push(getVertex(indexAttr.getX(i)));
			polygon.vertices.push(getVertex(indexAttr.getX(i + 1)));
			polygon.vertices.push(getVertex(indexAttr.getX(i + 2)));
			polygon.calculateProperties();
			polygons.push(polygon);
		}
	} else if (posAttr) {
		for (let i = 0; i < posAttr.count; i += 3) {
			polygon = new BSPPolygon();
			polygon.vertices.push(getVertex(i));
			polygon.vertices.push(getVertex(i + 1));
			polygon.vertices.push(getVertex(i + 2));
			polygon.calculateProperties();
			polygons.push(polygon);
		}
	}

	this.tree = new BSPNode(polygons);
}

BSP.prototype.subtract = function (otherTree) {
	var a = this.tree.clone();
	var b = otherTree.tree.clone();

	a.invert();
	a.clipTo(b);
	b.clipTo(a);
	b.invert();
	b.clipTo(a);
	b.invert();
	a.build(b.allPolygons());
	a.invert();
	a = new BSP(a);
	a.matrix = this.matrix;
	return a;
};

BSP.prototype.union = function (otherTree) {
	var a = this.tree.clone();
	var b = otherTree.tree.clone();

	a.clipTo(b);
	b.clipTo(a);
	b.invert();
	b.clipTo(a);
	b.invert();
	a.build(b.allPolygons());
	a = new BSP(a);
	a.matrix = this.matrix;
	return a;
};

BSP.prototype.intersect = function (otherTree) {
	var a = this.tree.clone();
	var b = otherTree.tree.clone();

	a.invert();
	b.clipTo(a);
	b.invert();
	a.clipTo(b);
	b.clipTo(a);
	a.build(b.allPolygons());
	a.invert();
	a = new BSP(a);
	a.matrix = this.matrix;
	return a;
};

BSP.prototype.toGeometry = function () {
	var matrix = new Matrix4().copy(this.matrix).invert();
	var geometry = new BufferGeometry();
	var polygons = this.tree.allPolygons();
	var polygonCount = polygons.length;

	var positions = [];
	var normals = [];
	var uvs = [];

	for (var i = 0; i < polygonCount; i++) {
		var polygon = polygons[i];
		var polygonVerticeCount = polygon.vertices.length;

		for (var j = 2; j < polygonVerticeCount; j++) {
			var verts = [
				polygon.vertices[0],
				polygon.vertices[j - 1],
				polygon.vertices[j]
			];

			for (var k = 0; k < 3; k++) {
				var v = verts[k];
				var pos = new Vector3(v.x, v.y, v.z).applyMatrix4(matrix);
				positions.push(pos.x, pos.y, pos.z);

				if (polygon.normal) {
					normals.push(polygon.normal.x, polygon.normal.y, polygon.normal.z);
				} else {
					normals.push(0, 1, 0);
				}

				if (v.uv) {
					uvs.push(v.uv.x, v.uv.y);
				} else {
					uvs.push(0, 0);
				}
			}
		}
	}

	geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
	geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
	if (uvs.length > 0) {
		geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
	}

	return geometry;
};

BSP.prototype.toMesh = function (material) {
	var geometry = this.toGeometry();
	var mesh = new Mesh(geometry, material);

	mesh.position.setFromMatrixPosition(this.matrix);
	mesh.rotation.setFromRotationMatrix(this.matrix);

	return mesh;
};

export { BSP };