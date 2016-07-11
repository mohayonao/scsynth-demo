"use strict";

const window = global;
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
