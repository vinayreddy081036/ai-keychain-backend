import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from 'three-bvh-csg'; // Keeping for reference if needed, but unused now.
// Actually, let's remove it to be clean.
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

// Cache loaded fonts
const fontCache = {};

export class ClientRenderer {
    constructor() {
        this.loader = new TTFLoader();
        this.exporter = new STLExporter();
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
        console.log("Starting Client-Side Generation (No CSG)...", params);
        const {
            text,
            fontName = 'sans',
            textThickness = 3,
            baseThickness = 2,
            basePadding = 5,
            holeRadius = 3,
            holePosition = 'top',
            outlineType = 'bubble',
            holeX = 0,
            holeY = 0
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
        const textSize = textGeo.boundingBox.getSize(new THREE.Vector3());

        // Center text
        textGeo.translate(-textCenter.x, -textCenter.y, 0);
        textGeo.translate(0, 0, baseThickness); // Sit on top of base

        const textMesh = new THREE.Mesh(textGeo);
        textMesh.updateMatrixWorld();

        // 2. Create Base Geometry
        // Calculate dimensions
        const width = textSize.x + (basePadding * 2);
        const height = textSize.y + (basePadding * 2);

        let baseGeo;

        if (outlineType === 'rect') {
            baseGeo = new THREE.BoxGeometry(width, height, baseThickness);
            // BoxGeometry is centered in Z, move it up
            baseGeo.translate(0, 0, baseThickness / 2);
        } else {
            // Bubble (Rounded Rect)
            const shape = new THREE.Shape();
            const x = -width / 2;
            const y = -height / 2;
            const radius = 5;

            shape.moveTo(x + radius, y);
            shape.lineTo(x + width - radius, y);
            shape.quadraticCurveTo(x + width, y, x + width, y + radius);
            shape.lineTo(x + width, y + height - radius);
            shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            shape.lineTo(x + radius, y + height);
            shape.quadraticCurveTo(x, y + height, x, y + height - radius);
            shape.lineTo(x, y + radius);
            shape.quadraticCurveTo(x, y, x + radius, y);

            baseGeo = new THREE.ExtrudeGeometry(shape, {
                depth: baseThickness,
                bevelEnabled: false
            });
            // ExtrudeGeometry is 0 to depth in Z. No translate needed for Z.
        }

        const baseMesh = new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial());
        baseMesh.updateMatrixWorld();

        // 3. Handle Hole (Loop)
        const group = new THREE.Group();
        group.add(textMesh);
        group.add(baseMesh);

        if (holePosition !== 'none') {
            let loopGeo;
            let lx = 0;
            let ly = 0;

            // Torus parameters
            const loopRadius = holeRadius + 1.5;
            const tubeRadius = baseThickness / 2;

            if (holePosition === 'top') {
                ly = (height / 2) + loopRadius - (tubeRadius / 2);
            } else if (holePosition === 'left') {
                lx = -(width / 2) - loopRadius + (tubeRadius / 2);
            } else if (holePosition === 'right') {
                lx = (width / 2) + loopRadius - (tubeRadius / 2);
            } else if (holePosition === 'custom') {
                lx = holeX;
                ly = holeY;
            }

            loopGeo = new THREE.TorusGeometry(loopRadius, tubeRadius, 16, 32);
            loopGeo.translate(lx, ly, baseThickness / 2);

            if (loopGeo) {
                const loopMesh = new THREE.Mesh(loopGeo, new THREE.MeshStandardMaterial());
                group.add(loopMesh);
            }
        }

        // 4. Export
        const stlString = this.exporter.parse(group, { binary: true });
        const blob = new Blob([stlString], { type: 'application/octet-stream' });
        return URL.createObjectURL(blob);
    }
}
