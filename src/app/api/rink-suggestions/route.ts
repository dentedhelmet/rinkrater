import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const maxDuration = 30;

const resend = new Resend(process.env.RESEND_API_KEY);

// Server-side Supabase client using the service role so we can read
// the caller's session server-side and insert on their behalf under RLS.
function getSupabaseForRequest(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: req.headers.get('authorization') || '',
        },
      },
    }
  );
  return supabase;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { suggestion_type, rink_id, payload, website } = body;

    // Honeypot: real users never fill this hidden field.
    if (website) {
      // Pretend success so bots don't learn to leave it blank.
      return NextResponse.json({ ok: true });
    }

    if (!suggestion_type || !['new_rink', 'edit'].includes(suggestion_type)) {
      return NextResponse.json({ error: 'Invalid suggestion type.' }, { status: 400 });
    }

    if (suggestion_type === 'edit' && !rink_id) {
      return NextResponse.json({ error: 'Missing rink_id for edit suggestion.' }, { status: 400 });
    }

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Missing suggestion details.' }, { status: 400 });
    }

    const supabase = getSupabaseForRequest(req);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Please sign in to submit a suggestion.' }, { status: 401 });
    }

    // Soft cap: block new submissions if the user already has 5+ pending.
    const { count, error: countError } = await supabase
      .from('rink_suggestions')
      .select('id', { count: 'exact', head: true })
      .eq('submitted_by', user.id)
      .eq('status', 'pending');

    if (countError) {
      console.error('rink_suggestions count error:', countError);
    } else if ((count ?? 0) >= 5) {
      return NextResponse.json(
        { error: 'You have 5 suggestions awaiting review already. Please wait for those to be processed.' },
        { status: 429 }
      );
    }

    const { data: inserted, error: insertError } = await supabase
      .from('rink_suggestions')
      .insert({
        suggestion_type,
        rink_id: rink_id || null,
        submitted_by: user.id,
        payload,
      })
      .select()
      .single();

    if (insertError) {
      console.error('rink_suggestions insert error:', insertError);
      return NextResponse.json({ error: 'Could not save your suggestion. Please try again.' }, { status: 500 });
    }

    // Notify Senan — best-effort, never block the response on email delivery
    try {
      const summary =
        suggestion_type === 'new_rink'
          ? `New rink suggestion: ${payload.name} (${payload.city}, ${payload.state})`
          : `Edit suggestion for rink ${rink_id}: ${Object.keys(payload).join(', ')}`;

      await resend.emails.send({
        from: 'Rink Rater <notifications@rinkrater.com>',
        to: 'senan@rinkrater.com',
        subject: `New rink suggestion pending review`,
        text: `${summary}\n\nSubmitted by user ${user.id}.\n\nReview it in the admin dashboard.`,
      });
    } catch (emailError) {
      console.error('rink suggestion notification email failed:', emailError);
    }

    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (err) {
    console.error('rink_suggestions POST error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

// GET: returns the signed-in user's own suggestions, for a
// "My Suggestions" list (e.g. on the profile page).
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseForRequest(req);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('rink_suggestions')
      .select('id, suggestion_type, rink_id, payload, status, admin_notes, created_at, reviewed_at')
      .eq('submitted_by', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('rink_suggestions GET error:', error);
      return NextResponse.json({ error: 'Could not load your suggestions.' }, { status: 500 });
    }

    return NextResponse.json({ suggestions: data });
  } catch (err) {
    console.error('rink_suggestions GET error:', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
