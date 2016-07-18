SynthDef("mouse", {
  f = MouseX.kr(1760, 220);
  y = MouseY.kr();
  a = LFPulse.kr(20, 0, y);
  z = RLPF.ar(PinkNoise.ar(), f, 0.01) * a;
  Out.ar(0, z ! 2);
})
