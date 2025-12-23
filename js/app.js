
import { parseCSV, downloadCSV, downloadJSON } from './io.js';
import { executePipeline } from './cleaning.js';
import { computeTFIDF, computePCA, computeKMeans } from './analysis.js';
import { renderResults, drawScatterPlot } from './vis.js';

/**
 * APP STATE
 */
const state = {
    rawData: [],
    headers: [],
    targetColumn: null,
    cleanedData: [],
    tfidfMatrix: null,
    featureNames: [],
    pcaVectors: null,
    clusters: null,
    trainIndices: null,
    step: 1,
    // Visualization State
    rotationX: 0,
    rotationY: 0,
    scale: 1,
    visDistance: 2,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0
};

function init() {
    // Step 1: File Input
    document.getElementById('csv-file').addEventListener('change', handleFileUpload);
    document.getElementById('confirm-column-btn').addEventListener('click', () => {
        state.targetColumn = document.getElementById('target-column').value;
        activateStep(2);
    });

    // Step 2: Pipeline
    document.getElementById('add-op-btn').addEventListener('click', addPipelineOperation);
    document.getElementById('confirm-pipeline-btn').addEventListener('click', () => activateStep(3));
    document.getElementById('preview-cleaning-btn').addEventListener('click', showCleaningPreview);

    // Step 3: Analysis
    document.getElementById('run-analysis-btn').addEventListener('click', runAnalysis);

    // Step 4: Export
    document.getElementById('download-csv-btn').addEventListener('click', () => downloadCSV(state.cleanedData));
    document.getElementById('download-json-btn').addEventListener('click', () => downloadJSON(state.cleanedData, state.pcaVectors, state.clusters));

    // Global Tooltip Listener
    const canvas = document.getElementById('scatter-plot');

    // Interaction Listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
}

function activateStep(stepNum) {
    state.step = stepNum;
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`step-${i}`);
        if (i <= stepNum) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    }
    document.getElementById(`step-${stepNum}`).scrollIntoView({ behavior: 'smooth' });
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const delimiter = document.getElementById('csv-delimiter').value || ',';
    const encoding = document.getElementById('csv-encoding').value || 'UTF-8';

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const text = evt.target.result;
            const result = parseCSV(text, delimiter);
            state.rawData = result.data;
            state.headers = result.headers;

            const select = document.getElementById('target-column');
            select.innerHTML = '';
            state.headers.forEach(h => {
                const option = document.createElement('option');
                option.value = h;
                option.textContent = h;
                select.appendChild(option);
            });
            document.getElementById('column-select-group').style.display = 'block';
        } catch (err) {
            console.error("Error processing file:", err);
            alert("Error parsing CSV. Check format/delimiter.");
        }
    };
    reader.readAsText(file, encoding);
}

function getPipeline() {
    const items = document.querySelectorAll('.pipeline-item');
    const pipeline = [];
    items.forEach(item => {
        const type = item.dataset.type;
        const params = {};
        if (type === 'regex_remove') {
            params.regex = item.querySelector('.op-input-regex').value;
        } else if (type === 'custom') {
            params.funcBody = item.querySelector('.op-input-custom').value;
        }
        pipeline.push({ type, params });
    });
    return pipeline;
}

function addPipelineOperation() {
    const type = document.getElementById('operation-select').value;
    const container = document.getElementById('pipeline-container');
    const emptyMsg = document.getElementById('pipeline-empty-msg');

    if (emptyMsg) emptyMsg.style.display = 'none';

    const opId = Date.now();
    const item = document.createElement('div');
    item.className = 'pipeline-item';
    item.dataset.id = opId;
    item.dataset.type = type;

    let detailsHtml = `<strong>${type}</strong>`;
    if (type === 'regex_remove') {
        detailsHtml += ` <input type="text" placeholder="Enter Regex (e.g. ^Ref:)" class="op-input-regex">`;
    } else if (type === 'custom') {
        detailsHtml += ` <textarea placeholder="return text.replace(/a/g, 'b');" class="op-input-custom"></textarea>`;
    }

    item.innerHTML = `
        <div class="details">${detailsHtml}</div>
        <div class="controls">
            <button class="remove-btn" data-id="${opId}">X</button>
            <div style="display:flex; flex-direction:column; margin-left:5px;">
                <button class="move-up-btn" data-id="${opId}" style="padding:2px; font-size:10px;">▲</button>
                <button class="move-down-btn" data-id="${opId}" style="padding:2px; font-size:10px;">▼</button>
            </div>
        </div>
    `;

    // Attach listeners dynamically or use delegation. Using simple closures for now.
    item.querySelector('.remove-btn').addEventListener('click', () => item.remove());
    item.querySelector('.move-up-btn').addEventListener('click', () => {
        if (item.previousElementSibling && item.previousElementSibling.id !== 'pipeline-empty-msg') {
            container.insertBefore(item, item.previousElementSibling);
        }
    });
    item.querySelector('.move-down-btn').addEventListener('click', () => {
        if (item.nextElementSibling) {
            container.insertBefore(item.nextElementSibling, item);
        }
    });

    container.appendChild(item);
}

