const https = require('https');

// Endpoint webhook pour recevoir les notifications Figma
exports.handler = async (event, context) => {
  try {
    // Vérifier que c'est bien un webhook Figma
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    const body = JSON.parse(event.body || '{}');
    
    // Déclencher l'action GitHub
    const githubToken = process.env.GITHUB_TOKEN;
    const repoOwner = 'josscuette';
    const repoName = 'solstice-tokens-pipeline';
    
    const payload = {
      event_type: 'figma-publish',
      client_payload: {
        timestamp: new Date().toISOString(),
        source: 'figma-webhook'
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
            github_status: res.statusCode 
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

