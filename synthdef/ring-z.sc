SynthDef("ring-z", { |freq = 2000, decayTime=4|
  a = Impulse.ar(MouseX.kr(1, 10)) * 0.25;
  a = Ringz.ar(a, freq, decayTime);
  Out.ar(0, a ! 2);
})
