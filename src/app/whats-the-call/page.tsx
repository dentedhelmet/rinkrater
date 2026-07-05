'use client';

/**
 * What's the Call? — Referee Hand Signal Quiz
 * Route: /whats-the-call
 *
 * Uses the Rink Rater design system (globals.css) exclusively — no Tailwind.
 * Images live in /public/ref-signals/ named rr_ref_{id}.jpg
 */

import { useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './quiz.module.css';

// ─── Data ──────────────────────────────────────────────────────────────────────
const SIGNALS = [
  {
    id:   'bodychecking',
    name: 'Body Checking',
    desc: 'The palm of the non-whistle hand is brought across the body and placed upon the opposite shoulder.',
  },
  {
    id:   'buttending',
    name: 'Butt-Ending',
    desc: 'Moving the forearm, fist closed, under the forearm of the other hand held palm down.',
  },
  {
    id:   'charging',
    name: 'Charging',
    desc: 'Rotating clenched fists around one another in front of the chest.',
  },
  {
    id:   'checkingfrombehind',
    name: 'Checking from Behind',
    desc: 'Arm placed behind the back, elbow bent, forearm parallel to the ice surface.',
  },
  {
    id:   'crosschecking',
    name: 'Cross-Checking',
    desc: 'A forward motion with both fists clenched, extending from the chest.',
  },
  {
    id:   'delayedpenalty',
    name: 'Delayed Calling of Penalty',
    desc: 'The non-whistle hand is extended straight above the head.',
  },
  {
    id:   'delayofgame',
    name: 'Delaying the Game',
    desc: 'The non-whistle hand, palm open, is placed across the chest and then fully extended directly in front of the body.',
  },
  {
    id:   'elbowing',
    name: 'Elbowing',
    desc: 'Tapping the elbow with the opposite hand.',
  },
  {
    id:   'fighting',
    name: 'Fighting (Roughing)',
    desc: 'One punching motion to the side with the arm extending from the shoulder.',
  },
  {
    id:   'goalscored',
    name: 'Goal Scored',
    desc: 'A single point with the non-whistle hand, directly at the goal in which the puck legally entered, while simultaneously blowing the whistle.',
  },
  {
    id:   'handpass',
    name: 'Hand Pass',
    desc: 'The non-whistle hand (open hand) and arm are placed straight down alongside the body and swung forward and up once in an underhand motion.',
  },
  {
    id:   'headcontact',
    name: 'Head Contact',
    desc: 'The non-whistle hand placed palm-inward to the back of the helmet.',
  },
  {
    id:   'highsticking',
    name: 'High-Sticking',
    desc: 'Holding both fists, clenched, one immediately above the other, at the side of the head.',
  },
  {
    id:   'holding',
    name: 'Holding',
    desc: 'Clasping the wrist of the whistle hand well in front of the chest.',
  },
  {
    id:   'holdingfacemask',
    name: 'Holding the Face Mask',
    desc: 'Closed fist held in front of the face, palm in, and pulled down in one straight motion.',
  },
  {
    id:   'hooking',
    name: 'Hooking',
    desc: 'A tugging motion with both arms, as if pulling something toward the stomach.',
  },
  {
    id:   'icing',
    name: 'Icing',
    desc: 'Arms folded across the chest. Back linesperson raises non-whistle hand over head to signal possible icing to their partner.',
  },
  {
    id:   'interference',
    name: 'Interference',
    desc: 'Crossed arms stationary in front of chest with fists closed.',
  },
  {
    id:   'matchpenalty',
    name: 'Match Penalty',
    desc: 'Pat the flat of the hand on the top of the head.',
  },
  {
    id:   'misconduct',
    name: 'Misconduct',
    desc: 'Placing both hands on hips one time.',
  },
  {
    id:   'penaltyshot',
    name: 'Penalty Shot',
    desc: 'Arms crossed with fists clenched above the head.',
  },
  {
    id:   'slashing',
    name: 'Slashing',
    desc: 'One chop of the hand across the straightened forearm of the other hand.',
  },
  {
    id:   'timeout',
    name: 'Timeout / Unsportsmanlike Conduct',
    desc: 'Using both hands, form a "T".',
  },
  {
    id:   'tripping',
    name: 'Tripping',
    desc: 'Strike the side of the knee and follow through once, keeping the head up and both skates on the ice.',
  },
  // { id: 'kneeing', name: 'Kneeing', desc: 'A single tap of the right knee with the right hand, keeping both skates on the ice.' },
] as const;

type SignalId = (typeof SIGNALS)[number]['id'];

interface Question {
  id:      SignalId;
  name:    string;
  desc:    string;
  options: string[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuiz(): Question[] {
  return shuffle(SIGNALS).map((signal) => {
    const distractors = shuffle(SIGNALS.filter((s) => s.id !== signal.id))
      .slice(0, 3)
      .map((s) => s.name);
    return {
      id:      signal.id,
      name:    signal.name,
      desc:    signal.desc,
      options: shuffle([signal.name, ...distractors]),
    };
  });
}

const RATINGS = [
  { min: 24, label: 'NHL-Ready',             emoji: '🎖️', note: "Perfect score. You're hired." },
  { min: 21, label: 'Elite Official',        emoji: '🏆', note: 'Sharp eyes on the ice.' },
  { min: 17, label: 'Travel Ref',            emoji: '⚡', note: 'You know your signals.' },
  { min: 12, label: 'House League Linesman', emoji: '🏒', note: 'Solid knowledge of the basics.' },
  { min:  7, label: 'Pee-Wee Ref',           emoji: '🐣', note: 'Getting the hang of it.' },
  { min:  0, label: 'Fresh Ice',             emoji: '🧊', note: 'Just laced up the skates.' },
] as const;

function getRating(score: number) {
  return RATINGS.find((r) => score >= r.min) ?? RATINGS[RATINGS.length - 1];
}

// ─── Page ──────────────────────────────────────────────────────────────────────
type Phase = 'intro' | 'quiz' | 'results';

export default function WhatsTheCallPage() {
  const [phase,     setPhase]     = useState<Phase>('intro');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current,   setCurrent]   = useState(0);
  const [selected,  setSelected]  = useState<string | null>(null);
  const [score,     setScore]     = useState(0);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
  const [showExit,  setShowExit]  = useState(false);

  const startQuiz = useCallback(() => {
    setQuestions(buildQuiz());
    setCurrent(0);
    setScore(0);
    setSelected(null);
    setImgErrors(new Set());
    setPhase('quiz');
  }, []);

  const handleSelect = useCallback((opt: string) => {
    if (selected !== null || !questions[current]) return;
    setSelected(opt);
    if (opt === questions[current].name) setScore((s) => s + 1);
  }, [selected, questions, current]);

  const handleNext = useCallback(() => {
    if (current + 1 >= questions.length) {
      setPhase('results');
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
    }
  }, [current, questions.length]);

  const handleImgError = useCallback((id: string) => {
    setImgErrors((prev) => new Set([...prev, id]));
  }, []);

  const q          = questions[current];
  const isAnswered = selected !== null;
  const progress   = questions.length > 0 ? (current / questions.length) * 100 : 0;

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--rr-warm)' }}>

      {/* ── TopBar — persistent across all phases ── */}
      <header style={{
        position:       'sticky',
        top:            0,
        zIndex:         'var(--z-header)' as never,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '10px 16px',
        background:     'var(--rr-navy)',
        boxShadow:      '0 3px 0 rgba(0,0,0,0.35)',
        gap:            12,
      }}>
        {/* Logo — always links home */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Image
            src="/assets/rinkrater_clay_logo.png"
            alt="Rink Rater"
            width={62}
            height={44}
            style={{ objectFit: 'contain' }}
            priority
          />
        </Link>

        {/* Center label */}
        <span className="display-xs" style={{ color: 'rgba(255,255,255,0.55)', flex: 1, textAlign: 'center' }}>
          What&apos;s the Call?
        </span>

        {/* Right action — Exit (quiz) or Back (intro/results) */}
        {phase === 'quiz' ? (
          <button
            onClick={() => setShowExit(true)}
            style={{
              fontFamily:    'var(--font-display)',
              fontWeight:    800,
              fontSize:      12,
              color:         'rgba(255,255,255,0.65)',
              background:    'none',
              border:        '1.5px solid rgba(255,255,255,0.2)',
              borderRadius:  'var(--rr-radius-pill)',
              padding:       '5px 12px',
              cursor:        'pointer',
              flexShrink:    0,
            }}
          >
            Exit
          </button>
        ) : (
          <Link
            href="/"
            style={{
              fontFamily:  'var(--font-display)',
              fontWeight:  800,
              fontSize:    12,
              color:       'rgba(255,255,255,0.65)',
              textDecoration: 'none',
              border:      '1.5px solid rgba(255,255,255,0.2)',
              borderRadius: 'var(--rr-radius-pill)',
              padding:     '5px 12px',
              flexShrink:  0,
              whiteSpace:  'nowrap',
            }}
          >
            ← Home
          </Link>
        )}
      </header>

      {/* ── Exit confirmation overlay ── */}
      {showExit && (
        <div
          style={{
            position:       'fixed',
            inset:          0,
            background:     'rgba(13,42,74,0.75)',
            zIndex:         500,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            padding:        24,
          }}
          onClick={() => setShowExit(false)}
        >
          <div
            className="clay-card"
            style={{ background: 'var(--rr-warm)', padding: '24px 20px', textAlign: 'center', maxWidth: 300, width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 36, marginBottom: 10 }}>🏒</div>
            <p className="display-md" style={{ marginBottom: 6 }}>Quit the quiz?</p>
            <p className="body-sm" style={{ color: 'rgba(13,42,74,0.55)', marginBottom: 20, lineHeight: 1.6 }}>
              Sign in to save your progress to your Rink Rater profile — coming soon.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="clay-btn clay-btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setShowExit(false)}
              >
                Keep Playing
              </button>
              <Link
                href="/"
                className="clay-btn clay-btn-primary"
                style={{ flex: 1, textAlign: 'center' }}
              >
                Exit
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Screens ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {phase === 'intro' && <IntroScreen onStart={startQuiz} />}
        {phase === 'quiz' && q && (
          <QuizScreen
            question={q}
            current={current}
            total={questions.length}
            score={score}
            selected={selected}
            progress={progress}
            imgError={imgErrors.has(q.id)}
            onImgError={() => handleImgError(q.id)}
            onSelect={handleSelect}
            onNext={handleNext}
          />
        )}
        {phase === 'results' && (
          <ResultsScreen score={score} total={questions.length} onRetry={startQuiz} />
        )}
      </main>
    </div>
  );
}

// ─── Intro ─────────────────────────────────────────────────────────────────────
function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <section style={{
      flex:           1,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '40px 24px 56px',
      textAlign:      'center',
    }}>
      {/* Clay logo hero */}
      <Image
        src="/assets/rinkrater_clay_logo.png"
        alt="Rink Rater"
        width={200}
        height={140}
        style={{ objectFit: 'contain', marginBottom: 24 }}
        priority
      />

      <h1 className="display-xl" style={{ fontSize: 44, lineHeight: 1.05, marginBottom: 12 }}>
        What&apos;s the<br />Call?
      </h1>
      <p className="body-md" style={{ fontWeight: 700, marginBottom: 6, maxWidth: 280 }}>
        24 referee signals. Can you read the ice?
      </p>
      <p className="body-sm" style={{ color: 'rgba(13,42,74,0.55)', maxWidth: 260, marginBottom: 32, lineHeight: 1.6 }}>
        Watch the ref. Pick the penalty. Impress the parents next to you in the stands.
      </p>

      <button
        className={`clay-btn clay-btn-primary ${styles.btnClay}`}
        style={{ fontSize: 18, padding: '14px 44px' }}
        onClick={onStart}
      >
        Drop the Puck →
      </button>

      {/* Save progress hook — wires to Supabase Auth when ready */}
      <p className="body-xs" style={{ marginTop: 14, color: 'rgba(13,42,74,0.35)' }}>
        Sign in to save your score to your profile
      </p>

      {/* Stats strip */}
      <div style={{ marginTop: 36, display: 'flex', gap: 36 }}>
        {[{ val: '24', label: 'Signals' }, { val: '4', label: 'Choices' }, { val: '?', label: 'Your Score' }].map(({ val, label }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div className="display-xl">{val}</div>
            <div className="label" style={{ color: 'rgba(13,42,74,0.45)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Quiz ──────────────────────────────────────────────────────────────────────
interface QuizScreenProps {
  question:   Question;
  current:    number;
  total:      number;
  score:      number;
  selected:   string | null;
  progress:   number;
  imgError:   boolean;
  onImgError: () => void;
  onSelect:   (opt: string) => void;
  onNext:     () => void;
}

function QuizScreen({ question, current, total, score, selected, progress, imgError, onImgError, onSelect, onNext }: QuizScreenProps) {
  const isAnswered = selected !== null;
  const isCorrect  = selected === question.name;

  return (
    <section style={{ width: '100%', maxWidth: 520, margin: '0 auto', padding: '16px 14px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Progress + score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          className="score-track"
          style={{ flex: 1 }}
          role="progressbar"
          aria-valuenow={current + 1}
          aria-valuemin={1}
          aria-valuemax={total}
        >
          <div
            className={`score-fill ${styles.progressFill} ${progress > 60 ? 'score-fill--great' : progress > 30 ? 'score-fill--ok' : 'score-fill--poor'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span style={{
          fontFamily:   'var(--font-display)',
          fontWeight:   800,
          fontSize:     12,
          padding:      '4px 10px',
          borderRadius: 'var(--rr-radius-pill)',
          background:   'var(--rr-navy)',
          color:        'white',
          whiteSpace:   'nowrap',
        }}
          aria-live="polite"
        >
          ✓ {score}
        </span>
      </div>

      {/* Signal image card */}
      <div
        className="clay-card"
        style={{
          position:     'relative',
          width:        '100%',
          aspectRatio:  '4 / 3',
          borderRadius: 'var(--rr-radius)',
          overflow:     'hidden',
          background:   'var(--rr-navy)',
        }}
      >
        {!imgError ? (
          <Image
            key={question.id}
            src={`/ref-signals/rr_ref_${question.id}.jpg`}
            alt="Referee performing a hand signal — identify the call"
            fill
            style={{ objectFit: 'contain' }}
            onError={onImgError}
            priority
          />
        ) : (
          <div style={{
            position:       'absolute',
            inset:          0,
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            12,
            padding:        32,
          }}>
            <span style={{ fontSize: 48 }}>🏒</span>
            <p className="body-sm" style={{ color: 'rgba(238,244,251,0.45)', textAlign: 'center' }}>
              Image coming soon
            </p>
          </div>
        )}

        {/* Badge */}
        <div style={{
          position:     'absolute',
          top:          10,
          left:         10,
          fontFamily:   'var(--font-display)',
          fontWeight:   800,
          fontSize:     10,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          padding:      '4px 10px',
          borderRadius: 'var(--rr-radius-pill)',
          background:   'var(--rr-red)',
          color:        'white',
        }}>
          What&apos;s the Call?
        </div>

        {/* Feedback tint */}
        {isAnswered && (
          <div
            className={styles.feedbackOverlay}
            style={{
              position:        'absolute',
              inset:           0,
              backgroundColor: isCorrect ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
              pointerEvents:   'none',
            }}
          />
        )}
      </div>

      {/* Answer grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {question.options.map((opt) => {
          const isThisCorrect  = opt === question.name;
          const isThisSelected = opt === selected;

          type State = 'default' | 'correct' | 'wrong' | 'dim';
          const state: State = !isAnswered ? 'default'
            : isThisCorrect  ? 'correct'
            : isThisSelected ? 'wrong'
            : 'dim';

          const bg: Record<State, string> = {
            default: 'var(--rr-warm)',
            correct: '#22C55E',
            wrong:   '#EF4444',
            dim:     'rgba(13,42,74,0.04)',
          };
          const border: Record<State, string> = {
            default: 'var(--rr-outline)',
            correct: '2.5px solid #16A34A',
            wrong:   '2.5px solid #DC2626',
            dim:     '2.5px solid rgba(13,42,74,0.15)',
          };
          const shadow: Record<State, string> = {
            default: 'var(--rr-shadow-sm)',
            correct: '2px 2px 0 #15803D',
            wrong:   '2px 2px 0 #B91C1C',
            dim:     '2px 2px 0 rgba(13,42,74,0.1)',
          };
          const color: Record<State, string> = {
            default: 'var(--rr-navy)',
            correct: 'white',
            wrong:   'white',
            dim:     'rgba(13,42,74,0.35)',
          };

          const animClass = !isAnswered ? ''
            : isThisCorrect  ? styles.correctPop
            : isThisSelected ? styles.wrongShake
            : '';

          return (
            <button
              key={opt}
              disabled={isAnswered}
              onClick={() => onSelect(opt)}
              className={`${styles.btnAnswer} ${animClass}`}
              style={{
                fontFamily:    'var(--font-display)',
                fontWeight:    800,
                fontSize:      13,
                lineHeight:    1.35,
                textAlign:     'left',
                padding:       '14px 14px',
                borderRadius:  'var(--rr-radius)',
                background:    bg[state],
                border:        border[state],
                boxShadow:     shadow[state],
                color:         color[state],
                cursor:        isAnswered ? 'default' : 'pointer',
                '--answer-shadow': shadow[state],
              } as React.CSSProperties}
              aria-label={
                !isAnswered ? opt
                  : isThisCorrect  ? `${opt} — correct`
                  : isThisSelected ? `${opt} — wrong`
                  : opt
              }
            >
              {isAnswered && isThisCorrect  && <span aria-hidden="true">✓ </span>}
              {isAnswered && isThisSelected && !isThisCorrect && <span aria-hidden="true">✗ </span>}
              {opt}
            </button>
          );
        })}
      </div>

      {/* Description reveal */}
      {isAnswered && (
        <div
          className={styles.feedbackOverlay}
          style={{
            background:   'var(--rr-navy)',
            border:       '2.5px solid rgba(255,255,255,0.1)',
            borderRadius: 'var(--rr-radius)',
            boxShadow:    '3px 3px 0 rgba(0,0,0,0.25)',
            padding:      '14px 16px',
          }}
          aria-live="polite"
        >
          <p className="label" style={{
            color:        isCorrect ? '#4ADE80' : '#FCA5A5',
            marginBottom: 6,
          }}>
            {isCorrect ? `✓ Correct — ${question.name}` : `✗ The call was: ${question.name}`}
          </p>
          <p className="body-sm" style={{ color: 'rgba(238,244,251,0.8)', lineHeight: 1.6 }}>
            {question.desc}
          </p>
        </div>
      )}

      {/* Next button */}
      {isAnswered && (
        <button
          onClick={onNext}
          autoFocus
          className={`clay-btn clay-btn-navy ${styles.btnClay}`}
          style={{ width: '100%', fontSize: 18, padding: '14px' }}
        >
          {current + 1 >= total ? 'See My Score →' : 'Next Signal →'}
        </button>
      )}

      {/* ── Thank a Ref! ── */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <ThankARefBanner />
      </div>
    </section>
  );
}

// ─── Results ───────────────────────────────────────────────────────────────────
function ResultsScreen({ score, total, onRetry }: { score: number; total: number; onRetry: () => void }) {
  const rating  = getRating(score);
  const pct     = Math.round((score / total) * 100);
  const fillClass = pct >= 80 ? 'score-fill--great' : pct >= 56 ? 'score-fill--ok' : 'score-fill--poor';

  return (
    <section style={{
      flex:           1,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '56px 24px',
      textAlign:      'center',
    }}>
      {/* Emoji badge */}
      <div style={{
        width:          96,
        height:         96,
        borderRadius:   20,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        fontSize:       48,
        marginBottom:   20,
        background:     'var(--rr-navy)',
        border:         'var(--rr-outline)',
        boxShadow:      'var(--rr-shadow-lg)',
      }}>
        {rating.emoji}
      </div>

      {/* Score */}
      <div style={{ marginBottom: 8 }}>
        <span className="display-xl" style={{ fontSize: 72, lineHeight: 1 }}>{score}</span>
        <span className="display-lg" style={{ color: 'rgba(13,42,74,0.4)' }}>/{total}</span>
      </div>

      {/* Rating chip */}
      <div className="clay-btn clay-btn-primary" style={{ marginBottom: 10, cursor: 'default', fontSize: 15 }}>
        {rating.label}
      </div>

      <p className="body-md" style={{ color: 'rgba(13,42,74,0.6)', marginBottom: 32, maxWidth: 260 }}>
        {rating.note}
      </p>

      {/* Accuracy bar */}
      <div className="clay-card" style={{ width: '100%', maxWidth: 300, padding: '16px 18px', marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="display-xs">Accuracy</span>
          <span className="display-xs">{pct}%</span>
        </div>
        <div className="score-track">
          <div className={`score-fill ${styles.accuracyFill} ${fillClass}`} style={{ width: `${pct}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span className="caption">0</span>
          <span className="caption">{total}</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 300 }}>
        <button
          onClick={onRetry}
          className={`clay-btn clay-btn-primary ${styles.btnClay}`}
          style={{ width: '100%', fontSize: 18, padding: '14px' }}
        >
          Play Again
        </button>

        {/* Save to Profile — wires to Supabase Auth when ready */}
        <button
          disabled
          className="clay-btn"
          style={{
            width:      '100%',
            fontSize:   15,
            padding:    '13px',
            opacity:    0.45,
            cursor:     'not-allowed',
            background: 'var(--rr-ice)',
            color:      'var(--rr-navy)',
          }}
          title="Coming soon — sign in to save your score"
        >
          💾 Save to Profile
        </button>

        <Link
          href="/"
          className="clay-btn clay-btn-secondary"
          style={{ width: '100%', fontSize: 16, padding: '14px', textAlign: 'center' }}
        >
          ← Back to Rink Rater
        </Link>
      </div>

      {/* ── Thank a Ref! banner ── */}
      <ThankARefBanner />
    </section>
  );
}

// ─── Shared Thank a Ref banner ─────────────────────────────────────────────────
function ThankARefBanner() {
  return (
    <div style={{
      width:        '100%',
      maxWidth:     340,
      marginTop:    40,
      borderRadius: 'var(--rr-radius)',
      overflow:     'hidden',
      border:       'var(--rr-outline)',
      boxShadow:    'var(--rr-shadow-lg)',
    }}>
      {/* Red top stripe */}
      <div style={{
        background:     'var(--rr-red)',
        padding:        '6px 16px',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            8,
      }}>
        <span style={{ fontSize: 14, letterSpacing: 1 }}>🏒</span>
        <span className="label" style={{ color: 'white', letterSpacing: '1.5px' }}>
          From All of Us in the Stands
        </span>
        <span style={{ fontSize: 14, letterSpacing: 1 }}>🏒</span>
      </div>

      {/* Main body */}
      <div style={{
        background:  'var(--rr-navy)',
        padding:     '22px 20px 24px',
        textAlign:   'center',
      }}>
        <p className="display-xl" style={{
          color:        'white',
          fontSize:     38,
          lineHeight:   1,
          marginBottom: 10,
          letterSpacing: '-0.5px',
        }}>
          THANK<br />A REF!
        </p>
        <p className="body-sm" style={{
          color:      'rgba(214,239,250,0.8)',
          lineHeight: 1.65,
          maxWidth:   240,
          margin:     '0 auto 18px',
        }}>
          Without officials, there&apos;s no game.
          Next time you see one on the ice,
          give them a nod.
        </p>
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            10,
          marginBottom:   18,
        }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: 18 }}>📣</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' }} />
        </div>
        <p className="display-xs" style={{ color: 'rgba(214,239,250,0.5)', letterSpacing: '1px' }}>
          RINKRATER.COM
        </p>
      </div>
    </div>
  )
}
