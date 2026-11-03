import {Vector3, Quaternion} from 'three'

const point = bone => bone.getWorldPosition(new Vector3())
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

/** Conservative hip-local garment envelope, not cloth/triangle collision. */
export function projectGarmentPoint(p, volume, radius = .03, side = 1) {
  const top = volume.top + radius, bottom = volume.bottom - radius
  const rx = volume.radiusX + radius, rz = volume.radiusZ + radius
  const x = p.x - (volume.centerX || 0), z = p.z - (volume.centerZ || 0)
  const r = Math.hypot(x / rx, z / rz)
  if (p.y >= top || p.y <= bottom || r >= 1) return {point: p.clone(), depth: 0}
  const radial = p.clone()
  if (r < 1e-8) radial.x = (volume.centerX || 0) + side * rx
  else {radial.x = (volume.centerX || 0) + x / r; radial.z = (volume.centerZ || 0) + z / r}
  const exits = [radial, new Vector3(p.x, top, p.z), new Vector3(p.x, bottom, p.z)]
  exits.sort((a, b) => a.distanceToSquared(p) - b.distanceToSquared(p))
  return {point: exits[0], depth: exits[0].distanceTo(p)}
}

function aim(bone, child, destination) {
  const from = point(bone), direction = point(child).sub(from).normalize(), wanted = destination.clone().sub(from).normalize()
  const world = new Quaternion().setFromUnitVectors(direction, wanted).multiply(bone.getWorldQuaternion(new Quaternion()))
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(world))
  bone.updateWorldMatrix(false, true)
}

/** Preserve the current elbow plane and wrist world orientation during a reach. */
function reachArm(upper, lower, hand, desired, poleHint = null) {
  const shoulder = point(upper), elbow = point(lower), wrist = point(hand)
  const a = shoulder.distanceTo(elbow), b = elbow.distanceTo(wrist)
  if (Math.min(a, b) < 1e-6) return
  const rotation = hand.getWorldQuaternion(new Quaternion()), axis = desired.clone().sub(shoulder)
  const distance = clamp(axis.length(), Math.abs(a - b) + 1e-5, a + b - 1e-5)
  if (axis.lengthSq() < 1e-10) return
  axis.normalize()
  const pole = poleHint?poleHint.clone():elbow.clone().sub(shoulder); pole.addScaledVector(axis, -pole.dot(axis))
  if (pole.lengthSq() < 1e-8) {pole.set(0, 0, 1); pole.addScaledVector(axis, -pole.dot(axis))}
  if (pole.lengthSq() < 1e-8) {pole.set(1, 0, 0); pole.addScaledVector(axis, -pole.dot(axis))}
  pole.normalize()
  const along = (a * a - b * b + distance * distance) / (2 * distance)
  const bend = Math.sqrt(Math.max(0, a * a - along * along))
  aim(upper, lower, shoulder.clone().addScaledVector(axis, along).addScaledVector(pole, bend))
  aim(lower, hand, shoulder.clone().addScaledVector(axis, distance))
  hand.quaternion.copy(hand.parent.getWorldQuaternion(new Quaternion()).invert().multiply(rotation))
  hand.updateWorldMatrix(false, true)
}

