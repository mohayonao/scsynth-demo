SynthDef("sine-100", {
  a = Array.fill(100, { ExpRand(220, 3520) });
  a = FSinOsc.ar(a);
  a = a.sum * a.size.reciprocal;
  Out.ar(0, a ! 2);
})
