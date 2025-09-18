const https = require('https');

exports.handler = async (event, context) => {
  console.log('Webhook function called:', event.httpMethod, new Date().toISOString());
  
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

  try {
    const body = JSON.parse(event.body || '{}');
    
    // Log du webhook reçu
    console.log('Webhook Figma reçu:', JSON.stringify(body, null, 2));
    
    // Vérifier le type d'événement
    if (body.event_type === 'FILE_PUBLISHED' || 
        body.event_type === 'VARIABLE_PUBLISHED') {
      
      // Déclencher GitHub Actions
      const githubToken = process.env.GITHUB_TOKEN;
      const repoOwner = 'josscuette';
      const repoName = 'solstice-tokens-pipeline';
      
      if (!githubToken) {
        console.error('GITHUB_TOKEN non configuré dans les variables d\'environnement');
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
          },
          body: JSON.stringify({ error: 'GitHub token not configured' })
        };
      }
      
      const payload = {
        event_type: 'figma-publish',
        client_payload: {
          timestamp: new Date().toISOString(),
          source: 'figma-webhook',
          figma_data: body
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
          let responseBody = '';
          res.on('data', (chunk) => responseBody += chunk);
          res.on('end', () => {
            console.log('GitHub Actions déclenché:', res.statusCode);
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
                github_response: responseBody
              })
            });
          });
        });

        req.on('error', (error) => {
          console.error('Erreur lors du déclenchement GitHub Actions:', error);
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
      
    } else {
      // Événement ignoré
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({ 
          message: 'Event ignored',
          event_type: body.event_type 
        })
      };
    }

  } catch (error) {
    console.error('Erreur dans le webhook:', error);
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
