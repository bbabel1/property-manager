import { config } from 'dotenv';
import { supabaseAdmin } from './src/lib/db.js';

config({ path: '.env.local' });

config({ path: '.env.local' });

async function testMonthlyLogs() {
  try {
    console.log('Testing database connection...');

    // Test basic connection
    const { data: testData, error: testError } = await supabaseAdmin
      .from('monthly_logs')
      .select('id, stage, status')
      .limit(5);

    if (testError) {
      console.error('Database connection error:', testError);
      return;
    }

    console.log('Database connection successful');
    console.log('Found monthly logs:', testData?.length || 0);

    if (testData && testData.length > 0) {
      console.log('Sample monthly log:', testData[0]);

      // Test updating the first monthly log
      const { error: updateError } = await supabaseAdmin
        .from('monthly_logs')
        .update({ stage: 'payments', status: 'in_progress' })
        .eq('id', testData[0].id);

      if (updateError) {
        console.error('Update error:', updateError);
      } else {
        console.log('Update successful');
      }
    } else {
      console.log('No monthly logs found in database');
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testMonthlyLogs();
