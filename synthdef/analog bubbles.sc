SynthDef("analog bubbles", {
  // glissando function
  f = LFSaw.kr(0.4, 0, 24, LFSaw.kr([8,7.23], 0, 3, 80)).midicps;
  // echoing sine wave
  f = CombN.ar(SinOsc.ar(f, 0, 0.04), 0.2, 0.2, 4);
  Out.ar(0, f);
})
