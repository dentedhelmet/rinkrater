// patch-fetchprofile-logging.js
//
// One-off script: replaces the silent error-swallowing in AuthContext's
// fetchProfile() with a version that logs the actual Supabase error.
//
// Run from your project root:
//   node patch-fetchprofile-logging.js

const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, 'src', 'context', 'AuthContext.tsx')

if (!fs.existsSync(filePath)) {
  console.error('❌ Could not find file at:', filePath)
  console.error('   Run this script from your project root (same folder as package.json).')
  process.exit(1)
}

let content = fs.readFileSync(filePath, 'utf8')
const original = content

const oldBlock = `  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (!error && data) setProfile(data as Profile)
  }, [])`

const newBlock = `  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) {
      console.error('fetchProfile failed:', error)
      return
    }
    if (data) setProfile(data as Profile)
  }, [])`

if (content.includes(newBlock)) {
  console.log('✓ Already applied — fetchProfile already logs errors. Nothing to do.')
  process.exit(0)
}

if (!content.includes(oldBlock)) {
  console.error('❌ FAILED: could not find the expected fetchProfile block.')
  console.error('   Your file may have drifted from what I expected — paste the current')
  console.error('   fetchProfile function back to me and I\'ll give you the exact edit by hand.')
  process.exit(1)
}

content = content.replace(oldBlock, newBlock)

fs.writeFileSync(filePath, content, 'utf8')
console.log('✅ Done. Saved changes to:', filePath)
console.log('   Run: git diff src/context/AuthContext.tsx   to confirm before committing.')
