/*
  Worker
  receives a buffer and guess type from extension
*/

// FORMAT Readers
import {YMReader} from './reader/ym.js'
import {FYMReader} from './reader/fym.js'
import {PSGReader} from './reader/psg.js'
import {VTXReader} from './reader/vtx.js'
//import {AYReader} from './reader/ay.js'

let song, dest, sampleRate, msgStack = [], timer

onmessage = function(e) {
  switch (e.data.msg) {
    case undefined: // transfer of the worklet.node.port
      dest = e.data
      dest.onmessage = (e) => {
        console.warn('Worker got from Backend', e) // this should not be in use
      }
      //postMessage({msg:'thanks for transfer'})
      break
    case 'stop': // not used
      stop()
      break
    case 'buf': // receive fetched data and guessed file type from extension
      stop()
      initBuf(e.data.buf, e.data.ext)
      break
    case 'init':
      sampleRate = e.data.a.sampleRate
      /*
      msg('configure', [true, song.clock, e.data.a.sampleRate, song.stereoMode ? song.stereoMode : 'abc'])
      msg('setPan', [0, 0.1, 0]) // what is this panning ?? from ayumi ??
      msg('setPan', [1, 0.5, 0])
      msg('setPan', [2, 0.9, 0])
      
      // fill buffer
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      timer = setInterval(()=>{
        console.log(song)
        msg('regs', song.getNextFrame())
        // if(song.loopCount == 1) loadAndPlayNextSong() // song ended
      },(1000/song.rate))


      //dest.postMessage({msg:'helloFromWorker'})
      */
      break
    case 'config':
      config()
      break
    case 'jump':
      song.frame = e.data.a
      break
    default:
      console.error('Unknown message from Module got: ', e.data)
  }
  
}

function stop() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  msg('stop')
}
function config() {
  msg('configure', [song.mode ? (song.mode != 'AY') : true, song.clock, sampleRate, song.stereoMode ? song.stereoMode : 'acb'])
  /*
  msg('setPan', [0, 0.1, 0]) // what is this panning ?? from ayumi ?? 0.1, 0.5, 0.9 ???
  msg('setPan', [1, 0.5, 0])
  msg('setPan', [2, 0.9, 0])
  */
}
function waitTillReady(cnt) {
  if (cnt == 30) {
    console.log('we waited too long')
    return
  }
  if (song?.frames?.length == 0) {
    setTimeout(()=>{
      waitTillReady(cnt+1)
    },100)
    return
  }
  console.log(`Play`, song)
  config()
  postMessage({msg:'song', song: song})
  startLoop()
}
function startLoop() {
  stop()
  // fill buffer
  timer = setInterval(()=>{
    msg('regs', song.getNextFrame()) // to worklet
    const prog = song.frame / ( (song.frames) ? song.frames.length : song.frameCount )
    postMessage({msg:'progress', a:prog}) // back to main
    if(song.loopCount == 1) {
      postMessage({msg:'songEnd'})
      //song.frame = song.loopFrame ? song.loopFrame : 0
    }
  },(1000/song.rate))
}
function initBuf(b, ext) {
  try {
    switch (ext) {
      // register records
      case 'fym':
      song = new FYMReader(b)
      break
      case '.ym':
      song = new YMReader(b)
      break
      case 'psg':
      song = new PSGReader(b)
      break
      case 'vtx':
      song = new VTXReader(b)
      break
      
      // player mem dumps (also needs z80 emu)
      case '.ay':
      //song = new AYReader(b)
      break
      
      // tracker data
      case 'pt3':
      //song = new PT3Reader(b)
      break
      default:
      // move to come...
    }

    waitTillReady(0)

  } catch(e) {
    // could not decode
    console.warn(e)
    postMessage({msg:'songEnd'}) // simply load next song
  }
}

function msg(cmd,a) { // this is for normal direction = Worker -> Worklet
  // msg
  //console.log('send msg', msgStack.length)
  let msg = {
    msg: cmd,
    a: a
  }

  try {
    while (msgStack.length>0) {
      dest.postMessage( JSON.parse(JSON.stringify(msgStack[0])) )
      msgStack.shift()
    }
    dest.postMessage( JSON.parse(JSON.stringify(msg)) )
  } catch(e) {
    // not ready yet
    // console.log('new msg stack size:', this.msgStack.length)
    msgStack.push( JSON.parse(JSON.stringify(msg)) )
  }
}
