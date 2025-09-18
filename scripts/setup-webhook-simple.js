#!/usr/bin/env node

import https from 'https';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const FIGMA_TOKEN = process.env.FIGMA_PERSONAL_ACCESS_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://solsticetokenspipeline.netlify.app/webhook';

if (!FIGMA_TOKEN) {
    console.error('❌ FIGMA_PERSONAL_ACCESS_TOKEN non trouvé dans les variables d\'environnement');
    process.exit(1);
}

// Fonction pour faire une requête HTTPS
function makeRequest(url, options, data) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsedBody = JSON.parse(body);
                    resolve({ status: res.statusCode, data: parsedBody });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// Fonction pour extraire le fileId depuis les tokens
function extractFileId() {
    try {
        const keyMapping = JSON.parse(fs.readFileSync('raw/key-mapping.json', 'utf8'));
        const firstEntry = Object.values(keyMapping)[0];
        
        if (firstEntry && firstEntry.id) {
            const match = firstEntry.id.match(/VariableID:[^/]*\/([0-9]+):/);
            if (match) {
                return match[1];
            }
        }
    } catch (error) {
        console.error('Erreur lors de l\'extraction du fileId:', error.message);
    }
    return null;
}

// Fonction pour créer le webhook
async function createWebhook(fileId) {
    console.log(`🚀 Création du webhook pour le fichier ${fileId}...`);
    
    const webhookData = {
        event_type: 'FILE_UPDATE',
        file_id: fileId,
        endpoint: WEBHOOK_URL,
        team_id: '1203433736795501655',
        passcode: 'solstice-webhook-2024' // Passcode pour sécuriser le webhook
    };

    const options = {
        method: 'POST',
        headers: {
            'X-FIGMA-TOKEN': FIGMA_TOKEN,
            'Content-Type': 'application/json'
        }
    };

    try {
        const response = await makeRequest('https://api.figma.com/v2/webhooks', options, webhookData);
        
        if (response.status === 200 || response.status === 201) {
            console.log('✅ Webhook créé avec succès !');
            console.log('📋 Détails du webhook:', JSON.stringify(response.data, null, 2));
            return response.data;
        } else {
            console.error('❌ Erreur lors de la création du webhook:', response.data);
            return null;
        }
    } catch (error) {
        console.error('❌ Erreur réseau:', error.message);
        return null;
    }
}

// Fonction principale
async function main() {
    console.log('🎨 Configuration automatique du webhook Figma');
    console.log('==========================================');
    
    // Extraire le fileId depuis les tokens
    const fileId = extractFileId();
    
    if (!fileId) {
        console.error('❌ Impossible d\'extraire le fileId depuis les tokens');
        process.exit(1);
    }
    
    console.log(`📁 File ID trouvé: ${fileId}`);
    
    // Créer le webhook
    const webhook = await createWebhook(fileId);
    
    if (webhook) {
        console.log('\n🎉 Webhook configuré avec succès !');
        console.log(`🔗 URL: ${WEBHOOK_URL}`);
        console.log(`📁 File ID: ${fileId}`);
        console.log('\n💡 Vous pouvez maintenant publier votre fichier Figma pour tester !');
    } else {
        console.log('\n❌ Échec de la configuration du webhook');
    }
}

// Exécution
main().catch(console.error);



