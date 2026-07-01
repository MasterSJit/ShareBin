'use client'

import { motion, useInView, useMotionValue, useSpring, useTransform, type Variants } from 'framer-motion'
import { useEffect, useRef, type ReactNode } from 'react'

/* ---------------- Variants ---------------- */

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24, filter: 'blur(6px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.6, ease: [0.2, 0.8, 0.2, 1] },
  },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.5, ease: 'easeOut' } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] },
  },
}

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -32 },
  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] } },
}

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 32 },
  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] } },
}

export const staggerContainer = (stagger = 0.08, delay = 0): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren: delay },
  },
})

/* ---------------- Reveal on scroll ---------------- */

export function Reveal({
  children,
  delay = 0,
  variant = fadeUp,
  className,
  as = 'div',
}: {
  children: ReactNode
  delay?: number
  variant?: Variants
  className?: string
  as?: 'div' | 'section' | 'li' | 'span'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px 0px -60px 0px' })
  const MotionTag = motion[as] as typeof motion.div
  return (
    <MotionTag
      ref={ref}
      variants={variant}
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
      transition={{ delay }}
      className={className}
    >
      {children}
    </MotionTag>
  )
}

/* ---------------- Stagger group ---------------- */

export function StaggerGroup({
  children,
  className,
  stagger = 0.08,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  stagger?: number
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  return (
    <motion.div
      ref={ref}
      variants={staggerContainer(stagger, delay)}
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ---------------- Animated number counter ---------------- */

export function AnimatedNumber({
  value,
  duration = 1.2,
  format,
  className,
}: {
  value: number
  duration?: number
  format?: (n: number) => string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { duration: duration * 1000, bounce: 0 })
  const display = useTransform(spring, (v) => (format ? format(Math.round(v)) : Math.round(v).toString()))

  useEffect(() => {
    if (inView) motionValue.set(value)
  }, [inView, value, motionValue])

  return <motion.span ref={ref} className={className}>{display}</motion.span>
}

/* ---------------- Tilt card (3D hover) ---------------- */

export function TiltCard({
  children,
  className,
  intensity = 8,
}: {
  children: ReactNode
  className?: string
  intensity?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const rotateX = useSpring(0, { stiffness: 200, damping: 18 })
  const rotateY = useSpring(0, { stiffness: 200, damping: 18 })

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    rotateX.set(-py * intensity)
    rotateY.set(px * intensity)
  }
  function onLeave() {
    rotateX.set(0)
    rotateY.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX, rotateY, transformPerspective: 1000, transformStyle: 'preserve-3d' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ---------------- Page transition wrapper ---------------- */

export function PageTransition({ children, k }: { children: ReactNode; k: string }) {
  return (
    <motion.div
      key={k}
      initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -8, filter: 'blur(8px)' }}
      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  )
}
