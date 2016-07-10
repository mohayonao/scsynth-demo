(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
"use strict";

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var window = global;
var AudioContext = window.AudioContext || window.webkitAudioContext;

var BUFFER_SLOTS = 16;
var BLOCK_SIZE = 256;

var WorkerPlayer = function () {
  function WorkerPlayer(worker) {
    var _this = this;

    _classCallCheck(this, WorkerPlayer);

    this.worker = worker;
    this.audioContext = new AudioContext();

    this.buffers = Array.from({ length: BUFFER_SLOTS }, function () {
      return null;
    });
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

    this.worker.onmessage = function (e) {
      _this.recvMessage(e.data);
    };
  }

  _createClass(WorkerPlayer, [{
    key: "recvMessage",
    value: function recvMessage(data) {
      if (data instanceof Float32Array) {
        this.buffers[this.wIndex] = data;
        this.wIndex = (this.wIndex + 1) % this.buffers.length;
      }
    }
  }, {
    key: "start",
    value: function start() {
      var _this2 = this;

      this.buffers.forEach(function (buffer) {
        return buffer && buffer.fill(0);
      });
      if (this.scp) {
        this.scp.disconnect();
      }
      this.scp = this.audioContext.createScriptProcessor(256, 2, 2);
      this.scp.onaudioprocess = function (e) {
        var buffer = _this2.buffers[_this2.rIndex];

        if (buffer === null) {
          return;
        }

        e.outputBuffer.getChannelData(0).set(buffer.subarray(0, BLOCK_SIZE));
        e.outputBuffer.getChannelData(1).set(buffer.subarray(BLOCK_SIZE));

        _this2.worker.postMessage(_this2.buffers[_this2.rIndex], [_this2.buffers[_this2.rIndex].buffer]);
        _this2.buffers[_this2.rIndex] = null;
        _this2.rIndex = (_this2.rIndex + 1) % _this2.buffers.length;
      };
      this.scp.connect(this.audioContext.destination);
      this.worker.postMessage({ type: "start" });
    }
  }, {
    key: "stop",
    value: function stop() {
      this.buffers.forEach(function (buffer) {
        return buffer && buffer.fill(0);
      });
      if (this.scp) {
        this.scp.disconnect();
        this.scp = null;
      }
      this.worker.postMessage({ type: "stop" });
    }
  }, {
    key: "setSynthDef",
    value: function setSynthDef(synthdef) {
      this.worker.postMessage({ type: "synthdef", value: synthdef });
    }
  }, {
    key: "setParam",
    value: function setParam(param1, param2) {
      this.worker.postMessage({ type: "param", value: [param1, param2] });
    }
  }]);

  return WorkerPlayer;
}();

window.addEventListener("DOMContentLoaded", function () {
  var player = new WorkerPlayer(new window.Worker("worker-bundle.js"));

  var app = new window.Vue({
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
      change: function change() {
        fetchSynthDef(this.selected);
        _stop();
      },
      changeParam: function changeParam() {
        player.setParam(this.param1, this.param2);
      },
      start: function start() {
        if (this.isPlaying) {
          return;
        }
        this.isPlaying = true;
        _start();
      },
      stop: function stop() {
        if (!this.isPlaying) {
          return;
        }
        this.isPlaying = false;
        _stop();
      }
    }
  });

  function _start() {
    player.start();
  }

  function _stop() {
    player.stop();
  }

  var scView = window.document.getElementById("sc-view");
  var jsView = window.document.getElementById("js-view");

  function fetchSynthDef(name) {
    Promise.all([window.fetch("synthdef/" + name + ".sc").then(function (res) {
      return res.text();
    }), window.fetch("synthdef/" + name + ".json").then(function (res) {
      return res.text();
    })]).then(function (_ref) {
      var _ref2 = _slicedToArray(_ref, 2);

      var sc = _ref2[0];
      var json = _ref2[1];

      scView.className = "prettyprint";
      jsView.className = "prettyprint";
      scView.textContent = sc.replace(/\t/g, "  ");
      jsView.textContent = json;
      window.prettyPrint();
      player.setSynthDef(JSON.parse(json));
    });
  }

  window.fetch("synthdef/list.json").then(function (res) {
    return res.json();
  }).then(function (list) {
    var _app$list;

    (_app$list = app.list).push.apply(_app$list, _toConsumableArray(list));
    app.selected = list[0];
    app.change();
  });
});

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[1]);
