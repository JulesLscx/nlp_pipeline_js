
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

    if (!state.pcaVectors || state.pcaVectors.length === 0) return;

    // 3D Visualization Logic
    const points = state.pcaVectors;

    // Camera / Rotation
    const rotX = state.rotationX;
    const rotY = state.rotationY;
    const scale = state.scale || 1;
    const dist = state.visDistance || 2;

    const cx = width / 2;
    const cy = height / 2;

    // Scale data to fit loosely in -1 to 1 range for rendering
    // We compute global bounds once preferably, but here we can just do it every time
    // since dataset size is small.
    // Actually, PCA results are already standardized (roughly N(0,1))
    // So we can assume they are roughly in range [-3, 3].
    // Let's normalize explicitly to be safe.

    // Find Max Abs value to normalize
    let maxVal = 0;
    for(let i=0; i<points.length; i++) {
        for(let j=0; j<points[i].length; j++) {
             maxVal = Math.max(maxVal, Math.abs(points[i][j]));
        }
    }
    const dataScale = 150 * scale; // Base scale in pixels

    const projectedPoints = [];

    // Colors
    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f1c40f', '#e67e22', '#1abc9c', '#34495e'];

    points.forEach((vec, i) => {
        const x = vec[0] / maxVal;
        const y = vec[1] / maxVal;
        const z = vec[2] / maxVal; // 3rd component

        // Rotation around Y
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const x1 = x * cosY - z * sinY;
        const z1 = z * cosY + x * sinY;

        // Rotation around X
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const y2 = y * cosX - z1 * sinX;
        const z2 = z1 * cosX + y * sinX;

        // Projection (Perspective)
        // Camera is at (0, 0, dist)
        // z2 is in [-1, 1] roughly.
        // We shift z2 so it's relative to camera
        const zDepth = dist - z2;

        // Perspective factor
        const f = 400 / (zDepth < 0.1 ? 0.1 : zDepth);

        const px = x1 * f * scale + cx;
        const py = -y2 * f * scale + cy; // Invert Y for canvas

        projectedPoints.push({
            x: px,
            y: py,
            z: zDepth, // Store depth for sorting
            index: i,
            r: 5 + (2 / zDepth) * scale // Size varies by depth
        });
    });

    // Painter's Algorithm: Sort by depth (far to near)
    projectedPoints.sort((a, b) => b.z - a.z);

    state.plotPoints = projectedPoints;

    // Draw Points
    projectedPoints.forEach(p => {
        const cluster = state.clusters[p.index];
        const isTest = state.cleanedData[p.index].setLabel === 'Test';

        ctx.fillStyle = colors[cluster % colors.length];

        // Fade out distant points?
        // ctx.globalAlpha = Math.max(0.1, 1 - (p.z / 5));

        ctx.beginPath();
        if (isTest) {
            // Triangle
            const r = p.r * 1.2;
            ctx.moveTo(p.x, p.y - r);
            ctx.lineTo(p.x + r, p.y + r);
            ctx.lineTo(p.x - r, p.y + r);
            ctx.closePath();
        } else {
            // Circle
            ctx.arc(p.x, p.y, p.r, 0, 2 * Math.PI);
        }
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // ctx.globalAlpha = 1.0;
    });

    // Optional: Draw Axes (3D)
    // Not strictly necessary but helpful.
    // We can just draw a small triad in the corner or center.
}

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#039;");
}
