const MediaMixer = require('..')

const mediaMixer = new MediaMixer( { 
  type: 'rtmp', 
  rows: 5, 
  cols: 5, 
  width: 384, 
  height: 216 
})

mediaMixer.start()

const sleep = time => {
  return new Promise( r => setTimeout( r, time ) )
}

const test = async () => {
  await sleep( 10000 )
  const id0 = mediaMixer.add({ type: "test", pattern: "ball", freq: 800 })

  await sleep( 10000 )
  const id1 = mediaMixer.add({ type: "test", pattern: "ball", freq: 800 })

  await sleep( 10000 )
  const id2 = mediaMixer.add({ type: "test", pattern: "pinwheel", freq: 2000 })

  await sleep( 10000 )
  const id3 = mediaMixer.add({ type: "test", pattern: "checkers-2", freq: 1100 })

  await sleep( 10000 )
  const id4 = mediaMixer.add({ type: "test", pattern: "snow", freq: 1500 })
}

test()