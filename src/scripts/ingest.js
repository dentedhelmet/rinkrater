import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { readFileSync, existsSync } from 'fs'
import { setTimeout } from 'timers/promises'
import { parse as parseCsv } from 'csv-parse/sync'

function loadEnvLocal() {
  const path = '.env.local'
  if (!existsSync(path)) {
    console.error('ERROR: .env.local not found in current directory.')
    console.error('Run this script from your project root: node src/scripts/ingest.js ...')
    process.exit(1)
  }
  const content = readFileSync(path, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (key && !process.env[key]) process.env[key] = value
  }
}
loadEnvLocal()

const SUPABASE_URL     = process.env.SUPABASE_URL
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_KEY
const OPENAI_API_KEY   = process.env.OPENAI_API_KEY
const FIREBASE_EXPORT  = process.env.FIREBASE_JSON || './data/firebase-export.json'
const FTLOH_CSV        = process.env.FTLOH_CSV     || './data/ftloh-data.csv'

const EMBED_MODEL      = 'text-embedding-3-small'
const BATCH_SIZE       = 100
const RATE_LIMIT_DELAY = 200

const missing = []
if (!SUPABASE_URL) missing.push('SUPABASE_URL')
if (!SUPABASE_KEY) missing.push('SUPABASE_SERVICE_KEY')
if (!OPENAI_API_KEY) missing.push('OPENAI_API_KEY')
if (missing.length) {
  console.error(`ERROR: Missing required values in .env.local: ${missing.join(', ')}`)
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const openai   = new OpenAI({ apiKey: OPENAI_API_KEY })

function buildEmbedText(rinkName, city, state, category, comment) {
  return `Rink: ${rinkName}, ${city} ${state}. Category: ${category}. Review: ${comment}`
}

async function embedBatch(texts) {
  const response = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: texts,
  })
  return response.data.map(d => d.embedding)
}

async function ingestRinks(firebaseData) {
  const rinks = firebaseData.rinks || {}
  const rows = []

  for (const [id, rink] of Object.entries(rinks)) {
    rows.push({
      id,
      name:    rink.name,
      altname: rink.altname || null,
      city:    rink.city,
      state:   rink.state,
      zip:     rink.zip ? String(rink.zip) : null,
      address: rink.address || null,
      phone:   rink.phone ? String(rink.phone) : null,
      website: rink.website && !['NULL','null',''].includes(rink.website)
                 ? rink.website : null,
    lat:     (rink.lat && rink.lat !== 'NULL') ? Number(rink.lat) : null,
    long:    (rink.long && rink.long !== 'NULL') ? Number(rink.long) : null,
      active:  rink.active === 1 || rink.active === true,
    })
  }

  let inserted = 0
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error } = await supabase
      .from('rinks')
      .upsert(chunk, { onConflict: 'id' })
    if (error) throw new Error(`Rink upsert failed: ${error.message}`)
    inserted += chunk.length
    console.log(`  Rinks: ${inserted}/${rows.length}`)
  }
  console.log(`✓ Upserted ${rows.length} rinks`)
}

async function ingestRinkRaterReviews(firebaseData) {
  const reviews  = firebaseData.reviews || {}
  const rinks    = firebaseData.rinks   || {}

  const rinkLookup = {}
  for (const [id, rink] of Object.entries(rinks)) {
    rinkLookup[id] = { name: rink.name, city: rink.city, state: rink.state }
  }

  const toProcess = []
  for (const [id, review] of Object.entries(reviews)) {
    const rink = rinkLookup[review.rinkId]
    if (!rink || !review.comment?.trim()) continue

    const embedText = buildEmbedText(
      rink.name, rink.city, rink.state,
      review.category, review.comment.trim()
    )

    toProcess.push({
      row: {
        id,
        rink_id:     review.rinkId,
        source:      'rinkrater',
        category:    review.category,
        comment:     review.comment.trim(),
        user_id:     review.created_by || review.userId || null,
        review_date: review.created_at
                       ? new Date(review.created_at).toISOString()
                       : null,
        rink_name:   rink.name,
        rink_city:   rink.city,
        rink_state:  rink.state,
      },
      embedText,
    })
  }

  console.log(`Processing ${toProcess.length} Rink Rater reviews...`)
  await embedAndUpsert(toProcess, 'rinkrater')
}

