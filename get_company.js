
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const sb = createClient(url, key);
sb.from('companies').select('id,name').then(({data,error}) => {
  fs.writeFileSync('/tmp/cid.txt', JSON.stringify({data,error}));
  process.exit(0);
});
