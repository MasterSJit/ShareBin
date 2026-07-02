'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'

/**
 * GSAP-powered animation hooks and components.
 * Register plugins once (no ScrollTrigger needed — we use IntersectionObserver
 * via Framer's useInView for scroll reveals; GSAP handles entrance timelines,
 * magnetic buttons, text splits, and hover micro-interactions).
 */

// Silence unused warning when registered
gsap.config({ nullTargetWarn: false })

/* ---------------- useGsapHeroEntrance ---------------- */
/**
 * Animates hero children in sequence: eyebrow → h1 (split by char) → subtitle → chips.
 * Call inside a layout effect on the hero container.
 */
export function useGsapHeroEntrance<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.from('[data-hero="eyebrow"]', { y: 12, opacity: 0, duration: 0.5 })
        .from(
          '[data-hero="title"] .char',
          { y: 30, opacity: 0, rotateX: -45, stagger: 0.03, duration: 0.6 },
          '-=0.2',
        )
        .from(
          '[data-hero="gradient"]',
          { y: 20, opacity: 0, duration: 0.5 },
          '-=0.3',
        )
        .from('[data-hero="subtitle"]', { y: 16, opacity: 0, duration: 0.5 }, '-=0.3')
        .from(
          '[data-hero="chip"]',
          { y: 10, opacity: 0, stagger: 0.08, duration: 0.4 },
          '-=0.2',
        )
    }, el)
    return () => ctx.revert()
  }, [])

  return ref
}

/* ---------------- useGsapMagnetic ---------------- */
/**
 * Magnetic hover effect — element follows the cursor slightly.
 */
export function useGsapMagnetic<T extends HTMLElement = HTMLButtonElement>(strength = 0.3) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(hover: none)').matches) return // skip on touch

    const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' })

    function onMove(e: MouseEvent) {
      const rect = el.getBoundingClientRect()
      const x = (e.clientX - (rect.left + rect.width / 2)) * strength
      const y = (e.clientY - (rect.top + rect.height / 2)) * strength
      xTo(x)
      yTo(y)
    }
    function onLeave() {
      xTo(0)
      yTo(0)
    }

    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [strength])

  return ref
}

/* ---------------- useGsapFieldFocus ---------------- */
/**
 * Animated underline / glow that responds to input focus.
 * Pass a ref to the field wrapper.
 */
export function useGsapFieldGlow<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const input = el.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null
    const bar = el.querySelector('[data-field-bar]') as HTMLElement | null
    if (!input || !bar) return

    function onFocus() {
      gsap.to(bar, { scaleX: 1, duration: 0.4, ease: 'power3.out' })
      gsap.to(el, { '--field-glow': '0.5', duration: 0.4 })
    }
    function onBlur() {
      gsap.to(bar, { scaleX: 0, duration: 0.3, ease: 'power3.in' })
      gsap.to(el, { '--field-glow': '0', duration: 0.3 })
    }

    input.addEventListener('focus', onFocus)
    input.addEventListener('blur', onBlur)
    return () => {
      input.removeEventListener('focus', onFocus)
      input.removeEventListener('blur', onBlur)
    }
  }, [])

  return ref
}

/* ---------------- useGsapStaggerEntrance ---------------- */
/**
 * Generic stagger entrance for a list of children.
 */
export function useGsapStaggerEntrance<T extends HTMLElement = HTMLDivElement>(
  deps: unknown[] = [],
  selector = '[data-stagger-item]',
) {
  const ref = useRef<T>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ctx = gsap.context(() => {
      gsap.from(selector, {
        y: 24,
        opacity: 0,
        stagger: 0.06,
        duration: 0.5,
        ease: 'power3.out',
      })
    }, el)
    return () => ctx.revert()
  }, deps)

  return ref
}

/* ---------------- useGsapCounter ---------------- */
/**
 * Count-up animation for a numeric value.
 */
export function useGsapCounter(
  targetRef: React.RefObject<HTMLElement>,
  value: number,
  duration = 1.5,
) {
  useEffect(() => {
    const el = targetRef.current
    if (!el) return
    const obj = { val: 0 }
    const tween = gsap.to(obj, {
      val: value,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = Math.round(obj.val).toLocaleString()
      },
    })
    return () => {
      tween.kill()
    }
  }, [targetRef, value, duration])
}

/* ---------------- <SplitText> helper ---------------- */
/**
 * Splits a string into per-character spans for GSAP char stagger.
 */
export function SplitText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className} aria-label={text}>
      {text.split('').map((ch, i) => (
        <span
          key={i}
          className="char inline-block"
          style={{ transformOrigin: 'bottom' }}
          aria-hidden
        >
          {ch === ' ' ? '\u00A0' : ch}
        </span>
      ))}
    </span>
  )
}
