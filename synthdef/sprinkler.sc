SynthDef("sprinkler", {
  f = BPZ2.ar(WhiteNoise.ar(LFPulse.kr(LFPulse.kr(0.09, 0, 0.16, 10, 7), 0, 0.25, 0.1)));
  Out.ar(0, f);
})
