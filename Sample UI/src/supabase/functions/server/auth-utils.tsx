import { createClient } from 'npm:@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// Utility function to verify user authorization
export async function getAuthorizedUser(request: Request) {
  const authHeader = request.headers.get('Authorization');
  console.log('Auth header present:', !!authHeader);
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Missing or invalid authorization header format');
    return null;
  }
  
  const accessToken = authHeader.split(' ')[1];
  if (!accessToken) {
    console.log('No access token in authorization header');
    return null;
  }
  
  console.log('Attempting to verify user with token:', accessToken.substring(0, 20) + '...');
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error) {
      console.log('Supabase auth error:', error);
      return null;
    }
    
    if (!user) {
      console.log('No user found for token');
      return null;
    }
    
    console.log('User authenticated successfully:', user.id);
    return user;
  } catch (error) {
    console.log('Exception during user verification:', error);
    return null;
  }
}

export { supabase };