const gstreamer = require('gstreamer-superficial')
const cv = require('opencv')

if( false ) {
  const pipeline = new gstreamer.Pipeline( 'audiotestsrc ! appsink name=appsink' )
  const pipeline2 = new gstreamer.Pipeline( 'appsrc name=appsrc ! audioconvert ! autoaudiosink' )
  const appsink = pipeline.findChild( 'appsink' )
  const appsrc = pipeline2.findChild( 'appsrc' )
  pipeline.play()
  pipeline2.play()

  pipeline2.pollBus( msg => {
    if( msg.type !== "state-changed") {
      console.log( msg )
    }
  })

  const onPull = ( buf, caps ) => {
    if( buf ) {
      const _caps = Object.entries( caps ).map( ( [key,val] ) => ( key === "name" ? `${val}` : `${key}=${val}`)).join(",") 
      appsrc.caps = _caps

      const outBuf = Buffer.alloc( buf.length )
      //console.log( caps )

      for( let i = 0; i < buf.length / 2; i++ ) {
        const val = buf.readInt16LE( i * 2 )
        const _v = Math.floor( val * 0.2 )
        outBuf.writeInt16LE( _v, i * 2 )
      }
      
      appsrc.push( outBuf )
      appsink.pull( onPull )
    } else {
      setTimeout( () => appsink.pull( onPull ), 200 )
    }
  }
  appsink.pull( onPull )

}



if ( true ) {
  const script = [
    `videotestsrc is-live=true ! videoconvert ! video/x-raw,width=640,height=480,format=BGR ! clockoverlay ! `,
    `appsink name=appsink`
  ].join("\n")

  const outscript = [
    `appsrc name=appsrc ! videoconvert ! autovideosink`
  ].join("\n")

  const pipeline = new gstreamer.Pipeline( script )
  const pipelineOut = new gstreamer.Pipeline( outscript )
  const appsink = pipeline.findChild("appsink")
  const appsrc = pipelineOut.findChild("appsrc")

  pipeline.play()
  pipelineOut.play()

  pipelineOut.pollBus( msg => {
    if( msg.type !== "state-changed") {
      console.log( msg )
    }
  })


  if( appsink ) {
    const onPull = ( buf, caps ) => {
      if( buf ) {
        const _caps = Object.entries( caps )
          .map( ( [key, val] ) => key === "name" ? `${val}` : `${key}=${val}`)
          .join(",")
        appsrc.caps = _caps
        appsrc.push( buf )

        appsink.pull( onPull )
      } else {
        setTimeout( () => {
          console.log('NULL buf')
          appsink.pull( onPull )
        }, 500)
      }
    }
    appsink.pull( onPull )
  }
}

// setInterval(() => {}, 1000)