SynthDef("dseq", {
  a = Dseq({ 10.rand } ! 32, inf);
  t = Impulse.ar(MouseX.kr(1, 10000, 1));
  f = Demand.ar(t, 0, a) * 30 + 340;
  z = SinOsc.ar(f) * 0.1;
  Out.ar(0, z ! 2);
})
