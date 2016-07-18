"use strict";

require("setimmediate");

const scsynth = require("scsynth");
const { UI_MOUSE_X, UI_MOUSE_Y, UI_MOUSE_BUTTON } = scsynth.Constants;

let context = null;
let synth = null;
let buffers = null;
let rIndex = 0;
let wIndex = 0;
let synthdef = null;
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
    if (data.type === "play") {
      running = true;
      if (synth === null) {
        synth = context.createSynth(synthdef).appendTo(context);
      }
      loop();
    }
    if (data.type === "pause") {
      running = false;
    }
    if (data.type === "stop") {
      running = false;
      if (synth) {
        synth.close();
      }
      synth = null;
    }
    if (data.type === "synthdef") {
      if (synth) {
        synth.close();
      }
      synthdef = data.value;
      synth = null;
    }
    if (data.type === "params" && synth) {
      const values = Array.prototype.slice.call(data.value, 0, synth.params.length);

      synth.params.set(values);
    }
    if (data.type === "mousestate") {
      context.uiValues[UI_MOUSE_X] = data.value.x;
      context.uiValues[UI_MOUSE_Y] = data.value.y;
      context.uiValues[UI_MOUSE_BUTTON] = data.value.button;
    }
  }
}
