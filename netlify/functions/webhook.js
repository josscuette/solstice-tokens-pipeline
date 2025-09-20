const https = require('https');

// Endpoint webhook pour recevoir les notifications Figma
exports.handler = async (event, context) => {
  console.log('Webhook function called:', event.httpMethod);
  
  // Gérer les requêtes OPTIONS (CORS)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    // Vérifier que c'est bien un webhook Figma
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    const body = JSON.parse(event.body || '{}');
    
    // Log du webhook reçu
    console.log('Webhook Figma reçu:', JSON.stringify(body, null, 2));
    
    // Fichiers Figma autorisés (test avec Core Primitives seulement)
    const allowedFileIds = [
      'wLvDaVOlQQcc1WacqT7BtB'  // Core Primitives (ID correct d'après les logs)
    ];
    
    // DEBUG: Log des valeurs pour diagnostic
    console.log(`DEBUG - event_type: "${body.event_type}"`);
    console.log(`DEBUG - file_key: "${body.file_key}"`);
    console.log(`DEBUG - allowedFileIds:`, allowedFileIds);
    console.log(`DEBUG - Checking event_type...`);
    
    // Vérifier que l'événement est LIBRARY_PUBLISH ou figma-publish
    if (body.event_type !== 'LIBRARY_PUBLISH' && body.event_type !== 'figma-publish') {
      console.log(`Ignoring event type: ${body.event_type}`);
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({ message: 'Event type ignored', event_type: body.event_type })
      };
    }
    
    console.log(`DEBUG - Event type OK, checking file...`);
    
    // Vérifier que le fichier concerné est dans notre liste autorisée
    // Gérer les deux structures : directe (Figma) et nested (manuel)
    let fileId;
    if (body.event_type === 'figma-publish' && body.client_payload) {
      fileId = body.client_payload.file_key;
    } else {
      fileId = body.file_key;
    }
    
    console.log(`DEBUG - fileId extracted: "${fileId}"`);
    console.log(`DEBUG - Checking if fileId is in allowedFileIds...`);
    
    if (!fileId || !allowedFileIds.includes(fileId)) {
      console.log(`Ignoring file: ${fileId} (not in allowed list)`);
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({ message: 'File not tracked', file_key: fileId })
      };
    }
    
    console.log(`DEBUG - File ID OK, proceeding...`);
    
    console.log(`Processing LIBRARY_PUBLISH for file: ${fileId}`);
    
    // Mapping des IDs vers les noms des sources (test avec Core Primitives seulement)
    const fileIdToSource = {
      'wLvDaVOlQQcc1WacqT7BtB': 'core-primitives'  // Core Primitives (ID correct)
    };
    
    // Déclencher l'action GitHub
    const githubToken = process.env.GITHUB_TOKEN;
    const repoOwner = 'josscuette';
    const repoName = 'solstice-tokens-pipeline';
    
    // Vérifier que le token GitHub est disponible
    if (!githubToken) {
      console.log('Warning: GITHUB_TOKEN not found in environment variables');
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({ 
          message: 'Webhook received but GitHub token not configured',
          file_key: fileId,
          source_name: fileIdToSource[fileId],
          event_type: 'LIBRARY_PUBLISH',
          warning: 'GITHUB_TOKEN missing'
        })
      };
    }
    
    const payload = {
      event_type: 'figma-publish',
      client_payload: {
        timestamp: new Date().toISOString(),
        source: 'figma-webhook',
        file_key: fileId,
        source_name: fileIdToSource[fileId],
        event_type: 'LIBRARY_PUBLISH'
      }
    };

    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: `/repos/${repoOwner}/${repoName}/dispatches`,
      method: 'POST',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Figma-Webhook-Netlify',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(payload))
      }
    };

    return new Promise((resolve) => {
      const req = https.request(options, (res) => {
        resolve({
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
          },
          body: JSON.stringify({ 
            message: 'Webhook processed successfully',
            github_status: res.statusCode,
            file_key: fileId,
            source_name: fileIdToSource[fileId],
            event_type: 'LIBRARY_PUBLISH'
          })
        });
      });

      req.on('error', (error) => {
        resolve({
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
          },
          body: JSON.stringify({ error: error.message })
        });
      });

      req.write(JSON.stringify(payload));
      req.end();
    });

  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};