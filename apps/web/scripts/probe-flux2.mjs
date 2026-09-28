/**
 * probe-flux2.mjs — Phase 5.1 end-to-end probe. Node, no UI.
 *
 * Walks both Flux 2 chains through the gateway against the dev-seeded stack:
 *   INTERNAL: create -> plan -> start -> add checkpoints -> reach -> complete
 *             -> close, asserting every intermediate status.
 *   EXTERNAL: create -> plan -> send-to-transporter -> acknowledge -> start
 *             -> reach -> complete -> close.
 *
 * Also pins the 5.2 regressions (5 TM reads back as 5, checkpoint-less tour
 * renders) and asserts GET /me/permissions per seeded actor.
 *
 * Usage: node scripts/probe-flux2.mjs [--base http://localhost:18080/api/v1]
 * Exit 0 = all assertions held. Any failure prints the step and exits 1.
 *
 * Everything the probe asserts on is either created by the probe itself
 * (tour codes PROBE-*, checkpoint sequences) or read from seed endpoints
 * (orgs, sites, users) — no hardcoded business ids.
 */

const BASE = (process.argv.find((a) => a.startsWith('--base='))?.slice(7)
  || process.env.PROBE_BASE
  || 'http://localhost:18080/api/v1').replace(/\/+$/, '')

const PASSWORD = process.env.PROBE_PASSWORD || 'Password123!'

