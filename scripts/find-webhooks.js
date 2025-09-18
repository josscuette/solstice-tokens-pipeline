#!/usr/bin/env node

import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const FIGMA_TOKEN = process.env.FIGMA_PERSONAL_ACCESS_TOKEN;
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

// Fonction pour tester différents contextes
async function testContexts() {
    console.log('🔍 Test des différents paramètres context...');
    
    const contexts = [
        'webhooks',
        'team',
        'file',
        'project',
        'library',
        'variables',
        'components',
        'styles',
        'comments',
        'dev_resources',
        'plugins',
        'branches',
        'files',
        'projects',
        'teams',
        'users',
        'organizations'
    ];
    
    const options = {
        method: 'GET',
        headers: {
            'X-FIGMA-TOKEN': FIGMA_TOKEN,
            'Content-Type': 'application/json'
        }
    };

    for (const context of contexts) {
        try {
            console.log(`\n🧪 Test avec context: ${context}`);
            const response = await makeRequest(`https://api.figma.com/v2/webhooks?team_id=${TEAM_ID}&context=${context}`, options);
            
            if (response.status === 200) {
                console.log(`✅ SUCCESS avec context: ${context}`);
                console.log(`📋 ${response.data.webhooks.length} webhooks trouvés`);
                
                if (response.data.webhooks.length > 0) {
                    console.log('📝 Détails des webhooks:');
                    response.data.webhooks.forEach(webhook => {
                        console.log(`   - ID: ${webhook.id}`);
                        console.log(`     Endpoint: ${webhook.endpoint}`);
                        console.log(`     Event: ${webhook.event_type}`);
                        console.log(`     File ID: ${webhook.file_id || 'N/A'}`);
                        console.log('');
                    });
                }
                return response.data.webhooks;
            } else {
                console.log(`❌ Erreur avec context: ${context} - ${response.data.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.log(`❌ Erreur réseau avec context: ${context} - ${error.message}`);
        }
    }
    
    return [];
}

// Fonction pour supprimer un webhook
async function deleteWebhook(webhookId) {
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
    console.log('🔍 Recherche des webhooks existants avec différents contextes');
    console.log('============================================================');
    
    // Tester différents contextes pour trouver les webhooks
    const webhooks = await testContexts();
    
    if (webhooks.length > 0) {
        console.log('\n🗑️  Suppression des webhooks existants...');
        let deletedCount = 0;
        
        for (const webhook of webhooks) {
            const deleted = await deleteWebhook(webhook.id);
            if (deleted) deletedCount++;
        }
        
        console.log(`✅ ${deletedCount}/${webhooks.length} webhooks supprimés`);
    } else {
        console.log('\n❌ Impossible de récupérer la liste des webhooks');
        console.log('💡 Il faut peut-être utiliser une autre approche ou contacter Figma');
    }
}

// Exécution
main().catch(console.error);
