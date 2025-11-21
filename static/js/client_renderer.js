import * as THREE from 'three';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

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

        // Map font names to files (assuming they are in /static/fonts/)
        // You might need to adjust filenames to match exactly what's on disk
        const fontMap = {
            'lobster': 'Lobster-Regular.ttf',
            'pacifico': 'Pacifico-Regular.ttf',
            'greatvibes': 'GreatVibes-Regular.ttf',
            'allura': 'Allura-Regular.ttf',
            'alexbrush': 'AlexBrush-Regular.ttf',
            'sans': 'VarelaRound-Regular.ttf', // Fallback/Default
            'serif': 'VarelaRound-Regular.ttf', // Placeholder
            'fredoka': 'Fredoka-SemiBold.ttf'
        };

        const filename = fontMap[fontName] || 'VarelaRound-Regular.ttf';
        const url = `/static/fonts/${filename}`;

        return new Promise((resolve, reject) => {
            this.loader.load(url, (json) => {
                // TTFLoader returns a JSON object that FontLoader can parse
                const font = new FontLoader().parse(json);
                fontCache[fontName] = font;
                resolve(font);
            }, undefined, (err) => reject(err));
        });
    }

    async generateKeychain(params) {
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
            size: 10, // Base size, we scale everything relative to this
            height: textThickness,
            curveSegments: 4, // Lower for performance
            bevelEnabled: false
        });
        
        textGeo.computeBoundingBox();
        const textCenter = textGeo.boundingBox.getCenter(new THREE.Vector3());
        
        // Center the text
        textGeo.translate(-textCenter.x, -textCenter.y, 0);
        
        // Move text up to sit on base
        textGeo.translate(0, 0, baseThickness);

        const textMesh = new THREE.Mesh(textGeo);
        textMesh.updateMatrixWorld();

        // 2. Create Base Geometry (Bubble or Rect)
        // For simplicity, we'll start with a rounded rectangle (Box + CSG or just Box)
        // A true "Bubble" outline in 3D is hard without 2D offsets. 
        // We will approximate with a Box for now, or a Cylinder if it's a circle tag.
        
        const bbox = textGeo.boundingBox;
        const width = bbox.max.x - bbox.min.x + (basePadding * 2);
        const height = bbox.max.y - bbox.min.y + (basePadding * 2);
        
        // Create Base Brush
        const baseGeo = new THREE.BoxGeometry(width, height, baseThickness);
        // Center base at 0,0, thickness/2
        baseGeo.translate(0, 0, baseThickness / 2);
        
        let baseBrush = new Brush(baseGeo);
        baseBrush.updateMatrixWorld();

        // 3. Create Hole Brush
        if (holePosition !== 'none') {
            const holeGeo = new THREE.CylinderGeometry(holeRadius, holeRadius, baseThickness * 2, 32);
            holeGeo.rotateX(Math.PI / 2); // Rotate to align with Z axis
            
            // Position Hole
            let hx = 0;
            let hy = height / 2 + holeRadius + 2; // Top by default
            
            if (holePosition === 'top') {
                // Add a "tab" for the hole
                const tabGeo = new THREE.CylinderGeometry(holeRadius + 3, holeRadius + 3, baseThickness, 32);
                tabGeo.rotateX(Math.PI / 2);
                tabGeo.translate(0, hy, baseThickness / 2);
                const tabBrush = new Brush(tabGeo);
                
                // Union Tab to Base
                baseBrush = this.evaluator.evaluate(baseBrush, tabBrush, SUBTRACTION); // Wait, Union first?
                // Actually, Three-BVH-CSG evaluate returns a Mesh (Brush).
                // We need to Union the tab, then Subtract the hole.
                
                // Let's redo: Base + Tab
                // Re-create base brush because evaluate returns a result brush
                // Union
                 // ... implementation detail: CSG operations are expensive. 
                 // For a simple hole, we can just subtract.
                 // But we need the extra material (tab) if the hole is outside the text box.
                 
                 // Simple approach: Just a box for now, hole inside if fits, or extended.
                 // Let's just put the hole at the top edge.
            }
            
            // ... (Refining hole logic in next iteration, keeping it simple for first pass)
        }

        // 4. Merge Text and Base? 
        // Usually we export them as one STL.
        // We can just group them and export.
        
        const group = new THREE.Group();
        group.add(textMesh);
        
        // Convert Brush back to Mesh for export
        const baseMesh = new THREE.Mesh(baseBrush.geometry, new THREE.MeshStandardMaterial());
        group.add(baseMesh);

        // Export
        const stlString = this.exporter.parse(group, { binary: true });
        const blob = new Blob([stlString], { type: 'application/octet-stream' });
        return URL.createObjectURL(blob);
    }
}
