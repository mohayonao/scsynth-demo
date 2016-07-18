SynthDef("impulse", {
  a = Impulse.ar(MouseX.kr(1, 10));
  Out.ar(0, a ! 2);
})
