SynthDef("bank of resonators excited by impulses", {
  // Klank - bank of resonators excited by impulses
  n = 5;	// number of simultaneous instruments
  p = 15;	// number of partials per instrument
  z = `[	// filter bank specification :
        Array.fill(p, { 80 + 10000.0.linrand} ),	// frequencies
        Array.fill(p, { 1.0.rand2 }), 			// amplitudes
        Array.fill(p, { 0.2 + 8.0.rand } )		// ring times
  ];
	f = Pan2.ar(Klank.ar(z, Dust.ar(0.7, 0.04)), 1.0.rand2);
	Out.ar(0, f);
})
