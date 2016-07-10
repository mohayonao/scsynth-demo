SynthDef("scratchy", {
  f = RHPF.ar(BrownNoise.ar([0.5,0.5], -0.49).max(0) * 20, 5000, 1);
  Out.ar(0, f);
})
