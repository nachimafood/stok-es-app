import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kzsrrkzxaroerjumfgdd.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6c3Jya3p4YXJvZXJqdW1mZ2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5NjUxOTcsImV4cCI6MjEwMDU0MTE5N30.Ym5-830u1ZEyGilp9uO3STQ7yLUrYqwILc_6iCxgenQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
