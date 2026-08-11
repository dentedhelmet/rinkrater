export const maxDuration = 15

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

// ASSUMPTION TO VERIFY: env var name. If your Resend key is stored under a
// different name, update this line to match.
const resend = new Resend(process.env.RESEND_API_KEY)

// ASSUMPTION TO VERIFY: this needs to be a verified sending address/domain
// in your Resend account, or delivery will fail even though this code runs
// without error. Check Resend's dashboard under Domains before relying on
// this in production.
const TO_ADDRESS   = 'info@rinkrater.com'
const FROM_ADDRESS = 'Rink Rater <noreply@rinkrater.com>'

export async function POST(req: NextRequest) {
  try {
    const { topic, name, email, phone, subject, message, website } = await req.json()

    // Honeypot check — a real visitor never sees or fills this field.
    // Silently report success so a bot doesn't learn its submission was caught.
    if (website) {
      return NextResponse.json({ success: true })
    }

    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const { error } = await resend.emails.send({
      from:    FROM_ADDRESS,
      to:      TO_ADDRESS,
      replyTo: email,
      subject: `[${topic || 'General Inquiry'}] ${subject}`,
      text: [
        `Topic: ${topic || 'General Inquiry'}`,
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone || '(not provided)'}`,
        '',
        'Message:',
        message,
      ].join('\n'),
    })

    if (error) {
      console.error('Contact form send error:', error)
      return NextResponse.json({ error: 'Could not send your message — please try again.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contact form submission error:', err)
    return NextResponse.json({ error: 'Failed to process message.' }, { status: 500 })
  }
}
