const gstreamer = require('gstreamer-superficial')
const cv = require('opencv')
const fs = require('fs')

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
    `videotestsrc ! videoconvert ! video/x-raw,width=640,height=480,format=BGR ! clockoverlay ! `,
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


  let x = 0, y = 0

  if( appsink ) {
    const onPull = ( buf, caps ) => {
      if( buf ) {
        const mat = new cv.Matrix( caps.height, caps.width, cv.Constants.CV_8UC3 )
        mat.put( buf )
        mat.rectangle( [10,10], [50,50], [0,0,255], 10 )
        const mat2 = mat.copy()
        mat2.resize( 320, 100 )
        mat2.copyTo( mat, x, y, 320, 100 )

        x = ( x + 1 ) % 320
        y = ( y + 10 ) % 300

        const _buf = mat.getData()

        const _caps = Object.entries( caps )
          .map( ( [key, val] ) => key === "name" ? `${val}` : `${key}=${val}`)
          .join(",")
        appsrc.caps = _caps
        appsrc.push( _buf )

        appsink.pull( onPull )
      } else {
        console.log('NULL buf')
        appsink.pull( onPull )
      }
    }
    appsink.pull( onPull )
  }
}

// setInterval(() => {}, 1000)