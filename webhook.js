import https from 'https';

// Endpoint webhook pour recevoir les notifications Figma
export const handler = async (event, context) => {
  try {
    // Vérifier que c'est bien un webhook Figma
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    const body = JSON.parse(event.body || '{}');
    
    // Fichiers Figma autorisés (IDs des 3 fichiers principaux)
    const allowedFileIds = [
      'C5A2VlekTKqBeOw0xCAcFH', // Core Primitives
      'dsC3Ox9b8xO9PVXjRugQze', // Density System  
      'wLvDaVOlQQcc1WacqT7BtB'  // Color Themes
    ];
    
    // Vérifier que l'événement est LIBRARY_PUBLISH
    if (body.event_type !== 'LIBRARY_PUBLISH') {
      console.log(`Ignoring event type: ${body.event_type}`);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Event type ignored', event_type: body.event_type })
      };
    }
    
    // Vérifier que le fichier concerné est dans notre liste autorisée
    const fileId = body.file_key;
    if (!fileId || !allowedFileIds.includes(fileId)) {
      console.log(`Ignoring file: ${fileId} (not in allowed list)`);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'File not tracked', file_key: fileId })
      };
    }
    
    console.log(`Processing LIBRARY_PUBLISH for file: ${fileId}`);
    
    // Mapping des IDs vers les noms des sources
    const fileIdToSource = {
      'C5A2VlekTKqBeOw0xCAcFH': 'core-primitives',
      'dsC3Ox9b8xO9PVXjRugQze': 'density-system',
      'wLvDaVOlQQcc1WacqT7BtB': 'color-themes'
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
        'User-Agent': 'Figma-Webhook',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(payload))
      }
    };

    return new Promise((resolve) => {
      const req = https.request(options, (res) => {
        resolve({
          statusCode: 200,
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
          body: JSON.stringify({ error: error.message })
        });
      });

      req.write(JSON.stringify(payload));
      req.end();
    });

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Export par défaut pour compatibilité
export default { handler };

