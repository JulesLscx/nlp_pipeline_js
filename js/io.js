
/**
 * IO Operations: CSV Parsing and Downloads
 */

export function parseCSV(text, delimiter = ',') {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let insideQuotes = false;

    // Normalize delimiter to handle potential issues? No, straightforward.
    // However, handling delimiters > 1 char is not required by standard csv but nice.
    // Assuming single char delimiter for now.

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (insideQuotes) {
            if (char === '"') {
                if (nextChar === '"') {
                    currentField += '"';
                    i++;
                } else {
                    insideQuotes = false;
                }
            } else {
                currentField += char;
            }
        } else {
            if (char === '"') {
                insideQuotes = true;
            } else if (char === delimiter) {
                currentRow.push(currentField);
                currentField = '';
            } else if (char === '\n' || char === '\r') {
                if (char === '\r' && nextChar === '\n') {
                    i++;
                }
                currentRow.push(currentField);
                rows.push(currentRow);
                currentRow = [];
                currentField = '';
            } else {
                currentField += char;
            }
        }
    }

    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
    }

    if (rows.length < 2) return { headers: [], data: [] };

    const headers = rows[0].map(h => h.trim());
    const data = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        // Allow loose parsing? Or strict?
        // Strict: if (row.length !== headers.length) continue;
        if (row.length !== headers.length) continue;

        const obj = {};
        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = row[j];
        }
        data.push(obj);
    }

    return { headers, data };
}

export function downloadCSV(data) {
    const headers = ['Original Text', 'Cleaned Text', 'Set', 'Cluster ID'];
    const rows = [headers.join(',')];

    data.forEach(item => {
        // Simple CSV escape
        const row = [
            item.original,
            item.cleaned,
            item.setLabel || '',
            item.cluster
        ].map(t => `"${String(t||"").replace(/"/g, '""')}"`);
        rows.push(row.join(','));
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cleaned_data.csv';
    a.click();
}

export function downloadJSON(data, vectors, clusters) {
    const exportData = data.map((item, i) => ({
        id: item.id, // Original Index
        original: item.original,
        cleaned: item.cleaned,
        set: item.setLabel || 'All',
        vector: vectors[i],
        cluster: clusters[i]
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vectors.json';
    a.click();
}
