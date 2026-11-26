import { apOrigin } from '../../../lib/activitypub/config'

// /.well-known/host-meta: older fediverse software looks here for WebFinger.
export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/xrd+xml; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">
  <Link rel="lrdd" type="application/xrd+xml" template="${apOrigin()}/.well-known/webfinger?resource={uri}"/>
</XRD>`)
}