async function ingestFTLOH() {
  if (!existsSync(FTLOH_CSV)) {
    console.error(`ERROR: FTLOH CSV not found at ${FTLOH_CSV}`)
    process.exit(1)
  }

  const raw = readFileSync(FTLOH_CSV, 'utf8')
  const records = parseCsv(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })

  console.log(`Found ${records.length} rows in FTLOH CSV`)

  const HEADER_MAP = {
    'rink name (and address, if known)': 'rink_name',
    'city & state':                       'city_state',
    'ice condition:':                     'ice_conditions',
    'rink temperatures:':                 'rink_temperature',
    'number of sheets of ice:':           'sheets_of_ice',
    'skate sharpening available/cost:':   'skate_sharpening',
    'bathroom cleanliness:':              'bathroom_conditions',
    'rink rat amenities:':                'rink_rat_activities',
    'food (at rink, or nearby, include link to snack bar menu if avaialble):': 'food_at_rink',
    'livebarn:':                          'livebarn',
    'wi-fi available?':                   'wifi',
    'adequate parking options?':          'parking',
    'drinks (coffee, bars, etc):':        'drinks',
    'seating/bleacher situation:':        'seating',
    "girls' locker room?":                'girls_locker_room',
    'any other items of note?':           'other_notes',
    'anything obstructing view of the rink (netting, scratched glass, etc)?': 'view_obstructions',
  }

  function normalizeRow(rawRow) {
    const normalized = {}
    for (const [rawKey, val] of Object.entries(rawRow)) {
      const cleanKey = rawKey.trim().toLowerCase()
      const mappedKey = HEADER_MAP[cleanKey] || cleanKey.replace(/[^a-z0-9]+/g, '_')
      normalized[mappedKey] = val
    }
    return normalized
  }

  const FTLOH_CATEGORY_MAP = {
    ice_conditions:       'ICE CONDITIONS',
    rink_temperature:     'RINK TEMPERATURE',
    skate_sharpening:     'SKATE SHARPENING',
    bathroom_conditions:  'RESTROOMS',
    rink_rat_activities:  'RINK RAT ACTIVITIES',
    food_at_rink:         'CONCESSIONS',
    livebarn:             'LIVE STREAMING',
    wifi:                 'WI-FI',
    parking:              'PARKING',
    drinks:               'DRINKS',
    seating:              'SEATING AREA / WARMING AREA',
    girls_locker_room:    'GIRLS LOCKER ROOM',
    view_obstructions:    'VIEW OBSTRUCTIONS',
    other_notes:          'FIRST IMPRESSIONS',
  }

  const toProcess = []
  let resolved = 0
  let skipped = 0

  for (const raw of records) {
    const row = normalizeRow(raw)
    if (!row.rink_name?.trim()) { skipped++; continue }

    const rinkId = await resolveRinkId(row.rink_name, row.city_state)
    if (!rinkId) { skipped++; continue }
    resolved++

    await supabase.from('ftloh_entries').upsert({
      rink_id:              rinkId,
      rink_name_raw:        row.rink_name,
      ice_conditions:       row.ice_conditions       || null,
      rink_temperature:     row.rink_temperature     || null,
      sheets_of_ice:        row.sheets_of_ice ? parseInt(row.sheets_of_ice) : null,
      skate_sharpening:     row.skate_sharpening     || null,
      bathroom_conditions:  row.bathroom_conditions  || null,
      rink_rat_activities:  row.rink_rat_activities  || null,
      food_at_rink:         row.food_at_rink         || null,
      livebarn:             row.livebarn             || null,
      wifi:                 row.wifi                 || null,
      parking:              row.parking              || null,
      drinks:               row.drinks               || null,
      seating:              row.seating              || null,
      girls_locker_room:    row.girls_locker_room    || null,
      view_obstructions:    row.view_obstructions    || null,
      other_notes:          row.other_notes          || null,
      contributor_count:    1,
    }, { onConflict: 'rink_id' })

    for (const [field, category] of Object.entries(FTLOH_CATEGORY_MAP)) {
      const text = row[field]?.trim()
      if (!text || text.toLowerCase() === 'no' || text === '-') continue

      const embedText = buildEmbedText(row.rink_name, row.city_state || '', '', category, text)

      toProcess.push({
        row: {
          id:          `ftloh_${rinkId}_${field}_${Math.random().toString(36).slice(2,8)}`,
          rink_id:     rinkId,
          source:      'ftloh',
          category,
          comment:     text,
          user_id:     'ftloh_contributor',
          review_date: new Date().toISOString(),
          rink_name:   row.rink_name,
          rink_city:   row.city_state || '',
          rink_state:  '',
        },
        embedText,
      })
    }
  }

  console.log(`Resolved ${resolved} rinks, skipped ${skipped} rows`)
  console.log(`Processing ${toProcess.length} FTLOH review records...`)
  await embedAndUpsert(toProcess, 'ftloh')
}

