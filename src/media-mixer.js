const EventEmittter = require('events')
const gstreamer = require('gstreamer-superficial')
const { nanoid } = require('nanoid')

class Pipeline {
  _id = ''
  _skip = false
  _pipeline = null
  _audioBuffer = null
  _videoBuffer = null

  /**
   * 
   * @param {object} props 
   * @param {string} props.id
   * @param {GstPipeline} props.pipeline
   */
  constructor( props ) {
    this._id = props.id
    this._pipeline = props.pipeline
  }
  
  set audioBuffer( buf ) {
    this._audioBuffer = buf
  }

  set videoBuffer( buf ) {
    this._videoBuffer = buf
  }

  get id() {
    return this._id
  }

  get pipeline() {
    return this._pipeline
  }

  get skip() {
    return this._skip
  }

  /**
   * @param {boolean} flag
   */
  set skip( flag ) {
    this._skip = !!flag
  }

  get audioBuffer() {
    return this._audioBuffer
  }

  get videoBuffer() {
    return this._videoBuffer
  }
}

class MediaMixer extends EventEmittter {
  _rows = 2
  _cols = 2
  _width = 320
  _height = 240
  _background = 'black'
  _type = 'test' // `test` or `rtmp`
  _rtmpUrl = ''
  _showId = true

  _pipelines = [] // Array<Pipeline>
  _coverPipeline = null // Pipeline
  _layouts = [] // Array<{ pipelineId, xpos, ypos, width, height }>

  _sinkVideo = null
  _sinkAudio = null

  constructor( props ) {
    super( props )

    this._type = props.type || 'test'
    this._rtmpUrl = props.rtmpUrl || 'rtmp://localhost/live/test'
    this._showId = props.showId || true
    this._rows = props.rows || 2
    this._cols = props.cols || 2
    this._width = props.width || 384
    this._height = props.height || 216
  }

  start() {
    console.log( `start MediaMixer. width:${this._width}, height: ${this._height}`)
    this._startSinkPipeline()
    this._startBasePipeline()
    this._startEventHandler()

    this._startCoverPipeline()
    this._updateLayouts()
  }

  stop() {
    // todo implement this.
  }

  /**
   * 
   * @param {object} param
   * @param {string} param.type - `test` or `rtp`
   * @param {string} [param.pattern] - case type=`test`, default is `ball`
   * @param {number} [param.freq]    - case type=`test`, default is 500
   * @param {number} [param.videoRtpPort]  - case type=`rtp`, default is 5000
   * @param {number} [param.videoRtcpPort] - case type=`rtp`, default is 5001
   * @param {number} [param.audioRtpPort]  - case type=`rtp`, default is 5002
   * @param {number} [param.audioRtcpPort] - case type=`rtp`, default is 5003
   * @returns 
   */
  add( param ) {
    let pipeline 

    if( param.type === "test" ) {
      const pattern = param.pattern || 'ball'
      const freq    = param.freq    || 500

      pipeline = this._startTestSrcPipeline( pattern, freq )
    } else if( param.type==="rtp" ) {
      const videoRtpPort  = param.videoRtpPort  || 5000
      const videoRtcpPort = param.videoRtcpPort || 5001
      const audioRtpPort  = param.audioRtpPort  || 5002
      const audioRtcpPort = param.audioRtcpPort || 5003

      pipeline = this._startRtpSrcPipeline( videoRtpPort, videoRtcpPort, audioRtpPort, audioRtcpPort )
    } else {
      return null
    }

    this._pipelines.push( pipeline )
    this._updateLayouts()

    return pipeline.id
  }

  delete( id ) {
    const target = this._pipelines.find( o => o.id === id )
    if( target ) {
      target.pipeline.stop()

      this._pipelines = this._pipelines.filter( o => o.id !== id )
      this._updateLayouts()
    }
  }

