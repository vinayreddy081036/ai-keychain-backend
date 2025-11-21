// Imports removed - using global THREE object from CDN

// State
let currentFileId = null;
let scene, camera, renderer, controls, mesh;

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
    controls = new THREE.OrbitControls(camera, renderer.domElement);
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

    // Upload to server
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
// Listener moved to updateButtons

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
    generateBtn.disabled = true;
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

// AI Toggle
// AI Toggle
const aiToggle = document.getElementById('aiToggle');
const apiKeyContainer = document.getElementById('apiKeyContainer');
const aiPromptContainer = document.getElementById('aiPromptContainer');
const apiKeyInput = document.getElementById('apiKeyInput');

// Load saved API key
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

// --- AI Chat Logic ---
const openChatBtn = document.getElementById('openChatBtn');
const closeChatBtn = document.getElementById('closeChatBtn');
const aiChatModal = document.getElementById('aiChatModal');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const chatHistory = document.getElementById('chatHistory');

let chatMessages = []; // Store conversation history

openChatBtn.addEventListener('click', () => aiChatModal.classList.remove('hidden'));
closeChatBtn.addEventListener('click', () => aiChatModal.classList.add('hidden'));

async function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    // Add User Message
    addMessageToChat('user', text);
    chatInput.value = '';

    // Add to history
    chatMessages.push({ role: 'user', content: text });

    // Show loading
    const loadingId = addMessageToChat('ai', 'Thinking...', true);

    try {
        const apiKey = apiKeyInput.value;
        if (!apiKey) {
            removeMessage(loadingId);
            addMessageToChat('ai', 'Please enter your OpenAI API Key in the settings first.');
            return;
        }

        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: chatMessages,
                api_key: apiKey
            })
        });

        const data = await res.json();
        removeMessage(loadingId);

        if (data.error) {
            addMessageToChat('ai', 'Error: ' + data.error);
            return;
        }

        // Add AI Response
        if (data.reply) {
            addMessageToChat('ai', data.reply);
            chatMessages.push({ role: 'assistant', content: data.reply });
        }

        // Check for Config
        if (data.config) {
            applyAIConfig(data.config);
            addMessageToChat('ai', 'I\'ve updated the design settings for you! You can now click "Generate 3D Model".');
            setTimeout(() => aiChatModal.classList.add('hidden'), 2000);
        }

    } catch (e) {
        removeMessage(loadingId);
        addMessageToChat('ai', 'Connection error: ' + e.message);
    }
}

sendChatBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});

function addMessageToChat(role, text, isLoading = false) {
    const id = 'msg-' + Date.now();
    const isUser = role === 'user';
    const div = document.createElement('div');
    div.id = id;
    div.className = `flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`;

    const icon = isUser ?
        `<div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 text-slate-600"><i data-lucide="user" class="w-4 h-4"></i></div>` :
        `<div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-indigo-600"><i data-lucide="bot" class="w-4 h-4"></i></div>`;

    const bubble = isUser ?
        `<div class="bg-indigo-600 text-white p-3 rounded-2xl rounded-tr-none shadow-sm text-sm">${text}</div>` :
        `<div class="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 text-sm text-slate-600 ${isLoading ? 'animate-pulse' : ''}">${text}</div>`;

    div.innerHTML = icon + bubble;
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    lucide.createIcons();
    return id;
}

function removeMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function applyAIConfig(p) {
    if (p.text_content) document.getElementById('textInput').value = p.text_content;
    if (p.font) document.getElementById('fontSelect').value = p.font;
    if (p.text_thickness) {
        textThickness.value = p.text_thickness;
        textThicknessVal.textContent = p.text_thickness;
    }
    if (p.base_thickness) {
        baseThickness.value = p.base_thickness;
        baseThicknessVal.textContent = p.base_thickness;
    }
    if (p.base_padding) {
        basePadding.value = p.base_padding;
        basePaddingVal.textContent = p.base_padding;
    }
    if (p.text_dilation) {
        textDilation.value = p.text_dilation;
        textDilationVal.textContent = p.text_dilation;
    }
    if (p.hole_radius) {
        holeRadius.value = p.hole_radius;
        holeRadiusVal.textContent = p.hole_radius;
    }
    if (p.hole_position) holeSelect.value = p.hole_position;

    // TODO: Add color inputs
    // if (p.text_color) textColorInput.value = p.text_color;
    // if (p.base_color) baseColorInput.value = p.base_color;

    if (p.outline_type) {
        document.querySelectorAll('.outline-btn').forEach(b => {
            if (b.dataset.outline === p.outline_type) b.click();
        });
    }
}

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
    previewBtn.disabled = !hasText; // Preview only for text mode for now
}

textInput.addEventListener('input', updateButtons);

