import { createClient } from '@supabase/supabase-js';
import { BuildRecordService } from '@/lib/database/services/build-record.service';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY');
}

export const postgres = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
    },
  },
);

export async function insertWithSupabase(
  record: ReturnType<typeof BuildRecordService.extractInfo>,
  email: string,
  userId: string,
  message: string,
) {
  const insertData = record ? {
    result: record.result,
    duration: record.duration,
    repository: record.repository,
    branch: record.branch,
    sequence: record.sequence,
    email: email,
    user_id: userId,
    text: message,
  } : {
    result: '',
    duration: '',
    repository: '',
    branch: '',
    sequence: '',
    email: email,
    user_id: userId,
    text: message,
  };

  const { error } = await postgres.from('build_record').insert([insertData]);
  if (error) {
    console.error('Supabase insert Error:', error);
    throw error;
  }
}

export async function getUser(userId: string) {
  const { data: dbUser, error } = await postgres
  .from('user')
  .select('*')
  .eq('user_id', userId)
  .eq('deleted', false);
  if (error) {
    console.error('Supabase getUser Error:', error);
  }
  return dbUser;
}

export async function getUserByEmail(email: string) {
  const { data: dbUser, error } = await postgres
  .from('user')
  .select('*')
  .ilike('email', email);
  if (error) {
    console.error('Supabase getUserByEmail Error:', error);
  }
  return dbUser;
}

export async function getUserNoFilter(userId: string) {
  const { data: dbUser, error } = await postgres
  .from('user')
  .select('*')
  .eq('user_id', userId);
  if (error) {
    console.error('Supabase getUserNoFilter Error:', error);
  }
  return dbUser;
}

export async function getAllUser() {
  const { data: dbUser, error } = await postgres
  .from('user')
  .select('*');
  if (error) {
    console.error('Supabase getAllUser Error:', error);
  }
  return dbUser;
}
