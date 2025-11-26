/**
 * Supabase 客户端配置
 * 使用环境变量配置 Supabase 连接
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// 检查配置是否存在
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// 创建 Supabase 客户端（仅在配置存在时创建）
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!isSupabaseConfigured) {
  console.warn('⚠️ Supabase credentials not found. Using mock data.');
  console.warn('To enable real backend, create .env.local with:');
  console.warn('VITE_SUPABASE_URL=your_project_url');
  console.warn('VITE_SUPABASE_ANON_KEY=your_anon_key');
}

// 测试连接
export async function testSupabaseConnection(): Promise<boolean> {
  if (!isSupabaseConfigured) {
    return false;
  }

  if (!supabase) return false;
  
  try {
    const { error } = await supabase.from('users').select('count').limit(1);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Supabase connection failed:', error);
    return false;
  }
}

