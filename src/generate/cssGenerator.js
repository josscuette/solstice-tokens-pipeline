// Nouveau générateur CSS avec système de routage basé sur les collections
import fs from 'fs';
import path from 'path';
import TokenAliasTracer from './trace-alias.js';

class CSSGenerator {
    constructor() {
        this.tokens = new Map();
        this.tracer = new TokenAliasTracer();
        this.collectionsConfig = null;
        this.generatorRouter = null;
    }

    async loadTokens() {
        console.log('🔄 Loading tokens...');
        
        const sources = [
            'raw/core-tokens/tokens-merged.json',
            'raw/density-system/tokens-merged.json', 
            'raw/core-primitives/tokens-merged.json'
        ];

        for (const source of sources) {
            if (fs.existsSync(source)) {
                const data = JSON.parse(fs.readFileSync(source, 'utf8'));
                console.log(`✅ Loaded ${data.length} tokens from ${source}`);
                
                data.forEach(token => {
                    this.tokens.set(token.name, token);
                });
            }
        }
    }

    async loadTracer() {
        await this.tracer.loadData();
        console.log('✅ Token tracer loaded');
    }

    async loadCollectionsConfig() {
        console.log('🔄 Loading collections config...');
        
        if (fs.existsSync('src/generate/collections-config.json')) {
            this.collectionsConfig = JSON.parse(fs.readFileSync('src/generate/collections-config.json', 'utf8'));
            console.log(`✅ Loaded ${this.collectionsConfig.collections.length} collections`);
        }
    }

    async loadGeneratorRouter() {
        console.log('🔄 Loading generator router...');
        
        if (fs.existsSync('src/generate/generator-router.json')) {
            this.generatorRouter = JSON.parse(fs.readFileSync('src/generate/generator-router.json', 'utf8'));
            console.log(`✅ Loaded ${this.generatorRouter.routing.length} generator routes`);
        }
    }

