'use client'
// ============================================================
//  JEFF'S DESIGN SYSTEM — components.jsx
//  Composants React prêts à l'emploi
//  Requiert : tokens.css + components.css (ou Tailwind)
// ============================================================

import React, { useState, useRef, useEffect } from 'react'

// ── BUTTON ──────────────────────────────────────────────────
export function Button({
  children,
  variant = 'primary',    // primary | secondary | ghost | danger | link
  size = 'md',            // sm | md | lg | xl | icon
  loading = false,
  disabled = false,
  leftIcon = null,
  rightIcon = null,
  className = '',
  onClick,
  type = 'button',
  ...props
}) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size !== 'md' && `btn-${size}`,
    loading && 'btn-loading',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      onClick={onClick}
      type={type}
      {...props}
    >
      {leftIcon && <span className="btn-icon-left" aria-hidden>{leftIcon}</span>}
      {children}
      {rightIcon && <span className="btn-icon-right" aria-hidden>{rightIcon}</span>}
    </button>
  )
}

// ── BADGE ────────────────────────────────────────────────────
export function Badge({ children, variant = 'default', dot = false, className = '' }) {
  return (
    <span className={`badge badge-${variant} ${dot ? 'badge-dot' : ''} ${className}`}>
      {children}
    </span>
  )
}

// ── CARD ─────────────────────────────────────────────────────
export function Card({ children, hoverable = false, className = '' }) {
  return (
    <div className={`card ${hoverable ? 'card-hover' : ''} ${className}`}>
      {children}
    </div>
  )
}
export function CardHeader({ title, subtitle, actions = null }) {
  return (
    <div className="card-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'var(--space-3)' }}>
      <div>
        {title    && <h3 className="card-title">{title}</h3>}
        {subtitle && <p className="card-subtitle">{subtitle}</p>}
      </div>
      {actions && <div style={{ flexShrink:0 }}>{actions}</div>}
    </div>
  )
}
export function CardBody({ children, className = '' }) {
  return <div className={`card-body ${className}`}>{children}</div>
}
export function CardFooter({ children }) {
  return <div className="card-footer">{children}</div>
}

// Stat card prêt à l'emploi
export function StatCard({ label, value, caption, delta, deltaLabel, icon = null }) {
  const isPositive = typeof delta === 'number' ? delta >= 0 : delta?.startsWith('+')
  return (
    <div className="card card-stat card-body">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <p className="stat-label">{label}</p>
        {icon && <span style={{ fontSize:'20px', opacity:0.6 }}>{icon}</span>}
      </div>
      <p className="stat-value">{value}</p>
      {caption && <p className="stat-caption">{caption}</p>}
      {delta !== undefined && (
        <p className={`stat-delta ${!isPositive ? 'down' : ''}`}>
          <span>{isPositive ? '↑' : '↓'}</span>
          <span>{delta}{deltaLabel ? ` ${deltaLabel}` : ''}</span>
        </p>
      )}
    </div>
  )
}

// ── FORM ELEMENTS ────────────────────────────────────────────
export function FormGroup({ label, hint, error, htmlFor, children, required = false }) {
  return (
    <div className="form-group">
      {label && (
        <label className="form-label" htmlFor={htmlFor}>
          {label}
          {required && <span style={{ color:'var(--color-danger)', marginLeft:'var(--space-1)' }}>*</span>}
        </label>
      )}
      {children}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!error && hint && <p className="form-hint">{hint}</p>}
    </div>
  )
}

export const Input = React.forwardRef(function Input({ id, error, className = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      id={id}
      className={`input ${error ? 'error' : ''} ${className}`}
      aria-invalid={!!error}
      {...props}
    />
  )
})

export const Textarea = React.forwardRef(function Textarea({ id, error, className = '', ...props }, ref) {
  return (
    <textarea
      ref={ref}
      id={id}
      className={`textarea ${error ? 'error' : ''} ${className}`}
      aria-invalid={!!error}
      {...props}
    />
  )
})

