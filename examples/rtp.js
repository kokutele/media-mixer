const gstreamer = require('gstreamer-superficial')
const MediaMixer = require('..')

const width = 384, height = 216
const mediaMixer = new MediaMixer( { rows: 2, cols: 2, width, height })

mediaMixer.start()

const sleep = time => {
  return new Promise( r => setTimeout( r, time ) )
}

const test = async () => {
  const script = [
    `rtpbin name=rtpbin`,
    `  videotestsrc pattern=ball is-live=true ! video/x-raw,width=${width},height=${height} ! videoconvert !`,
    `  vp8enc keyframe-max-dist=30 ! rtpvp8pay ! queue ! rtpbin.send_rtp_sink_0`,
    `  rtpbin.send_rtp_src_0 ! udpsink port=5000`,
    `  rtpbin.send_rtcp_src_0 ! udpsink port=5001`,
    `audiotestsrc is-live=true freq=500 volume=0.25 ! audioresample ! audio/x-raw,rate=48000,channels=1 !`,
    `  opusenc ! rtpopuspay ! queue ! rtpbin.send_rtp_sink_1`,
    `  rtpbin.send_rtp_src_1 ! udpsink port=5002`,
    `  rtpbin.send_rtcp_src_1 ! udpsink port=5003`,
  ].join("\n")

  await sleep( 1000 )
  const id0 = mediaMixer.add({ type: "test", pattern: "snow", freq: 1500 })

  await sleep( 1000 )
  const pipeline = new gstreamer.Pipeline( script )
  pipeline.play()
  const id1 = mediaMixer.add({ type: "rtp", videoRtpPort: 5000, videoRtcpPort: 5001, audioRtpPort: 5002, audioRtcpPort: 5003 })


  await sleep( 1000 )
  const id2 = mediaMixer.add({ type: "test", pattern: "smpte", freq: 750 })
}

test()
