from pathlib import Path
import numpy as np
import wave, json, subprocess
P=Path(__file__).resolve().parents[2]
sr=44100;duration=48;n=sr*duration;t=np.arange(n)/sr
rng=np.random.default_rng(2709);mix=np.zeros((n,2))
def place(x,start,gain,pan=0):
 idx=(np.arange(len(x))+round(start*sr))%n
 g=np.array([np.cos((pan+1)*np.pi/4),np.sin((pan+1)*np.pi/4)])*gain
 for c in range(2):np.add.at(mix[:,c],idx,x*g[c])
def hz(m):return 440*2**((m-69)/12)
# Periodic, slowly breathing low register. Integer cycles keep the loop seamless.
for midi,gain in [(38,.048),(45,.015),(50,.010)]:
 f=round(hz(midi)*duration)/duration
 for c in range(2):
  mix[:,c]+=gain*np.sin(2*np.pi*f*t+c*.13)*(0.78+.22*np.cos(2*np.pi*t/duration))
# Air with no rhythmic hiss or sharp transients.
noise=rng.normal(size=n);freq=np.fft.rfftfreq(n,1/sr)
spec=np.fft.rfft(noise);spec*=np.exp(-(freq/850)**2)*(1-np.exp(-(freq/80)**2))
air=np.fft.irfft(spec,n);air=air/max(abs(air))*.017
mix+=air[:,None]*np.array([.85,1])
def piano(midi):
 u=np.arange(sr*10)/sr;f=hz(midi);x=np.zeros_like(u)
 for k,amp in [(1,1),(2,.28),(3,.11),(4,.045)]:
  x+=amp*np.sin(2*np.pi*f*k*(1+.00018*k*k)*u)*np.exp(-u/(3.7/k**.7))
 return x*(1-np.exp(-u/.014))*np.minimum(1,(10-u)/.5)
notes=[(3,62,.15,-.35),(7.5,69,.09,.35),(12,65,.11,-.15),(18,63,.08,.3),(24,62,.13,-.3),(29,57,.10,.2),(34,65,.09,.4),(40,60,.08,-.2)]
for start,note,gain,pan in notes:
 x=piano(note);place(x,start,gain,pan)
 for delay,level in [(.31,.24),(.73,.17),(1.29,.10),(2.13,.055)]:place(x,start+delay,gain*level,-pan)
for start,pan in [(10,.65),(32,-.6)]:
 u=np.arange(sr*9)/sr
 x=sum(a*np.sin(2*np.pi*f*u)*np.exp(-u/decay) for f,a,decay in [(174.6,1,3),(397.3,.2,1.7),(613.1,.08,.8)])
 x*=1-np.exp(-u/.05);place(x,start,.045,pan)
# A distant traffic bed from the project's already credited engine recording.
raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(P/'phaser/assets/audio/vehicles/vehicle-engine-loop-01.wav'),'-af','lowpass=f=380,highpass=f=65','-ar',str(sr),'-ac','1','-f','f32le','-'])
engine=np.frombuffer(raw,dtype='<f4');engine=np.resize(engine,n)
engine=engine/max(abs(engine))*.012
engine*=.45+.55*np.cos(np.pi*t/duration)**2
mix+=engine[:,None]*np.array([1,.7])
# Small circular overlap avoids a click without a recurring fade to silence.
k=round(.08*sr);tail=mix[-k:].copy();a=np.linspace(0,1,k)[:,None]
mix=np.concatenate([tail*(1-a)+mix[:k]*a,mix[k:-k]])
mix*=.52/max(abs(mix).max(),1e-9)
out=P/'phaser/assets/audio/music/after-the-last-light.wav'
with wave.open(str(out),'wb') as w:
 w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes((mix*32767).astype('<i2').tobytes())
print(json.dumps({'duration':duration,'peak':float(abs(mix).max()),'rms':float(np.sqrt(np.mean(mix**2))),'file':str(out)}))