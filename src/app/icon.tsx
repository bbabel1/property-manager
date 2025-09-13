import { ImageResponse } from 'next/og'

// Tell Next the icon output size and content type
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

// Simple generated favicon to prevent missing /favicon.ico errors
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#111827',
          color: 'white',
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        O
      </div>
    ),
    size
  )
}