previewBtn.addEventListener('click', async () => {
    const text = textInput.value;
    const font = document.getElementById('fontSelect').value;

    if (!text) return;

    previewBtn.disabled = true;
    previewBtn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Generating...';

    try {
        const res = await fetch('/api/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, font })
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // Show preview
        previewImg.src = data.preview_url;
        fileName.textContent = "Text Preview";
        uploadPrompt.classList.add('hidden');
        filePreview.classList.remove('hidden');

        // Update file ID so generation uses this preview
        currentFileId = data.file_id;

    } catch (err) {
        alert('Preview failed: ' + err.message);
    } finally {
        previewBtn.disabled = false;
        previewBtn.innerHTML = '<i data-lucide="eye" class="w-5 h-5"></i> Preview 2D';
        lucide.createIcons();
    }
});

// Generate
generateBtn.addEventListener('click', async () => {
    const text = document.getElementById('textInput').value;
    if (!currentFileId && !text) return;

    loadingOverlay.classList.remove('hidden');

    const shape = document.querySelector('.shape-btn.active').dataset.shape;
    const useAi = document.getElementById('aiToggle').checked;
    const apiKey = document.getElementById('apiKeyInput').value;

    // Advanced Params
    const font = document.getElementById('fontSelect').value;
    const textThick = textThickness.value;
    const baseThick = baseThickness.value;
    const basePad = basePadding.value;
    const outline = document.querySelector('.outline-btn.active').dataset.outline;
    const hole = holeSelect.value;
    const holeX = document.getElementById('holeX').value;
    const holeY = document.getElementById('holeY').value;
    const holeRadius = parseFloat(document.getElementById('holeRadius').value) || 3.0; // Added holeRadius

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
                text_thickness: textThick,
                base_thickness: baseThick,
                base_padding: basePad,
                text_dilation: textDilation.value,
                outline_type: outline,
                hole_position: hole,
                hole_x: holeX,
                hole_y: holeY,
                hole_radius: holeRadius, // Added to payload
                ai_prompt: aiPrompt
            })
        });

        const data = await res.json();

        if (data.error) throw new Error(data.error);

        // Apply AI Params if present
        if (data.ai_params) {
            const p = data.ai_params;

            // Update Inputs
            if (p.text_content) document.getElementById('textInput').value = p.text_content;
            if (p.font) document.getElementById('fontSelect').value = p.font;
            if (p.text_thickness) {
                textThickness.value = p.text_thickness;
                textThicknessVal.textContent = p.text_thickness;
            }
            if (p.base_thickness) {
                baseThickness.value = p.base_thickness;
                baseThicknessVal.textContent = p.base_thickness;
            }
            if (p.base_padding) {
                basePadding.value = p.base_padding;
                basePaddingVal.textContent = p.base_padding;
            }
            if (p.text_dilation) {
                textDilation.value = p.text_dilation;
                textDilationVal.textContent = p.text_dilation;
            }
            if (p.hole_position) holeSelect.value = p.hole_position;

            // Update Colors
            if (p.text_color) textColorInput.value = p.text_color;
            if (p.base_color) baseColorInput.value = p.base_color;

            // Update Outline Buttons
            if (p.outline_type) {
                document.querySelectorAll('.outline-btn').forEach(b => {
                    if (b.dataset.outline === p.outline_type) b.click();
                });
            }

            // Show Reasoning
            if (p.reasoning) {
                // Create or update reasoning toast/alert
                let reasoningBox = document.getElementById('aiReasoning');
                if (!reasoningBox) {
                    reasoningBox = document.createElement('div');
                    reasoningBox.id = 'aiReasoning';
                    reasoningBox.className = 'fixed top-24 right-6 max-w-sm bg-white/90 backdrop-blur p-4 rounded-xl shadow-xl border border-purple-100 z-50 animate-in slide-in-from-right duration-500';
                    document.body.appendChild(reasoningBox);
                }
                reasoningBox.innerHTML = `
                    <div class="flex items-start gap-3">
                        <div class="p-2 bg-purple-100 text-purple-600 rounded-lg shrink-0">
                            <i data-lucide="sparkles" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <p class="text-xs font-bold text-purple-900 uppercase mb-1">AI Designer</p>
                            <p class="text-sm text-slate-700">${p.reasoning}</p>
                        </div>
                        <button onclick="this.parentElement.parentElement.remove()" class="text-slate-400 hover:text-slate-600">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>
                `;
                lucide.createIcons();

                // Auto hide after 8s
                setTimeout(() => {
                    if (reasoningBox && document.body.contains(reasoningBox)) {
                        reasoningBox.remove();
                    }
                }, 8000);
            }
        }

        // Success
        downloadLink.href = data.stl_url;
        downloadBar.classList.remove('hidden');

        try {
            loadSTL(data.stl_url, data.base_url, data.text_url);
        } catch (e) {
            console.error("Viewer error:", e);
        }

    } catch (err) {
        alert('Generation failed: ' + err.message);
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

let textMesh = null;
let baseMesh = null;

function loadSTL(url, baseUrl = null, textUrl = null) {
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

    const loader = new THREE.STLLoader();

    if (baseUrl && textUrl) {
        // Load separate parts
        loader.load(baseUrl, (geometry) => {
            geometry.computeVertexNormals();
            const material = new THREE.MeshPhysicalMaterial({
                color: baseColorInput.value,
                metalness: 0.1, roughness: 0.5, clearcoat: 0.1
            });
            baseMesh = new THREE.Mesh(geometry, material);
            baseMesh.rotation.x = -Math.PI / 2;
            scene.add(baseMesh);
            fitCamera([baseMesh]);
        });

        loader.load(textUrl, (geometry) => {
            geometry.computeVertexNormals();
            const material = new THREE.MeshPhysicalMaterial({
                color: textColorInput.value,
                metalness: 0.2, roughness: 0.2, clearcoat: 0.3
            });
            textMesh = new THREE.Mesh(geometry, material);
            textMesh.rotation.x = -Math.PI / 2;
            scene.add(textMesh);
        });

    } else {
        // Fallback to single mesh
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
