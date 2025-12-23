
/**
 * Text Cleaning Operations
 */
export const Operations = {
    lowercase: (text) => text.toLowerCase(),
    punctuation: (text) => text.replace(/[.,\/#!$%\^&\*;:{}=\-_~()?]/g, ""),
    french_stopwords: (text) => {
        const stopWords = new Set([
            "au", "aux", "avec", "ce", "ces", "dans", "de", "des", "du", "elle", "en", "et", "eux",
            "il", "je", "la", "le", "leur", "lui", "ma", "mais", "me", "meme", "mes", "moi", "mon",
            "ne", "nos", "notre", "nous", "on", "ou", "par", "pas", "pour", "qu", "que", "qui", "sa",
            "se", "ses", "son", "sur", "ta", "te", "tes", "toi", "ton", "tu", "un", "une", "vos", "votre",
            "vous", "c", "d", "j", "l", "à", "m", "n", "s", "t", "y", "été", "étée", "étées", "étés",
            "étant", "suis", "es", "est", "sommes", "êtes", "sont", "serai", "seras", "sera", "serons",
            "serez", "seront", "serais", "serait", "serions", "seriez", "seraient", "étais", "était",
            "étions", "étiez", "étaient", "fus", "fut", "fûmes", "fûtes", "furent", "sois", "soit",
            "soyons", "soyez", "soient", "fusse", "fusses", "fût", "fussions", "fussiez", "fussent",
            "ayant", "eu", "eue", "eues", "eus", "ai", "as", "avons", "avez", "ont", "aurai", "auras",
            "aura", "aurons", "aurez", "auront", "aurais", "aurait", "aurions", "auriez", "auraient",
            "avais", "avait", "avions", "aviez", "avaient", "eut", "eûmes", "eûtes", "eurent", "aie",
            "aies", "ait", "ayons", "ayez", "aient", "eusse", "eusses", "eût", "eussions", "eussiez", "eussent"
        ]);
        return text.split(/\s+/).filter(word => !stopWords.has(word.toLowerCase())).join(" ");
    }
};

export function executePipeline(rawData, targetColumn, pipelineItems) {
    const processedList = [];
    const rawList = rawData.map(r => r[targetColumn] || "");

    rawList.forEach((text, idx) => {
        let currentText = text;
        let drop = false;

        for (const item of pipelineItems) {
            const type = item.type;

            if (type === 'regex_remove') {
                const regexStr = item.params.regex;
                if (regexStr) {
                    try {
                        const re = new RegExp(regexStr);
                        if (re.test(currentText)) {
                            drop = true;
                            break;
                        }
                    } catch (e) { console.error("Regex error", e); }
                }
            } else if (type === 'custom') {
                const funcBody = item.params.funcBody;
                try {
                    const func = new Function('text', funcBody);
                    currentText = func(currentText);
                    if (typeof currentText !== 'string') currentText = String(currentText);
                } catch (e) { console.error("Custom Function Error", e); }
            } else if (Operations[type]) {
                currentText = Operations[type](currentText);
            }
        }

        if (!drop) {
            processedList.push({
                original: text,
                cleaned: currentText,
                id: idx
            });
        }
    });

    return processedList;
}
