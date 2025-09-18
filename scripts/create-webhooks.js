#!/usr/bin/env node

import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const FIGMA_TOKEN = process.env.FIGMA_PERSONAL_ACCESS_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://solsticetokenspipeline.netlify.app/webhook';
const TEAM_ID = '1203433736795501655';

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

// Fonction pour créer un webhook pour un fichier spécifique
async function createWebhook(fileId, fileName) {
    console.log(`🚀 Création du webhook pour ${fileName} (${fileId})...`);
    
    const webhookData = {
        event_type: 'FILE_UPDATE',
        file_id: fileId,
        endpoint: WEBHOOK_URL,
        team_id: TEAM_ID,
        passcode: 'solstice-webhook-2024'
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
            console.log(`✅ Webhook créé pour ${fileName}`);
            console.log(`   ID: ${response.data.id}`);
            return response.data;
        } else {
            console.error(`❌ Erreur lors de la création du webhook pour ${fileName}:`, response.data);
            return null;
        }
    } catch (error) {
        console.error('❌ Erreur réseau:', error.message);
        return null;
    }
}

// Fonction pour supprimer un webhook par ID (si on connaît l'ID)
async function deleteWebhookById(webhookId) {
    console.log(`🗑️  Suppression du webhook ${webhookId}...`);
    
    const options = {
        method: 'DELETE',
        headers: {
            'X-FIGMA-TOKEN': FIGMA_TOKEN,
            'Content-Type': 'application/json'
        }
    };

    try {
        const response = await makeRequest(`https://api.figma.com/v2/webhooks/${webhookId}`, options);
        
        if (response.status === 200) {
            console.log(`✅ Webhook ${webhookId} supprimé`);
            return true;
        } else {
            console.error(`❌ Erreur lors de la suppression du webhook ${webhookId}:`, response.data);
            return false;
        }
    } catch (error) {
        console.error('❌ Erreur réseau:', error.message);
        return false;
    }
}

// Fonction principale
async function main() {
    console.log('🚀 Tentative de création des webhooks pour les 3 fichiers principaux');
    console.log('==================================================================');
    
    const mainFiles = [
        { id: 'C5A2VlekTKqBeOw0xCAcFH', name: 'Core Primitives' },
        { id: 'dsC3Ox9b8xO9PVXjRugQze', name: 'Density System' },
        { id: 'wLvDaVOlQQcc1WacqT7BtB', name: 'Color Themes' }
    ];
    
    let createdCount = 0;
    let failedCount = 0;
    
    for (const file of mainFiles) {
        const webhook = await createWebhook(file.id, file.name);
        if (webhook) {
            createdCount++;
        } else {
            failedCount++;
        }
    }
    
    console.log('\n📊 Résultats:');
    console.log(`✅ ${createdCount} webhooks créés`);
    console.log(`❌ ${failedCount} webhooks échoués`);
    
    if (failedCount > 0) {
        console.log('\n💡 Solutions possibles:');
        console.log('1. Supprimer manuellement les anciens webhooks via l\'API Figma');
        console.log('2. Contacter le support Figma pour augmenter la limite');
        console.log('3. Utiliser un seul webhook pour tous les fichiers');
        console.log('4. Utiliser l\'action GitHub pour faire le nettoyage');
    }
    
    if (createdCount > 0) {
        console.log('\n🎉 Au moins un webhook a été créé !');
        console.log(`🔗 URL: ${WEBHOOK_URL}`);
        console.log('💡 Tu peux maintenant tester en publiant dans Figma');
    }
}

// Exécution
main().catch(console.error);
