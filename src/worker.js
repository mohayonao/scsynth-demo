"use strict";

require("setimmediate");

const scsynth = require("scsynth");

let context = null;
let synth = null;
let buffers = null;
let rIndex = 0;
let wIndex = 0;
let running = false;

global.onmessage = (e) => {
  recvMessage(e.data);
};

function loop() {
  if (!running) {
    return;
  }
  if (buffers[rIndex]) {
    const buffer = buffers[rIndex];
    const blockSize = context.blockSize;
    const bufferLength = buffer.length / 2;
    const imax = bufferLength / blockSize;

    for (let i = 0; i < imax; i++) {
      context.process();
      buffer.set(context.outputs[0], blockSize * i);
      buffer.set(context.outputs[1], blockSize * i + bufferLength);
    }

    global.postMessage(buffer, [ buffer.buffer ]);
    buffers[rIndex] = null;
    rIndex = (rIndex + 1) % buffers.length;
  }
  setImmediate(loop);
}

function recvMessage(data) {
  if (data instanceof Float32Array) {
    buffers[wIndex] = data;
    wIndex = (wIndex + 1) % buffers.length;
    return;
  }
  if (data.type === "init" && context === null) {
    context = new scsynth.SCContext({ sampleRate: data.value.sampleRate });
    buffers = Array.from({ length: data.value.bufferSlots }, () => {
      return new Float32Array(data.value.bufferLength * 2);
    });
  }
  if (context) {
    if (data.type === "start") {
      running = true;
      loop();
    }
    if (data.type === "stop") {
      running = false;
    }
    if (data.type === "synthdef") {
      if (synth) {
        synth.end();
      }
      synth = context.createSynth(data.value);
      context.addToTail(synth);
    }
    if (data.type === "param" && synth) {
      if (data.value.length <= synth.params.length) {
        synth.params.set(data.value);
      }
    }
  }
}
