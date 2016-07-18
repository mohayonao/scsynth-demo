SynthDef("toggle-ff", { |density=2|
  f = ToggleFF.ar(Dust.ar(density)) * 220 + 440;
  a = SinOsc.ar(f, mul: 0.25);
  Out.ar(0, a ! 2);
})
