const {test} = require('node:test')
const assert = require('node:assert/strict')

test('raw hand projection accounts for parent transforms, viewport offset and CSS size', async () => {
  const {Object3D, OrthographicCamera} = await import('three')
  const {projectCharacterAnchors} = await import('../src/effects/character-anchors.mjs')
  const root = new Object3D(), hand = new Object3D()
  root.position.set(.1, .2, 0); hand.position.set(.4, .3, 0); root.add(hand)
  const camera = new OrthographicCamera(-1, 1, 1, -1, .1, 10)
  camera.position.z = 4; camera.updateMatrixWorld(true)
  const anchors = projectCharacterAnchors({humanoid: {getRawBoneNode: name => name === 'leftHand' ? hand : null}},
    camera, {left: 20, top: 66, width: 200, height: 400}, 10)
  assert.equal(anchors.hands.length, 1)
  assert.ok(Math.abs(anchors.hands[0].x - 170) < 1e-8)
  assert.ok(Math.abs(anchors.hands[0].y - 166) < 1e-8)
  assert.equal(anchors.at, 10)
  assert.equal(anchors.head, null)
})

test('hand selection prefers extension and rejects face, offscreen and stale anchors', async () => {
  const {selectFireworkHand} = await import('../src/effects/character-anchors.mjs')
  const rect = {left: 0, top: 0, width: 300, height: 440}
  const anchors = {at: 1, head: {x: 150, y: 120}, chest: {x: 150, y: 190},
    hands: [{side: 'left', x: 145, y: 210}, {side: 'right', x: 230, y: 185}]}
  const selected = selectFireworkHand(anchors, rect, 1.02)
  assert.equal(selected.side, 'right')
  assert.equal(selected.x, 230 / 300)
  assert.equal(selected.y, 185 / 440)
  assert.equal(selectFireworkHand(anchors, rect, 1.3), null)
  anchors.hands = [{side: 'left', x: 150, y: 120}, {side: 'right', x: 330, y: 185}]
  assert.equal(selectFireworkHand(anchors, rect, 1.02), null)
})

test('lowered or tucked hands cannot trigger; a raised or outward gesture can',async()=>{
 const {selectFireworkHand}=await import('../src/effects/character-anchors.mjs')
 const rect={left:0,top:0,width:300,height:440}
 const anchors={at:1,head:{x:150,y:90},chest:{x:150,y:160},hands:[
  {side:'left',x:100,y:240},{side:'right',x:205,y:235}]}
 assert.equal(selectFireworkHand(anchors,rect,1),null,'waist-level movement is not an emitting gesture')
 anchors.hands=[{side:'left',x:145,y:170}]
 assert.equal(selectFireworkHand(anchors,rect,1),null,'hand tucked against torso is skipped')
 anchors.hands=[{side:'left',x:230,y:160}]
 assert.equal(selectFireworkHand(anchors,rect,1).side,'left')
 anchors.hands=[{side:'right',x:210,y:100}]
 assert.equal(selectFireworkHand(anchors,rect,1).side,'right')
})