export function Select({ id, options = [], placeholder, error, className = '', value, onChange, ...props }) {
  return (
    <select
      id={id}
      className={`select ${error ? 'error' : ''} ${className}`}
      value={value}
      onChange={onChange}
      aria-invalid={!!error}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(opt => {
        const v = typeof opt === 'object' ? opt.value : opt
        const l = typeof opt === 'object' ? opt.label : opt
        return <option key={v} value={v}>{l}</option>
      })}
    </select>
  )
}

// ── AVATAR ───────────────────────────────────────────────────
export function Avatar({ src, name = '', size = 'md', className = '' }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
  return (
    <div className={`avatar avatar-${size} ${className}`} title={name}>
      {src ? <img src={src} alt={name} /> : <span>{initials}</span>}
    </div>
  )
}

// ── TABLE ────────────────────────────────────────────────────
export function Table({ columns = [], rows = [], onRowClick, emptyLabel = 'Aucun résultat', loading = false }) {
  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={col.width ? { width:col.width } : {}}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr><td colSpan={columns.length} style={{ textAlign:'center', color:'var(--color-text-muted)', padding:'var(--space-8)' }}>Chargement…</td></tr>
          )}
          {!loading && rows.length === 0 && (
            <tr><td colSpan={columns.length} style={{ textAlign:'center', color:'var(--color-text-muted)', padding:'var(--space-8)' }}>{emptyLabel}</td></tr>
          )}
          {!loading && rows.map((row, i) => (
            <tr
              key={row.id ?? i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor:'pointer' } : {}}
            >
              {columns.map(col => (
                <td key={col.key}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── MODAL ────────────────────────────────────────────────────
export function Modal({ isOpen, onClose, title, children, footer, size = '' }) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="modal-overlay is-open"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`modal ${size ? `modal-${size}` : ''}`}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

// ── TOAST ────────────────────────────────────────────────────
// Hook useToast — usage : const { toast, toasts } = useToast()
const ICONS = {
  success: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>,
  warning: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  danger:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  info:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
}

export function useToast(duration = 4000) {
  const [toasts, setToasts] = useState([])

  const toast = (title, message = '', type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, title, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }

  return { toast, toasts }
}

export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`} role="alert">
          <span className="toast-icon" style={{ color: `var(--color-${t.type === 'info' ? 'primary' : t.type})` }}>
            {ICONS[t.type]}
          </span>
          <div className="toast-body">
            <p className="toast-title">{t.title}</p>
            {t.message && <p className="toast-msg">{t.message}</p>}
          </div>
          {onDismiss && (
            <button className="toast-dismiss" onClick={() => onDismiss(t.id)} aria-label="Fermer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// ── TABS ─────────────────────────────────────────────────────
export function Tabs({ tabs = [], value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(t => (
        <button
          key={t.value}
          className={`tab ${value === t.value ? 'active' : ''}`}
          onClick={() => onChange(t.value)}
          role="tab"
          aria-selected={value === t.value}
        >
          {t.label}
          {t.count !== undefined && (
            <Badge variant={value === t.value ? 'primary' : 'default'} style={{ marginLeft:'var(--space-2)' }}>
              {t.count}
            </Badge>
          )}
        </button>
      ))}
    </div>
  )
}

// ── PAGE LAYOUT ──────────────────────────────────────────────
export function AppLayout({ sidebar, topbar, children }) {
  return (
    <div className="page-layout">
      {sidebar}
      <main className="page-main">
        {topbar}
        <div className="page-content">{children}</div>
      </main>
    </div>
  )
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'var(--space-4)' }}>
      <div>
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {actions && <div style={{ flexShrink:0, display:'flex', gap:'var(--space-3)' }}>{actions}</div>}
    </div>
  )
}

// ── EMPTY STATE ──────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-icon">{icon}</div>}
      <p className="empty-title">{title}</p>
      {description && <p className="empty-desc">{description}</p>}
      {action && <div style={{ marginTop:'var(--space-6)' }}>{action}</div>}
    </div>
  )
}
