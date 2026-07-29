import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { rating, experience, wishlist } = await request.json()

    const html = `
      <h2>New Rink Rater Feedback</h2>
      <p><strong>Overall Rating:</strong> ${rating > 0 ? rating + '/5' : 'Not rated'}</p>
      <p><strong>What can we do to improve your experience?</strong><br/>${(experience || '(no response)').replace(/\n/g, '<br/>')}</p>
      <p><strong>What features would you most like to see added?</strong><br/>${(wishlist || '(no response)').replace(/\n/g, '<br/>')}</p>
    `

    const { error } = await resend.emails.send({
      from: 'Rink Rater Feedback <feedback@rinkrater.com>',
      to: 'feedback@rinkrater.com',
      subject: 'New Rink Rater Feedback',
      html,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ success: false }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Feedback route error:', err)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}