import Foundation
import CoreAudio
import AudioToolbox
import Darwin

func address(_ selector: AudioObjectPropertySelector) -> AudioObjectPropertyAddress {
 AudioObjectPropertyAddress(mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
}
func checked(_ status: OSStatus, _ stage: String) throws {
 if status != noErr { throw NSError(domain: "KomorebiAudio", code: Int(status), userInfo: [NSLocalizedDescriptionKey: "\(stage) (\(status))"]) }
}
func report(_ value: [String:Any]) {
 if let data=try? JSONSerialization.data(withJSONObject:value) { FileHandle.standardError.write(data);FileHandle.standardError.write(Data([10])) }
}
func neteaseProcesses() throws -> [AudioObjectID] {
 var a=address(kAudioHardwarePropertyProcessObjectList),size:UInt32=0
 try checked(AudioObjectGetPropertyDataSize(AudioObjectID(kAudioObjectSystemObject),&a,0,nil,&size),"Process list")
 var ids=[AudioObjectID](repeating:0,count:Int(size)/MemoryLayout<AudioObjectID>.stride)
 try checked(AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject),&a,0,nil,&size,&ids),"Read processes")
 return ids.filter { id in
  var b=address(kAudioProcessPropertyBundleID),bundle:Unmanaged<CFString>?=nil,bytes=UInt32(MemoryLayout<CFString>.size)
  guard AudioObjectGetPropertyData(id,&b,0,nil,&bytes,&bundle)==noErr else{return false}
  return ((bundle?.takeUnretainedValue() as String?) ?? "").hasPrefix("com.netease.163music")
 }
}

/// Bounded handoff: callback only copies into preallocated memory. Pipe writes run on a timer queue.
final class PCMBuffer {
 let storage:UnsafeMutableRawPointer,capacity:Int,lock=NSLock()
 var used=0,overflow=false
 init(capacity:Int){self.capacity=capacity;storage=UnsafeMutableRawPointer.allocate(byteCount:capacity,alignment:16)}
 deinit{storage.deallocate()}
 func append(_ pointer:UnsafeRawPointer,_ count:Int){
  guard lock.try() else{return};defer{lock.unlock()}
  guard used+count<=capacity else{overflow=true;return}
  storage.advanced(by:used).copyMemory(from:pointer,byteCount:count);used+=count
 }
 func drain()->(Data,Bool){lock.lock();defer{lock.unlock()};let data=Data(bytes:storage,count:used),lost=overflow;used=0;overflow=false;return(data,lost)}
}

@available(macOS 14.2, *)
final class Capture {
 var tap:AudioObjectID=0,device:AudioObjectID=0,io:AudioDeviceIOProcID?,timer:DispatchSourceTimer?
 var buffer:PCMBuffer?,rate:Double=48000
 func start(system:Bool) throws {
  let description: CATapDescription
  if system {
   description = CATapDescription(monoGlobalTapButExcludeProcesses: [])
   description.name = "Komorebi system audio"
  } else {
   let processes=try neteaseProcesses()
   guard !processes.isEmpty else{throw NSError(domain:"KomorebiAudio",code:1,userInfo:[NSLocalizedDescriptionKey:"没有找到网易云音频进程，请先播放音乐。"])}
   description = CATapDescription(monoMixdownOfProcesses:processes)
   description.name = "Komorebi NetEase music"
  }
  description.isPrivate=true;description.muteBehavior = .unmuted
  try checked(AudioHardwareCreateProcessTap(description,&tap),"Create audio tap")
  var fmt=AudioStreamBasicDescription(),formatSize=UInt32(MemoryLayout<AudioStreamBasicDescription>.size),property=address(kAudioTapPropertyFormat)
  try checked(AudioObjectGetPropertyData(tap,&property,0,nil,&formatSize,&fmt),"Read tap format")
  guard fmt.mBitsPerChannel==32 && fmt.mFormatFlags & kAudioFormatFlagIsFloat != 0 && fmt.mChannelsPerFrame==1 else{throw NSError(domain:"KomorebiAudio",code:2,userInfo:[NSLocalizedDescriptionKey:"当前音频格式不支持32位浮点单声道采集。"])}
  rate=fmt.mSampleRate;buffer=PCMBuffer(capacity:Int(rate)*4*2)
  let settings:[String:Any]=[kAudioAggregateDeviceNameKey:system ? "Komorebi private system input" : "Komorebi private music input",kAudioAggregateDeviceUIDKey:UUID().uuidString,kAudioAggregateDeviceIsPrivateKey:true,kAudioAggregateDeviceIsStackedKey:false,kAudioAggregateDeviceTapAutoStartKey:true,kAudioAggregateDeviceTapListKey:[[kAudioSubTapUIDKey:description.uuid.uuidString,kAudioSubTapDriftCompensationKey:true]]]
  try checked(AudioHardwareCreateAggregateDevice(settings as CFDictionary,&device),"Create aggregate")
  try checked(AudioDeviceCreateIOProcID(device,{ _,_,input,_,_,_,context in
   let capture=Unmanaged<Capture>.fromOpaque(context!).takeUnretainedValue()
   let b=input.pointee.mBuffers
   if let p=b.mData,b.mDataByteSize>0{capture.buffer?.append(p,Int(b.mDataByteSize))};return noErr
  },Unmanaged.passUnretained(self).toOpaque(),&io),"Create IO callback")
  report(["type":"format","sampleRate":rate,"channels":1,"format":"f32le","mode":system ? "system" : "netease"])
  try checked(AudioDeviceStart(device,io),"Start audio capture")
  let timer=DispatchSource.makeTimerSource(queue:DispatchQueue(label:system ? "komorebi.system.output" : "komorebi.audio.output",qos:.userInitiated));self.timer=timer
  timer.schedule(deadline:.now(),repeating:.milliseconds(20))
  timer.setEventHandler { [weak self] in
   guard let self=self,let buffer=self.buffer else{return}
   let (data,lost)=buffer.drain();if lost{report(["type":"gap"])}
   if !data.isEmpty{FileHandle.standardOutput.write(data)}
  };timer.resume()
 }
 func stop(){timer?.cancel();timer=nil;if let io=io{AudioDeviceStop(device,io);AudioDeviceDestroyIOProcID(device,io);self.io=nil};if device != 0{AudioHardwareDestroyAggregateDevice(device);device=0};if tap != 0{AudioHardwareDestroyProcessTap(tap);tap=0}}
 deinit{stop()}
}
if #available(macOS 14.2, *) {
 let system=CommandLine.arguments.contains("--system")
 if CommandLine.arguments.contains("--list") {do{report(["type":"sources","count":try neteaseProcesses().count])}catch{report(["type":"error","message":error.localizedDescription]);exit(1)}}
 else {
  let capture=Capture()
  signal(SIGPIPE,SIG_IGN);signal(SIGTERM,SIG_IGN);signal(SIGINT,SIG_IGN)
  do{try capture.start(system:system);let term=DispatchSource.makeSignalSource(signal:SIGTERM,queue:.main);let interrupt=DispatchSource.makeSignalSource(signal:SIGINT,queue:.main);for source in [term,interrupt]{source.setEventHandler{capture.stop();exit(0)};source.resume()};dispatchMain()}catch{capture.stop();report(["type":"error","message":error.localizedDescription]);exit(1)}
 }
}else{report(["type":"error","message":"需要macOS 14.2或更新版本。"]);exit(1)}