  skip( id ) {
    const target = this._pipelines.find( o => o.id === id )
    if( target ) {
      target.skip = true
      this._updateLayouts()
    }
  }

  unskip( id ) {
    const target = this._pipelines.find( o => o.id === id )
    if( target ) {
      target.skip = false
      this._updateLayouts()
    }
  }

  toLast( id ) {
    const target = this._pipelines.find( o => o.id === id )
    if( target ) {
      this._pipelines = this._pipelines.filter( o => o.id !== id )
      this._pipelines.push( target )
      this._updateLayouts()
    }
  }

  toFirst( id ) {
    const target = this._pipelines.find( o => o.id === id )
    if( target ) {
      this._pipelines = this._pipelines.filter( o => o.id !== id )
      this._pipelines.unshift( target )
      this._updateLayouts()
    }
  }

  _updateLayouts() {
    this._layouts.length = 0
    const _pipelines = this._pipelines.filter( o => !o.skip )
    const len = _pipelines.length

    for( let i = 0, l = this._cols * this._rows; i < l; i++ ) {
      const pipeline = len === 0 ?  this._coverPipeline : _pipelines[ i % len ]
      const xpos = ( i % this._cols ) * this._width
      const ypos = Math.floor( i / this._cols ) * this._height
      this._layouts.push({ seq: i, pipeline, xpos, ypos, width: this._width, height: this._height })
    }
  }


  _startSinkPipeline() {
    let script
    if( this._type === "rtmp" ) {
      const delay = 100 * 1000 * 1000 // 100msec
      const delayElem = `queue max-size-buffers=0 max-size-time=0 max-size-bytes=0 min-threshold-time=${delay}`
      const videoWidth = this._width * this._cols, videoHeight = this._height * this._rows

      script = [
        `flvmux name=mux streamable=true ! ${delayElem} ! rtmpsink location="${this._rtmpUrl} live=1"`,
        ``,
        `compositor background=0 name=comp`,
        `  sink_0::xpos=0 sink_0::ypos=0 sink_0::width=${videoWidth} sink_0::height=${videoHeight}`,
        `  sink_1::xpos=0 sink_1::ypos=0 sink_1::width=${videoWidth} sink_1::height=${videoHeight}`,
        `! videoconvert ! queue !`,
        `clockoverlay ! videoconvert ! video/x-raw,format=I420 !`,
        `  x264enc key-int-max=60 bitrate=4096 speed-preset=superfast tune=zerolatency ! h264parse ! queue ! mux.`,
        ``,
        `videotestsrc is-live=true ! video/x-raw,width=${videoWidth},height=${videoHeight},format=I420 ! videoconvert ! comp.`,
        `intervideosrc ! queue ! comp. `,
        ``,
        `audiomixer name=mix ! audioresample ! audio/x-raw,rate=44100 ! voaacenc ! queue ! mux.`,
        `audiotestsrc volume=0 ! queue ! mix.`,
        `interaudiosrc ! queue ! mix.`,
        ``,
        `appsrc name=audioSrc ! audioresample ! audio/x-raw,rate=44100 ! queue ! interaudiosink`,
        `appsrc name=videoSrc ! videoconvert ! video/x-raw,format=I420 ! queue ! intervideosink`,
      ].join("\n")
    } else {
      script = [
        `appsrc name=videoSrc ! videoconvert ! queue ! autovideosink`,
        `appsrc name=audioSrc ! audioconvert ! queue ! autoaudiosink`
      ].join("\n")
    }

    const pipeline = new gstreamer.Pipeline( script )
    // pipeline.pollBus( msg => msg.type !== "state-changed" && console.log( msg ))

    this._sinkVideo = pipeline.findChild( 'videoSrc' )
    this._sinkAudio = pipeline.findChild( 'audioSrc' )

    pipeline.play()
  }

