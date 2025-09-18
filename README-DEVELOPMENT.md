# Solstice Tokens Pipeline - Documentation Complète

## 🎯 Vue d'ensemble

Le **Solstice Tokens Pipeline** est un système complet d'extraction, normalisation et génération de design tokens depuis Figma vers CSS. Il gère des tokens multi-dimensionnels avec support des thèmes (light/dark), breakpoints (responsive), et densité (low/high).

## 🏗️ Architecture du Système

### 1. Sources Figma (3 fichiers principaux)

#### A. Core Primitives (`C5A2VlekTKqBeOw0xCAcFH`)
- **Contenu** : Tokens primitifs statiques
- **Types** : `core/breakpoint/*`, `core/color/base/*`, `core/radius/*`, `core/shadow/*`, `core/spacing/*`, `core/typeSize/*`
- **Stratégie** : `staticOnce` - Variables CSS dans `:root`
- **Exemple** : `core/color/base/primary-500` → `--core-color-base-primary-500: #3498db`

#### B. Density System (`dsC3Ox9b8xO9PVXjRugQze`)
- **Contenu** : Tokens responsives par breakpoint ET densité
- **Types** : `layout/grid/[LMH]/*`, `type/*/hero/*`, `type/*/title/*`, `type/*/body/*`
- **Stratégie** : `backingsPlusMappingWithMQ` + `semanticTypography`
- **Exemple** : `type/L/hero/size` → Variables par breakpoint + mapping densité

#### C. Color Themes (`wLvDaVOlQQcc1WacqT7BtB`)
- **Contenu** : Couleurs dépendantes du thème
- **Types** : `color/surface/*`, `color/text/*`, `color/stroke/*`, `color/brand/*`, `elevation/*`
- **Stratégie** : `themeOnly` - Variables par thème (light/dark + JLL/Lasalle)
- **Exemple** : `color/surface/primary` → `[data-theme="dark"] { --color-surface-primary: #1e1e1e }`

### 2. Structure des Dossiers

```
/
├── src/
│   ├── extract/          # Extraction Figma
│   │   └── figmaExtractor.js
│   ├── generate/         # Génération CSS
│   │   ├── cssGenerator.js
│   │   └── generator-registry.json
│   ├── normalize/        # Normalisation (futur)
│   └── resolve/          # Résolution alias (futur)
├── raw/                  # Données brutes Figma
│   ├── core-primitives/
│   │   ├── tokens-local.json
│   │   ├── tokens-published.json
│   │   └── tokens-merged.json
│   ├── density-system/
│   │   ├── tokens-local.json
│   │   ├── tokens-published.json
│   │   └── tokens-merged.json
│   ├── color-themes/
│   │   ├── tokens-local.json
│   │   ├── tokens-published.json
│   │   └── tokens-merged.json
│   └── remote-references/
│       ├── C5A2VlekTKqBeOw0xCAcFH-references.json
│       ├── dsC3Ox9b8xO9PVXjRugQze-references.json
│       └── wLvDaVOlQQcc1WacqT7BtB-references.json
├── generated/            # CSS générés
│   ├── css/
│   │   ├── primitives.css
│   │   ├── responsive.css
│   │   ├── density.css
│   │   └── themes.css
│   └── merged/           # Fichiers fusionnés (futur)
├── lab/                  # Lab de développement
│   ├── index.html
│   └── token-locator.html
├── scripts/
│   └── createSnapshot.js
└── snapshots/            # Sauvegardes du projet
```

## 🔄 Processus d'Extraction

### 1. Double Extraction Strategy

