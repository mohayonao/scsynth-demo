"use strict";

const AudioContext = global.AudioContext || global.webkitAudioContext;

const BUFFER_SLOTS = 16;
const BUFFER_LENGTH = 512;

class AudioDriver {
  constructor(worker) {
    this.worker = worker;
    this.audioContext = new AudioContext();

    this.buffers = Array.from({ length: BUFFER_SLOTS }, () => null);
    this.rIndex = 0;
    this.wIndex = 0;

    this.worker.postMessage({
      type: "init",
      value: {
        sampleRate: this.audioContext.sampleRate,
        bufferLength: BUFFER_LENGTH,
        bufferSlots: BUFFER_SLOTS
      }
    });

    this.worker.onmessage = (e) => {
      this.recvMessage(e.data);
    };
  }

  recvMessage(data) {
    if (data instanceof Float32Array) {
      this.buffers[this.wIndex] = data;
      this.wIndex = (this.wIndex + 1) % this.buffers.length;
    }
  }

  play() {
    this.buffers.forEach(buffer => buffer && buffer.fill(0));
    if (this.scp) {
      this.scp.disconnect();
    }
    this.scp = this.audioContext.createScriptProcessor(BUFFER_LENGTH, 2, 2);
    this.scp.onaudioprocess = (e) => {
      const buffer = this.buffers[this.rIndex];

      if (buffer === null) {
        return;
      }

      e.outputBuffer.getChannelData(0).set(buffer.subarray(0, BUFFER_LENGTH));
      e.outputBuffer.getChannelData(1).set(buffer.subarray(BUFFER_LENGTH));

      this.worker.postMessage(buffer, [ buffer.buffer ]);
      this.buffers[this.rIndex] = null;
      this.rIndex = (this.rIndex + 1) % this.buffers.length;
    };
    this.scp.connect(this.audioContext.destination);
    this.worker.postMessage({ type: "play" });
  }

  pause() {
    this.buffers.forEach(buffer => buffer && buffer.fill(0));
    if (this.scp) {
      this.scp.disconnect();
      this.scp = null;
    }
    this.worker.postMessage({ type: "pause" });
  }

  stop() {
    this.buffers.forEach(buffer => buffer && buffer.fill(0));
    if (this.scp) {
      this.scp.disconnect();
      this.scp = null;
    }
    this.worker.postMessage({ type: "stop" });
  }

  setSynthDef(synthdef) {
    this.worker.postMessage({ type: "synthdef", value: synthdef });
  }

  setParam(param1, param2) {
    this.worker.postMessage({ type: "param", value: [ param1, param2 ] });
  }
}

module.exports = AudioDriver;