  _startBasePipeline() {
    const script = [
      `videotestsrc pattern=${ this._background } ! videoconvert !`,
      `  video/x-raw,width=${this._width * this._cols},height=${this._height * this._rows},format=BGR,framerate=30/1 !`,
      `  appsink name=videoSink max-buffers=1 drop=true`,
      `audiotestsrc volume=0 ! audioresample ! audio/x-raw,rate=48000 ! appsink name=audioSink max-buffers=1 drop=true`,
    ].join("\n")

    const pipeline = new gstreamer.Pipeline( script )
    pipeline.play()

    const videoSink = pipeline.findChild( 'videoSink' )
    const audioSink = pipeline.findChild( 'audioSink' )

    const onVideo = ( buf, caps ) => {
      if( buf ) {
        if( this._sinkVideo.caps === 'NULL' ) {
          const _caps = Object.entries( caps ).map( ( [key, val] ) => key === "name" ? `${val}` : `${key}=${val}`).join(",")
          console.log( _caps )
          this._sinkVideo.caps = _caps
        }
        this.emit( "baseVideo", buf )
        videoSink.pull( onVideo )
      } else {
        setTimeout( () => videoSink.pull( onVideo ))
      }
    }
    videoSink.pull( onVideo )

    const onAudio = ( buf, caps ) => {
      if( buf ) {
        if( this._sinkAudio.caps === 'NULL' ) {
          const _caps = Object.entries( caps ).map( ( [key, val] ) => key === "name" ? `${val}` : `${key}=${val}`).join(",")
          console.log( _caps )
          this._sinkAudio.caps = _caps
        }
        this.emit( "baseAudio", buf )
        audioSink.pull( onAudio )
      } else {
        setTimeout( () => audioSink.pull( onAudio ))
      }
    }
    audioSink.pull( onAudio )
  }

  _startCoverPipeline() {
    const script = [
      `videotestsrc is-live=true !`,
      `  video/x-raw,width=${this._width},height=${this._height},format=BGR !`,
      `  videoconvert !`,
      `  appsink name=videosink`,
    ].join("\n")

    this._coverPipeline = this._createPipeline( script )
  }

  _startTestSrcPipeline( pattern = "ball", freq = 500 ) {
    const script = [
      `videotestsrc pattern=${pattern} is-live=true !`,
      `  video/x-raw,width=${this._width},height=${this._height},format=BGR !`,
      `  videoconvert !`,
      `  textoverlay name=text font-desc="Sans, 32" !`,
      `  appsink name=videosink`,
      `audiotestsrc freq=${freq} volume=0.1 !`,
      `  audioresample ! audio/x-raw,rate=48000 !`,
      `  appsink name=audiosink`
    ].join("\n")
    return this._createPipeline( script )
  }