    // Nettoyer le nom de token pour CSS
    sanitizeCSSVarName(tokenName) {
        return tokenName
            .replace(/\//g, '-')           // Slashes vers tirets
            .replace(/\s+/g, '-')           // Espaces vers tirets
            .replace(/[()]/g, '')           // Supprimer parenthèses
            .replace(/[^\w-]/g, '')         // Supprimer caractères spéciaux
            .replace(/-+/g, '-')            // Remplacer tirets multiples par un seul
            .replace(/^-|-$/g, '');        // Supprimer tirets en début/fin
    }

    // Résoudre les alias UNIQUEMENT à un niveau (cohérence avec Figma)
    resolveValueOneLevel(value, tokenName = '') {
        if (typeof value === 'object' && value !== null && value.type === 'VARIABLE_ALIAS') {
            // Résoudre l'alias vers le nom de la variable CSS (pas la valeur finale)
            const resolvedName = this.tracer.resolveAlias(value);
            if (resolvedName) {
                return `var(--${this.sanitizeCSSVarName(resolvedName)})`;
            }
            return value.id;
        }
        
        // Si c'est une valeur directe (couleur, nombre), la formater
        if (typeof value === 'object' && value !== null && value.r !== undefined) {
            // Couleur
            const r = Math.round(value.r * 255);
            const g = Math.round(value.g * 255);
            const b = Math.round(value.b * 255);
            const a = value.a !== undefined ? Math.round(value.a * 100) / 100 : 1;
            
            if (a === 1) {
                return `rgb(${r}, ${g}, ${b})`;
            } else {
                return `rgba(${r}, ${g}, ${b}, ${a})`;
            }
        }
        
        // Valeur numérique ou string
        return value;
    }

    // Trouver les tokens pour un générateur basé sur les collections
    findTokensForGenerator(generatorId) {
        const route = this.generatorRouter.routing.find(r => r.generator === generatorId);
        if (!route) {
            console.warn(`⚠️ No route found for generator: ${generatorId}`);
            return [];
        }

        const tokens = Array.from(this.tokens.values());
        const filteredTokens = [];

        // Filtrer par collections
        route.collections.forEach(collectionId => {
            const collection = this.collectionsConfig.collections.find(c => c.id === collectionId);
            if (!collection) {
                console.warn(`⚠️ Collection not found: ${collectionId}`);
                return;
            }

            const collectionTokens = tokens.filter(token => 
                token.variableCollectionId === collection.figmaId
            );

            console.log(`📦 Collection ${collection.name}: ${collectionTokens.length} tokens`);
            filteredTokens.push(...collectionTokens);
        });

        // Supprimer les doublons
        const uniqueTokens = filteredTokens.filter((token, index, self) => 
            index === self.findIndex(t => t.name === token.name)
        );

        console.log(`🎯 Generator ${generatorId}: ${uniqueTokens.length} unique tokens`);
        return uniqueTokens;
    }

    // Générer CSS pour les thèmes
    generateThemesCSS(tokens) {
        let css = `/* Themes - Semantic colors with 4 theme modes */\n`;
        
        // Modes de thème (grouper les sélecteurs par mode)
        const themes = [
            { 
                name: 'JLL Light', 
                mode: '2403:0', 
                selector: ':root, [data-theme="light"], [data-brand="jll"]' 
            },
            { 
                name: 'JLL Dark', 
                mode: '2403:1', 
                selector: '[data-theme="dark"], [data-brand="jll"]' 
            },
            { 
                name: 'Lasalle Light', 
                mode: '23394:0', 
                selector: '[data-theme="light"], [data-brand="lasalle"]' 
            },
            { 
                name: 'Lasalle Dark', 
                mode: '23394:1', 
                selector: '[data-theme="dark"], [data-brand="lasalle"]' 
            }
        ];

        // Trier les tokens par nom
        const sortedTokens = tokens.sort((a, b) => a.name.localeCompare(b.name));

        themes.forEach(theme => {
            css += `\n/* ${theme.name} */\n`;
            css += `${theme.selector} {\n`;
            
            sortedTokens.forEach(token => {
                if (token.values && token.values[theme.mode] !== undefined) {
                    const cssVarName = this.sanitizeCSSVarName(token.name);
                    const value = this.resolveValueOneLevel(token.values[theme.mode], token.name);
                    css += `  --${cssVarName}: ${value};\n`;
                }
            });
            
            css += `}\n`;
        });

        return css;
    }

    // Générer CSS pour les primitives
    generatePrimitivesCSS(tokens) {
        let css = `/* Primitives - Static variables without modes */\n`;
        
        // Trier les tokens par nom
        const sortedTokens = tokens.sort((a, b) => a.name.localeCompare(b.name));

        css += `:root {\n`;
        
        sortedTokens.forEach(token => {
            if (token.values) {
                // Prendre la première valeur disponible (tokens statiques n'ont qu'un mode)
                const firstMode = Object.keys(token.values)[0];
                if (firstMode) {
                    const cssVarName = this.sanitizeCSSVarName(token.name);
                    const value = this.resolveValueOneLevel(token.values[firstMode], token.name);
                    css += `  --${cssVarName}: ${value};\n`;
                }
            }
        });
        
        css += `}\n`;
        return css;
    }

    // Générer CSS pour la densité
    generateDensityCSS(tokens) {
        let css = `/* Density - Tokens with 3 density modes */\n`;

        // Modes de densité
        const densityModes = [
            { name: 'Low', mode: '24109:0', selector: '[data-density="low"]' },
            { name: 'Medium', mode: '24109:3', selector: '[data-density="medium"]' },
            { name: 'High', mode: '24109:4', selector: '[data-density="high"]' }
        ];

        // Trier les tokens par nom
        const sortedTokens = tokens.sort((a, b) => a.name.localeCompare(b.name));

        densityModes.forEach(density => {
            css += `\n/* ${density.name} Density */\n`;
            css += `${density.selector} {\n`;
            
            sortedTokens.forEach(token => {
                if (token.values && token.values[density.mode] !== undefined) {
                    const cssVarName = this.sanitizeCSSVarName(token.name);
                    const value = this.resolveValueOneLevel(token.values[density.mode], token.name);
                    css += `  --${cssVarName}: ${value};\n`;
                }
            });
            
            css += `}\n`;
        });

        return css;
    }

    // Générer CSS pour le responsive
    generateResponsiveCSS(tokens) {
        let css = `/* Responsive - Tokens with 12 breakpoint modes */\n`;
        
        // Modes responsives avec les vrais breakpoints (logique corrigée)
        const responsiveModes = [
            { name: 'Mobile Small', mode: '13263:0', media: '(min-width: 320px) and (max-width: 399px)' },
            { name: 'Mobile Default', mode: '13263:1', media: '(min-width: 400px) and (max-width: 519px)' },
            { name: 'Mobile Large', mode: '13263:2', media: '(min-width: 520px) and (max-width: 623px)' },
            { name: 'Tablet Small', mode: '13263:3', media: '(min-width: 624px) and (max-width: 779px)' },
            { name: 'Tablet Default', mode: '13263:4', media: '(min-width: 780px) and (max-width: 1219px)' },
            { name: 'Tablet Large', mode: '13263:5', media: '(min-width: 1220px) and (max-width: 1459px)' },
            { name: 'Laptop Small', mode: '13263:6', media: '(min-width: 1460px) and (max-width: 1699px)' },
            { name: 'Laptop Default', mode: '13263:7', media: '(min-width: 1700px) and (max-width: 1919px)' },
            { name: 'Laptop Large', mode: '13263:8', media: '(min-width: 1700px) and (max-width: 1919px)' },
            { name: 'Desktop Default', mode: '13263:9', media: '(min-width: 1920px) and (max-width: 2199px)' },
            { name: 'Desktop Large', mode: '13263:10', media: '(min-width: 2200px) and (max-width: 2399px)' },
            { name: 'Desktop Extra Large', mode: '13263:11', media: '(min-width: 2400px)' }
        ];

        // Trier les tokens par nom
        const sortedTokens = tokens.sort((a, b) => a.name.localeCompare(b.name));

        responsiveModes.forEach(responsive => {
            css += `\n/* ${responsive.name} */\n`;
            css += `@media ${responsive.media} {\n`;
            css += `  :root {\n`;
            
            sortedTokens.forEach(token => {
                if (token.values && token.values[responsive.mode] !== undefined) {
                    const cssVarName = this.sanitizeCSSVarName(token.name);
                    const value = this.resolveValueOneLevel(token.values[responsive.mode], token.name);
                    css += `    --${cssVarName}: ${value};\n`;
                }
            });
            
            css += `  }\n`;
            css += `}\n`;
        });

        return css;
    }

    // Générer tous les fichiers CSS
    async generateAll() {
        console.log('🚀 Starting CSS generation with collection-based routing...');
        
        await this.loadTokens();
        await this.loadTracer();
        await this.loadCollectionsConfig();
        await this.loadGeneratorRouter();

        // Générer chaque type de CSS
        const generators = [
            { id: 'themes', method: 'generateThemesCSS', file: 'generated/css/themes.css' },
            { id: 'primitives', method: 'generatePrimitivesCSS', file: 'generated/css/primitives.css' },
            { id: 'density', method: 'generateDensityCSS', file: 'generated/css/density.css' },
            { id: 'responsive', method: 'generateResponsiveCSS', file: 'generated/css/responsive.css' }
        ];

        for (const generator of generators) {
            console.log(`\n🎨 Generating ${generator.id}...`);
            
            const tokens = this.findTokensForGenerator(generator.id);
            const css = this[generator.method](tokens);
            
            // Créer le dossier s'il n'existe pas
            const dir = path.dirname(generator.file);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            // Écrire le fichier
            fs.writeFileSync(generator.file, css);
            console.log(`✅ Generated ${generator.file} (${css.split('\n').length} lines)`);
        }
        
        console.log('\n🎉 CSS generation completed!');
    }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
    const generator = new CSSGenerator();
    generator.generateAll().catch(console.error);
}

export default CSSGenerator;
