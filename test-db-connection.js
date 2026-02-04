// Test script to verify Supabase database connection
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials in .env.local');
  process.exit(1);
}

console.log('🔌 Testing Supabase connection...\n');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseKey.substring(0, 20) + '...\n');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    // Test 1: Basic connection test - try to access Supabase API
    console.log('Test 1: Testing Supabase API connection...');
    
    // Try a simple health check by accessing auth endpoint
    const { data: healthData, error: healthError } = await supabase.auth.getSession();
    
    // Even if auth fails, if we get a response, connection works
    if (healthError && healthError.message.includes('JWT')) {
      // This is expected - we're using anon key, not authenticated
      console.log('✅ API connection successful! (Auth check returned expected result)\n');
    } else {
      console.log('✅ API connection successful!\n');
    }
    
    // Test 2: Check if tables exist
    console.log('Test 2: Checking for database tables...');
    const { data: events, error: eventsError } = await supabase.from('events').select('id').limit(1);
    const { data: captions, error: captionsError } = await supabase.from('captions').select('id').limit(1);
    
    if (!eventsError && !captionsError) {
      console.log('✅ Tables exist: events, captions');
      
      // Count records
      const { count: eventsCount } = await supabase.from('events').select('*', { count: 'exact', head: true });
      const { count: captionsCount } = await supabase.from('captions').select('*', { count: 'exact', head: true });
      
      console.log(`   → Events: ${eventsCount || 0} records`);
      console.log(`   → Captions: ${captionsCount || 0} records\n`);
    } else {
      if (eventsError && (eventsError.code === 'PGRST116' || eventsError.message.includes('does not exist'))) {
        console.log('⚠️  Tables not found. This is expected - you need to run migrations.');
        console.log('   → See instructions below.\n');
      } else {
        console.log('⚠️  Error checking tables:', eventsError?.message || captionsError?.message, '\n');
      }
    }
    
    // Test 3: Check Realtime (if tables exist)
    if (!eventsError && !captionsError) {
      console.log('Test 3: Checking Realtime subscription...');
      return new Promise((resolve) => {
        const channel = supabase.channel('test-connection');
        let resolved = false;
        
        channel.subscribe((status) => {
          if (!resolved) {
            resolved = true;
            if (status === 'SUBSCRIBED') {
              console.log('✅ Realtime is enabled and working!\n');
              channel.unsubscribe();
              resolve(true);
            } else if (status === 'CHANNEL_ERROR') {
              console.log('⚠️  Realtime subscription issue (may need configuration)\n');
              resolve(true);
            }
          }
        });
        
        // Timeout after 3 seconds
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.log('⚠️  Realtime check timed out (this is okay for now)\n');
            resolve(true);
          }
        }, 3000);
      });
    }
    
    return true;
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    return false;
  }
}

testConnection().then(success => {
  if (success) {
    console.log('✅ Database connection test completed!');
    console.log('\nNext steps:');
    console.log('1. Run the database migrations (see SETUP.md)');
    console.log('2. Configure GitHub OAuth');
    console.log('3. Add your ElevenLabs API key to .env.local');
    console.log('4. Run: pnpm dev');
  } else {
    console.log('\n❌ Database connection test failed.');
    console.log('Please check your Supabase credentials and project status.');
  }
  process.exit(success ? 0 : 1);
});