  _startRtpSrcPipeline( videoRtpPort, videoRtcpPort, audioRtpPort, audioRtcpPort ) {
    const scaleparam = `video/x-raw,width=${this._width + 2},pixel-aspect-ratio=1/1`
    const script = [
      `rtpbin name=rtpbin`,
      ``,
      `udpsrc port=${videoRtpPort} caps="application/x-rtp,media=(string)video,clock-rate=(int)90000,encoding-name=(string)VP8" !`,
      `  rtpbin.recv_rtp_sink_0`,
      `rtpbin. !`,
      `  rtpvp8depay ! vp8dec !`,
      `  videoscale ! ${scaleparam} !`,
      `  videobox autocrop=true ! video/x-raw,width=${this._width},height=${this._height} !`,
      `  queue ! videoconvert ! video/x-raw,format=BGR !`,
      `  textoverlay name=text font-desc="Sans, 32" !`,
      `  appsink name=videosink max-buffers=1 drop=true`,
      `udpsrc port=${videoRtcpPort} !`,
      `  rtpbin.recv_rtcp_sink_0`,
      ``,
      `udpsrc port=${audioRtpPort} caps="application/x-rtp,media=(string)audio,clock-rate=(int)48000,encoding-name=(string)X-GST-OPUS-DRAFT-SPITTKA-00" !`,
      `  rtpbin.recv_rtp_sink_1`,
      `rtpbin. !`,
      `  rtpopusdepay ! opusdec ! audioresample ! audio/x-raw,rate=48000,channels=1 ! queue ! `,
      `  appsink name=audiosink max-buffers=1 drop=true`,
      `udpsrc port=${audioRtcpPort} !`,
      `  rtpbin.recv_rtcp_sink_1`
    ].join("\n")

    return this._createPipeline( script )
  }
  _createPipeline( script ) {
    const id = nanoid()

    const pipeline = new gstreamer.Pipeline( script )
    const textNode = pipeline.findChild("text")
    if( this._showId && textNode ) {
      textNode.text = id
    }
    const _pipeline = new Pipeline({ id, pipeline })

    const videosink = pipeline.findChild('videosink')
    const audiosink = pipeline.findChild('audiosink')

    if( videosink ) {
      const videoPull = buf => {
        if( buf ) {
          _pipeline.videoBuffer = buf
          // video の場合はシンプルにbuf を割り当てる
          videosink.pull( videoPull )
        } else {
          setTimeout( () => {
            videosink.pull( videoPull )
          }, 500 )
        }
      }
      videosink.pull( videoPull )
    }

    let flag = false
    if( audiosink ) {
      const audioPull = ( buf, caps ) => {
        if( buf ) {
          if( !flag ) {
            flag = true
          }
          // audio の場合は、受信した buf を足し合わせる
          if( !_pipeline.audioBuffer ) {
            _pipeline.audioBuffer = buf
          } else {
            _pipeline.audioBuffer = Buffer.concat( [ _pipeline.audioBuffer, buf ] )
          }
          audiosink.pull( audioPull )
        } else {
          audiosink.pull( audioPull )
        }
      }
      audiosink.pull( audioPull )
    }

    pipeline.play()

    return _pipeline
  }

  _startEventHandler() {
    this.on("baseVideo", ( buf ) => {
      this._mixVideo( buf )
      this._sinkVideo.push( buf )
    })

    this.on("baseAudio", ( buf ) => {
      this._mixAudio( buf )
      this._sinkAudio.push( buf )
    })
  }

  _mixVideo( buf ) {
    // todo - move to worker
    const xl = this._width * this._cols
      , yl = this._height * this._rows
      , layouts = this._layouts
      , w = this._width

    let idx = 0
    let item, _idx, videoBuffer // for better performance
    for( let y = 0; y < yl; y++ ) {
      for( let x = 0; x < xl; x += w ) {
        item = layouts.find( o => (
          x >= o.xpos && x < ( o.xpos + o.width ) && y >= o.ypos && y < ( o.ypos + o.height )
        ))
        if( !item || !item.pipeline.videoBuffer ) { 
          idx += w * 3
        } else { 
          _idx = 3 * ( x - item.xpos + item.width * ( y - item.ypos ) )
          videoBuffer = item.pipeline.videoBuffer
          videoBuffer.copy( buf, idx, _idx, _idx + w * 3 )
          idx += w * 3
        }
      }
    }
  }

  _mixAudio( buf ) {
    let v, idx // for better performance

    for( let i = 0, len = buf.length / 2; i < len; i++ ) {
      idx = i * 2
      v = buf.readInt16LE( idx )
      for( const o of this._pipelines ) {
        if( o.audioBuffer && !o.skip && o.audioBuffer.length >= buf.length ) {
          v += o.audioBuffer.readInt16LE( idx )
        }
      }

      if( v > 32767 ) v = 32767
      if( v < -32768 ) v = -32768
      buf.writeInt16LE( v, idx )
    }

    for( const o of this._pipelines ) {
      if( o.audioBuffer ) {
        o.audioBuffer = Buffer.from( o.audioBuffer.subarray( buf.length ) )
      }
    }
  }
}

module.exports = MediaMixer