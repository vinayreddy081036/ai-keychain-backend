import * as THREE from 'three';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from 'three-bvh-csg';

// Cache loaded fonts
const fontCache = {};

export class ClientRenderer {
    constructor() {
        this.loader = new TTFLoader();
        this.exporter = new STLExporter();
        this.evaluator = new Evaluator();
    }

    async loadFont(fontName) {
        if (fontCache[fontName]) return fontCache[fontName];

        const fontMap = {
            'lobster': 'Lobster-Regular.ttf',
            'pacifico': 'Pacifico-Regular.ttf',
            'greatvibes': 'GreatVibes-Regular.ttf',
            'allura': 'Allura-Regular.ttf',
            'alexbrush': 'AlexBrush-Regular.ttf',
            'sans': 'VarelaRound-Regular.ttf',
            'serif': 'VarelaRound-Regular.ttf',
            'fredoka': 'Fredoka-SemiBold.ttf'
        };

        const filename = fontMap[fontName] || 'VarelaRound-Regular.ttf';
        const url = `/static/fonts/${filename}`;

        return new Promise((resolve, reject) => {
            this.loader.load(url, (json) => {
                const font = new FontLoader().parse(json);
                fontCache[fontName] = font;
                resolve(font);
            }, undefined, (err) => reject(err));
        });
    }

    async generateKeychain(params) {
        console.log("Starting Client-Side Generation...", params);
        const {
            text,
            fontName = 'sans',
            textThickness = 3,
            baseThickness = 2,
            basePadding = 5,
            holeRadius = 3,
            holePosition = 'top'
        } = params;

        const font = await this.loadFont(fontName);

        // 1. Create Text Geometry
        const textGeo = new TextGeometry(text, {
            font: font,
            size: 10,
            height: textThickness,
            curveSegments: 4,
            bevelEnabled: false
        });

        textGeo.computeBoundingBox();
        const textCenter = textGeo.boundingBox.getCenter(new THREE.Vector3());

        // Center text
        textGeo.translate(-textCenter.x, -textCenter.y, 0);
        textGeo.translate(0, 0, baseThickness); // Sit on top of base

        const textMesh = new THREE.Mesh(textGeo);
        textMesh.updateMatrixWorld();

        // 2. Create Base Geometry
        const bbox = textGeo.boundingBox;
        const width = (bbox.max.x - bbox.min.x) + (basePadding * 2);
        const height = (bbox.max.y - bbox.min.y) + (basePadding * 2);

        const baseGeo = new THREE.BoxGeometry(width, height, baseThickness);
        baseGeo.translate(0, 0, baseThickness / 2);

        let baseBrush = new Brush(baseGeo);
        baseBrush.updateMatrixWorld();

        // 4. Export
        const group = new THREE.Group();
        group.add(textMesh);

        const baseMesh = new THREE.Mesh(baseBrush.geometry, new THREE.MeshStandardMaterial());
        group.add(baseMesh);

        const stlString = this.exporter.parse(group, { binary: true });
        const blob = new Blob([stlString], { type: 'application/octet-stream' });
        return URL.createObjectURL(blob);
    }
}