function showCleaningPreview() {
    const pipeline = getPipeline();
    if (!state.rawData.length) return;

    // Preview first 5 rows
    const subset = state.rawData.slice(0, 5);
    const cleaned = executePipeline(subset, state.targetColumn, pipeline);

    const container = document.getElementById('cleaning-preview-container');
    container.innerHTML = '<h4>Preview (First 5 Rows)</h4>';
    const table = document.createElement('table');
    table.innerHTML = `<thead><tr><th>Original</th><th>Cleaned</th></tr></thead><tbody></tbody>`;
    const tbody = table.querySelector('tbody');

    cleaned.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${item.original}</td><td>${item.cleaned}</td>`;
        tbody.appendChild(tr);
    });

    container.appendChild(table);
    container.style.display = 'block';
}

async function runAnalysis() {
    document.getElementById('loading-indicator').style.display = 'block';
    document.getElementById('results-area').style.display = 'none';

    setTimeout(() => {
        try {
            // 1. Full Pipeline
            const pipeline = getPipeline();
            state.cleanedData = executePipeline(state.rawData, state.targetColumn, pipeline);

            if (state.cleanedData.length === 0) {
                throw new Error("No data remaining after cleaning.");
            }

            // 2. Data Splitting
            const splitRatio = parseFloat(document.getElementById('split-ratio').value) || 0.8;
            performSplit(splitRatio);

            // 3. Analysis
            const tfidfOptions = {
                minDf: parseInt(document.getElementById('min-df').value),
                maxDf: parseFloat(document.getElementById('max-df').value),
                nMin: parseInt(document.getElementById('ngram-min').value),
                nMax: parseInt(document.getElementById('ngram-max').value)
            };
            const result = computeTFIDF(state.cleanedData, tfidfOptions);
            state.tfidfMatrix = result.matrix;
            state.featureNames = result.featureNames;

            state.pcaVectors = computePCA(state.tfidfMatrix, 3, state.trainIndices);

            const k = parseInt(document.getElementById('kmeans-k').value);
            state.clusters = computeKMeans(state.pcaVectors, k, state.trainIndices);

            // 4. Render
            renderResults(state);
            activateStep(4);
        } catch (err) {
            alert("Error: " + err.message);
            console.error(err);
        } finally {
            document.getElementById('loading-indicator').style.display = 'none';
            document.getElementById('results-area').style.display = 'block';
        }
    }, 100);
}

function performSplit(ratio) {
    const n = state.cleanedData.length;
    const indices = Array.from({ length: n }, (_, i) => i);

    // Shuffle
    for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const nTrain = Math.floor(n * ratio);
    const trainIndices = indices.slice(0, nTrain);
    const testIndices = indices.slice(nTrain);

    const trainSet = new Set(trainIndices);
    state.cleanedData.forEach((item, i) => {
        item.setLabel = trainSet.has(i) ? 'Train' : 'Test';
    });

    state.trainIndices = trainIndices;
}

function handleMouseDown(e) {
    if (!state.pcaVectors) return;
    state.isDragging = true;
    state.lastMouseX = e.clientX;
    state.lastMouseY = e.clientY;
}

function handleMouseMove(e) {
    if (!state.pcaVectors) return;

    const canvas = document.getElementById('scatter-plot');
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (state.isDragging) {
        const deltaX = e.clientX - state.lastMouseX;
        const deltaY = e.clientY - state.lastMouseY;

        state.rotationY += deltaX * 0.01;
        state.rotationX += deltaY * 0.01;

        state.lastMouseX = e.clientX;
        state.lastMouseY = e.clientY;

        drawScatterPlot(state);
    } else {
        // Tooltip logic
        handleTooltip(mx, my);
    }
}

function handleMouseUp(e) {
    state.isDragging = false;
}

function handleWheel(e) {
    if (!state.pcaVectors) return;
    e.preventDefault();

    const zoomSpeed = 0.1;
    if (e.deltaY < 0) {
        state.scale *= (1 + zoomSpeed);
    } else {
        state.scale /= (1 + zoomSpeed);
    }
    drawScatterPlot(state);
}

function handleTooltip(mx, my) {
    if (!state.plotPoints) return;

    // Use hit detection on projected points
    // Sort by Z (implicit in painters algo, but we just check distance in 2D)
    // Actually for 3D picking we should probably check Z-buffer or just pick closest 2D point
    // but prioritize ones "on top".
    // Since we draw back-to-front, the last drawn points are on top.
    // So we should search in reverse order or just find all hits and pick max Z?
    // state.plotPoints should store Z or index.

    // Simple closest distance check
    let bestHit = null;
    let minDist = Infinity;

    for (let i = state.plotPoints.length - 1; i >= 0; i--) {
        const p = state.plotPoints[i];
        const dist = Math.sqrt((p.x - mx)**2 + (p.y - my)**2);
        if (dist < p.r + 2) {
             // Found a hit. Since we iterate back-to-front (top-to-bottom),
             // the first one we find is the topmost one.
             bestHit = p;
             break;
        }
    }

    const tooltip = document.getElementById('plot-tooltip');
    if (bestHit) {
        tooltip.style.display = 'block';
        tooltip.style.left = (mx + 10) + 'px';
        tooltip.style.top = (my + 10) + 'px';
        const item = state.cleanedData[bestHit.index];

        // Use CLEANED text
        let content = item.cleaned.substring(0, 200);
        if (item.cleaned.length > 200) content += "...";

        tooltip.innerHTML = `
            <strong>${item.setLabel}</strong> (Cluster ${state.clusters[bestHit.index]})<br>
            <div style="max-width:250px; word-wrap:break-word;">${content}</div>
        `;
    } else {
        tooltip.style.display = 'none';
    }
}

// Start
init();
