# Solstice Tokens Pipeline

Pipeline d'extraction, traitement et conversion des tokens de design Solstice depuis Figma vers CSS.

## Structure du Projet

```
├── src/
│   ├── extract/
│   │   └── figmaExtractor.js          # Extraction des tokens depuis Figma
│   ├── generate/
│   │   ├── cssGenerator.js           # Génération CSS depuis les tokens
│   │   └── generator-registry.json    # Configuration des générateurs CSS
│   ├── config/                       # Configuration des sources
│   ├── normalize/                    # Normalisation des données
│   └── resolve/                      # Résolution des alias
├── raw/                              # Données brutes extraites de Figma
│   ├── core-primitives/              # Tokens primitifs
│   ├── density-system/              # Système de densité
│   ├── color-themes/                 # Thèmes de couleurs
│   └── remote-references/            # Références distantes
├── generated/
│   ├── css/                          # CSS générés
│   │   ├── primitives.css            # Tokens primitifs
│   │   ├── density.css               # Tokens de densité
│   │   ├── responsive.css            # Tokens responsives
│   │   └── themes.css                # Tokens de thèmes
│   └── merged/                       # Données fusionnées
├── scripts/
│   ├── trace-alias.js                # Helper CLI pour tracer les alias
│   └── createSnapshot.js             # Création de snapshots
└── snapshots/                        # Snapshots de développement
```

## Utilisation

### Extraction des Tokens
```bash
node src/extract/figmaExtractor.js
```

### Génération CSS
```bash
node src/generate/cssGenerator.js
```

### Tracer un Alias
```bash
node scripts/trace-alias.js <token-name>
```

## Génération CSS

Le système génère 4 fichiers CSS selon différentes stratégies :

- **`primitives.css`** : Tokens statiques (couleurs, typographie, spacing)
- **`density.css`** : Tokens avec modes de densité (`[data-density]`)
- **`responsive.css`** : Tokens avec media queries
- **`themes.css`** : Tokens avec modes de thème (`[data-theme]`, `[data-brand]`)

## Configuration

Les générateurs sont configurés dans `src/generate/generator-registry.json` avec :
- Patterns de tokens à inclure
- Stratégies d'émission CSS
- Filtres de source

## Développement

```bash
npm install
npm run extract    # Extraire les tokens
npm run generate   # Générer le CSS
npm run trace      # Tracer un alias
```