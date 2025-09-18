#!/usr/bin/env node

// Script CLI pour tracer les alias jusqu'à la valeur racine
import fs from 'fs';
import path from 'path';

class TokenAliasTracer {
    constructor() {
        this.keyMapping = new Map();
        this.directIdMapping = new Map();
        this.tokensData = [];
        this.loaded = false;
    }

    async loadData() {
        if (this.loaded) return;

        console.log('🔄 Chargement des données...');

        // Charger les tokens
        const corePrimitives = JSON.parse(fs.readFileSync('raw/core-primitives/tokens-merged.json', 'utf8'));
        const densitySystem = JSON.parse(fs.readFileSync('raw/density-system/tokens-merged.json', 'utf8'));
        const colorThemes = JSON.parse(fs.readFileSync('raw/color-themes/tokens-merged.json', 'utf8'));

        this.tokensData = [...corePrimitives, ...densitySystem, ...colorThemes];

        // Charger les mappings
        const keyMapping = JSON.parse(fs.readFileSync('raw/key-mapping.json', 'utf8'));
        const directIdMapping = JSON.parse(fs.readFileSync('raw/direct-id-mapping.json', 'utf8'));

        this.keyMapping = new Map(Object.entries(keyMapping));
        this.directIdMapping = new Map(Object.entries(directIdMapping));

        this.loaded = true;
        console.log(`✅ Données chargées: ${this.tokensData.length} tokens, ${this.keyMapping.size} keys, ${this.directIdMapping.size} IDs directs`);
    }

    resolveAlias(value) {
        if (typeof value === 'object' && value !== null && value.type === 'VARIABLE_ALIAS') {
            // D'abord, essayer de résoudre avec l'ID direct
            const directToken = this.directIdMapping.get(value.id);
            if (directToken) {
                return directToken.name;
            }
            
            // Sinon, essayer d'extraire la key de l'alias
            const match = value.id.match(/VariableID:([^/]+)\//);
            if (match) {
                const key = match[1];
                const token = this.keyMapping.get(key);
                if (token) {
                    return token.name;
                }
            }
        }
        return null;
    }

    getModeName(modeId) {
        const modeMap = {
            // Modes de thème
            '2403:0': 'JLL Light',
            '2403:1': 'JLL Dark',
            '23394:0': 'Lasalle Light',
            '23394:1': 'Lasalle Dark',
            
            // Modes de breakpoint
            '13263:0': 'Mobile Small (320px)',
            '13263:1': 'Mobile Default (400px)',
            '13263:2': 'Mobile Large (520px)',
            '13263:3': 'Tablet Small (624px)',
            '13263:4': 'Tablet Default (780px)',
            '13263:5': 'Tablet Large (980px)',
            '13263:6': 'Laptop Small (1220px)',
            '13263:7': 'Laptop Default (1460px)',
            '13263:8': 'Laptop Large (1700px)',
            '13263:9': 'Desktop Default (1920px)',
            '13263:10': 'Desktop Large (2200px)',
            '13263:11': 'Desktop Extra Large (2400px)'
        };
        return modeMap[modeId] || modeId;
    }

    findToken(name) {
        return this.tokensData.find(token => token.name === name);
    }

    traceAliasChain(tokenName, mode = null, visited = new Set()) {
        if (visited.has(tokenName)) {
            return { error: `Cycle détecté: ${tokenName}` };
        }
        visited.add(tokenName);

        const token = this.findToken(tokenName);
        if (!token) {
            return { error: `Token non trouvé: ${tokenName}` };
        }

        const result = {
            token: tokenName,
            source: token.source,
            type: token.resolvedType,
            modes: {}
        };

        // Si un mode spécifique est demandé, trouver l'ID correspondant
        let modesToProcess = token.values;
        if (mode) {
            // Chercher l'ID du mode par son nom
            const modeId = Object.keys(token.values).find(id => this.getModeName(id) === mode);
            if (modeId) {
                modesToProcess = { [modeId]: token.values[modeId] };
            } else {
                // Essayer directement avec l'ID
                if (token.values[mode]) {
                    modesToProcess = { [mode]: token.values[mode] };
                } else {
                    return { error: `Mode non trouvé: ${mode}` };
                }
            }
        }

        for (const [modeId, value] of Object.entries(modesToProcess)) {
            const modeName = this.getModeName(modeId);
            
            if (typeof value === 'object' && value !== null && value.type === 'VARIABLE_ALIAS') {
                const resolvedName = this.resolveAlias(value);
                if (resolvedName) {
                    // Récursion pour tracer la chaîne (sans mode spécifique pour éviter les erreurs)
                    const nextLevel = this.traceAliasChain(resolvedName, null, new Set(visited));
                    result.modes[modeName] = {
                        alias: resolvedName,
                        chain: nextLevel
                    };
                } else {
                    result.modes[modeName] = { error: `Alias non résolu: ${value.id}` };
                }
            } else {
                // Valeur finale (couleur, nombre, etc.)
                result.modes[modeName] = { value: value };
            }
        }

        return result;
    }

    formatTrace(trace, indent = 0) {
        const spaces = '  '.repeat(indent);
        let output = '';

        if (trace.error) {
            return `${spaces}❌ ${trace.error}\n`;
        }

        output += `${spaces}📦 ${trace.token} (${trace.source}, ${trace.type})\n`;

        for (const [modeName, modeData] of Object.entries(trace.modes)) {
            output += `${spaces}  🎨 ${modeName}:\n`;
            
            if (modeData.error) {
                output += `${spaces}    ❌ ${modeData.error}\n`;
            } else if (modeData.value !== undefined) {
                output += `${spaces}    ✅ ${JSON.stringify(modeData.value)}\n`;
            } else if (modeData.alias) {
                output += `${spaces}    🔗 alias vers ${modeData.alias}\n`;
                if (modeData.chain) {
                    output += this.formatTrace(modeData.chain, indent + 2);
                }
            }
        }

        return output;
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
🔍 Token Alias Tracer

Usage:
  node trace-alias.js <token-name> [mode]
  
Examples:
  node trace-alias.js surface/base/default
  node trace-alias.js surface/base/default "JLL Light"
  node trace-alias.js type/hero/size
  node trace-alias.js type/hero/size "Mobile Small (320px)"

Modes disponibles:
  - JLL Light, JLL Dark, Lasalle Light, Lasalle Dark
  - Mobile Small (320px), Mobile Default (400px), etc.
  - Ou utilise l'ID du mode (ex: 2403:0)
        `);
        process.exit(1);
    }

    const tokenName = args[0];
    const mode = args[1] || null;

    const tracer = new TokenAliasTracer();
    await tracer.loadData();

    console.log(`\n🔍 Traçage de l'alias pour: ${tokenName}`);
    if (mode) {
        console.log(`🎯 Mode spécifique: ${mode}`);
    }
    console.log('─'.repeat(60));

    const trace = tracer.traceAliasChain(tokenName, mode);
    const formatted = tracer.formatTrace(trace);
    
    console.log(formatted);
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default TokenAliasTracer;
