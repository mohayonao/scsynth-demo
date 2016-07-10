SynthDef("cymbalism", {
  // cymbalism
  var p;
  var z, f1, f2;
  p = 15; // number of partials per channel per 'cymbal'.
	f1 = 500 + 2000.0.rand;
	f2 = 8000.0.rand;
	z = Array.fill(2, {
	  `[  // sine oscil bank specification :
		  y = Array.fill(p, { f1 + f2.rand} ), // frequencies
			nil,                                 // amplitudes default to 1.0
			Array.fill(p, { 1.0 + 4.0.rand })	   // ring times
		]
	});
	z =	Klank.ar(z, Decay.ar(Impulse.ar(3.0.rand + 0.5), 0.004, WhiteNoise.ar(0.03)));
	Out.ar(0, z);
})
