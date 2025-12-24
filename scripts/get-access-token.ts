/**
 * Get Supabase access token for CLI usage
 */

const email = 'brandon@managedbyora.com';
const password = '@2Tampa2015';

async function getAccessToken() {
  try {
    // Try Supabase Auth API
    const response = await fetch('https://api.supabase.com/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.access_token) {
        console.log(data.access_token);
        return data.access_token;
      }
    }

    // Alternative: Use Management API
    const mgmtResponse = await fetch('https://api.supabase.com/v1/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (mgmtResponse.ok) {
      const data = await mgmtResponse.json();
      if (data.access_token) {
        console.log(data.access_token);
        return data.access_token;
      }
    }

    throw new Error('Could not get access token');
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

getAccessToken();
