SynthDef("sync-saw", {
  a = SyncSaw.ar(100, MouseY.kr(100, 800));
  a = a * 0.25;
  Out.ar(0, a ! 2);
})
