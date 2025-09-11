#!/usr/bin/env -S tsx
// Quick webhook smoke test: posts a signed payload to local webhook route
// Usage: npm run test:buildium:webhook  (ensure `npm run dev` is running)

import 'dotenv/config'
import crypto from 'crypto'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing ${name} in environment`)
  return v
}

function sign(body: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

async function main() {
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/buildium`
  const secret = requireEnv('BUILDIUM_WEBHOOK_SECRET')

  const payload = {
    Events: [
      {
        Id: `smoke-${Date.now()}`,
        EventType: 'smoke.test',
        EntityId: 0,
        EntityType: 'Test',
        EventDate: new Date().toISOString(),
        Data: { hello: 'world' },
      },
    ],
  }

  const body = JSON.stringify(payload)
  const signature = sign(body, secret)

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-buildium-signature': signature,
    },
    body,
  })

  const text = await res.text()
  const ok = res.ok
  console.log(`${ok ? '✅' : '❌'} Webhook POST -> ${res.status} ${res.statusText}`)
  if (!ok) console.log(text)
  if (!ok) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })

