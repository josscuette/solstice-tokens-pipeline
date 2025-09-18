#!/usr/bin/env node

import https from 'https';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const FIGMA_TOKEN = process.env.FIGMA_PERSONAL_ACCESS_TOKEN;
const WEBHOOK_URL = 'https://sparkling-sunflower-ca7cd5.netlify.app';

if (!FIGMA_TOKEN) {
    console.error('❌ FIGMA_TOKEN non trouvé dans les variables d\'environnement');
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

// Fonction pour récupérer les informations du fichier
async function getFileInfo(fileId) {
    console.log(`🔍 Récupération des infos du fichier ${fileId}...`);
    
    const options = {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${FIGMA_TOKEN}`,
            'Content-Type': 'application/json'
        }
    };

    try {
        const response = await makeRequest(`https://api.figma.com/v1/files/${fileId}`, options);
        
        if (response.status === 200) {
            console.log('✅ Informations du fichier récupérées');
            return response.data;
        } else {
            console.error('❌ Erreur lors de la récupération des infos:', response.data);
            return null;
        }
    } catch (error) {
        console.error('❌ Erreur réseau:', error.message);
        return null;
    }
}

// Fonction pour créer le webhook
async function createWebhook(teamId, fileId) {
    console.log(`🚀 Création du webhook pour l'équipe ${teamId}...`);
    
    const webhookData = {
        event_type: 'FILE_UPDATE',
        team_id: teamId,
        endpoint: WEBHOOK_URL
    };

    const options = {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${FIGMA_TOKEN}`,
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

// Fonction pour lister les webhooks existants
async function listWebhooks(teamId) {
    console.log(`📋 Liste des webhooks existants pour l'équipe ${teamId}...`);
    
    const options = {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${FIGMA_TOKEN}`,
            'Content-Type': 'application/json'
        }
    };

    try {
        const response = await makeRequest(`https://api.figma.com/v2/teams/${teamId}/webhooks`, options);
        
        if (response.status === 200) {
            console.log('✅ Webhooks existants:', JSON.stringify(response.data, null, 2));
            return response.data;
        } else {
            console.error('❌ Erreur lors de la récupération des webhooks:', response.data);
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
    
    // Récupérer les IDs depuis les fichiers de tokens
    const tokenFiles = [
        'raw/density-system/tokens-merged.json',
        'raw/responsive-system/tokens-merged.json', 
        'raw/theme-system/tokens-merged.json'
    ];
    
    let teamId = null;
    let fileId = null;
    
    // Chercher les IDs dans les fichiers de tokens
    for (const file of tokenFiles) {
        if (fs.existsSync(file)) {
            try {
                const tokens = JSON.parse(fs.readFileSync(file, 'utf8'));
                const firstToken = Object.values(tokens)[0];
                
                if (firstToken && firstToken.teamId) {
                    teamId = firstToken.teamId;
                    fileId = firstToken.fileId;
                    console.log(`📁 IDs trouvés dans ${file}:`);
                    console.log(`   Team ID: ${teamId}`);
                    console.log(`   File ID: ${fileId}`);
                    break;
                }
            } catch (error) {
                console.log(`⚠️  Erreur lecture ${file}:`, error.message);
            }
        }
    }
    
    // Si pas trouvé dans les tokens, essayer de récupérer depuis l'API
    if (!teamId && !fileId) {
        console.log('🔍 IDs non trouvés dans les tokens, tentative via API...');
        
        // Essayer de récupérer les infos depuis les collections de variables
        const collectionId = '24109'; // Collection ID trouvé dans les tokens
        
        try {
            const response = await makeRequest(`https://api.figma.com/v1/variable-collections/${collectionId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${FIGMA_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.status === 200 && response.data) {
                teamId = response.data.teamId;
                fileId = response.data.fileId;
                console.log(`📁 IDs récupérés via API (collection ${collectionId}):`);
                console.log(`   Team ID: ${teamId}`);
                console.log(`   File ID: ${fileId}`);
            }
        } catch (error) {
            console.log('⚠️  Erreur lors de la récupération via collection:', error.message);
        }
    }
    
    if (!teamId) {
        console.error('❌ Impossible de récupérer le team_id. Vérifiez votre configuration.');
        console.log('💡 Vous pouvez aussi définir manuellement:');
        console.log('   - FIGMA_TEAM_ID dans votre .env');
        console.log('   - Ou modifier le script avec votre file_id');
        process.exit(1);
    }
    
    // Lister les webhooks existants
    await listWebhooks(teamId);
    
    // Créer le nouveau webhook
    const webhook = await createWebhook(teamId, fileId);
    
    if (webhook) {
        console.log('\n🎉 Webhook configuré avec succès !');
        console.log(`🔗 URL: ${WEBHOOK_URL}`);
        console.log(`📊 Team ID: ${teamId}`);
        console.log(`📁 File ID: ${fileId}`);
        console.log('\n💡 Vous pouvez maintenant publier votre fichier Figma pour tester !');
    } else {
        console.log('\n❌ Échec de la configuration du webhook');
    }
}

// Exécution
main().catch(console.error);
