'use client'

import { useState, useEffect } from 'react'

interface RotatingQuestionsProps {
  questions: string[]
}

export function RotatingQuestions(props: RotatingQuestionsProps) {
  const questions = props.questions || []
  const [index, setIndex] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(function() {
    if (questions.length <= 1) return

    const interval = setInterval(function() {
      setFading(true)
      setTimeout(function() {
        setIndex(function(prev) { return (prev + 1) % questions.length })
        setFading(false)
      }, 300)
    }, 3000)

    return function() { clearInterval(interval) }
  }, [questions.length])

  if (questions.length === 0) {
    return null
  }

  return (
    <div className="rotating-question-box">
      <span style={{ color: 'var(--rr-red)', flexShrink: 0 }}>{'\u2022'}</span>
      <span className={'rotating-question-text' + (fading ? ' rotating-question-text--fading' : '')}>
        {questions[index]}
      </span>

      <style jsx>{`
        .rotating-question-box {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--rr-navy);
          min-height: 20px;
        }
        .rotating-question-text {
          opacity: 1;
          transition: opacity 0.3s ease;
        }
        .rotating-question-text--fading {
          opacity: 0;
        }
      `}</style>
    </div>
  )
}
