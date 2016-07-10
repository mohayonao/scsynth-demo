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
    context.process();
    buffers[rIndex].set(context.outputs[0], 0);
    buffers[rIndex].set(context.outputs[1], context.outputs[0].length);
    global.postMessage(buffers[rIndex], [ buffers[rIndex].buffer ]);
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
    context = new scsynth.SCContext(data.value);
    buffers = Array.from({ length: data.value.bufferSlots }, () => {
      return new Float32Array(data.value.blockSize * 2);
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
      synth.params.set(data.value);
    }
  }
}
