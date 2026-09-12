const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qusucvfcrtaayensmzht.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1c3VjdmZjcnRhYXllbnNtemh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzk3ODAwNiwiZXhwIjoyMTAzNTU0MDA2fQ.n9QWieDvJqCMPj4gCKy_g3klMpM-c5vJF4ggodhUjb8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  const yesterday20h = new Date('2026-09-07T13:00:00Z').toISOString();
  const robotIds = [
    'e0d00614-dfcc-4948-b840-340bfa0f8707', // 10m
    '7e95b9b5-e113-4d61-92a6-26c9979e7ebc', // 1h
    '1ba05b33-0b3c-4838-9cbb-dfe8161895d9'  // 30m
  ];

  console.log("=== LATEST STRATEGY SIGNALS & REALTIME PRICES ===");
  
  for (const rid of robotIds) {
    console.log(`\nAnalyzing Robot: ${rid}`);
    
    // Check STATE_TRANSITION first
    const { data: states } = await supabase.from('core_events')
      .select('payload, created_at')
      .eq('robot_id', rid)
      .eq('event_type', 'STATE_TRANSITION')
      .gte('created_at', yesterday20h)
      .order('created_at', { ascending: true });
      
    if (states && states.length > 0) {
      console.log(`State Transitions (Total: ${states.length}):`);
      states.slice(-5).forEach(s => console.log(` -> ${s.payload?.toState || s.payload?.state} at ${s.created_at}`));
    } else {
       console.log("No State Transitions found.");
    }
    
    // Get latest STRATEGY_SIGNAL_EVENT
    const { data: signals } = await supabase.from('core_events')
      .select('payload, created_at, correlation_id')
      .eq('robot_id', rid)
      .eq('event_type', 'STRATEGY_SIGNAL_EVENT')
      .gte('created_at', yesterday20h)
      .order('created_at', { ascending: false });
      
    if (!signals || signals.length === 0) {
      console.log("No signals generated.");
      continue;
    }
    
    const latestSignal = signals[0];
    const p = latestSignal.payload;
    if (p.direction === 'NONE') {
      console.log(`Latest Signal: NONE at ${latestSignal.created_at}`);
      continue;
    }
    
    console.log(`Signal: ${p.direction} at ${latestSignal.created_at} (Correlation: ${latestSignal.correlation_id})`);
    console.log(`Arm Bounds:`, JSON.stringify(p.armBounds));
    console.log(`Entry Trigger:`, JSON.stringify(p.entryTrigger));
    
    // Check realtime prices after this signal
    const { data: prices } = await supabase.from('core_events')
      .select('payload')
      .eq('robot_id', rid)
      .eq('event_type', 'REALTIME_PRICE_EVENT')
      .gte('created_at', latestSignal.created_at)
      .order('created_at', { ascending: true });
      
    if (!prices || prices.length === 0) {
      console.log("NO REALTIME PRICES FOUND after this signal!");
    } else {
      console.log(`Found ${prices.length} REALTIME_PRICE_EVENT(s).`);
      let minPrice = Infinity;
      let maxPrice = -Infinity;
      prices.forEach(pr => {
        const pVal = pr.payload.price;
        if (pVal < minPrice) minPrice = pVal;
        if (pVal > maxPrice) maxPrice = pVal;
      });
      console.log(`Price Range since signal: MIN = ${minPrice}, MAX = ${maxPrice}`);
      
      let armTouched = false;
      let triggerTouched = false;
      
      if (p.direction === 'SHORT') {
         armTouched = maxPrice >= (p.armBounds?.upper || p.armBounds?.value || 999999);
         triggerTouched = minPrice <= (p.entryTrigger?.lower || p.entryTrigger?.value || 0);
      } else {
         armTouched = minPrice <= (p.armBounds?.lower || p.armBounds?.value || 0);
         triggerTouched = maxPrice >= (p.entryTrigger?.upper || p.entryTrigger?.value || 999999);
      }
      console.log(`Arm Touched? ${armTouched} | Trigger Touched? ${triggerTouched}`);
    }
  }
}

runAudit();