export function createGarmentClearance(vrm, {volume: explicitVolume, handRadius = .035, padding = .018} = {}) {
  vrm.scene.updateMatrixWorld(true)
  const node = n => vrm.humanoid.getNormalizedBoneNode(n), hips = node('hips')
  if (!hips) return {enabled: false, apply: () => ({enabled: false})}
  const skirts = [], coats = []
  vrm.scene.traverse(bone => {if (bone.isBone && /skirt/i.test(bone.name)) (/coat/i.test(bone.name)?coats:skirts).push(hips.worldToLocal(point(bone)))})
  // Long coat helper chains may extend well below the visible short skirt.
  const garment=skirts.length?skirts:coats
  if (!explicitVolume && !garment.length) return {enabled: false, apply: () => ({enabled: false})}
  // Use the primary skirt rig in rest pose rather than one avatar's dimensions.
  const volume = explicitVolume || {
    top: Math.max(...garment.map(p => p.y)) + padding,
    bottom: Math.min(...garment.map(p => p.y)) - padding,
    radiusX: Math.max(...garment.map(p => Math.abs(p.x))) + padding,
    radiusZ: Math.max(...garment.map(p => Math.abs(p.z))) + padding,
  }
  if (![volume.top, volume.bottom, volume.radiusX, volume.radiusZ].every(Number.isFinite) || volume.top <= volume.bottom || Math.min(volume.radiusX, volume.radiusZ) <= 0) throw new TypeError('Invalid garment volume')
  const arms = ['left', 'right'].map(side => ({side, upper: node(side + 'UpperArm'), lower: node(side + 'LowerArm'), hand: node(side + 'Hand'), finger: node(side + 'MiddleDistal'), offset: new Vector3()})).filter(a => a.upper && a.lower && a.hand)
  for (const arm of arms) arm.sign = Math.sign(hips.worldToLocal(point(arm.upper)).x) || (arm.side === 'left' ? 1 : -1)
  function samples(arm) {
    const elbow = point(arm.lower), wrist = point(arm.hand)
    const tip = arm.finger ? point(arm.finger) : wrist.clone().add(wrist.clone().sub(elbow).normalize().multiplyScalar(elbow.distanceTo(wrist)*.3))
    return [elbow, elbow.clone().lerp(wrist, .35), elbow.clone().lerp(wrist, .7), wrist, tip]
  }
  function inspect(arm) {
    return samples(arm).map((p, i) => {
      const local = hips.worldToLocal(p.clone()), projected = projectGarmentPoint(local, volume, handRadius, arm.sign)
      return {index: i, depth: projected.depth, delta: projected.point.sub(local), local}
    }).sort((a, b) => b.depth - a.depth)[0]
  }
  const measure = () => Math.max(0, ...arms.map(arm => inspect(arm).depth))
  return {enabled: true, volume: {...volume}, measure, reset(){for(const arm of arms)arm.offset.set(0,0,0)}, apply({dt = 1 / 60} = {}) {
    vrm.scene.updateMatrixWorld(true)
    const before = measure(), report = {enabled: true, before, remaining: 0, corrected: 0, maxHandShift: 0}
    for (const arm of arms) {
      const original = hips.worldToLocal(point(arm.hand)),wristRotation=arm.hand.getWorldQuaternion(new Quaternion())
      const restoreWrist=()=>{arm.hand.quaternion.copy(arm.hand.parent.getWorldQuaternion(new Quaternion()).invert().multiply(wristRotation));arm.hand.updateWorldMatrix(false,true)}
      // A short release prevents grazing the boundary from toggling an arm correction.
      if (arm.offset.lengthSq() > 1e-10) {
        arm.offset.multiplyScalar(Math.exp(-Math.max(0, dt) / .08))
        reachArm(arm.upper, arm.lower, arm.hand, hips.localToWorld(original.clone().add(arm.offset)))
      }
      restoreWrist()
      for (let iteration = 0; iteration < 12; iteration++) {
        const hit = inspect(arm)
        if (hit.depth < 1e-4) break
        if (hit.index === 0) aim(arm.upper, arm.lower, hips.localToWorld(hit.local.clone().add(hit.delta)))
        else {
          const fraction = [0, .35, .7, 1, 1][hit.index]
          const target = hips.worldToLocal(point(arm.hand)).add(hit.delta.clone().divideScalar(fraction).clampLength(0,.045))
          reachArm(arm.upper, arm.lower, arm.hand, hips.localToWorld(target))
        }
        restoreWrist()
      }
      if (inspect(arm).depth > .002) {
        // A radial target can be unreachable or leave the forearm inside. Compare
        // nearby exits and elbow planes; choose the least displacement that clears.
        const initial=[arm.upper,arm.lower,arm.hand].map(n=>n.quaternion.clone())
        const exits=[original.clone().setY(volume.top+handRadius+.09),
          original.clone().setX((Math.sign(original.x)||arm.sign)*(volume.radiusX+handRadius+.09)),
          original.clone().setZ((Math.sign(original.z)||1)*(volume.radiusZ+handRadius+.09)),
          original.clone().setX(arm.sign*(volume.radiusX+handRadius+.09))]
        const up=new Vector3(0,1,0).applyQuaternion(hips.getWorldQuaternion(new Quaternion()))
        let best=initial,bestCost=inspect(arm).depth*1000+hips.worldToLocal(point(arm.hand)).distanceTo(original)
        for(const target of exits)for(const pole of [null,up]){
          ;[arm.upper,arm.lower,arm.hand].forEach((n,i)=>n.quaternion.copy(initial[i]));arm.upper.updateWorldMatrix(true,true)
          reachArm(arm.upper,arm.lower,arm.hand,hips.localToWorld(target.clone()),pole)
          restoreWrist()
          const depth=inspect(arm).depth,shift=hips.worldToLocal(point(arm.hand)).distanceTo(original),cost=depth*1000+shift
          if(cost<bestCost){bestCost=cost;best=[arm.upper,arm.lower,arm.hand].map(n=>n.quaternion.clone())}
        }
        ;[arm.upper,arm.lower,arm.hand].forEach((n,i)=>n.quaternion.copy(best[i]));arm.upper.updateWorldMatrix(true,true)
      }
      restoreWrist()
      arm.offset.copy(hips.worldToLocal(point(arm.hand))).sub(original)
      report.maxHandShift = Math.max(report.maxHandShift, arm.offset.length())
      if (arm.offset.length() > .0001) report.corrected++
    }
    report.remaining = measure()
    return report
  }}
}