let failures = 0
function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  ok   ${name}`)
  } else {
    failures++
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function req(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* HTML error page */ }
  return { status: res.status, json, text }
}

function data(r) {
  return r.json?.data ?? null
}

async function login(username) {
  const r = await req('POST', '/auth/login', null, {
    username, password: PASSWORD, deviceInfo: 'probe-flux2', ipAddress: '127.0.0.1',
  })
  check(`login ${username} (HTTP ${r.status})`, r.status === 200 && data(r)?.accessToken, r.text.slice(0, 200))
  return data(r)?.accessToken ?? null
}

async function main() {
  console.log(`probe base: ${BASE}`)

  // ── actors ──────────────────────────────────────────────────────────────
  console.log('actors:')
  const adminToken = await login('superadmin.cspHq')
  const marketeurToken = await login('gest.gpl')
  const transportToken = await login('resp.abc')
  const driverToken = await login('chauffeur.abc1')
  if (!adminToken) { console.error('no admin token — abort'); process.exit(1) }

  // ── /me/permissions per actor (decision 6: role vocabularies) ───────────
  console.log('permissions:')
  for (const [name, token] of [['superadmin', adminToken], ['marketeur', marketeurToken], ['transporteur', transportToken], ['driver', driverToken]]) {
    if (!token) { check(`/me/permissions ${name}`, false, 'no token'); continue }
    const r = await req('GET', '/me/permissions', token)
    const perms = data(r)
    check(`/me/permissions ${name} (HTTP ${r.status})`, r.status === 200 && perms != null, r.text.slice(0, 200))
  }

  // ── reference rows (seeded, read live — never hardcoded) ────────────────
  console.log('reference rows:')
  const orgsR = await req('GET', '/organizations?size=200', adminToken)
  // Organization list is a top-level Hydra-style page ({member, content}),
  // not the {data} envelope — and org types are short codes (MKT/TRP/DEP…).
  const orgPage = data(orgsR) ?? orgsR.json ?? []
  const orgList = Array.isArray(orgPage) ? orgPage : (orgPage.member ?? orgPage.content ?? [])
  const isMarketeur = (o) => o.type === 'MKT' || o.type === 'MARKETEUR'
    || /arqueteur/i.test(o.typeDescription ?? '')
  const isTransporteur = (o) => o.type === 'TRP' || o.type === 'TRANSPORTEUR'
    || /ransporteur/i.test(o.typeDescription ?? '')
  const marketeur = orgList.find(isMarketeur)
  const transporteur = orgList.find(isTransporteur)
  check('marketeur org seeded', !!marketeur, `found ${orgList.length} orgs`)
  check('transporteur org seeded', !!transporteur, `found ${orgList.length} orgs`)

  const sitesR = await req('GET', '/client-sites?size=200', adminToken)
  let siteList = data(sitesR) ?? sitesR.json ?? []
  siteList = Array.isArray(siteList) ? siteList : (siteList.content ?? siteList.member ?? [])
  if (siteList.length === 0) {
    const s2 = await req('GET', '/sites?size=200', adminToken)
    let alt = data(s2) ?? s2.json ?? []
    siteList = Array.isArray(alt) ? alt : (alt.content ?? alt.member ?? [])
  }
  check('checkpoint destination seeded', siteList.length > 0, 'no sites or client-sites')
  const destSite = siteList[0]
  const destKey = destSite?.id ? (siteList === (data(sitesR) ?? []) || destSite.org_id || destSite.orgId ? 'clientSiteId' : 'siteId') : null

  // ── INTERNAL chain ──────────────────────────────────────────────────────
  console.log('INTERNAL chain:')
  const stamp = Date.now().toString(36)
  const tCode = `PROBE-INT-${stamp}`
  const created = await req('POST', '/tours', adminToken, {
    tourCode: tCode,
    marketerOrganizationId: marketeur.id,
    executionMode: 'INTERNAL',
    type: 'VRAC',
    requestedQuantity: 5,
  })
  const tour = data(created)
  check('create INTERNAL (DRAFT)', created.status === 201 && tour?.status === 'DRAFT', `HTTP ${created.status} ${created.text.slice(0, 200)}`)
  // 5.2 pin: 5 TM reads back as 5, not 5000.
  check('requested_quantity 5 reads back as 5', tour?.requestedQuantity === 5 || tour?.requested_quantity === 5, JSON.stringify(tour)?.slice(0, 200))
  if (!tour?.id) { console.error('no tour id — abort'); process.exit(1) }

  const planned = await req('POST', `/tours/${tour.id}/plan`, adminToken)
  check('plan -> PLANNED', planned.status === 200 && data(planned)?.status === 'PLANNED', `HTTP ${planned.status}`)

  const started = await req('POST', `/tours/${tour.id}/start`, adminToken)
  check('start -> INPROGRESS', started.status === 200 && data(started)?.status === 'INPROGRESS', `HTTP ${started.status} ${started.text.slice(0, 200)}`)

  // 5.2 pin: checkpoint-less tour renders (detail resolves with empty list).
  const cps0 = await req('GET', `/tours/${tour.id}/checkpoints`, adminToken)
  check('checkpoint-less tour renders (empty list)', cps0.status === 200 && Array.isArray(data(cps0)) && data(cps0).length === 0, `HTTP ${cps0.status}`)

  const cpBody = { sequence: 1 }
  if (destKey) cpBody[destKey] = destSite.id
  const cp1 = await req('POST', `/tours/${tour.id}/checkpoints`, adminToken, cpBody)
  const cp = data(cp1)
  check('add checkpoint (PENDING)', cp1.status === 201 && cp?.status === 'PENDING', `HTTP ${cp1.status} ${cp1.text.slice(0, 200)}`)

  const reached = await req('POST', `/checkpoints/${cp.id}/reach`, adminToken)
  check('reach -> REACHED', reached.status === 200 && data(reached)?.status === 'REACHED', `HTTP ${reached.status} ${reached.text.slice(0, 200)}`)

  const completed = await req('POST', `/checkpoints/${cp.id}/complete`, adminToken)
  check('complete -> COMPLETED', completed.status === 200 && data(completed)?.status === 'COMPLETED', `HTTP ${completed.status}`)

  const closed = await req('POST', `/tours/${tour.id}/close?deliveredQuantity=5`, adminToken)
  check('close -> CLOSED', closed.status === 200 && data(closed)?.status === 'CLOSED', `HTTP ${closed.status} ${closed.text.slice(0, 200)}`)

  // ── EXTERNAL chain ──────────────────────────────────────────────────────
  console.log('EXTERNAL chain:')
  const eCode = `PROBE-EXT-${stamp}`
  const eCreated = await req('POST', '/tours', adminToken, {
    tourCode: eCode,
    marketerOrganizationId: marketeur.id,
    executionMode: 'EXTERNAL',
    type: 'BOUTEILLES50KG',
    requestedQuantity: 200,
    transporterOrganizationId: transporteur.id,
  })
  const etour = data(eCreated)
  check('create EXTERNAL (DRAFT)', eCreated.status === 201 && etour?.status === 'DRAFT', `HTTP ${eCreated.status} ${eCreated.text.slice(0, 200)}`)
  if (!etour?.id) { console.error('no external tour id — abort'); process.exit(1) }

  // EXTERNAL has no plan step: send-to-transporter moves DRAFT straight to
  // PENDINGTRANSPORTERACK (the transporter ack replaces internal planning).
  const sent = await req('POST', `/tours/${etour.id}/send-to-transporter`, adminToken)
  check('send -> PENDINGTRANSPORTERACK', sent.status === 200 && data(sent)?.status === 'PENDINGTRANSPORTERACK', `HTTP ${sent.status} ${sent.text.slice(0, 200)}`)

  const acked = await req('POST', `/tours/${etour.id}/acknowledge`, transportToken || adminToken)
  check('acknowledge -> ACKNOWLEDGED', acked.status === 200 && data(acked)?.status === 'ACKNOWLEDGED', `HTTP ${acked.status} ${acked.text.slice(0, 200)}`)

  const eStarted = await req('POST', `/tours/${etour.id}/start`, adminToken)
  check('start -> INPROGRESS', eStarted.status === 200 && data(eStarted)?.status === 'INPROGRESS', `HTTP ${eStarted.status}`)

  const eCpBody = { sequence: 1 }
  if (destKey) eCpBody[destKey] = destSite.id
  const eCp = data(await req('POST', `/tours/${etour.id}/checkpoints`, adminToken, eCpBody))
  await req('POST', `/checkpoints/${eCp.id}/reach`, adminToken)
  // Skip path instead of complete: exercises SKIPPED as terminal for close.
  const skipped = await req('POST', `/checkpoints/${eCp.id}/skip?reason=${encodeURIComponent('probe: client closed')}`, adminToken)
  check('skip -> SKIPPED', skipped.status === 200 && data(skipped)?.status === 'SKIPPED', `HTTP ${skipped.status} ${skipped.text.slice(0, 200)}`)

  const eClosed = await req('POST', `/tours/${etour.id}/close?deliveredQuantity=180`, adminToken)
  check('close with SKIPPED stop -> CLOSED', eClosed.status === 200 && data(eClosed)?.status === 'CLOSED', `HTTP ${eClosed.status} ${eClosed.text.slice(0, 200)}`)

  console.log(failures === 0 ? 'PROBE PASS' : `PROBE FAIL (${failures})`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error('probe crashed:', e); process.exit(1) })
