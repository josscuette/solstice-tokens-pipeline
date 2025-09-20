# Solstice Tokens Pipeline

A comprehensive design token pipeline that extracts tokens from Figma and generates CSS variables with advanced collection-based routing. This system automatically processes design tokens from multiple Figma files and generates organized CSS files for different use cases.

## 🚀 Features

- **Collection-based CSS Generation**: Routes tokens to appropriate CSS files based on Figma collections
- **Multi-mode Support**: Handles theme modes (light/dark, JLL/Lasalle), density modes (low/medium/high), and responsive breakpoints
- **Automatic Webhook Processing**: Triggers CSS generation when Figma files are published
- **Alias Resolution**: Maintains Figma's token reference structure with one-level alias resolution
- **Real Breakpoints**: Uses actual breakpoint values from Figma tokens instead of hardcoded values

## 📁 Project Structure

```
├── src/
│   ├── extract/
│   │   └── figmaExtractor.js          # Extracts tokens from Figma API
│   └── generate/
│       ├── cssGenerator.js             # Main CSS generation engine
│       ├── collections-config.json     # Figma collection metadata
│       ├── generator-router.json       # Generator-to-collection mapping
│       └── trace-alias.js              # Token alias resolution
├── raw/                               # Raw token data from Figma
│   ├── core-tokens/                   # Core semantic tokens (themes)
│   ├── core-primitives/               # Primitive tokens (colors, spacing, etc.)
│   └── density-system/                # Density and responsive tokens
├── generated/css/                     # Generated CSS files
│   ├── themes.css                     # Semantic colors with 4 theme modes
│   ├── primitives.css                 # Static primitive variables
│   ├── density.css                    # Density-specific tokens
│   └── responsive.css                 # Responsive tokens with media queries
├── docs/                             # Documentation and webhook testing
│   └── netlify/functions/           # Netlify webhook handler
└── .github/workflows/                # GitHub Actions for automation
```

## 🎯 Generated CSS Files

### `themes.css` (1,002 lines)
Semantic colors with 4 theme modes:
- **JLL Light**: `:root, [data-theme="light"], [data-brand="jll"]`
- **JLL Dark**: `[data-theme="dark"], [data-brand="jll"]`
- **Lasalle Light**: `[data-theme="light"], [data-brand="lasalle"]`
- **Lasalle Dark**: `[data-theme="dark"], [data-brand="lasalle"]`

### `primitives.css` (913 lines)
Static variables from 7 collections:
- Breakpoints, colors, elevation, spacing, typography, radii, density-agnostic tokens

### `density.css` (1,277 lines)
Density-specific tokens with 3 modes:
- **Low**: `[data-density="low"]`
- **Medium**: `[data-density="medium"]`
- **High**: `[data-density="high"]`

### `responsive.css` (2,354 lines)
Responsive tokens with 12 real breakpoints:
- Mobile Small: `320px-399px`
- Mobile Default: `400px-519px`
- Mobile Large: `520px-623px`
- Tablet Small: `624px-779px`
- Tablet Default: `780px-1219px`
- Tablet Large: `1220px-1459px`
- Laptop Small: `1460px-1699px`
- Laptop Default: `1700px-1919px`
- Laptop Large: `1700px-1919px`
- Desktop Default: `1920px-2199px`
- Desktop Large: `2200px-2399px`
- Desktop Extra Large: `2400px+`

## 🛠️ Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/josscuette/solstice-tokens-pipeline.git
   cd solstice-tokens-pipeline
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your Figma Personal Access Token
   ```

## 🚀 Usage

### Manual Generation

```bash
# Extract tokens from Figma and generate CSS
npm run extract

# Extract tokens only
npm run extract-only

# Generate CSS only (requires existing token data)
npm run generate

# Serve generated files locally
npm run serve
```

### Environment Variables

Required environment variables:

- `FIGMA_PERSONAL_ACCESS_TOKEN`: Your Figma Personal Access Token
- `GITHUB_TOKEN`: GitHub token for webhook automation (set in GitHub Secrets)

## 🔄 Automated Workflow

The pipeline includes automated webhook processing:

1. **Figma Webhook**: Triggers when Figma files are published
2. **GitHub Action**: Processes the webhook and generates CSS
3. **Auto-commit**: Commits generated CSS files to the repository

### Webhook Configuration

The webhook is configured to listen for `LIBRARY_PUBLISH` events from 3 specific Figma files:
- Core Primitives (`wLvDaVOlQQcc1WacqT7BtB`)
- Density System (`dsC3Ox9b8xO9PVXjRugQze`)
- Core Tokens (`C5A2VlekTKqBeOw0xCAcFH`)

## 🏗️ Architecture

### Collection-Based Routing

The system uses a sophisticated routing mechanism:

1. **Collections Config** (`collections-config.json`): Defines Figma collections with their IDs and modes
2. **Generator Router** (`generator-router.json`): Maps generators to collections
3. **CSS Generator**: Routes tokens to appropriate CSS files based on collection membership

### Token Processing Flow

```
Figma Files → Extract → Raw Tokens → Collection Routing → CSS Generation
     ↓              ↓           ↓              ↓                ↓
  3 Files      figmaExtractor  JSON Files   Router Logic   4 CSS Files
```

### Alias Resolution

The system maintains Figma's token reference structure by resolving aliases only one level deep, ensuring CSS variables reference other CSS variables just like in Figma.

## 📊 Collections

The system processes tokens from 10 Figma collections:

| Collection | Description | Modes | Generator |
|------------|-------------|-------|-----------|
| `theme` | Semantic colors | 4 (light/dark × JLL/Lasalle) | themes |
| `responsive` | Responsive values | 12 breakpoints | responsive |
| `densitySpecific` | Density tokens | 3 (low/medium/high) | density |
| `densityAgnostic` | Static tokens | 1 | primitives |
| `breakpoint` | Breakpoint values | 1 | primitives |
| `color` | Primitive colors | 1 | primitives |
| `elevation` | Elevation tokens | 1 | primitives |
| `spacing` | Spacing tokens | 1 | primitives |
| `typography` | Typography tokens | 1 | primitives |
| `radii` | Radius tokens | 1 | primitives |

## 🔧 Development

### Adding New Collections

1. Add collection metadata to `src/generate/collections-config.json`
2. Update generator routing in `src/generate/generator-router.json`
3. Test with `npm run generate`

### Adding New Generators

1. Create generator method in `cssGenerator.js`
2. Add generator configuration to `generator-router.json`
3. Update the `generateAll()` method

### Testing Webhooks

Use the test page at `docs/webhook.html` to manually trigger webhook processing.

## 📝 Scripts

- `npm run extract`: Full pipeline (extract + generate)
- `npm run extract-only`: Extract tokens from Figma only
- `npm run generate`: Generate CSS from existing tokens
- `npm run serve`: Serve files locally on port 8082
- `npm run dev`: Alias for serve

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `npm run extract`
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 👥 Author

**Josselin Cuette**  
<josselin.cuette@jll.com>

---

*This pipeline is part of the Solstice Design System for JLL.*