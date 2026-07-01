'use client'

import { motion } from 'framer-motion'

/**
 * Fixed, full-viewport animated aurora background.
 * Sits behind everything (z-[-1]) and never intercepts pointer events.
 * Uses emerald + violet + fuchsia blobs (no blue/indigo) + a subtle grid overlay.
 */
export function AnimatedBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
    >
      {/* grid overlay */}
      <div className="absolute inset-0 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />

      {/* aurora blobs */}
      <motion.div
        className="aurora-blob"
        style={{
          width: '46vw',
          height: '46vw',
          top: '-12%',
          left: '-8%',
          background:
            'radial-gradient(circle at center, oklch(0.7 0.18 162 / 0.55), transparent 65%)',
        }}
        animate={{
          x: [0, 60, -30, 0],
          y: [0, 40, 80, 0],
          scale: [1, 1.12, 0.95, 1],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="aurora-blob"
        style={{
          width: '40vw',
          height: '40vw',
          top: '20%',
          right: '-10%',
          background:
            'radial-gradient(circle at center, oklch(0.65 0.22 300 / 0.5), transparent 65%)',
        }}
        animate={{
          x: [0, -50, 30, 0],
          y: [0, 70, -20, 0],
          scale: [1, 0.9, 1.15, 1],
        }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="aurora-blob"
        style={{
          width: '36vw',
          height: '36vw',
          bottom: '-15%',
          left: '25%',
          background:
            'radial-gradient(circle at center, oklch(0.7 0.2 330 / 0.45), transparent 65%)',
        }}
        animate={{
          x: [0, 40, -40, 0],
          y: [0, -30, 20, 0],
          scale: [1, 1.1, 0.92, 1],
        }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* top vignette for header legibility */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background to-transparent" />
      {/* bottom vignette */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </div>
  )
}