**PROBLÈME RÉSOLU** : Figma a deux types de variables :
- **Local** : Variables de travail (avec métadonnées complètes)
- **Published** : Variables officielles (source de vérité pour l'inventaire)

**SOLUTION** : Extraire les deux et les merger intelligemment.

```javascript
// Extraction des deux sources
const localVars = await this.getVariables(fileKey);           // /variables/local
const publishedVars = await this.getPublishedVariables(fileKey); // /variables/published

// Merge : Published comme source de vérité + métadonnées Local
const mergedTokens = publishedTokens.map(publishedToken => {
    const localToken = localMap.get(publishedToken.name);
    if (localToken) {
        return {
            ...publishedToken,  // Valeurs officielles
            description: localToken.description,  // Métadonnées enrichies
            hiddenFromPublishing: localToken.hiddenFromPublishing,
            scopes: localToken.scopes,
            codeSyntax: localToken.codeSyntax
        };
    }
    return publishedToken;
});
```

### 2. Résolution des Alias

**PROBLÈME RÉSOLU** : Les tokens référencent d'autres tokens via `VariableID:`.

**SOLUTION** : Système de résolution en deux étapes :

#### A. Chargement des Références
```javascript
// Charger toutes les références depuis /variables/remote
const referencesData = [];
for (const file of referenceFiles) {
    const data = await this.getRemoteReferences(file.key);
    referencesData = referencesData.concat(data);
}
```

#### B. Résolution des Alias
```javascript
resolveAlias(tokenValue) {
    if (typeof tokenValue === 'string' && tokenValue.startsWith('VariableID:')) {
        const ref = this.references.get(tokenValue);
        if (ref) {
            return ref.name;  // Retourne le NOM du token, pas sa valeur finale
        }
    }
    return tokenValue;
}
```

**IMPORTANT** : La résolution retourne le **nom du token cible**, pas sa valeur finale. Cela permet la chaîne d'alias : `semantic → density → typeScale → finalValue`.

### 3. Mapping des Modes Figma

**PROBLÈME RÉSOLU** : Les modes Figma ont des IDs cryptiques (`13263:0`, `13263:1`, etc.).

**SOLUTION** : Mapping explicite des modes :

```javascript
const modeMap = {
    '13263:0': 'Light Theme',
    '13263:1': 'Dark Theme', 
    '13263:2': 'Lasalle Light',
    '13263:3': 'Lasalle Dark',
    '13263:4': 'Mobile Small (320px)',
    '13263:5': 'Mobile Default (400px)',
    '13263:6': 'Mobile Large (520px)',
    '13263:7': 'Tablet Small (624px)',
    '13263:8': 'Tablet Default (780px)',
    '13263:9': 'Tablet Large (980px)',
    '13263:10': 'Laptop Small (1220px)',
    '13263:11': 'Laptop Default (1460px)',
    '13263:12': 'Laptop Large (1700px)',
    '13263:13': 'Desktop Default (1920px)',
    '13263:14': 'Desktop Large (2200px)',
    '13263:15': 'Desktop Extra Large (2400px)'
};
```

## 🎨 Stratégies de Génération CSS

### 1. `staticOnce` - Primitives Statiques

**Usage** : Tokens qui ne varient jamais (breakpoints, couleurs de base, espacements, rayons).

```css
:root {
  --core-breakpoint-mobile-Small: 320px;
  --core-color-base-primary-500: #3498db;
  --core-radius-small: 4px;
  --core-spacing-1: 4px;
}
```

**Logique** :
- Tri par type puis par nom
- Ajout automatique d'unités (`px` pour radius, spacing, typeSize)
- Conversion RGB → Hex automatique

### 2. `themeOnly` - Couleurs par Thème

**Usage** : Couleurs qui changent selon le thème (light/dark) et la marque (JLL/Lasalle).

```css
:root {
  --color-surface-primary: #ffffff;
  --color-text-default: #2c3e50;
}

[data-theme="dark"] {
  --color-surface-primary: #1e1e1e;
  --color-text-default: #ffffff;
}

[data-brand="lasalle"] {
  --color-surface-primary: #f8f9fa;
}

[data-brand="lasalle"][data-theme="dark"] {
  --color-surface-primary: #2c3e50;
}
```

**Logique** :
- Mode `13263:0` → Light (défaut)
- Mode `13263:1` → Dark
- Mode `13263:2` → Lasalle Light  
- Mode `13263:3` → Lasalle Dark

### 3. `byBreakpointOnly` - Responsive Pur

**Usage** : Tokens qui changent uniquement par breakpoint (espacements responsives).

```css
@media (min-width: 320px) {
  :root {
    --spacing-responsive-1: 4px;
  }
}

@media (min-width: 400px) {
  :root {
    --spacing-responsive-1: 6px;
  }
}
```

**FIX CRITIQUE** : Les media queries ne peuvent PAS utiliser de variables CSS pour `min-width` :
```css
/* ❌ INCORRECT */
@media (min-width: var(--breakpoint-mobile-Small)) { }

/* ✅ CORRECT */
@media (min-width: 320px) { }
```

### 4. `backingsPlusMappingWithMQ` - Backings Responsives

**Usage** : Variables de backing qui changent par breakpoint (pour le density system).

```css
@media (min-width: 320px) {
  :root {
    --type-L-hero-size: var(--scale-s6-size);
  }
}

@media (min-width: 624px) {
  :root {
    --type-L-hero-size: var(--scale-s8-size);
  }
}
```

**Logique** :
- Génère les variables de backing pour chaque breakpoint
- Utilise la résolution d'alias pour pointer vers les bonnes échelles
- **FIX CRITIQUE** : Utilise des valeurs littérales dans les media queries

### 5. `densityMappingOnly` - Mapping Densité

**Usage** : Tokens sémantiques qui mappent vers des backings selon la densité.

```css
[data-density="low"] {
  --type-hero-size: var(--type-L-hero-size);
  --layout-grid-margin: var(--layout-grid-L-margin);
}

[data-density="high"] {
  --type-hero-size: var(--type-H-hero-size);
  --layout-grid-margin: var(--layout-grid-H-margin);
}
```

**FIX CRITIQUE** : Les valeurs `data-density` doivent être `low`/`high`, pas `L`/`H`.

### 6. `semanticTypography` - Typographie Hybride

**Usage** : Typographie sémantique avec mapping densité + backings responsives.

```css
/* Mapping densité */
[data-density="low"] {
  --type-hero-size: var(--type-L-hero-size);
}

/* Backings responsives */
@media (min-width: 320px) {
  :root {
    --type-L-hero-size: var(--scale-s6-size);
  }
}

@media (min-width: 624px) {
  :root {
    --type-L-hero-size: var(--scale-s8-size);
  }
}
```

## 🔧 Registry des Générateurs

Le fichier `src/generate/generator-registry.json` définit quels générateurs traitent quels tokens :

```json
{
  "generators": [
    {
      "id": "primitives",
      "name": "Primitives", 
      "targetFile": "generated/css/primitives.css",
      "patterns": [
        "core/breakpoint/*",
        "core/color/base/*",
        "core/radius/*",
        "core/shadow/*",
        "core/spacing/*",
        "core/typeSize/*"
      ],
      "emissionStrategy": "staticOnce"
    },
    {
      "id": "responsive",
      "name": "Responsive",
      "targetFile": "generated/css/responsive.css", 
      "patterns": [
        "layout/grid/[LMH]/*",
        "spacing/responsive/*"
      ],
      "emissionStrategy": "backingsPlusMappingWithMQ",
      "sourceFilter": "density-system"
    },
    {
      "id": "density",
      "name": "Density",
      "targetFile": "generated/css/density.css",
      "patterns": [
        "type/*/hero/*",
        "type/*/title/*", 
        "type/*/body/*",
        "type/*/caption/*",
        "layout/grid/columns",
        "layout/grid/gutter",
        "layout/grid/margin",
        "layout/grid/padding"
      ],
      "emissionStrategy": "semanticTypography",
      "sourceFilter": "density-system"
    },
    {
      "id": "themes",
      "name": "Themes",
      "targetFile": "generated/css/themes.css",
      "patterns": [
        "color/surface/*",
        "color/text/*",
        "color/stroke/*", 
        "color/brand/*",
        "elevation/*"
      ],
      "emissionStrategy": "themeOnly",
      "sourceFilter": "color-themes"
    }
  ]
}
```

### Patterns de Matching

- **Exact** : `"core/color/base/primary-500"` (avec `^` et `$`)
- **Wildcard** : `"core/color/base/*"` (avec `*`)
- **Contains** : `"hero"` (contient le mot)

### Source Filter

- **`sourceFilter`** : Limite les tokens à une source spécifique
- **Exemple** : `"sourceFilter": "density-system"` → Seulement les tokens de `density-system`

## 🎯 Logique de Résolution des Tokens

### 1. Chargement Multi-Sources

```javascript
async loadTokens() {
    const sources = [
        'raw/core-primitives/tokens-merged.json',
        'raw/density-system/tokens-merged.json', 
        'raw/color-themes/tokens-merged.json'
    ];

    for (const source of sources) {
        const data = JSON.parse(fs.readFileSync(source, 'utf8'));
        data.forEach(token => {
            this.tokens.set(token.name, token);
        });
    }
}
```

### 2. Résolution par Générateur

```javascript
findTokensForGenerator(generator, allTokens, usedTokens) {
    const tokens = [];
    
    for (const token of allTokens.values()) {
        if (usedTokens.has(token.name)) continue;
        
        // Check source filter
        if (generator.sourceFilter && token.source !== generator.sourceFilter) {
            continue;
        }
        
        // Check patterns
        const matchesPattern = generator.patterns.some(pattern => {
            if (pattern.startsWith('^') && pattern.endsWith('$')) {
                return token.name === pattern.slice(1, -1);
            } else if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(token.name);
            } else {
                return token.name.includes(pattern);
            }
        });
        
        if (matchesPattern) {
            tokens.push(token);
            usedTokens.add(token.name);
        }
    }
    
    return tokens;
}
```

### 3. Sérialisation des Valeurs

```javascript
serializeTokenValue(token, mode = null) {
    if (!token.values) return null;

    let value = null;
    
    if (mode) {
        const modeEntry = Object.entries(token.values).find(([m, v]) => m === mode);
        if (modeEntry) {
            value = modeEntry[1];
        }
    } else {
        const firstEntry = Object.entries(token.values)[0];
        if (firstEntry) {
            value = firstEntry[1];
        }
    }

    if (!value) return null;

    // Resolve alias
    const resolved = this.resolveAlias(value);
    
    // Convert to CSS value
    if (typeof resolved === 'string') {
        if (resolved.startsWith('rgb(') || resolved.startsWith('rgba(')) {
            return this.rgbToHex(resolved);
        }
        return resolved;
    }

    return resolved;
}
```

## 🎨 Conversion et Formatage

### 1. RGB → Hex Conversion

```javascript
rgbToHex(rgbString) {
    const match = rgbString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) return rgbString;

    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    const a = match[4] ? parseFloat(match[4]) : 1;

    const toHex = (n) => n.toString(16).padStart(2, '0');
    
    if (a >= 1) {
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;  // 6-digit
    } else {
        return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(Math.round(a * 255))}`;  // 8-digit
    }
}
```

**RÈGLE** : 
- Alpha ≥ 1 → `#RRGGBB` (6 chiffres)
- Alpha < 1 → `#RRGGBBAA` (8 chiffres)

