"use strict";

const window = global;
const throttle = require("lodash.throttle");
const decoder = require("synthdef-decoder");
const formatter = require("synthdef-json-formatter");
const AudioDriver = require("./AudioDriver");

window.addEventListener("DOMContentLoaded", () => {
  const player = new AudioDriver(new window.Worker("worker-bundle.js"));

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
        this.stop();
        fetchSynthDef(this.selected);
      },
      changeParam() {
        player.setParam(this.param1 / 128, this.param2 / 128);
      },
      play() {
        if (this.isPlaying) {
          return;
        }
        this.isPlaying = true;
        player.play();
      },
      pause() {
        this.isPlaying = false;
        player.pause();
      },
      stop() {
        this.isPlaying = false;
        player.stop();
      }
    }
  });

  const scView = window.document.getElementById("sc-view");
  const jsView = window.document.getElementById("js-view");

  function fetchSynthDef(name) {
    Promise.all([
      window.fetch(`synthdef/${ name }.sc`).then(res => res.text()),
      window.fetch(`synthdef/${ name }.json`).then(res => res.text())
    ]).then(([ sc, json ]) => {
      scView.className = "prettyprint";
      jsView.className = "prettyprint";
      scView.textContent = sc.replace(/\t/g, "  ");
      jsView.textContent = json;
      window.prettyPrint();
      player.setSynthDef(JSON.parse(json));
    });
  }

  window.fetch("synthdef/list.json").then(res => res.json()).then((list) => {
    app.list.push(...list);
    app.selected = list[0];
    app.change();
  });

  const mouseState = { x: 0, y: 0, button: 0 };
  const updateMouseState = throttle(() => {
    player.updateMouseState(mouseState);
  }, 100);

  window.addEventListener("mousedown", () => {
    mouseState.button = 1;
    updateMouseState();
  });
  window.addEventListener("mousemove", (e) => {
    mouseState.x = e.pageX / window.innerWidth;
    mouseState.y = e.pageY / window.innerHeight;
    updateMouseState();
  });
  window.addEventListener("mouseup", () => {
    mouseState.button = 0;
    updateMouseState();
  });

  function dropFile(file) {
    if (!/\.scsyndef$/.test(file.name)) {
      return;
    }

    const reader = new window.FileReader();

    reader.onload = (e) => {
      const synthdef = decoder.decode(e.target.result)[0];
      const json = formatter.format(synthdef);

      scView.className = "prettyprint";
      jsView.className = "prettyprint";
      scView.textContent = "// dropped synthdef";
      jsView.textContent = json;
      window.prettyPrint();
      player.setSynthDef(synthdef);
      app.selected = "";
    };

    reader.readAsArrayBuffer(file);
  }

  window.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  window.addEventListener("drop", (e) => {
    e.preventDefault();
    dropFile(e.dataTransfer.files[0]);
  });
});
