
/**
 * Analysis Algorithms: TF-IDF, PCA, K-Means
 */

export function computeTFIDF(cleanedData, options) {
    const { minDf, maxDf, nMin, nMax } = options;
    const docs = cleanedData.map(d => d.cleaned);
    const N = docs.length;

    // 1. Tokenization & N-grams
    const docTokens = docs.map(doc => {
        const tokens = doc.toLowerCase().split(/\s+/).filter(t => t.length > 0);
        const ngrams = [];
        for (let n = nMin; n <= nMax; n++) {
            for (let i = 0; i <= tokens.length - n; i++) {
                ngrams.push(tokens.slice(i, i + n).join(" "));
            }
        }
        return ngrams;
    });

    // 2. Document Frequency
    const df = {};
    docTokens.forEach(tokens => {
        const uniqueTokens = new Set(tokens);
        uniqueTokens.forEach(t => {
            df[t] = (df[t] || 0) + 1;
        });
    });

    // 3. Filtering
    const vocabulary = Object.keys(df).filter(term => {
        const count = df[term];
        const ratio = count / N;
        return count >= minDf && ratio <= maxDf;
    }).sort();

    if (vocabulary.length === 0) throw new Error("Vocabulary is empty after filtering.");

    // 4. Matrix Construction
    const matrix = docTokens.map(tokens => {
        const counts = {};
        tokens.forEach(t => counts[t] = (counts[t] || 0) + 1);

        const row = vocabulary.map(term => {
            const tf = counts[term] || 0;
            const idf = Math.log((N + 1) / (df[term] + 1)) + 1;
            return tf * idf;
        });

        // L2 Normalize
        const sumSq = row.reduce((acc, val) => acc + val * val, 0);
        const norm = Math.sqrt(sumSq);
        return norm > 0 ? row.map(v => v / norm) : row;
    });

    return { matrix, featureNames: vocabulary };
}

export function computePCA(X, nComponents, trainIndices) {
    const nSamples = X.length;
    const nFeatures = X[0].length;

    // Use only training data to compute statistics
    const trainX = trainIndices ? trainIndices.map(i => X[i]) : X;
    const nTrain = trainX.length;

    // 1. Standardize (Center and Scale) based on Train
    const means = new Array(nFeatures).fill(0);
    const stds = new Array(nFeatures).fill(0);

    for (let j = 0; j < nFeatures; j++) {
        let sum = 0;
        for (let i = 0; i < nTrain; i++) sum += trainX[i][j];
        means[j] = sum / nTrain;
    }

    for (let j = 0; j < nFeatures; j++) {
        let sumSq = 0;
        for (let i = 0; i < nTrain; i++) {
            sumSq += Math.pow(trainX[i][j] - means[j], 2);
        }
        stds[j] = Math.sqrt(sumSq / (nTrain - 1)) || 1;
    }

    // Standardize ALL data (Train + Test)
    const Z = [];
    for (let i = 0; i < nSamples; i++) {
        const row = [];
        for (let j = 0; j < nFeatures; j++) {
            row.push((X[i][j] - means[j]) / stds[j]);
        }
        Z.push(row);
    }

    // 2. Covariance Matrix on Train Z
    // We need to standardize TrainX specifically for Covariance calc
    const trainZ = trainIndices ? trainIndices.map(i => Z[i]) : Z;

    const C = new Array(nFeatures);
    for (let i = 0; i < nFeatures; i++) C[i] = new Array(nFeatures).fill(0);

    for (let i = 0; i < nFeatures; i++) {
        for (let j = i; j < nFeatures; j++) {
            let sum = 0;
            for (let k = 0; k < nTrain; k++) {
                sum += trainZ[k][i] * trainZ[k][j];
            }
            const cov = sum / (nTrain - 1);
            C[i][j] = cov;
            C[j][i] = cov;
        }
    }

    // 3. Eigen Decomposition
    const { eigenvectors, eigenvalues } = jacobi(C);

    // 4. Sort and Project
    const indices = eigenvalues.map((e, i) => i);
    indices.sort((a, b) => eigenvalues[b] - eigenvalues[a]);

    const topIndices = indices.slice(0, nComponents);
    const projectionMatrix = topIndices.map(idx => eigenvectors[idx]);

    // Project ALL data
    const pcaVectors = [];
    for (let i = 0; i < nSamples; i++) {
        const row = [];
        for (let k = 0; k < nComponents; k++) {
            let sum = 0;
            for (let j = 0; j < nFeatures; j++) {
                sum += Z[i][j] * projectionMatrix[k][j];
            }
            row.push(sum);
        }
        pcaVectors.push(row);
    }

    return pcaVectors;
}

