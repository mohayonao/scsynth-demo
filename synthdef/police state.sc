SynthDef("police state", {
  n = 4;
  z = CombL.ar(
		Mix.arFill(n, {
			Pan2.ar(
				SinOsc.ar(
					SinOsc.kr(0.1.rand + 0.02, 2pi.rand, 600.rand, 1000 + 300.rand2),
					0,
					LFNoise2.ar(100 + 20.0.rand2, 0.1)
				),
				1.0.rand2
			)
  })
	+ LFNoise2.ar(LFNoise2.kr([0.4,0.4], 90, 620), LFNoise2.kr([0.3,0.3], 0.15, 0.18)),
  0.3, 0.3, 3);
	Out.ar(0, z);
})
