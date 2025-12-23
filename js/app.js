
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
    step: 1
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
    canvas.addEventListener('mousemove', handleTooltip);
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

            state.pcaVectors = computePCA(state.tfidfMatrix, 2, state.trainIndices);

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

function handleTooltip(e) {
    if (!state.plotPoints) return;

    const canvas = document.getElementById('scatter-plot');
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const hit = state.plotPoints.find(p => {
        const dist = Math.sqrt((p.x - mx)**2 + (p.y - my)**2);
        return dist < p.r + 2;
    });

    const tooltip = document.getElementById('plot-tooltip');
    if (hit) {
        tooltip.style.display = 'block';
        tooltip.style.left = (mx + 10) + 'px';
        tooltip.style.top = (my + 10) + 'px';
        const item = state.cleanedData[hit.index];
        tooltip.innerHTML = `
            <strong>${item.setLabel}</strong> (Cluster ${state.clusters[hit.index]})<br>
            ${item.original.substring(0, 100)}...
        `;
    } else {
        tooltip.style.display = 'none';
    }
}

// Start
init();
