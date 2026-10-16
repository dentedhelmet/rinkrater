'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useAdminRole, type AdminRole } from '@/lib/useAdminRole'
import { ROLE_LABELS } from './adminSections'

interface AdminShellProps {
  title:        string
  subtitle?:    string
  /** Roles allowed on this page. Omit to allow any admin. */
  allow?:       AdminRole[]
  /** Show a "← Dashboard" link (every page except the hub itself). */
  showBack?:    boolean
  actions?:     ReactNode
  children:     (role: AdminRole) => ReactNode
}

/**
 * Wraps every admin page: role gate, page header, consistent layout.
 * The database functions enforce access on their own; this gate just keeps
 * non-admins from seeing an empty admin screen.
 */
export function AdminShell({ title, subtitle, allow, showBack = true, actions, children }: AdminShellProps) {
  const { role, loading } = useAdminRole()
  const reduceMotion = useReducedMotion()

  if (loading) {
    return (
      <div className="admin-state" role="status" aria-live="polite">
        <motion.span
          className="admin-puck"
          aria-hidden="true"
          animate={reduceMotion ? undefined : { x: [-40, 40, -40] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <p>Lacing up…</p>
        <style jsx>{stateStyles}</style>
      </div>
    )
  }

  if (!role || (allow && !allow.includes(role))) {
    return (
      <div className="admin-state">
        <h1>Not authorized</h1>
        <p>This page is only available to Rink Rater admins.</p>
        <Link href="/profile" className="clay-btn clay-btn-secondary admin-state-btn">
          Back to profile
        </Link>
        <style jsx>{stateStyles}</style>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <motion.header
        className="admin-header"
        initial={reduceMotion ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {showBack && (
          <Link href="/admin" className="admin-back">
            ← Dashboard
          </Link>
        )}
        <div className="admin-title-row">
          <div>
            <h1>{title}</h1>
            {subtitle && <p className="admin-subtitle">{subtitle}</p>}
          </div>
          <div className="admin-title-actions">
            <span className="admin-role-chip">{ROLE_LABELS[role]}</span>
            {actions}
          </div>
        </div>
      </motion.header>

      {children(role)}

      <style jsx>{`
        .admin-page {
          max-width: 880px;
          margin: 0 auto;
          padding: 24px 16px 96px;
        }
        .admin-header {
          margin-bottom: 20px;
        }
        .admin-header :global(.admin-back) {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          font-weight: 800;
          color: var(--rr-navy);
          text-decoration: none;
        }
        .admin-header :global(.admin-back:focus-visible) {
          outline: 3px solid var(--rr-yellow);
          outline-offset: 2px;
          border-radius: 6px;
        }
        .admin-title-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
        }
        h1 {
          font-family: var(--font-display, 'Nunito', sans-serif);
          font-weight: 900;
          color: var(--rr-navy);
          margin: 0 0 4px;
          font-size: 1.75rem;
        }
        .admin-subtitle {
          margin: 0;
          color: rgba(13, 42, 74, 0.78);
        }
        .admin-title-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .admin-role-chip {
          font-weight: 800;
          font-size: 0.8rem;
          padding: 5px 12px;
          border-radius: 999px;
          background: var(--rr-navy);
          color: #fff;
          white-space: nowrap;
        }
      `}</style>
    </div>
  )
}

const stateStyles = `
  .admin-state {
    padding: 64px 24px;
    text-align: center;
    color: var(--rr-navy);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .admin-state h1 {
    font-weight: 900;
    margin: 0;
  }
  .admin-state p {
    margin: 0;
    color: rgba(13, 42, 74, 0.8);
  }
  .admin-puck {
    display: block;
    width: 28px;
    height: 12px;
    border-radius: 50%;
    background: var(--rr-navy);
    box-shadow: 0 3px 0 rgba(13, 42, 74, 0.35);
  }
  .admin-state :global(.admin-state-btn) {
    margin-top: 8px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    text-decoration: none;
  }
`
