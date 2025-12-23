
/**
 * Visualization: Tables and Scatter Plot
 */

export function renderResults(state) {
    // 1. Table
    const tbody = document.querySelector('#results-table tbody');
    tbody.innerHTML = '';

    // Render first 500 rows to avoid freezing DOM if large
    const limit = 500;

    state.cleanedData.slice(0, limit).forEach((item, i) => {
        const row = document.createElement('tr');
        const cId = state.clusters[i];
        const setLabel = state.cleanedData[i].setLabel || "-";

        row.innerHTML = `
            <td><div style="max-height:100px; overflow-y:auto;">${escapeHtml(item.original)}</div></td>
            <td><div style="max-height:100px; overflow-y:auto;">${escapeHtml(item.cleaned)}</div></td>
            <td>${setLabel}</td>
            <td>${cId}</td>
        `;
        tbody.appendChild(row);
    });

    if (state.cleanedData.length > limit) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="4" style="text-align:center; color:#999;">... ${state.cleanedData.length - limit} more rows hidden ...</td>`;
        tbody.appendChild(row);
    }

    // 2. TF-IDF Preview
    const matrixBody = document.querySelector('#tfidf-preview-table tbody');
    const matrixHead = document.querySelector('#tfidf-preview-table thead');
    matrixBody.innerHTML = '';
    matrixHead.innerHTML = '';

    // Headers
    const headRow = document.createElement('tr');
    headRow.innerHTML = '<th>Doc ID</th>' + state.featureNames.slice(0, 20).map(f => `<th>${f}</th>`).join('');
    matrixHead.appendChild(headRow);

    // Rows (first 10)
    state.tfidfMatrix.slice(0, 10).forEach((vec, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i}</td>` + vec.slice(0, 20).map(v => `<td>${v.toFixed(3)}</td>`).join('');
        matrixBody.appendChild(tr);
    });

    // 3. Scatter Plot
    drawScatterPlot(state);
}

export function drawScatterPlot(state) {
    const canvas = document.getElementById('scatter-plot');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Find bounds
    const xs = state.pcaVectors.map(v => v[0]);
    const ys = state.pcaVectors.map(v => v[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const padding = 40;
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    // Scale function
    const scaleX = (x) => padding + ((x - minX) / rangeX) * (width - 2 * padding);
    const scaleY = (y) => height - padding - ((y - minY) / rangeY) * (height - 2 * padding);

    // Colors
    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f1c40f', '#e67e22', '#1abc9c', '#34495e'];

    state.plotPoints = [];

    state.pcaVectors.forEach((vec, i) => {
        const cx = scaleX(vec[0]);
        const cy = scaleY(vec[1]);
        const cluster = state.clusters[i];
        const isTrain = state.cleanedData[i].setLabel === 'Train';

        ctx.beginPath();
        // Circle for Train, Square for Test?
        // Or just same shape. Let's use shape: Circle (Train), Triangle (Test)
        if (state.cleanedData[i].setLabel === 'Test') {
            // Triangle
            ctx.moveTo(cx, cy - 6);
            ctx.lineTo(cx + 6, cy + 6);
            ctx.lineTo(cx - 6, cy + 6);
            ctx.closePath();
        } else {
            // Circle (Default/Train)
            ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
        }

        ctx.fillStyle = colors[cluster % colors.length];
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        // Save for tooltip
        state.plotPoints.push({ x: cx, y: cy, r: 6, index: i });
    });

    // Draw Axes
    ctx.strokeStyle = '#ccc';
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding); // X
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(padding, padding); // Y
    ctx.stroke();

    // Tooltip Interaction (Needs to be attached only once or handled carefully)
    // Here we just update the global state.plotPoints used by the event listener in app.js
    // Actually, event listener is better attached here or in app.js.
    // Let's assume app.js attaches the listener and checks state.plotPoints.
}

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#039;");
}