async function resolveRinkId(rinkName, cityState) {
  const { data, error } = await supabase
    .rpc('search_rinks_fuzzy', {
      name_query: rinkName,
      state_filter: null,
      limit_count: 1,
    })

  if (error) {
    console.warn(`  Fuzzy search error for "${rinkName}": ${error.message}`)
  }

  if (data?.[0] && data[0].similarity > 0.3) return data[0].id

  const stubId = `ftloh_${Date.now()}_${Math.random().toString(36).slice(2,7)}`
  const parts = (cityState || '').split(',').map(s => s.trim())
  const city  = parts[0] || null
  const state = parts[1] || null

  const { error: insertErr } = await supabase.from('rinks').insert({
    id: stubId, name: rinkName, city, state, active: true,
  })

  if (insertErr) {
    console.warn(`  Could not create stub rink for "${rinkName}": ${insertErr.message}`)
    return null
  }

  return stubId
}

async function embedAndUpsert(toProcess, sourceLabel) {
  let done = 0

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE)
    const texts = batch.map(b => b.embedText)

    let embeddings
    try {
      embeddings = await embedBatch(texts)
    } catch (err) {
      console.error(`  Embedding batch failed at index ${i}:`, err.message)
      await setTimeout(2000)
      embeddings = await embedBatch(texts)
    }

    const rows = batch.map((b, idx) => ({
      ...b.row,
      embedding: embeddings[idx],
    }))

    const { error } = await supabase
      .from('reviews')
      .upsert(rows, { onConflict: 'id' })

    if (error) throw new Error(`Review upsert failed: ${error.message}`)

    done += batch.length
    process.stdout.write(`\r  [${sourceLabel}] ${done}/${toProcess.length} embedded & saved`)

    await setTimeout(RATE_LIMIT_DELAY)
  }

  console.log(`\n✓ [${sourceLabel}] ${done} reviews ingested`)
}

async function main() {
  const args = process.argv.slice(2)
  const sourceIdx = args.indexOf('--source')
  const source = sourceIdx !== -1 ? args[sourceIdx + 1] : null
  const rinksOnly = args.includes('--rinks-only')

  if (rinksOnly) {
    console.log('Loading Firebase export...')
    const firebaseData = JSON.parse(readFileSync(FIREBASE_EXPORT, 'utf8'))
    console.log(`  ${Object.keys(firebaseData.rinks||{}).length} rinks, ${Object.keys(firebaseData.reviews||{}).length} reviews found in file`)
    console.log('\nIngesting rink records...')
    await ingestRinks(firebaseData)
  } else if (source === 'rinkrater') {
    console.log('Loading Firebase export...')
    const firebaseData = JSON.parse(readFileSync(FIREBASE_EXPORT, 'utf8'))
    console.log('\nIngesting Rink Rater reviews...')
    await ingestRinkRaterReviews(firebaseData)
  } else if (source === 'ftloh') {
    console.log('\nIngesting FTLOH reviews from CSV...')
    await ingestFTLOH()
  } else {
    console.log('Usage:')
    console.log('  node src/scripts/ingest.js --rinks-only')
    console.log('  node src/scripts/ingest.js --source rinkrater')
    console.log('  node src/scripts/ingest.js --source ftloh')
    process.exit(1)
  }

  console.log('\nDone!')
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
