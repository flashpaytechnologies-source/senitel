import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://unutjtyiyliiuyhxvbrh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_RPiSnN6_dfPMAnYPM3G5Kg_WgQEGlt7';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);