function jacobi(A, maxIter = 100, tol = 1e-8) {
    const n = A.length;
    let M = A.map(row => [...row]);
    let V = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
    );

    for (let iter = 0; iter < maxIter; iter++) {
        let maxVal = 0;
        let p = 0, q = 0;
        for (let i = 0; i < n - 1; i++) {
            for (let j = i + 1; j < n; j++) {
                if (Math.abs(M[i][j]) > maxVal) {
                    maxVal = Math.abs(M[i][j]);
                    p = i;
                    q = j;
                }
            }
        }

        if (maxVal < tol) break;

        const app = M[p][p];
        const aqq = M[q][q];
        const apq = M[p][q];

        const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
        const c = Math.cos(phi);
        const s = Math.sin(phi);

        M[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
        M[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
        M[p][q] = 0;
        M[q][p] = 0;

        for (let i = 0; i < n; i++) {
            if (i !== p && i !== q) {
                const api = M[i][p];
                const aqi = M[i][q];
                M[i][p] = c * api - s * aqi;
                M[p][i] = M[i][p];
                M[i][q] = s * api + c * aqi;
                M[q][i] = M[i][q];
            }
        }

        for (let i = 0; i < n; i++) {
            const vip = V[i][p];
            const viq = V[i][q];
            V[i][p] = c * vip - s * viq;
            V[i][q] = s * vip + c * viq;
        }
    }

    const eigenvalues = [];
    for (let i = 0; i < n; i++) eigenvalues.push(M[i][i]);

    const eigenvectors = [];
    for (let j = 0; j < n; j++) {
        const vec = [];
        for (let i = 0; i < n; i++) vec.push(V[i][j]);
        eigenvectors.push(vec);
    }

    return { eigenvalues, eigenvectors };
}

export function computeKMeans(data, k, trainIndices) {
    const n = data.length;

    // Use ONLY Train data for initialization and updates
    const trainData = trainIndices ? trainIndices.map(i => data[i]) : data;
    const nTrain = trainData.length;

    // Initialize Centroids Randomly from Train Data
    let centroids = [];
    const usedIndices = new Set();
    while (centroids.length < k && usedIndices.size < nTrain) {
        const idx = Math.floor(Math.random() * nTrain);
        if (!usedIndices.has(idx)) {
            usedIndices.add(idx);
            centroids.push([...trainData[idx]]);
        }
    }
    while (centroids.length < k) centroids.push([...trainData[0]]);

    let assignments = new Array(n).fill(-1);
    let changed = true;
    let maxIter = 100;

    for (let iter = 0; iter < maxIter && changed; iter++) {
        changed = false;

        // Assignment Step: Assign ALL data to centroids
        for (let i = 0; i < n; i++) {
            let minDist = Infinity;
            let cluster = -1;
            for (let j = 0; j < k; j++) {
                const d = euclidean(data[i], centroids[j]);
                if (d < minDist) {
                    minDist = d;
                    cluster = j;
                }
            }
            if (assignments[i] !== cluster) {
                assignments[i] = cluster;
                changed = true;
            }
        }

        // Update Step: Update centroids using ONLY Train data
        const newCentroids = Array.from({ length: k }, () => [0, 0]);
        const counts = new Array(k).fill(0);

        // Iterate over TRAIN data only
        if (trainIndices) {
            trainIndices.forEach(realIdx => {
                const c = assignments[realIdx];
                newCentroids[c][0] += data[realIdx][0];
                newCentroids[c][1] += data[realIdx][1];
                counts[c]++;
            });
        } else {
             for (let i = 0; i < n; i++) {
                const c = assignments[i];
                newCentroids[c][0] += data[i][0];
                newCentroids[c][1] += data[i][1];
                counts[c]++;
            }
        }

        for (let j = 0; j < k; j++) {
            if (counts[j] > 0) {
                centroids[j][0] = newCentroids[j][0] / counts[j];
                centroids[j][1] = newCentroids[j][1] / counts[j];
            }
        }
    }

    return assignments;
}

function euclidean(a, b) {
    return Math.sqrt(Math.pow(a[0]-b[0], 2) + Math.pow(a[1]-b[1], 2));
}
