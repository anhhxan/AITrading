import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
import { POST } from '../app/api/robots/[robotId]/test-signal/route';

async function runTests() {
  const robotId = 'f1610ab1-3177-4930-81fc-6cd98262d7b6';
  
  console.log(`[TEST RUNNER] Starting single test calling Next.js API handler directly...`);
  
  // Mock NextRequest
  const req = {
    method: 'POST',
    url: `http://localhost:3000/api/robots/${robotId}/test-signal`,
  } as any;
  
  const params = Promise.resolve({ robotId });

  try {
      const res = await POST(req, { params });
      const data = await res.json();
      console.log(`Single Test Result:`, JSON.stringify(data, null, 2));
      
      if (data.supabase_persistence === 'SUCCESS') {
          console.log(`\n[TEST RUNNER] Single test passed! Running 10 sequential tests...\n`);
          
          console.log(`testId\t\t| CF status\t| Vercel status\t| Supabase\t| duration\t| execution`);
          console.log(`-----------------------------------------------------------------------------------------`);
          
          for (let i = 0; i < 10; i++) {
              const res2 = await POST(req, { params });
              const d2 = await res2.json();
              console.log(`${d2.testId.substring(0,8)}\t| ${d2.worker_response_status}\t\t| N/A\t\t| ${d2.supabase_persistence}\t| ${d2.duration_ms}ms\t| ${d2.execution_status}`);
              
              if (d2.worker_response_status !== 200 || d2.worker_request_status === 'FAILED') {
                  console.error(`[WARNING] Test ${i+1} returned bad status!`);
              }
          }
      } else {
          console.error(`[TEST RUNNER] Single test failed or persistence not found.`);
      }
  } catch (err) {
      console.error(`Failed to execute POST handler`, err);
  }
}

runTests().catch(console.error);
