SynthDef("moto rev", {
  f = RLPF.ar(LFPulse.ar(SinOsc.kr(0.2, 0, 10, 21), 0.1), 100, 0.1).clip2(0.4);
  Out.ar(0, f);
})
