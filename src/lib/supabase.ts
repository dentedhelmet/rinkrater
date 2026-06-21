import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })