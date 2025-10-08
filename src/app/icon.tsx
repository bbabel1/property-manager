import { ImageResponse } from 'next/og'

// Tell Next the icon output size and content type
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

// Simple generated favicon to prevent missing /favicon.ico errors
export default function Icon() {
  return new ImageResponse(
    (
      <div
        tw="flex h-full w-full items-center justify-center bg-slate-900 text-white text-[20px] font-bold"
      >
        O
      </div>
    ),
    size
  )
}
