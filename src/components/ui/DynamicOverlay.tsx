"use client"

import React, { useEffect, useRef } from 'react'

interface DynamicOverlayProps {
  overlayTop: number
  overlayLeft: number
  children: React.ReactNode
  className?: string
}

export default function DynamicOverlay({ 
  overlayTop, 
  overlayLeft, 
  children, 
  className = "dynamic-overlay" 
}: DynamicOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.style.setProperty('--overlay-top', `${Math.max(overlayTop, 0)}px`)
      overlayRef.current.style.setProperty('--overlay-left', `${Math.max(overlayLeft, 0)}px`)
    }
  }, [overlayTop, overlayLeft])

  return (
    <div ref={overlayRef} className={className}>
      {children}
    </div>
  )
}
