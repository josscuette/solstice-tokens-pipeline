import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';

// Load environment variables from .env file
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    });
}

class FigmaTokenExtractor {
    constructor() {
        this.accessToken = process.env.FIGMA_PERSONAL_ACCESS_TOKEN;
        this.baseUrl = 'https://api.figma.com/v1';
        this.headers = {
            'X-Figma-Token': this.accessToken,
            'Content-Type': 'application/json'
        };
    }

    async fetchFigmaData(url) {
        try {
            console.log(`🔄 Fetching: ${url}`);
            const response = await fetch(url, { headers: this.headers });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`✅ Successfully fetched data`);
            return data;
        } catch (error) {
            console.error(`❌ Error fetching ${url}:`, error.message);
            throw error;
        }
    }

    async getFileInfo(fileKey) {
        const url = `${this.baseUrl}/files/${fileKey}`;
        return await this.fetchFigmaData(url);
    }

    async getVariables(fileKey) {
        const url = `${this.baseUrl}/files/${fileKey}/variables/local`;
        return await this.fetchFigmaData(url);
    }

    async getPublishedVariables(fileKey) {
        const url = `${this.baseUrl}/files/${fileKey}/variables/published`;
        return await this.fetchFigmaData(url);
    }


    extractFileNameFromUrl(fileUrl) {
        // Extract file name from Figma URL
        const match = fileUrl.match(/figma\.com\/file\/([^\/]+)\/([^\/\?]+)/);
        if (match) {
            return match[2].replace(/-/g, ' ');
        }
        return 'Unknown File';
    }

    normalizeToken(token, source) {
        return {
            name: token.name,
            source: source,
            id: token.id,
            key: token.key,
            resolvedType: token.resolvedType,
            resolvedDataType: token.resolvedDataType,
            description: token.description || '',
            values: token.valuesByMode || {},
            hiddenFromPublishing: token.hiddenFromPublishing || false,
            scopes: token.scopes || [],
            codeSyntax: token.codeSyntax || {},
            variableCollectionId: token.variableCollectionId,
            updatedAt: token.updatedAt,
            subscribed_id: token.subscribed_id
        };
    }

    async extractFromFile(fileKey, sourceName) {
        console.log(`\n📁 Extracting from file: ${fileKey}`);
        
        try {
            // Get file info
            const fileInfo = await this.getFileInfo(fileKey);
            const fileName = fileInfo.name || this.extractFileNameFromUrl(fileKey);
            console.log(`📄 File: ${fileName}`);

            // Extract local variables
            const localVars = await this.getVariables(fileKey);
            const localVariables = localVars.meta?.variables || {};
            const localTokensArray = Object.values(localVariables);
            console.log(`📊 Found ${localTokensArray.length} local variables`);

            // Extract published variables
            const publishedVars = await this.getPublishedVariables(fileKey);
            const publishedVariables = publishedVars.meta?.variables || {};
            const publishedTokensArray = Object.values(publishedVariables);
            console.log(`📊 Found ${publishedTokensArray.length} published variables`);

            // Normalize tokens
            const localTokens = localTokensArray.map(token => 
                this.normalizeToken(token, sourceName)
            );

            const publishedTokens = publishedTokensArray.map(token => 
                this.normalizeToken(token, sourceName)
            );

            return {
                fileName,
                localTokens,
                publishedTokens
            };

        } catch (error) {
            console.error(`❌ Error extracting from ${fileKey}:`, error.message);
            return {
                fileName: 'Error',
                localTokens: [],
                publishedTokens: []
            };
        }
    }

    async extractAllTokens() {
        console.log('🚀 Starting Figma token extraction...');
        
        if (!this.accessToken) {
            throw new Error('FIGMA_PERSONAL_ACCESS_TOKEN not found in environment variables');
        }

        // Define the files to extract from (based on our previous work)
        const filesToExtract = [
            {
                key: 'C5A2VlekTKqBeOw0xCAcFH',
                source: 'core-primitives',
                description: 'Core Primitives - breakpoints, colors, spacing, radius, shadows'
            },
            {
                key: 'dsC3Ox9b8xO9PVXjRugQze', 
                source: 'density-system',
                description: 'Density System - responsive typography and layout'
            },
            {
                key: 'wLvDaVOlQQcc1WacqT7BtB',
                source: 'color-themes',
                description: 'Color Themes - surface, text, brand colors'
            }
        ];

        const allResults = {};

        for (const file of filesToExtract) {
            console.log(`\n🔄 Processing ${file.source}...`);
            const result = await this.extractFromFile(file.key, file.source);
            allResults[file.source] = result;
            
            // Save individual files
            await this.saveExtractedData(file.source, result);
        }

        console.log('\n🎉 Extraction completed!');
        return allResults;
    }

    async saveExtractedData(sourceName, data) {
        const outputDir = `raw/${sourceName}`;
        
        // Ensure directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Save local tokens
        const localPath = `${outputDir}/tokens-local.json`;
        fs.writeFileSync(localPath, JSON.stringify(data.localTokens, null, 2));
        console.log(`💾 Saved ${data.localTokens.length} local tokens to ${localPath}`);

        // Save published tokens
        const publishedPath = `${outputDir}/tokens-published.json`;
        fs.writeFileSync(publishedPath, JSON.stringify(data.publishedTokens, null, 2));
        console.log(`💾 Saved ${data.publishedTokens.length} published tokens to ${publishedPath}`);


        // Create merged tokens (published as source of truth, enriched with local metadata)
        const mergedTokens = this.mergeTokens(data.publishedTokens, data.localTokens);
        const mergedPath = `${outputDir}/tokens-merged.json`;
        fs.writeFileSync(mergedPath, JSON.stringify(mergedTokens, null, 2));
        console.log(`💾 Saved ${mergedTokens.length} merged tokens to ${mergedPath}`);
    }

    mergeTokens(publishedTokens, localTokens) {
        // Create a map of local tokens for quick lookup
        const localMap = new Map();
        localTokens.forEach(token => {
            localMap.set(token.name, token);
        });

        // Start with published tokens as the base (source of truth for inventory)
        const mergedTokens = publishedTokens.map(publishedToken => {
            const localToken = localMap.get(publishedToken.name);
            if (localToken) {
                // Merge published (source of truth) with ALL local data
                return {
                    ...publishedToken,
                    // Enrich with ALL local data
                    resolvedType: localToken.resolvedType,
                    description: localToken.description || publishedToken.description,
                    values: localToken.values, // Copy values from local token
                    hiddenFromPublishing: localToken.hiddenFromPublishing,
                    scopes: localToken.scopes,
                    codeSyntax: localToken.codeSyntax,
                    // Flag to indicate this token is published
                    isPublished: true
                };
            }
            // If no local match, keep published token but mark as incomplete
            return {
                ...publishedToken,
                values: {}, // No values available
                isPublished: true,
                isIncomplete: true
            };
        });

        // DO NOT add local-only tokens - they are phantom tokens that don't exist
        // Each token should exist in exactly one file
        console.log(`📊 Merged ${mergedTokens.length} tokens (${publishedTokens.length} published, ${localTokens.length} local)`);
        
        return mergedTokens;
    }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const extractor = new FigmaTokenExtractor();
    extractor.extractAllTokens().catch(console.error);
}

export default FigmaTokenExtractor;