### 2. Ajout d'Unités

```javascript
addUnit(value, tokenName) {
    if (typeof value !== 'number') return value;
    
    // Add px unit for specific token types
    if (tokenName.includes('radius') || 
        tokenName.includes('spacing') || 
        tokenName.includes('core-typeSize') ||
        tokenName.includes('size')) {
        return `${value}px`;
    }
    
    return value;
}
```

**EXCEPTIONS** :
- Font weights → Pas d'unité
- Variables `columns` → Pas d'unité
- Couleurs → Pas d'unité

### 3. Tri des Tokens

```javascript
sortTokensByTypeAndName(tokens) {
    const typeOrder = ['color', 'typeSize', 'spacing', 'radius', 'shadow', 'breakpoint'];
    
    return tokens.sort((a, b) => {
        const aType = typeOrder.findIndex(type => a.name.includes(type));
        const bType = typeOrder.findIndex(type => b.name.includes(type));
        
        if (aType !== bType) {
            return aType - bType;
        }
        
        return this.sortTokensByName([a, b])[0].name.localeCompare(this.sortTokensByName([a, b])[1].name);
    });
}
```

## 🐛 FIXES CRITIQUES APPLIQUÉS

### 1. Media Queries avec Variables CSS

**PROBLÈME** : `@media (min-width: var(--breakpoint-mobile-Small))` ne fonctionne pas.

