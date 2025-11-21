import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ClientRenderer } from './client_renderer.js';

// State
let currentFileId = null;
let scene, camera, renderer, controls, mesh;
let textMesh, baseMesh;

// Initialize Client Renderer
const clientRenderer = new ClientRenderer();

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadPrompt = document.getElementById('uploadPrompt');
const filePreview = document.getElementById('filePreview');
const previewImg = document.getElementById('previewImg');
const fileName = document.getElementById('fileName');
const removeFileBtn = document.getElementById('removeFile');
const generateBtn = document.getElementById('generateBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const downloadBar = document.getElementById('downloadBar');
const downloadLink = document.getElementById('downloadLink');
const viewerContainer = document.getElementById('viewerContainer');
const placeholder = document.getElementById('placeholder');

// Initialize 3D Viewer
function initViewer() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e293b); // Slate-800

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.8);
    backLight.position.set(-5, 10, -10);
    scene.add(backLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(0, -10, 5);
    scene.add(fillLight);

    // Helpers
    const gridHelper = new THREE.GridHelper(100, 20, 0x334155, 0x1e293b);
    scene.add(gridHelper);

    // Camera
    camera = new THREE.PerspectiveCamera(45, viewerContainer.clientWidth / viewerContainer.clientHeight, 0.1, 1000);
    camera.position.set(0, 30, 30);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Resize handler
    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = viewerContainer.clientWidth / viewerContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// File Handling
function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
        alert('Please upload a valid image file (PNG or JPG).');
        return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        fileName.textContent = file.name;
        uploadPrompt.classList.add('hidden');
        filePreview.classList.remove('hidden');
        generateBtn.disabled = false;
    };
    reader.readAsDataURL(file);

    // Upload to server (Still needed for Image-to-3D fallback if we don't implement image tracing in JS yet)
    // For now, we'll keep the server upload for images, but use client for text.
    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/upload', {
        method: 'POST',
        body: formData
    })
        .then(res => res.json())
        .then(data => {
            if (data.file_id) {
                currentFileId = data.file_id;
            }
        })
        .catch(err => console.error('Upload failed:', err));
}

// Event Listeners
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

const textInput = document.getElementById('textInput');

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFile(e.dataTransfer.files[0]);
});

removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.value = '';
    currentFileId = null;
    uploadPrompt.classList.remove('hidden');
    filePreview.classList.add('hidden');
    updateButtons();
});

// Shape Selection
document.querySelectorAll('.shape-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.shape-btn').forEach(b => {
            b.classList.remove('active', 'border-indigo-600', 'bg-indigo-50/50', 'text-indigo-700');
            b.classList.add('border-slate-200', 'text-slate-600');
        });
        btn.classList.add('active', 'border-indigo-600', 'bg-indigo-50/50', 'text-indigo-700');
        btn.classList.remove('border-slate-200', 'text-slate-600');
    });
});

// AI Toggle & Settings (Keep existing logic)
const aiToggle = document.getElementById('aiToggle');
const apiKeyContainer = document.getElementById('apiKeyContainer');
const aiPromptContainer = document.getElementById('aiPromptContainer');
const apiKeyInput = document.getElementById('apiKeyInput');

const savedKey = localStorage.getItem('openai_api_key');
if (savedKey) {
    apiKeyInput.value = savedKey;
}

apiKeyInput.addEventListener('change', () => {
    localStorage.setItem('openai_api_key', apiKeyInput.value);
});

aiToggle.addEventListener('change', () => {
    if (aiToggle.checked) {
        apiKeyContainer.classList.remove('hidden');
        aiPromptContainer.classList.remove('hidden');
    } else {
        apiKeyContainer.classList.add('hidden');
        aiPromptContainer.classList.add('hidden');
    }
});

// Advanced Settings Toggle
const advancedToggle = document.getElementById('advancedToggle');
const advancedPanel = document.getElementById('advancedPanel');
const advancedIcon = document.getElementById('advancedIcon');

advancedToggle.addEventListener('click', () => {
    advancedPanel.classList.toggle('hidden');
    advancedIcon.classList.toggle('rotate-180');
});

// Sliders
const textThickness = document.getElementById('textThickness');
const baseThickness = document.getElementById('baseThickness');
const basePadding = document.getElementById('basePadding');
const textDilation = document.getElementById('textDilation');
const holeRadius = document.getElementById('holeRadius');

const textThicknessVal = document.getElementById('textThicknessVal');
const baseThicknessVal = document.getElementById('baseThicknessVal');
const basePaddingVal = document.getElementById('basePaddingVal');
const textDilationVal = document.getElementById('textDilationVal');
const holeRadiusVal = document.getElementById('holeRadiusVal');

textThickness.addEventListener('input', (e) => textThicknessVal.textContent = e.target.value);
baseThickness.addEventListener('input', (e) => baseThicknessVal.textContent = e.target.value);
basePadding.addEventListener('input', (e) => basePaddingVal.textContent = e.target.value);
textDilation.addEventListener('input', (e) => textDilationVal.textContent = e.target.value);
holeRadius.addEventListener('input', (e) => holeRadiusVal.textContent = e.target.value);

// Hole Selection
const holeSelect = document.getElementById('holeSelect');
const holeOffsets = document.getElementById('holeOffsets');

holeSelect.addEventListener('change', () => {
    if (holeSelect.value === 'custom') {
        holeOffsets.classList.remove('hidden');
    } else {
        holeOffsets.classList.add('hidden');
    }
});

