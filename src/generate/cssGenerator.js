// Nouveau générateur CSS avec logique correcte par contexte de mode
import fs from 'fs';
import path from 'path';
import TokenAliasTracer from '../../scripts/trace-alias.js';

class CSSGenerator {
    constructor() {
        this.tokens = new Map();
        this.tracer = new TokenAliasTracer();
        this.generators = [];
    }

    async loadTokens() {
        console.log('🔄 Loading tokens...');
        
        const sources = [
            'raw/core-primitives/tokens-merged.json',
            'raw/density-system/tokens-merged.json', 
            'raw/color-themes/tokens-merged.json'
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

    async loadGenerators() {
        console.log('🔄 Loading generator registry...');
        
        if (fs.existsSync('src/generate/generator-registry.json')) {
            const registry = JSON.parse(fs.readFileSync('src/generate/generator-registry.json', 'utf8'));
            this.generators = registry.generators;
            console.log(`✅ Loaded ${this.generators.length} generators`);
        }
    }

    // Nettoyer le nom de token pour CSS (enlever espaces, parenthèses, caractères spéciaux)
    sanitizeCSSVarName(tokenName) {
        return tokenName
            .replace(/\//g, '-')           // Slashes vers tirets
            .replace(/\s+/g, '-')           // Espaces vers tirets
            .replace(/[()]/g, '')           // Supprimer parenthèses
            .replace(/[^\w-]/g, '')         // Supprimer caractères spéciaux (garde lettres, chiffres, tirets)
            .replace(/-+/g, '-')            // Remplacer tirets multiples par un seul
            .replace(/^-|-$/g, '');        // Supprimer tirets en début/fin
    }

    // Règle : Ne jamais résoudre au-delà d'un niveau
    resolveValueOneLevel(value, tokenName = '', shouldResolveToFinal = false) {
        if (typeof value === 'object' && value !== null && value.type === 'VARIABLE_ALIAS') {
            if (shouldResolveToFinal) {
                // Pour les thèmes, résoudre jusqu'à la valeur finale
                const trace = this.tracer.traceAliasChain(tokenName);
                if (trace && !trace.error) {
                    // Prendre la première valeur finale trouvée
                    for (const modeData of Object.values(trace.modes)) {
                        if (modeData.value !== undefined) {
                            return this.formatFinalValue(modeData.value, tokenName);
                        }
                    }
                }
            }
            // Sinon, résoudre l'alias vers le nom de la variable CSS (pas la valeur finale)
            const resolvedName = this.tracer.resolveAlias(value);
            if (resolvedName) {
                // Formater comme une variable CSS
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
                return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            } else {
                return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
            }
        }
        
        if (typeof value === 'number') {
            // Ajouter des unités selon le contexte
            return this.addUnits(value, tokenName);
        }
        
        // Pour les autres types (string, etc.), utiliser formatFinalValue
        return this.formatFinalValue(value, tokenName);
    }

    // Formater une valeur finale
    formatFinalValue(value, tokenName = '') {
        // Si c'est une couleur
        if (typeof value === 'object' && value !== null && value.r !== undefined) {
            const r = Math.round(value.r * 255);
            const g = Math.round(value.g * 255);
            const b = Math.round(value.b * 255);
            const a = value.a !== undefined ? Math.round(value.a * 100) / 100 : 1;
            
            // Hex 8-digit si alpha < 1, sinon hex 6-digit
            if (a < 1) {
                return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
            } else {
                return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            }
        }
        
        // Si c'est un nombre
        if (typeof value === 'number') {
            return this.addUnits(value, tokenName);
        }
        
        // Si c'est une chaîne de caractères
        if (typeof value === 'string') {
            // Pour les typefaces, les guillemets sont recommandés en CSS
            if (tokenName.toLowerCase().includes('typeface') || tokenName.toLowerCase().includes('font')) {
                return `"${value}"`;
            }
            // Pour les autres strings, vérifier si des guillemets sont nécessaires
            // (contient des espaces, points-virgules, ou autres caractères spéciaux)
            if (value.includes(' ') || value.includes(';') || value.includes(',') || value.includes('(') || value.includes(')')) {
                return `"${value}"`;
            }
            // Sinon, retourner sans guillemets
            return value;
        }
        
        return value;
    }

    // Trier les tokens par propriété puis par nom
    sortTokensByPropertyAndName(tokens) {
        // Ordre des propriétés (logique et visuel)
        const propertyOrder = [
            // Couleurs (par ordre d'importance)
            'color', 'background', 'surface', 'text', 'icon', 'stroke', 'brand', 'tonal',
            // Elevation (ombres et profondeur)
            'elevation',
            // Spacing et dimensions
            'spacing', 'margin', 'padding', 'gap', 'size', 'width', 'height',
            // Typography
            'typography', 'font', 'type', 'lineHeight', 'letterSpacing', 'paragraphSpacing',
            // Bordures et effets
            'radius', 'border', 'shadow', 'blur', 'projection',
            // Layout et grille
            'layout', 'grid', 'columns', 'gutter', 'breakpoint',
            // Composants
            'component', 'comp', 'button', 'field', 'navigation',
            // Core et autres
            'core', 'scale', 'basics'
        ];

        return tokens.sort((a, b) => {
            // Extraire la propriété principale du nom du token
            const getProperty = (tokenName) => {
                const parts = tokenName.split('/');
                const firstPart = parts[0].toLowerCase();
                
                // Mapping des préfixes vers les propriétés
                if (firstPart.includes('elevation') || firstPart.includes('elevationLevels')) {
                    return 'elevation';
                }
                if (firstPart.includes('spacing') || firstPart.includes('margin') || firstPart.includes('padding') || 
                    firstPart.includes('gap') || firstPart.includes('micro') || firstPart.includes('static')) {
                    return 'spacing';
                }
                if (firstPart.includes('type') || firstPart.includes('font') || firstPart.includes('typography') ||
                    firstPart.includes('lineHeight') || firstPart.includes('letterSpacing') || firstPart.includes('paragraphSpacing')) {
                    return 'typography';
                }
                if (firstPart.includes('radius') || firstPart.includes('border') || firstPart.includes('shadow') ||
                    firstPart.includes('blur') || firstPart.includes('projection')) {
                    return 'radius';
                }
                if (firstPart.includes('layout') || firstPart.includes('grid') || firstPart.includes('columns') ||
                    firstPart.includes('gutter') || firstPart.includes('breakpoint')) {
                    return 'layout';
                }
                if (firstPart.includes('comp') || firstPart.includes('button') || firstPart.includes('field') ||
                    firstPart.includes('navigation')) {
                    return 'component';
                }
                if (firstPart.includes('core')) {
                    return 'core';
                }
                if (firstPart.includes('scale')) {
                    return 'scale';
                }
                if (firstPart.includes('basics')) {
                    return 'basics';
                }
                // Toutes les couleurs (amber, glacier, royal, etc.)
                if (firstPart.includes('color') || firstPart.includes('amber') || firstPart.includes('glacier') || 
                    firstPart.includes('royal') || firstPart.includes('orange') || firstPart.includes('sand') ||
                    firstPart.includes('surface') || firstPart.includes('text') || firstPart.includes('icon') ||
                    firstPart.includes('stroke') || firstPart.includes('brand') || firstPart.includes('tonal') ||
                    firstPart.includes('action') || firstPart.includes('lasalle') || firstPart.includes('watercourse') ||
                    firstPart.includes('violet') || firstPart.includes('science') || firstPart.includes('salem') ||
                    firstPart.includes('ocean') || firstPart.includes('magenta') || firstPart.includes('lima') ||
                    firstPart.includes('lilac') || firstPart.includes('lavender') || firstPart.includes('jllRed') ||
                    firstPart.includes('grayscale') || firstPart.includes('forest') || firstPart.includes('crimson') ||
                    firstPart.includes('clay') || firstPart.includes('bahama') || firstPart.includes('atoll')) {
                    return 'color';
                }
                return firstPart;
            };

            const propA = getProperty(a.name);
            const propB = getProperty(b.name);
            
            // Trier par propriété
            const indexA = propertyOrder.indexOf(propA);
            const indexB = propertyOrder.indexOf(propB);
            
            if (indexA !== indexB) {
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            }
            
            // Si même propriété, trier par nom avec tri numérique naturel
            return this.naturalCompare(a.name, b.name);
        });
    }

    // Tri numérique naturel (amber-100, amber-200, amber-1000, amber-1100)
    naturalCompare(a, b) {
        const regex = /(\d+)/g;
        const aParts = a.split(regex);
        const bParts = b.split(regex);
        
        const maxLength = Math.max(aParts.length, bParts.length);
        
        for (let i = 0; i < maxLength; i++) {
            const aPart = aParts[i] || '';
            const bPart = bParts[i] || '';
            
            // Si les deux parties sont des nombres, comparer numériquement
            if (/^\d+$/.test(aPart) && /^\d+$/.test(bPart)) {
                const aNum = parseInt(aPart, 10);
                const bNum = parseInt(bPart, 10);
                if (aNum !== bNum) {
                    return aNum - bNum;
                }
            } else {
                // Sinon, comparer alphabétiquement
                const comparison = aPart.localeCompare(bPart);
                if (comparison !== 0) {
                    return comparison;
                }
            }
        }
        
        return 0;
    }

    // Ajouter des unités selon le contexte
    addUnits(value, tokenName = '') {
        if (typeof value !== 'number') return value;
        // Tokens qui doivent rester sans unité
        if (tokenName.includes('weight') || 
            tokenName.includes('typeWeight') ||
            tokenName.includes('columns') ||
            tokenName.includes('columnsScroll')) {
            return value.toString();
        }
        
        // Tokens de radius, spacing, typeSize -> px
        if (tokenName.includes('radius') || 
            tokenName.includes('spacing') || 
            tokenName.includes('typeSize') ||
            tokenName.includes('Spacing')) {
            return `${value}px`;
        }
        
        // Par défaut, ajouter px pour les nombres
        return `${value}px`;
    }

    // 1. STATICONCE - Tokens sans mode ou avec un seul mode simple
    generateStaticOnceCSS(generator, tokens) {
        let css = `/* ${generator.name} - Static Once */\n:root {\n`;
        
        // Pour les primitives, prendre tous les tokens statiques de toutes les sources
        const allTokens = Array.from(this.tokens.values());
        const staticTokens = allTokens.filter(token => {
            if (!token.values || Object.keys(token.values).length === 0) {
                return true;
            }
            
            // Tokens avec un seul mode simple (pas de breakpoints/thèmes/densité)
            const modes = Object.keys(token.values);
            if (modes.length === 1) {
                const mode = modes[0];
                if (!mode.startsWith('13263:') && !mode.startsWith('2403:') && !mode.startsWith('23394:') && !mode.startsWith('24109:')) {
                    return true;
                }
            }
            
            return false;
        });

        // Trier les tokens par propriété puis par nom
        const sortedTokens = this.sortTokensByPropertyAndName(staticTokens);

        sortedTokens.forEach(token => {
            let value = null;
            
            if (!token.values || Object.keys(token.values).length === 0) {
                // Token sans mode - utiliser la première valeur disponible
                const allTokens = Array.from(this.tokens.values());
                const trace = this.tracer.traceAliasChain(token.name);
                if (trace && !trace.error) {
                    // Prendre la première valeur trouvée (pas forcément finale)
                    for (const modeData of Object.values(trace.modes)) {
                        if (modeData.alias) {
                            value = { type: 'VARIABLE_ALIAS', id: `VariableID:${modeData.alias}` };
                            break;
                        } else if (modeData.value !== undefined) {
                            value = modeData.value;
                            break;
                        }
                    }
                }
            } else {
                // Token avec un mode simple
                const mode = Object.keys(token.values)[0];
                value = token.values[mode];
            }

            if (value !== null) {
                const resolvedValue = this.resolveValueOneLevel(value, token.name);
                const cssVarName = `--${this.sanitizeCSSVarName(token.name)}`;
                css += `  ${cssVarName}: ${resolvedValue};\n`;
            }
        });

        css += '}\n';
        return css;
    }

    // 2. BACKINGSPLUSMAPPINGWITHMQ - Tokens avec modes breakpoints
    generateBackingsPlusMappingWithMQCSS(generator, tokens) {
        let css = `/* ${generator.name} - Backings Plus Mapping With MQ */\n`;
        
        const responsiveTokens = tokens.filter(token => {
            if (!token.values) return false;
            return Object.keys(token.values).some(mode => mode.startsWith('13263:'));
        });

        // Trier les tokens par propriété puis par nom
        const sortedResponsiveTokens = this.sortTokensByPropertyAndName(responsiveTokens);

        // Breakpoints
        const breakpoints = [
            { name: 'mobile-Small', value: '320px', mode: '13263:0' },
            { name: 'mobile-Default', value: '400px', mode: '13263:1' },
            { name: 'mobile-Large', value: '520px', mode: '13263:2' },
            { name: 'tablet-Small', value: '624px', mode: '13263:3' },
            { name: 'tablet-Default', value: '780px', mode: '13263:4' },
            { name: 'tablet-Large', value: '980px', mode: '13263:5' },
            { name: 'laptop-Small', value: '1220px', mode: '13263:6' },
            { name: 'laptop-Default', value: '1460px', mode: '13263:7' },
            { name: 'laptop-Large', value: '1700px', mode: '13263:8' },
            { name: 'desktop-default', value: '1920px', mode: '13263:9' },
            { name: 'desktop-large', value: '2200px', mode: '13263:10' },
            { name: 'desktop-extraLarge', value: '2400px', mode: '13263:11' }
        ];

        // Générer les variables pour chaque breakpoint
        breakpoints.forEach(bp => {
            css += `@media (min-width: ${bp.value}) {\n`;
            css += `  :root {\n`;

            sortedResponsiveTokens.forEach(token => {
                const value = token.values[bp.mode];
                if (value !== undefined) {
                    // Pour les responsive, résoudre seulement un niveau (garder les alias)
                    const resolvedValue = this.resolveValueOneLevel(value, token.name);
                    const cssVarName = `--${this.sanitizeCSSVarName(token.name)}`;
                    css += `    ${cssVarName}: ${resolvedValue};\n`;
                }
            });

            css += `  }\n`;
            css += `}\n\n`;
        });

        return css;
    }

    // 3. SEMANTICTYPOGRAPHY - Tokens avec modes densité
    generateSemanticTypographyCSS(generator, tokens) {
        let css = `/* ${generator.name} - Semantic Typography */\n`;
        
        // Utiliser directement les tokens passés (déjà filtrés par le générateur)
        // et vérifier qu'ils ont des modes de density
        const densityTokens = tokens.filter(token => {
            if (!token.values) return false;
            return Object.keys(token.values).some(mode => mode.startsWith('24109:'));
        });

        // Trier les tokens par propriété puis par nom
        const sortedDensityTokens = this.sortTokensByPropertyAndName(densityTokens);

        // Modes de densité
        const densities = [
            { name: 'low', mode: '24109:0' },
            { name: 'medium', mode: '24109:3' },
            { name: 'high', mode: '24109:4' }
        ];

        densities.forEach(density => {
            css += `[data-density="${density.name}"] {\n`;

            sortedDensityTokens.forEach(token => {
                const value = token.values[density.mode];
                if (value !== undefined) {
                    // Pour les density, résoudre seulement un niveau (garder les alias)
                    const resolvedValue = this.resolveValueOneLevel(value, token.name);
                    const cssVarName = `--${this.sanitizeCSSVarName(token.name)}`;
                    css += `  ${cssVarName}: ${resolvedValue};\n`;
                }
            });

            css += `}\n\n`;
        });

        return css;
    }

    // 4. THEMEONLY - Tokens avec modes thème
    generateThemeOnlyCSS(generator, tokens) {
        let css = `/* ${generator.name} - Theme Only */\n`;
        
        // Chercher dans tous les tokens, pas seulement ceux du générateur
        const allTokens = Array.from(this.tokens.values());
        const themeTokens = allTokens.filter(token => {
            if (!token.values) return false;
            return Object.keys(token.values).some(mode => mode.startsWith('2403:') || mode.startsWith('23394:'));
        });

        // Trier les tokens par propriété puis par nom
        const sortedThemeTokens = this.sortTokensByPropertyAndName(themeTokens);

        // Modes de thème
        const themes = [
            { name: 'JLL Light', mode: '2403:0', selector: ':root' },
            { name: 'JLL Dark', mode: '2403:1', selector: '[data-theme="dark"]' },
            { name: 'Lasalle Light', mode: '23394:0', selector: '[data-brand="lasalle"]' },
            { name: 'Lasalle Dark', mode: '23394:1', selector: '[data-brand="lasalle"][data-theme="dark"]' }
        ];

        themes.forEach(theme => {
            css += `${theme.selector} {\n`;

            sortedThemeTokens.forEach(token => {
                const value = token.values[theme.mode];
                if (value !== undefined) {
                    // Pour les thèmes, résoudre jusqu'à la valeur finale
                    const trace = this.tracer.traceAliasChain(token.name, theme.name);
                    let resolvedValue;
                    if (trace && !trace.error && trace.modes[theme.name]) {
                        // Chercher la valeur finale dans la chaîne
                        let finalValue = null;
                        if (trace.modes[theme.name].value !== undefined) {
                            finalValue = trace.modes[theme.name].value;
                        } else if (trace.modes[theme.name].chain && trace.modes[theme.name].chain.modes) {
                            // Chercher dans la chaîne
                            for (const modeData of Object.values(trace.modes[theme.name].chain.modes)) {
                                if (modeData.value !== undefined) {
                                    finalValue = modeData.value;
                                    break;
                                }
                            }
                        }
                        
                        if (finalValue !== null) {
                            resolvedValue = this.formatFinalValue(finalValue, token.name);
                        } else {
                            // Fallback sur la résolution d'un niveau
                            resolvedValue = this.resolveValueOneLevel(value, token.name);
                        }
                    } else {
                        // Fallback sur la résolution d'un niveau
                        resolvedValue = this.resolveValueOneLevel(value, token.name);
                    }
                    const cssVarName = `--${this.sanitizeCSSVarName(token.name)}`;
                    css += `  ${cssVarName}: ${resolvedValue};\n`;
                }
            });

            css += `}\n\n`;
        });

        return css;
    }

    findTokensForGenerator(generator, allTokens) {
        const tokens = Array.from(allTokens.values());
        
        // SAFEGUARD 1: Filtrer par source si spécifié
        let filteredTokens = tokens;
        if (generator.sourceFilter) {
            filteredTokens = tokens.filter(token => token.source === generator.sourceFilter);
        }

        // SAFEGUARD 2: Filtrer par patterns
        const patternMatchedTokens = filteredTokens.filter(token => {
            return generator.patterns.some(pattern => {
                // Convertir le pattern glob en regex
                const regexPattern = pattern
                    .replace(/\*/g, '.*')
                    .replace(/\?/g, '.');
                const regex = new RegExp(`^${regexPattern}$`);
                return regex.test(token.name);
            });
        });

        // SAFEGUARD 3: Détection intelligente des modes pour tokens non reconnus
        const modeDetectedTokens = this.detectTokensByModes(generator, filteredTokens, patternMatchedTokens);

        // Logging pour debug
        if (patternMatchedTokens.length > 0) {
            console.log(`  📋 ${generator.id}: ${patternMatchedTokens.length} tokens reconnus par patterns`);
        }
        if (modeDetectedTokens.length > 0) {
            console.log(`  🔍 ${generator.id}: ${modeDetectedTokens.length} tokens détectés par modes`);
            modeDetectedTokens.forEach(token => {
                const modes = this.extractModesFromToken(token);
                console.log(`    - ${token.name}: modes=${JSON.stringify(modes)}`);
            });
        }

        // Combiner les tokens reconnus par patterns + détection de modes
        const allMatchingTokens = [...patternMatchedTokens, ...modeDetectedTokens];
        
        // Dédupliquer (au cas où un token matcherait les deux)
        const uniqueTokens = allMatchingTokens.filter((token, index, self) => 
            index === self.findIndex(t => t.name === token.name)
        );

        return uniqueTokens;
    }

    // Nouvelle fonction: Détection intelligente des modes
    detectTokensByModes(generator, filteredTokens, alreadyMatchedTokens) {
        const alreadyMatchedNames = new Set(alreadyMatchedTokens.map(t => t.name));
        
        // Tokens non encore reconnus par patterns
        const unmatchedTokens = filteredTokens.filter(token => 
            !alreadyMatchedNames.has(token.name)
        );

        return unmatchedTokens.filter(token => {
            const modes = this.extractModesFromToken(token);
            
            // Logique de détection selon le générateur
            switch (generator.id) {
                case 'density':
                    // Tokens avec modes de densité (low, medium, high)
                    return modes.hasDensityModes;
                    
                case 'responsive':
                    // Tokens avec modes responsives (L, M, H)
                    return modes.hasResponsiveModes;
                    
                case 'themes':
                    // Tokens avec modes de thème (light, dark, brand variants)
                    return modes.hasThemeModes;
                    
                case 'primitives':
                    // Tokens sans modes (statiques)
                    return !modes.hasAnyModes;
                    
                default:
                    return false;
            }
        });
    }

    // Nouvelle fonction: Extraire les modes d'un token
    extractModesFromToken(token) {
        const modes = {
            hasDensityModes: false,
            hasResponsiveModes: false,
            hasThemeModes: false,
            hasAnyModes: false
        };

        // Utiliser 'values' au lieu de 'valuesByMode' car c'est là que sont stockés les modes
        const values = token.values || {};
        
        if (!values || typeof values !== 'object') {
            return modes;
        }

        const modeIds = Object.keys(values);
        
        // Détection par pattern d'ID de collection (plus fiable que les noms de modes)
        // D'après l'analyse des données :
        // - Collection 24109: modes de densité (low, medium, high)
        // - Collection 13263: modes responsives (L, M, H)
        // - Collection 24140: modes de thème (light, dark, lasalle, jll)
        
        modeIds.forEach(modeId => {
            const collectionId = modeId.split(':')[0];
            
            switch (collectionId) {
                case '24109': // Collection de densité
                    modes.hasDensityModes = true;
                    break;
                case '13263': // Collection responsive
                    modes.hasResponsiveModes = true;
                    break;
                case '24140': // Collection de thème
                    modes.hasThemeModes = true;
                    break;
            }
        });
        
        modes.hasAnyModes = modeIds.length > 0;
        
        return modes;
    }

    async generateAllCSS() {
        console.log('🚀 Starting CSS generation...');
        
        await this.loadTokens();
        await this.loadTracer();
        await this.loadGenerators();
        
        const allTokens = this.tokens;
        
        for (const generator of this.generators) {
            console.log(`\n🔄 Processing generator: ${generator.name}`);
            
            const tokens = this.findTokensForGenerator(generator, allTokens);
            console.log(`   Found ${tokens.length} tokens`);
            
            let css = '';
            
            switch (generator.emissionStrategy) {
                case 'staticOnce':
                    css = this.generateStaticOnceCSS(generator, tokens);
                    break;
                case 'backingsPlusMappingWithMQ':
                    css = this.generateBackingsPlusMappingWithMQCSS(generator, tokens);
                    break;
                case 'semanticTypography':
                    css = this.generateSemanticTypographyCSS(generator, tokens);
                    break;
                case 'themeOnly':
                    css = this.generateThemeOnlyCSS(generator, tokens);
                    break;
                default:
                    console.log(`   ⚠️ Unknown emission strategy: ${generator.emissionStrategy}`);
                    continue;
            }
            
            // Créer le répertoire si nécessaire
            const outputDir = path.dirname(generator.targetFile);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            
            // Sauvegarder le CSS
            fs.writeFileSync(generator.targetFile, css);
            console.log(`   ✅ Generated ${generator.targetFile}`);
        }
        
        console.log('\n🎉 CSS generation completed!');
    }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
    const generator = new CSSGenerator();
    generator.generateAllCSS().catch(console.error);
}

export default CSSGenerator;