**SOLUTION** : Utiliser des valeurs littérales dans les media queries.

```javascript
const breakpoints = [
    { name: 'mobile-Small', value: '320px' },
    { name: 'mobile-Default', value: '400px' },
    // ...
];

// Dans les media queries
css += `@media (min-width: ${bp.value}) {\n`;
```

### 2. Résolution des Modes par Breakpoint

**PROBLÈME** : `serializeTokenValueForBreakpoint` utilisait un index numérique au lieu du mode ID exact.

**SOLUTION** : Construire l'ID de mode exact.

```javascript
serializeTokenValueForBreakpoint(token, breakpointIndex) {
    const valueEntries = Object.entries(token.values);
    const targetMode = `13263:${breakpointIndex}`;  // Mode ID exact
    const foundEntry = valueEntries.find(([mode, value]) => mode === targetMode);
    
    if (foundEntry) {
        return this.resolveAlias(foundEntry[1]);
    }
    // Fallback...
}
```

### 3. Valeurs data-density

**PROBLÈME** : Les valeurs `data-density` étaient `L`/`M`/`H` au lieu de `low`/`medium`/`high`.

**SOLUTION** : Utiliser les valeurs complètes.

```javascript
const densities = [
    { name: 'low', selector: '[data-density="low"]' },
    { name: 'high', selector: '[data-density="high"]' }
];
```

### 4. Source Filter pour Density System

**PROBLÈME** : Les générateurs `semantic-typography` et `density-system` ne trouvaient pas les tokens `hero`.

**SOLUTION** : Ajouter `sourceFilter: "density-system"` aux générateurs concernés.

## 🧪 Lab de Développement

### 1. Structure du Lab

- **`lab/index.html`** : Lab principal avec contrôles theme/brand/density
- **`lab/token-locator.html`** : Outil de debug pour rechercher des tokens

### 2. Contrôles du Lab

```html
<div class="controls">
    <div class="control-group">
        <label for="theme-select">Theme</label>
        <select id="theme-select">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
        </select>
    </div>
    <div class="control-group">
        <label for="brand-select">Brand</label>
        <select id="brand-select">
            <option value="jll">JLL</option>
            <option value="lasalle">Lasalle</option>
        </select>
    </div>
    <div class="control-group">
        <label for="density-select">Density</label>
        <select id="density-select">
            <option value="low">Low</option>
            <option value="high">High</option>
        </select>
    </div>
</div>
```

### 3. Application des Contrôles

```javascript
function updateTheme() {
    const html = document.documentElement;
    html.setAttribute('data-theme', themeSelect.value);
    html.setAttribute('data-brand', brandSelect.value);
    html.setAttribute('data-density', densitySelect.value);
}
```

## 📦 Système de Snapshots

### 1. Création de Snapshots

```bash
node scripts/createSnapshot.js
```

### 2. Contenu des Snapshots

- **Manifest** : Structure complète du projet
- **Archive** : Fichiers compressés (excluant `node_modules`, `.git`, `snapshots`)
- **Summary** : Métadonnées du projet (git commit, taille, etc.)

### 3. Restauration

```bash
tar -xzf snapshots/solstice-tokens-snapshot-TIMESTAMP.tar.gz
```

## 🚀 Commandes Principales

### Extraction
```bash
node src/extract/figmaExtractor.js
```

### Génération CSS
```bash
node src/generate/cssGenerator.js
```

### Snapshot
```bash
node scripts/createSnapshot.js
```

### Serveur de Dev
```bash
cd lab && python3 -m http.server 8082
```

## 🔍 Debug et Troubleshooting

### 1. Token Locator

Utilise `lab/token-locator.html` pour :
- Rechercher des tokens par nom
- Voir leurs valeurs par mode
- Vérifier la résolution d'alias
- Inspecter les métadonnées

### 2. Logs de Debug

Le générateur affiche des logs détaillés :
```
🔄 Processing generator: Density
   Found 2 tokens
   ✅ Generated generated/css/density.css
```

### 3. Vérification des Fichiers

```bash
# Vérifier les tokens extraits
ls -la raw/*/tokens-merged.json

# Vérifier les CSS générés  
ls -la generated/css/

# Vérifier les références
ls -la raw/remote-references/
```

## 📋 Checklist de Vérification

### Avant Extraction
- [ ] Token Figma configuré dans `.env`
- [ ] URLs des fichiers Figma correctes
- [ ] Dossiers `raw/` créés

### Après Extraction
- [ ] Fichiers `tokens-local.json` créés
- [ ] Fichiers `tokens-published.json` créés
- [ ] Fichiers `tokens-merged.json` créés
- [ ] Fichiers `*-references.json` créés

### Après Génération
- [ ] 4 fichiers CSS générés (`primitives.css`, `responsive.css`, `density.css`, `themes.css`)
- [ ] Pas d'erreurs dans les logs
- [ ] Variables CSS correctement formées
- [ ] Media queries avec valeurs littérales

### Test du Lab
- [ ] Serveur démarre sur port 8082
- [ ] Lab accessible sur `http://localhost:8082/lab/`
- [ ] Token locator accessible sur `http://localhost:8082/lab/token-locator.html`
- [ ] Contrôles theme/brand/density fonctionnent
- [ ] Variables CSS appliquées correctement

## 🎯 Points d'Attention

### 1. Ordre des Générations
Les générateurs doivent être exécutés dans l'ordre pour éviter les dépendances circulaires.

### 2. Résolution d'Alias
La résolution doit pointer vers le **nom du token**, pas sa valeur finale.

### 3. Media Queries
Toujours utiliser des valeurs littérales, jamais de variables CSS.

### 4. Source Filter
Vérifier que les générateurs ont le bon `sourceFilter` pour trouver leurs tokens.

### 5. Modes Figma
Respecter le mapping exact des modes (`13263:0`, `13263:1`, etc.).

---

**Cette documentation doit être mise à jour à chaque modification du système pour éviter toute perte de connaissance.**