// Outline Selection
document.querySelectorAll('.outline-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.outline-btn').forEach(b => {
            b.classList.remove('active', 'bg-white', 'text-indigo-600', 'shadow-sm', 'font-bold');
            b.classList.add('text-slate-500', 'font-medium');
        });
        btn.classList.add('active', 'bg-white', 'text-indigo-600', 'shadow-sm', 'font-bold');
        btn.classList.remove('text-slate-500', 'font-medium');
    });
});

// Preview
const previewBtn = document.getElementById('previewBtn');

function updateButtons() {
    const hasText = document.getElementById('textInput').value.trim().length > 0;
    const hasFile = currentFileId !== null;
    const ready = hasText || hasFile;

    generateBtn.disabled = !ready;
    previewBtn.disabled = !hasText;
}

textInput.addEventListener('input', updateButtons);

// Generate Logic
generateBtn.addEventListener('click', async () => {
    const text = document.getElementById('textInput').value;

    // If we have text, use Client-Side Rendering
    if (text && !currentFileId) {
        loadingOverlay.classList.remove('hidden');
        document.getElementById('loadingText').textContent = "Generating in Browser...";

        try {
            const params = {
                text: text,
                fontName: document.getElementById('fontSelect').value,
                textThickness: parseFloat(textThickness.value),
                baseThickness: parseFloat(baseThickness.value),
                basePadding: parseFloat(basePadding.value),
                holeRadius: parseFloat(holeRadius.value),
                holePosition: holeSelect.value
            };

            const stlUrl = await clientRenderer.generateKeychain(params);

            // Success
            downloadLink.href = stlUrl;
            downloadBar.classList.remove('hidden');

            loadSTL(stlUrl); // Load the blob directly

        } catch (err) {
            console.error(err);
            alert('Client-side generation failed: ' + err.message);
        } finally {
            loadingOverlay.classList.add('hidden');
        }
        return;
    }

    // Fallback to Server-Side for Images (until we port image tracing)
    if (!currentFileId && !text) return;

    loadingOverlay.classList.remove('hidden');
    document.getElementById('loadingText').textContent = "Processing on Server...";

    // ... (Keep existing Server-Side Logic for Images) ...
    // For brevity, I'm omitting the full server-side fallback code here, 
    // but in a real refactor we'd keep it or port image tracing too.
    // Assuming user wants text-to-3d client side mostly.

    // Re-implement server call for images:
    const shape = document.querySelector('.shape-btn.active').dataset.shape;
    const useAi = document.getElementById('aiToggle').checked;
    const apiKey = document.getElementById('apiKeyInput').value;
    const font = document.getElementById('fontSelect').value;
    const outline = document.querySelector('.outline-btn.active').dataset.outline;
    const hole = holeSelect.value;
    const holeX = document.getElementById('holeX').value;
    const holeY = document.getElementById('holeY').value;

    try {
        const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file_id: currentFileId,
                text: text,
                shape: shape,
                use_ai: useAi,
                api_key: apiKey,
                font: font,
                text_thickness: textThickness.value,
                base_thickness: baseThickness.value,
                base_padding: basePadding.value,
                text_dilation: textDilation.value,
                outline_type: outline,
                hole_position: hole,
                hole_x: holeX,
                hole_y: holeY,
                hole_radius: holeRadius.value
            })
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        downloadLink.href = data.stl_url;
        downloadBar.classList.remove('hidden');
        loadSTL(data.stl_url);

    } catch (err) {
        alert('Server generation failed: ' + err.message);
    } finally {
        loadingOverlay.classList.add('hidden');
    }
});

// Colors
const textColorInput = document.getElementById('textColor');
const baseColorInput = document.getElementById('baseColor');

textColorInput.addEventListener('input', () => {
    if (textMesh) textMesh.material.color.set(textColorInput.value);
});

baseColorInput.addEventListener('input', () => {
    if (baseMesh) baseMesh.material.color.set(baseColorInput.value);
});

function loadSTL(url) {
    if (!scene) {
        initViewer();
        viewerContainer.appendChild(renderer.domElement);
        placeholder.classList.add('hidden');
        animate();
    }

    // Remove old meshes
    if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); mesh = null; }
    if (textMesh) { scene.remove(textMesh); textMesh.geometry.dispose(); textMesh.material.dispose(); textMesh = null; }
    if (baseMesh) { scene.remove(baseMesh); baseMesh.geometry.dispose(); baseMesh.material.dispose(); baseMesh = null; }

    const loader = new STLLoader();
    loader.load(url, (geometry) => {
        geometry.computeVertexNormals();
        const material = new THREE.MeshPhysicalMaterial({
            color: 0x60a5fa, metalness: 0.2, roughness: 0.3
        });
        mesh = new THREE.Mesh(geometry, material);
        geometry.center();
        mesh.rotation.x = -Math.PI / 2;
        scene.add(mesh);
        fitCamera([mesh]);
    });
}

function fitCamera(objects) {
    const box = new THREE.Box3();
    objects.forEach(obj => box.expandByObject(obj));

    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());

    controls.reset();
    camera.position.copy(center);
    camera.position.x += size * 0.8;
    camera.position.y += size * 0.8;
    camera.position.z += size * 0.8;
    camera.lookAt(center);
    controls.autoRotate = true;
}
