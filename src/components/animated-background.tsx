'use client'

import { motion } from 'framer-motion'

/**
 * Fixed, full-viewport background: deep charcoal base + subtle grid +
 * a single drifting lime aurora + faint coral accent. Restrained and
 * purposeful — no rainbow blobs.
 */
export function AnimatedBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
    >
      {/* grid overlay — faded at edges */}
      <div className="absolute inset-0 bg-grid opacity-70 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />

      {/* primary lime aurora — top left, slow drift */}
      <motion.div
        className="aurora-blob"
        style={{
          width: '50vw',
          height: '50vw',
          top: '-18%',
          left: '-10%',
          background:
            'radial-gradient(circle at center, oklch(0.8 0.2 125 / 0.5), transparent 60%)',
        }}
        animate={{
          x: [0, 40, -20, 0],
          y: [0, 30, 60, 0],
          scale: [1, 1.1, 0.95, 1],
        }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* secondary coral aurora — bottom right, slower */}
      <motion.div
        className="aurora-blob"
        style={{
          width: '38vw',
          height: '38vw',
          bottom: '-12%',
          right: '-8%',
          background:
            'radial-gradient(circle at center, oklch(0.68 0.2 25 / 0.35), transparent 60%)',
        }}
        animate={{
          x: [0, -30, 20, 0],
          y: [0, -20, 15, 0],
          scale: [1, 0.92, 1.08, 1],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* top vignette for header legibility */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-background to-transparent" />
    </div>
  )
}
