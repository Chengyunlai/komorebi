import {Vector3} from 'three'

// Read the rendered (raw) skeleton after VRM update/constraints. Coordinates are
// CSS viewport pixels, so overlay and character can have different origins/DPR.
export function projectCharacterAnchors(vrm, camera, rect, now) {
  if (!vrm?.humanoid || !camera || !rect?.width || !rect?.height) return null
  const project = name => {
    const bone = vrm.humanoid.getRawBoneNode(name)
    if (!bone) return null
    const point = bone.getWorldPosition(new Vector3()).project(camera)
    if (![point.x, point.y, point.z].every(Number.isFinite) || Math.abs(point.z) > 1) return null
    return {x: rect.left + (point.x + 1) * rect.width / 2,
      y: rect.top + (1 - point.y) * rect.height / 2}
  }
  const hands = ['left', 'right'].flatMap(side => {
    const point = project(side + 'Hand')
    return point ? [{side, ...point}] : []
  })
  return {at: now, hands, head: project('head'), chest: project('chest')}
}

export function selectFireworkHand(anchors, rect, now, previous) {
  if (!anchors || now - anchors.at > .2 || now < anchors.at || !rect?.width || !rect?.height) return null
  const unit = Math.min(rect.width, rect.height)
  let best = null
  for (const hand of anchors.hands) {
    const x = (hand.x - rect.left) / rect.width, y = (hand.y - rect.top) / rect.height
    // Skip offscreen hands and hands in front of the face; never move a burst to
    // an invented hand location just to fit it inside the window.
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < .08 || x > .92 || y < .12 || y > .85) continue
    if (anchors.head && Math.hypot(hand.x - anchors.head.x, hand.y - anchors.head.y) < unit * .13) continue
    const prior = previous?.hands.find(item => item.side === hand.side)
    const dt = previous ? anchors.at - previous.at : 0
    const speed = prior && dt > .005 && dt < .2
      ? Math.min(1, Math.hypot(hand.x - prior.x, hand.y - prior.y) / dt / unit) : 0
    const extension = anchors.chest ? Math.abs(hand.x - anchors.chest.x) / unit : Math.abs(x - .5)
    const height = anchors.chest ? (anchors.chest.y - hand.y) / unit : .5 - y
    // A visible gesture is required: skip lowered wrists near the waist even
    // when they happen to be the better of two available hands.
    const raised = height > .10
    const extended = extension > .16 && height > -.06
    if (!raised && !extended) continue
    const score = extension * 2 + height * .7 + speed * .15
    if (!best || score > best.score) best = {x, y, side: hand.side, speed, score}
  }
  return best
}
