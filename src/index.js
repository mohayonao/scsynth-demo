"use strict";

const window = global;
const AudioContext = window.AudioContext || window.webkitAudioContext;

const BUFFER_SLOTS = 16;
const BLOCK_SIZE = 256;

class WorkerPlayer {
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
        blockSize: BLOCK_SIZE,
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

  start() {
    this.buffers.forEach(buffer => buffer && buffer.fill(0));
    if (this.scp) {
      this.scp.disconnect();
    }
    this.scp = this.audioContext.createScriptProcessor(256, 2, 2);
    this.scp.onaudioprocess = (e) => {
      const buffer = this.buffers[this.rIndex];

      if (buffer === null) {
        return;
      }

      e.outputBuffer.getChannelData(0).set(buffer.subarray(0, BLOCK_SIZE));
      e.outputBuffer.getChannelData(1).set(buffer.subarray(BLOCK_SIZE));

      this.worker.postMessage(this.buffers[this.rIndex], [ this.buffers[this.rIndex].buffer ]);
      this.buffers[this.rIndex] = null;
      this.rIndex = (this.rIndex + 1) % this.buffers.length;
    };
    this.scp.connect(this.audioContext.destination);
    this.worker.postMessage({ type: "start" });
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

window.addEventListener("DOMContentLoaded", () => {
  const player = new WorkerPlayer(new window.Worker("worker-bundle.js"));

  const app = new window.Vue({
    el: "#app",
    data: {
      selected: "",
      list: [],
      param1: 0,
      param2: 0,
      sc: "",
      json: "",
      isPlaying: false
    },
    methods: {
      change() {
        fetchSynthDef(this.selected);
        stop();
      },
      changeParam() {
        player.setParam(this.param1, this.param2);
      },
      start() {
        if (this.isPlaying) {
          return;
        }
        this.isPlaying = true;
        start();
      },
      stop() {
        if (!this.isPlaying) {
          return;
        }
        this.isPlaying = false;
        stop();
      }
    }
  });

  function start() {
    player.start();
  }

  function stop() {
    player.stop();
  }

  function fetchSynthDef(name) {
    Promise.all([
      window.fetch(`synthdef/${ name }.sc`).then(res => res.text()),
      window.fetch(`synthdef/${ name }.json`).then(res => res.text())
    ]).then(([ sc, json ]) => {
      window.document.getElementById("sc-view").textContent = sc.replace(/\t/g, "  ");
      window.document.getElementById("json-view").textContent = json;
      window.prettyPrint();
      player.setSynthDef(JSON.parse(json));
    });
  }

  window.fetch("synthdef/list.json").then(res => res.json()).then((list) => {
    app.list.push(...list);
    app.selected = list[0];
    app.change();
  });
});
