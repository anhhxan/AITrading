import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function askPassword(query: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(query);
    let password = '';
    
    const onData = (chunk: Buffer) => {
      const char = chunk.toString('utf8');
      
      // Enter key
      if (char === '\n' || char === '\r' || char === '\r\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(password);
        return;
      }
      
      // Ctrl+C
      if (char === '\u0003') {
        process.exit();
      }
      
      // Backspace
      if (char === '\u0008' || char === '\x7f') {
        password = password.slice(0, -1);
      } else {
        password += char;
      }
    };
    
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const email = args[0];

  if (!email) {
    console.error('Usage: npx tsx src/test_supabase_login.ts email@example.com');
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('AUTH DIRECT TEST: FAIL');
    console.error('Error message: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
    process.exit(1);
  }

  const password = await askPassword('Enter password: ');

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.log('\nAUTH DIRECT TEST: FAIL');
    console.log('Error message:', error.message);
    if ((error as any).code) console.log('Error code:', (error as any).code);
    console.log('Status:', error.status);
    process.exit(1);
  }

  if (data && data.user) {
    console.log('\nAUTH DIRECT TEST: PASS');
    console.log('User ID:', data.user.id);
    console.log('Email:', data.user.email);
    
    await supabase.auth.signOut();
  }
}

main().catch(console.error);
