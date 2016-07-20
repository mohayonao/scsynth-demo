(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
module.exports = function nmap(n, map) {
  var result = new Array(n);

  for (var i = 0; i < n; i++) {
    result[i] = map(result[i], i, result);
  }

  return result;
};

},{}],3:[function(require,module,exports){
"use strict";

module.exports.RATE_SCALAR = 0;
module.exports.RATE_CONTROL = 1;
module.exports.RATE_AUDIO = 2;
module.exports.RATE_DEMAND = 3;

module.exports.UI_KEY_STATE = 0;
module.exports.UI_MOUSE_BUTTON = 1;
module.exports.UI_MOUSE_X = 2;
module.exports.UI_MOUSE_Y = 3;
},{}],4:[function(require,module,exports){
"use strict";

module.exports = {
  sampleRate: 44100,
  blockSize: 64,
  numberOfChannels: 2,
  numberOfAudioBus: 16,
  numberOfControlBus: 128
};
},{}],5:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var nmap = require("nmap");
var util = require("./util");
var fill = require("./util/fill");
var DefaultConfig = require("./DefaultConfig");
var SCGraphNode = require("./SCGraphNode");
var SCSynth = require("./SCSynth");
var SCRate = require("./SCRate");

var BYTES_PER_ELEMENT = Float32Array.BYTES_PER_ELEMENT;

var SCContext = function () {
  function SCContext(opts) {
    var _this = this;

    _classCallCheck(this, SCContext);

    opts = Object.assign({}, DefaultConfig, opts);

    this.sampleRate = util.toValidSampleRate(opts.sampleRate);
    this.blockSize = util.toValidBlockSize(opts.blockSize);
    this.numberOfChannels = util.toValidNumberOfChannels(opts.numberOfChannels);
    this.numberOfAudioBus = util.toValidNumberOfAudioBus(opts.numberOfAudioBus);
    this.numberOfControlBus = util.toValidNumberOfControlBus(opts.numberOfControlBus);

    var audioBusLength = this.numberOfAudioBus * this.blockSize;
    var controlBusLength = this.numberOfControlBus;

    this.bus = new Float32Array(audioBusLength + controlBusLength);
    this.audioBuses = nmap(this.numberOfAudioBus, function (_, ch) {
      return new Float32Array(_this.bus.buffer, ch * _this.blockSize * BYTES_PER_ELEMENT, _this.blockSize);
    });
    this.controlBuses = nmap(this.numberOfControlBus, function (_, ch) {
      return new Float32Array(_this.bus.buffer, (audioBusLength + ch) * BYTES_PER_ELEMENT, 1);
    });
    this.uiValues = new Float32Array(10);

    this.inputs = [];
    this.outputs = nmap(this.numberOfChannels, function (_, ch) {
      return _this.audioBuses[ch];
    });

    this.root = new SCGraphNode(this);
    this.root.parent = this; // state hacking
    this.aRate = new SCRate(this.sampleRate, this.blockSize);
    this.kRate = new SCRate(this.sampleRate / this.blockSize, 1);
  }

  _createClass(SCContext, [{
    key: "createSynth",
    value: function createSynth(synthdef) {
      var synth = new SCSynth(this);

      synth.build(synthdef);

      return synth;
    }
  }, {
    key: "createGroup",
    value: function createGroup() {
      return new SCGraphNode(this);
    }
  }, {
    key: "append",
    value: function append(node) {
      this.root.append(node);
      return this;
    }
  }, {
    key: "prepend",
    value: function prepend(node) {
      this.root.prepend(node);
      return this;
    }
  }, {
    key: "process",
    value: function process() {
      fill(this.bus, 0);
      this.root.process(this.blockSize);
    }
  }]);

  return SCContext;
}();

module.exports = SCContext;
},{"./DefaultConfig":4,"./SCGraphNode":6,"./SCRate":8,"./SCSynth":9,"./util":215,"./util/fill":213,"nmap":2}],6:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var events = require("events");
var _doneAction = require("./SCGraphNodeDoneAction");

var STATE_CLOSED = 0;
var STATE_RUNNING = 1;
var STATE_SUSPENDED = 2;
var STATES = ["closed", "running", "suspended"];

var SCGraphNode = function (_events$EventEmitter) {
  _inherits(SCGraphNode, _events$EventEmitter);

  function SCGraphNode(context) {
    _classCallCheck(this, SCGraphNode);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(SCGraphNode).call(this));

    _this.context = context;
    _this.parent = null;
    _this.prev = null;
    _this.next = null;
    _this.head = null;
    _this.tail = null;

    _this._state = STATE_RUNNING;
    return _this;
  }

  _createClass(SCGraphNode, [{
    key: "append",
    value: function append(node) {
      this._checkNode(node);
      node.parent = this;
      node.prev = this.tail;
      node.next = null;
      if (this.tail) {
        this.tail.next = node;
        this.tail = node;
      } else {
        this.head = this.tail = node;
      }
      return this;
    }
  }, {
    key: "appendTo",
    value: function appendTo(node) {
      node.append(this);
      return this;
    }
  }, {
    key: "prepend",
    value: function prepend(node) {
      this._checkNode(node);
      node.parent = this;
      node.prev = null;
      node.next = this.head;
      if (this.head) {
        this.head.prev = node;
        this.head = node;
      } else {
        this.head = this.tail = node;
      }
      return this;
    }
  }, {
    key: "prependTo",
    value: function prependTo(node) {
      node.prepend(this);
      return this;
    }
  }, {
    key: "before",
    value: function before(node) {
      this._checkNode(node);
      node.parent = this.parent;
      node.prev = this.prev;
      node.next = this;
      if (this.prev) {
        this.prev.next = node;
      } else if (node.parent) {
        node.parent.head = node;
      }
      this.prev = node;
      return this;
    }
  }, {
    key: "insertBefore",
    value: function insertBefore(node) {
      node.before(this);
      return this;
    }
  }, {
    key: "after",
    value: function after(node) {
      this._checkNode(node);
      node.parent = this.parent;
      node.prev = this;
      node.next = this.next;
      if (this.next) {
        this.next.prev = node;
      } else if (node.parent) {
        node.parent.tail = node;
      }
      this.next = node;
      return this;
    }
  }, {
    key: "insertAfter",
    value: function insertAfter(node) {
      node.after(this);
      return this;
    }
  }, {
    key: "replace",
    value: function replace(node) {
      node.after(this).remove();
      return this;
    }
  }, {
    key: "remove",
    value: function remove() {
      if (this.prev) {
        this.prev.next = this.next;
      }
      if (this.next) {
        this.next.prev = this.prev;
      }
      if (this.parent) {
        if (this.parent.head === this) {
          this.parent.head = this.next;
        }
        if (this.parent.tail === this) {
          this.parent.tail = this.prev;
        }
      }
      this.parent = null;
      this.prev = null;
      this.next = null;
      this.head = null;
      this.tail = null;
      return this;
    }
  }, {
    key: "suspend",
    value: function suspend() {
      if (this._state === STATE_RUNNING) {
        this._state = STATE_SUSPENDED;
        this.emit("statechange");
      }
      return this;
    }
  }, {
    key: "resume",
    value: function resume() {
      if (this._state === STATE_SUSPENDED) {
        this._state = STATE_RUNNING;
        this.emit("statechange");
      }
      return this;
    }
  }, {
    key: "close",
    value: function close() {
      if (this._state !== STATE_CLOSED) {
        this.remove();
        this._state = STATE_CLOSED;
        this.emit("statechange");
      }
      return this;
    }
  }, {
    key: "closeAll",
    value: function closeAll() {
      var node = this.head;
      while (node) {
        var next = node.next;
        node.close();
        node = next;
      }
      this.close();
      return this;
    }
  }, {
    key: "closeDeep",
    value: function closeDeep() {
      var node = this.head;
      while (node) {
        var next = node.next;
        node.closeDeep();
        node = next;
      }
      this.close();
      return this;
    }
  }, {
    key: "doneAction",
    value: function doneAction(action) {
      if (typeof _doneAction[action] === "function") {
        _doneAction[action](this);
      }
    }
  }, {
    key: "process",
    value: function process(inNumSamples) {
      if (this._state === STATE_RUNNING) {
        if (this.head) {
          this.head.process(inNumSamples);
        }
        if (this.dspProcess) {
          this.dspProcess(inNumSamples);
        }
      }
      if (this.next) {
        this.next.process(inNumSamples);
      }
    }

    // FIXME: rename!!!

  }, {
    key: "_checkNode",
    value: function _checkNode(node) {
      if (node.context !== this.context) {
        throw new TypeError("cannot append to a node belonging to a different context");
      }
      if (node.parent || node.prev || node.next) {
        throw new TypeError("node is already a partially element of another graph");
      }
    }
  }, {
    key: "state",
    get: function get() {
      return STATES[this._state];
    }
  }]);

  return SCGraphNode;
}(events.EventEmitter);

module.exports = SCGraphNode;
},{"./SCGraphNodeDoneAction":7,"events":1}],7:[function(require,module,exports){
"use strict";

var doneAction = [];

// do nothing when the UGen is finished
doneAction[0] = null;

// pause the enclosing synth, but do not free it
doneAction[1] = function (node) {
  node.suspend();
};

// free the enclosing synth
doneAction[2] = function (node) {
  node.close();
};

// free both this synth and the preceding node
doneAction[3] = function (node) {
  if (node.prev) {
    node.prev.close();
  }
  node.close();
};

// free both this synth and the following node
doneAction[4] = function (node) {
  if (node.next) {
    node.next.close();
  }
  node.close();
};

// free this synth; if the preceding node is a group then do g_freeAll on it, else free it
doneAction[5] = function (node) {
  if (node.prev) {
    node.prev.closeAll();
  }
  node.close();
};

// free this synth; if the following node is a group then do g_freeAll on it, else free it
doneAction[6] = function (node) {
  if (node.next) {
    node.next.closeAll();
  }
  node.close();
};

// free this synth and all preceding nodes in this group
doneAction[7] = function (node) {
  var prev = void 0;
  while (node) {
    prev = node.prev;
    node.close();
    node = prev;
  }
};

// free this synth and all following nodes in this group
doneAction[8] = function (node) {
  var next = void 0;
  while (node) {
    next = node.next;
    node.close();
    node = next;
  }
};

// free this synth and pause the preceding node
doneAction[9] = function (node) {
  if (node.prev) {
    node.prev.suspend();
  }
  node.close();
};

// free this synth and pause the following node
doneAction[10] = function (node) {
  if (node.next) {
    node.next.suspend();
  }
  node.close();
};

// free this synth and if the preceding node is a group then do g_deepFree on it, else free it
doneAction[11] = function (node) {
  if (node.prev) {
    node.prev.closeDeep();
  }
  node.close();
};

// free this synth and if the following node is a group then do g_deepFree on it, else free it
doneAction[12] = function (node) {
  if (node.next) {
    node.next.closeDeep();
  }
  node.close();
};

// free this synth and all other nodes in this group (before and after)
doneAction[13] = function (node) {
  if (node.parent) {
    node = node.parent.head;
    while (node) {
      var next = node.next;
      node.close();
      node = next;
    }
  }
};

// free the enclosing group and all nodes within it (including this synth)
doneAction[14] = function (node) {
  if (node.parent) {
    node.parent.closeDeep();
  }
};

module.exports = doneAction;
},{}],8:[function(require,module,exports){
"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SCRate = function SCRate(sampleRate, bufferLength) {
  _classCallCheck(this, SCRate);

  this.sampleRate = sampleRate;
  this.sampleDur = 1 / sampleRate;
  this.radiansPerSample = Math.PI * 2 / sampleRate;
  this.bufferLength = bufferLength;
  this.bufferDuration = bufferLength / sampleRate;
  this.bufferRate = 1 / this.bufferDuration;
  this.slopeFactor = 1 / bufferLength;
  this.filterLoops = bufferLength / 3 | 0;
  this.filterRemain = bufferLength % 3 | 0;
  if (this.filterLoops === 0) {
    this.filterSlope = 0;
  } else {
    this.filterSlope = 1 / this.filterLoops;
  }
};

module.exports = SCRate;
},{}],9:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCGraphNode = require("./SCGraphNode");
var SCSynthBuilder = require("./SCSynthBuilder");

var SCSynth = function (_SCGraphNode) {
  _inherits(SCSynth, _SCGraphNode);

  function SCSynth(context) {
    _classCallCheck(this, SCSynth);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(SCSynth).call(this, context));

    _this.synthdef = null;
    _this.paramIndices = null;
    _this.consts = null;
    _this.params = null;
    _this.buffer = null;
    _this.unitList = null;
    return _this;
  }

  _createClass(SCSynth, [{
    key: "build",
    value: function build(synthdef) {
      var _this2 = this;

      if (this.synthdef !== null) {
        throw new TypeError("synth has be already built");
      }
      this.synthdef = synthdef;
      this.paramIndices = synthdef.paramIndices;

      SCSynthBuilder.build(this, synthdef);

      Object.keys(this.paramIndices).forEach(function (name) {
        Object.defineProperty(_this2, "$" + name, {
          set: function set(value) {
            this.setParam(name, value);
          },
          get: function get() {
            return this.getParam(name);
          },

          enumerable: true, configurable: true
        });
      });
    }
  }, {
    key: "setParam",
    value: function setParam(key, value) {
      if (!this.paramIndices.hasOwnProperty(key)) {
        throw new TypeError("param name is not defined: " + key);
      }
      if (this.paramIndices[key].length === 1) {
        this.params[this.paramIndices[key].index] = value;
      } else {
        this.params.set(value, this.paramIndices[key].index);
      }
    }
  }, {
    key: "getParam",
    value: function getParam(key) {
      if (!this.paramIndices.hasOwnProperty(key)) {
        throw new TypeError("param name is not defined: " + key);
      }
      if (this.paramIndices[key].length === 1) {
        return this.params[this.paramIndices[key].index];
      } else {
        return this.params.subarray(this.paramIndices[key].index, this.paramIndices[key].index + this.paramIndices[key].length);
      }
    }
  }, {
    key: "dspProcess",
    value: function dspProcess() {
      var dspUnitList = this.dspUnitList;

      for (var i = 0, imax = dspUnitList.length; i < imax; i++) {
        dspUnitList[i].dspProcess(dspUnitList[i].bufferLength);
      }
    }
  }]);

  return SCSynth;
}(SCGraphNode);

module.exports = SCSynth;
},{"./SCGraphNode":6,"./SCSynthBuilder":10}],10:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var C = require("./Constants");
var SCUnitRepository = require("./SCUnitRepository");

var CONSTANT_VALUE = -1;
var BYTES_PER_ELEMENT = Float32Array.BYTES_PER_ELEMENT;

var SCSynthBuilder = function () {
  function SCSynthBuilder() {
    _classCallCheck(this, SCSynthBuilder);
  }

  _createClass(SCSynthBuilder, null, [{
    key: "build",
    value: function build(synthInstance, synthdef) {
      var context = synthInstance.context;
      var consts = synthdef.consts.map(function (x) {
        return new Float32Array([x]);
      });
      var params = new Float32Array(synthdef.paramValues);
      var bufferLength = synthdef.units.reduce(function (sum, unitSpec) {
        return sum + unitSpec[4].reduce(function (sum, rate) {
          return sum + $rate(context, rate).bufferLength;
        }, 0);
      }, 0);
      var buffer = new Float32Array(bufferLength);
      var unitList = [];
      var dspUnitList = [];

      synthInstance.consts = consts;
      synthInstance.params = params;
      synthInstance.buffer = buffer;
      synthInstance.unitList = unitList;
      synthInstance.dspUnitList = dspUnitList;

      var unitSpecs = synthdef.units;

      var bufferOffset = 0;

      for (var i = 0, imax = unitSpecs.length; i < imax; i++) {
        var unitSpec = unitSpecs[i];
        var inputSpecs = unitSpec[3];
        var outputSpecs = unitSpec[4];
        var unit = SCUnitRepository.createSCUnit(synthInstance, unitSpec);

        for (var j = 0, jmax = unit.inputs.length; j < jmax; j++) {
          var inputSpec = inputSpecs[j];

          if (inputSpec[0] === CONSTANT_VALUE) {
            unit.inputs[j] = consts[inputSpec[1]];
            unit.inputSpecs[j].rate = C.RATE_SCALAR;
          } else {
            unit.inputs[j] = unitList[inputSpec[0]].outputs[inputSpec[1]];
            unit.inputSpecs[j].rate = unitList[inputSpec[0]].outputSpecs[inputSpec[1]].rate;
            unit.inputSpecs[j].unit = unitList[inputSpec[0]];
          }
        }
        for (var _j = 0, _jmax = unit.outputs.length; _j < _jmax; _j++) {
          var outputSpec = outputSpecs[_j];
          var _bufferLength = $rate(context, outputSpec).bufferLength;

          unit.outputs[_j] = new Float32Array(buffer.buffer, bufferOffset * BYTES_PER_ELEMENT, _bufferLength);
          unit.outputSpecs[_j].rate = outputSpec;

          bufferOffset += _bufferLength;
        }

        var rate = $rate(context, unit.calcRate);

        unit.bufferLength = rate.bufferLength;
        unit.initialize(rate);

        unitList[i] = unit;

        if (unit.dspProcess && unit.calcRate !== C.RATE_DEMAND) {
          dspUnitList.push(unit);
        }
      }

      return synthInstance;
    }
  }]);

  return SCSynthBuilder;
}();

function $rate(context, rate) {
  return rate === C.RATE_AUDIO ? context.aRate : context.kRate;
}

module.exports = SCSynthBuilder;
},{"./Constants":3,"./SCUnitRepository":12}],11:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SCUnit = function () {
  function SCUnit(synth, unitSpec) {
    _classCallCheck(this, SCUnit);

    this.context = synth.context;
    this.synth = synth;
    this.name = unitSpec[0];
    this.calcRate = unitSpec[1];
    this.specialIndex = unitSpec[2];
    this.inputs = new Array(unitSpec[3].length);
    this.outputs = new Array(unitSpec[4].length);
    this.inputSpecs = unitSpec[3].map(function () {
      return { rate: 0, unit: null };
    });
    this.outputSpecs = unitSpec[4].map(function () {
      return { rate: 0 };
    });
    this.bufferLength = 0;
    this.dspProcess = null;
    this.done = false;
  }

  _createClass(SCUnit, [{
    key: "initialize",
    value: function initialize() {}
  }, {
    key: "doneAction",
    value: function doneAction(action) {
      this.synth.doneAction(action);
    }
  }]);

  return SCUnit;
}();

module.exports = SCUnit;
},{}],12:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var db = {};

var SCUnitRepository = function () {
  function SCUnitRepository() {
    _classCallCheck(this, SCUnitRepository);
  }

  _createClass(SCUnitRepository, null, [{
    key: "createSCUnit",
    value: function createSCUnit(synth, unitSpec) {
      var name = unitSpec[0];

      if (!db.hasOwnProperty(name)) {
        throw new TypeError("SCUnit is not defined: " + name);
      }

      return new db[name](synth, unitSpec);
    }
  }, {
    key: "registerSCUnitClass",
    value: function registerSCUnitClass(name, SCUnitClass) {
      db[name] = SCUnitClass;
    }
  }, {
    key: "unregisterSCUnitClass",
    value: function unregisterSCUnitClass(name) {
      delete db[name];
    }
  }]);

  return SCUnitRepository;
}();

module.exports = SCUnitRepository;
},{}],13:[function(require,module,exports){
"use strict";

var Constants = require("./Constants");
var SCContext = require("./SCContext");
var SCGraphNode = require("./SCGraphNode");
var SCSynth = require("./SCSynth");
var SCUnit = require("./SCUnit");
var SCUnitRepository = require("./SCUnitRepository");
var unit = require("./unit");

module.exports = { Constants: Constants, SCContext: SCContext, SCGraphNode: SCGraphNode, SCSynth: SCSynth, SCUnit: SCUnit, SCUnitRepository: SCUnitRepository, unit: unit };
},{"./Constants":3,"./SCContext":5,"./SCGraphNode":6,"./SCSynth":9,"./SCUnit":11,"./SCUnitRepository":12,"./unit":211}],14:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitA2K = function (_SCUnit) {
  _inherits(SCUnitA2K, _SCUnit);

  function SCUnitA2K() {
    _classCallCheck(this, SCUnitA2K);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitA2K).apply(this, arguments));
  }

  _createClass(SCUnitA2K, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["a"];
    }
  }]);

  return SCUnitA2K;
}(SCUnit);

dspProcess["a"] = function () {
  this.outputs[0][0] = this.inputs[0][0];
};

SCUnitRepository.registerSCUnitClass("A2K", SCUnitA2K);

module.exports = SCUnitA2K;
},{"../SCUnit":11,"../SCUnitRepository":12}],15:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitAPF = function (_SCUnit) {
  _inherits(SCUnitAPF, _SCUnit);

  function SCUnitAPF() {
    _classCallCheck(this, SCUnitAPF);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitAPF).apply(this, arguments));
  }

  _createClass(SCUnitAPF, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._b1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._x1 = 0;
      this._x2 = 0;
      this._freq = NaN;
      this._reson = NaN;
      this.dspProcess(1);
    }
  }]);

  return SCUnitAPF;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var reson = Math.max(0, Math.min(this.inputs[2][0], 1));
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  var x1 = this._x1;
  var x2 = this._x2;
  if (freq !== this._freq && reson !== this._reson) {
    var b1_next = 2 * reson * Math.cos(freq * this._radiansPerSample);
    var b2_next = -(reson * reson);
    var b1_slope = (b1_next - b1) * this._slopeFactor;
    var b2_slope = (b2_next - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var x0 = inIn[i];
      var y0 = x0 + (b1 + b1_slope * i) * (y1 - x1) + (b2 + b2_slope * i) * (y2 - x2);
      out[i] = y0;
      y2 = y1;
      y1 = y0;
      x2 = x1;
      x1 = x0;
    }
    this._freq = freq;
    this._reson = reson;
    this._b1 = b1_next;
    this._b2 = b2_next;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _x = inIn[_i];
      var _y = _x + b1 * (y1 - x1) + b2 * (y2 - x2);
      out[_i] = _y;
      y2 = y1;
      y1 = _y;
      x2 = x1;
      x1 = _x;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
  this._x1 = x1;
  this._x2 = x2;
};
SCUnitRepository.registerSCUnitClass("APF", SCUnitAPF);
module.exports = SCUnitAPF;
},{"../SCUnit":11,"../SCUnitRepository":12}],16:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var delay = require("./_delay");
var toPowerOfTwo = require("../util/toPowerOfTwo");
var sc_cubicinterp = require("../util/sc_cubicinterp");
var clamp = require("../util/clamp");
var dspProcess = {};

var SCUnitAllpassC = function (_SCUnit) {
  _inherits(SCUnitAllpassC, _SCUnit);

  function SCUnitAllpassC() {
    _classCallCheck(this, SCUnitAllpassC);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitAllpassC).apply(this, arguments));
  }

  _createClass(SCUnitAllpassC, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["kk"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._maxdelaytime = this.inputs[1][0];
      this._delaytime = this.inputs[2][0];
      this._decaytime = this.inputs[3][0];
      this._fdelaylen = toPowerOfTwo(this._maxdelaytime * this._sampleRate + 1 + this.bufferLength);
      this._idelaylen = this._fdelaylen;
      this._dlybuf = new Float32Array(this._fdelaylen);
      this._mask = this._fdelaylen - 1;
      this._dsamp = clamp(this._delaytime * this._sampleRate, 1, this._fdelaylen);
      this._iwrphase = 0;
      this._feedbk = delay.feedback(this._delaytime, this._decaytime);
    }
  }]);

  return SCUnitAllpassC;
}(SCUnit);

dspProcess["kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var delaytime = this.inputs[2][0];
  var decaytime = this.inputs[3][0];
  var dlybuf = this._dlybuf;
  var mask = this._mask;
  var dsamp = this._dsamp;
  var feedbk = this._feedbk;
  var iwrphase = this._iwrphase;
  var irdphase = void 0;
  if (delaytime === this._delaytime) {
    var frac = dsamp - (dsamp | 0);
    irdphase = iwrphase - (dsamp | 0);
    if (decaytime === this._decaytime) {
      for (var i = 0; i < inNumSamples; i++) {
        var d0 = dlybuf[irdphase + 1 & mask];
        var d1 = dlybuf[irdphase & mask];
        var d2 = dlybuf[irdphase - 1 & mask];
        var d3 = dlybuf[irdphase - 2 & mask];
        var value = sc_cubicinterp(frac, d0, d1, d2, d3) || 0;
        var dwr = value * feedbk + inIn[i] || 0;
        dlybuf[iwrphase & mask] = dwr;
        out[i] = value - feedbk * dwr;
        irdphase++;
        iwrphase++;
      }
    } else {
      var nextFeedbk = delay.feedback(delaytime, decaytime);
      var feedbkSlope = (nextFeedbk - feedbk) * this._slopeFactor;
      for (var _i = 0; _i < inNumSamples; _i++) {
        var _d = dlybuf[irdphase + 1 & mask];
        var _d2 = dlybuf[irdphase & mask];
        var _d3 = dlybuf[irdphase - 1 & mask];
        var _d4 = dlybuf[irdphase - 2 & mask];
        var _value = sc_cubicinterp(frac, _d, _d2, _d3, _d4) || 0;
        var _dwr = _value * feedbk + inIn[_i] || 0;
        dlybuf[iwrphase & mask] = _dwr;
        out[_i] = _value - feedbk * _dwr;
        feedbk += feedbkSlope;
        irdphase++;
        iwrphase++;
      }
      this._feedbk = nextFeedbk;
      this._decaytime = decaytime;
    }
  } else {
    var nextDsamp = clamp(delaytime * this._sampleRate, 1, this._fdelaylen);
    var dsampSlope = (nextDsamp - dsamp) * this._slopeFactor;
    var _nextFeedbk = delay.feedback(delaytime, decaytime);
    var _feedbkSlope = (_nextFeedbk - feedbk) * this._slopeFactor;
    for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
      irdphase = iwrphase - (dsamp | 0);
      var _frac = dsamp - (dsamp | 0);
      var _d5 = dlybuf[irdphase + 1 & mask];
      var _d6 = dlybuf[irdphase & mask];
      var _d7 = dlybuf[irdphase - 1 & mask];
      var _d8 = dlybuf[irdphase - 2 & mask];
      var _value2 = sc_cubicinterp(_frac, _d5, _d6, _d7, _d8) || 0;
      var _dwr2 = _value2 * feedbk + inIn[_i2] || 0;
      dlybuf[iwrphase & mask] = _dwr2;
      out[_i2] = _value2 - feedbk * _dwr2;
      dsamp += dsampSlope;
      feedbk += _feedbkSlope;
      irdphase++;
      iwrphase++;
    }
    this._feedbk = feedbk;
    this._dsamp = dsamp;
    this._delaytime = delaytime;
    this._decaytime = decaytime;
  }
  this._iwrphase = iwrphase;
};
SCUnitRepository.registerSCUnitClass("AllpassC", SCUnitAllpassC);
module.exports = SCUnitAllpassC;
},{"../SCUnit":11,"../SCUnitRepository":12,"../util/clamp":212,"../util/sc_cubicinterp":216,"../util/toPowerOfTwo":222,"./_delay":208}],17:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var delay = require("./_delay");
var toPowerOfTwo = require("../util/toPowerOfTwo");
var clamp = require("../util/clamp");
var dspProcess = {};

var SCUnitAllpassL = function (_SCUnit) {
  _inherits(SCUnitAllpassL, _SCUnit);

  function SCUnitAllpassL() {
    _classCallCheck(this, SCUnitAllpassL);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitAllpassL).apply(this, arguments));
  }

  _createClass(SCUnitAllpassL, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["kk"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._maxdelaytime = this.inputs[1][0];
      this._delaytime = this.inputs[2][0];
      this._decaytime = this.inputs[3][0];
      this._fdelaylen = toPowerOfTwo(this._maxdelaytime * this._sampleRate + 1 + this.bufferLength);
      this._idelaylen = this._fdelaylen;
      this._dlybuf = new Float32Array(this._fdelaylen);
      this._mask = this._fdelaylen - 1;
      this._dsamp = clamp(this._delaytime * this._sampleRate, 1, this._fdelaylen);
      this._iwrphase = 0;
      this._feedbk = delay.feedback(this._delaytime, this._decaytime);
    }
  }]);

  return SCUnitAllpassL;
}(SCUnit);

dspProcess["kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var delaytime = this.inputs[2][0];
  var decaytime = this.inputs[3][0];
  var dlybuf = this._dlybuf;
  var mask = this._mask;
  var dsamp = this._dsamp;
  var feedbk = this._feedbk;
  var iwrphase = this._iwrphase;
  var irdphase = void 0;
  if (delaytime === this._delaytime) {
    var frac = dsamp - (dsamp | 0);
    irdphase = iwrphase - (dsamp | 0);
    if (decaytime === this._decaytime) {
      for (var i = 0; i < inNumSamples; i++) {
        var d1 = dlybuf[irdphase & mask];
        var d2 = dlybuf[irdphase - 1 & mask];
        var value = d1 + frac * (d2 - d1) || 0;
        var dwr = value * feedbk + inIn[i] || 0;
        dlybuf[iwrphase & mask] = dwr;
        out[i] = value - feedbk * dwr;
        irdphase++;
        iwrphase++;
      }
    } else {
      var nextFeedbk = delay.feedback(delaytime, decaytime);
      var feedbkSlope = (nextFeedbk - feedbk) * this._slopeFactor;
      for (var _i = 0; _i < inNumSamples; _i++) {
        var _d = dlybuf[irdphase & mask];
        var _d2 = dlybuf[irdphase - 1 & mask];
        var _value = _d + frac * (_d2 - _d) || 0;
        var _dwr = _value * feedbk + inIn[_i] || 0;
        dlybuf[iwrphase & mask] = _dwr;
        out[_i] = _value - feedbk * _dwr;
        feedbk += feedbkSlope;
        irdphase++;
        iwrphase++;
      }
      this._feedbk = nextFeedbk;
      this._decaytime = decaytime;
    }
  } else {
    var nextDsamp = clamp(delaytime * this._sampleRate, 1, this._fdelaylen);
    var dsampSlope = (nextDsamp - dsamp) * this._slopeFactor;
    var _nextFeedbk = delay.feedback(delaytime, decaytime);
    var _feedbkSlope = (_nextFeedbk - feedbk) * this._slopeFactor;
    for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
      irdphase = iwrphase - (dsamp | 0);
      var _frac = dsamp - (dsamp | 0);
      var _d3 = dlybuf[irdphase & mask];
      var _d4 = dlybuf[irdphase - 1 & mask];
      var _value2 = _d3 + _frac * (_d4 - _d3) || 0;
      var _dwr2 = _value2 * feedbk + inIn[_i2] || 0;
      dlybuf[iwrphase & mask] = _dwr2;
      out[_i2] = _value2 - feedbk * _dwr2;
      dsamp += dsampSlope;
      feedbk += _feedbkSlope;
      irdphase++;
      iwrphase++;
    }
    this._feedbk = feedbk;
    this._dsamp = dsamp;
    this._delaytime = delaytime;
    this._decaytime = decaytime;
  }
  this._iwrphase = iwrphase;
};
SCUnitRepository.registerSCUnitClass("AllpassL", SCUnitAllpassL);
module.exports = SCUnitAllpassL;
},{"../SCUnit":11,"../SCUnitRepository":12,"../util/clamp":212,"../util/toPowerOfTwo":222,"./_delay":208}],18:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var delay = require("./_delay");
var toPowerOfTwo = require("../util/toPowerOfTwo");
var clamp = require("../util/clamp");
var dspProcess = {};

var SCUnitAllpassN = function (_SCUnit) {
  _inherits(SCUnitAllpassN, _SCUnit);

  function SCUnitAllpassN() {
    _classCallCheck(this, SCUnitAllpassN);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitAllpassN).apply(this, arguments));
  }

  _createClass(SCUnitAllpassN, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["kk"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._maxdelaytime = this.inputs[1][0];
      this._delaytime = this.inputs[2][0];
      this._decaytime = this.inputs[3][0];
      this._fdelaylen = toPowerOfTwo(this._maxdelaytime * this._sampleRate + 1 + this.bufferLength);
      this._idelaylen = this._fdelaylen;
      this._dlybuf = new Float32Array(this._fdelaylen);
      this._mask = this._fdelaylen - 1;
      this._dsamp = clamp(this._delaytime * this._sampleRate, 1, this._fdelaylen);
      this._iwrphase = 0;
      this._feedbk = delay.feedback(this._delaytime, this._decaytime);
    }
  }]);

  return SCUnitAllpassN;
}(SCUnit);

dspProcess["kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var delaytime = this.inputs[2][0];
  var decaytime = this.inputs[3][0];
  var dlybuf = this._dlybuf;
  var mask = this._mask;
  var dsamp = this._dsamp;
  var feedbk = this._feedbk;
  var iwrphase = this._iwrphase;
  var irdphase = void 0;
  if (delaytime === this._delaytime) {
    irdphase = iwrphase - (dsamp | 0);
    if (decaytime === this._decaytime) {
      for (var i = 0; i < inNumSamples; i++) {
        var value = dlybuf[irdphase & mask] || 0;
        var dwr = value * feedbk + inIn[i] || 0;
        dlybuf[iwrphase & mask] = dwr;
        out[i] = value - feedbk * dwr;
        irdphase++;
        iwrphase++;
      }
    } else {
      var nextFeedbk = delay.feedback(delaytime, decaytime);
      var feedbkSlope = (nextFeedbk - feedbk) * this._slopeFactor;
      for (var _i = 0; _i < inNumSamples; _i++) {
        var _value = dlybuf[irdphase & mask] || 0;
        var _dwr = _value * feedbk + inIn[_i] || 0;
        dlybuf[iwrphase & mask] = _dwr;
        out[_i] = _value - feedbk * _dwr;
        feedbk += feedbkSlope;
        irdphase++;
        iwrphase++;
      }
      this._feedbk = nextFeedbk;
      this._decaytime = decaytime;
    }
  } else {
    var nextDsamp = clamp(delaytime * this._sampleRate, 1, this._fdelaylen);
    var dsampSlope = (nextDsamp - dsamp) * this._slopeFactor;
    var _nextFeedbk = delay.feedback(delaytime, decaytime);
    var _feedbkSlope = (_nextFeedbk - feedbk) * this._slopeFactor;
    for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
      irdphase = iwrphase - (dsamp | 0);
      var _value2 = dlybuf[irdphase & mask] || 0;
      var _dwr2 = _value2 * feedbk + inIn[_i2] || 0;
      dlybuf[iwrphase & mask] = _dwr2;
      out[_i2] = _value2 - feedbk * _dwr2;
      dsamp += dsampSlope;
      feedbk += _feedbkSlope;
      irdphase++;
      iwrphase++;
    }
    this._feedbk = feedbk;
    this._dsamp = dsamp;
    this._delaytime = delaytime;
    this._decaytime = decaytime;
  }
  this._iwrphase = iwrphase;
};
SCUnitRepository.registerSCUnitClass("AllpassN", SCUnitAllpassN);
module.exports = SCUnitAllpassN;
},{"../SCUnit":11,"../SCUnitRepository":12,"../util/clamp":212,"../util/toPowerOfTwo":222,"./_delay":208}],19:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitAmpComp = function (_SCUnit) {
  _inherits(SCUnitAmpComp, _SCUnit);

  function SCUnitAmpComp() {
    _classCallCheck(this, SCUnitAmpComp);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitAmpComp).apply(this, arguments));
  }

  _createClass(SCUnitAmpComp, [{
    key: "initialize",
    value: function initialize() {

      if (this.inputSpecs[1].rate === C.RATE_SCALAR && this.inputSpecs[2].rate === C.RATE_SCALAR) {
        this.dspProcess = dspProcess["aii"];

        var exp = this.inputs[2][0];

        this._rootmul = Math.pow(this.inputs[1][0], exp) || 0;
        this._exponent = -1 * exp;
      } else {
        this.dspProcess = dspProcess["akk"];
      }

      this.dspProcess(1);
    }
  }]);

  return SCUnitAmpComp;
}(SCUnit);

dspProcess["akk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freqIn = this.inputs[0];
  var root = this.inputs[1][0];
  var xb = this.inputs[2][0];

  for (var i = 0; i < inNumSamples; i++) {
    var xa = root / freqIn[i];

    out[i] = xa >= 0 ? Math.pow(xa, xb) : -Math.pow(-xa, xb);
  }
};

dspProcess["aii"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freqIn = this.inputs[0];
  var rootmul = this._rootmul;
  var xb = this._exponent;

  for (var i = 0; i < inNumSamples; i++) {
    var xa = freqIn[i];

    out[i] = (xa >= 0 ? Math.pow(xa, xb) : -Math.pow(-xa, xb)) * rootmul;
  }
};

SCUnitRepository.registerSCUnitClass("AmpComp", SCUnitAmpComp);

module.exports = SCUnitAmpComp;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],20:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var AMPCOMP_K = 3.5041384 * 10e15;
var AMPCOMP_C1 = 20.598997 * 20.598997;
var AMPCOMP_C2 = 107.65265 * 107.65265;
var AMPCOMP_C3 = 737.86223 * 737.86223;
var AMPCOMP_C4 = 12194.217 * 12194.217;
var AMPCOMP_MINLEVEL = -0.1575371167435;

var SCUnitAmpCompA = function (_SCUnit) {
  _inherits(SCUnitAmpCompA, _SCUnit);

  function SCUnitAmpCompA() {
    _classCallCheck(this, SCUnitAmpCompA);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitAmpCompA).apply(this, arguments));
  }

  _createClass(SCUnitAmpCompA, [{
    key: "initialize",
    value: function initialize() {

      this.dspProcess = dspProcess["aiii"];

      var rootFreq = this.inputs[1][0];
      var rootLevel = calcLevel(rootFreq);
      var minLevel = this.inputs[2][0];

      this._scale = (this.inputs[3][0] - minLevel) / (rootLevel - AMPCOMP_MINLEVEL);
      this._offset = minLevel - this._scale * AMPCOMP_MINLEVEL;

      this.dspProcess(1);
    }
  }]);

  return SCUnitAmpCompA;
}(SCUnit);

function calcLevel(freq) {
  var r = freq * freq;
  var n1 = AMPCOMP_C1 + r;
  var n2 = AMPCOMP_C4 + r;

  var level = AMPCOMP_K * r * r * r * r;

  level = level / (n1 * n1 * (AMPCOMP_C2 + r) * (AMPCOMP_C3 + r) * n2 * n2);
  level = 1 - Math.sqrt(level);

  return level;
}

dspProcess["aiii"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freqIn = this.inputs[0];
  var scale = this._scale;
  var offset = this._offset;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = calcLevel(freqIn[i]) * scale + offset;
  }
};

SCUnitRepository.registerSCUnitClass("AmpCompA", SCUnitAmpCompA);

module.exports = SCUnitAmpCompA;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],21:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var log1 = Math.log(0.1);

var SCUnitAmplitude = function (_SCUnit) {
  _inherits(SCUnitAmplitude, _SCUnit);

  function SCUnitAmplitude() {
    _classCallCheck(this, SCUnitAmplitude);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitAmplitude).apply(this, arguments));
  }

  _createClass(SCUnitAmplitude, [{
    key: "initialize",
    value: function initialize(rate) {

      if (this.calcRate !== C.RATE_AUDIO && this.inputSpecs[0].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["akk/atok"];
      } else {
        this.dspProcess = dspProcess["akk"];
      }

      var clamp = this.inputs[1][0];
      var relax = this.inputs[2][0];

      this._sampleRate = rate.sampleRate;
      this._fullBufferLength = this.context.aRate.bufferLength;
      this._clampCoef = clamp ? Math.exp(log1 / (clamp * this._sampleRate)) : 0;
      this._relaxCoef = relax ? Math.exp(log1 / (relax * this._sampleRate)) : 0;
      this._prevClamp = clamp;
      this._prevRelax = relax;
      this._prevIn = Math.abs(this.inputs[0][0]);

      this.dspProcess(1);
    }
  }]);

  return SCUnitAmplitude;
}(SCUnit);

dspProcess["akk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var clamp = this.inputs[1][0];
  var relax = this.inputs[2][0];

  if (clamp !== this._prevClamp) {
    this._clampCoef = clamp ? Math.exp(log1 / (clamp * this._sampleRate)) : 0;
    this._prevClamp = clamp;
  }
  if (relax !== this._prevRelax) {
    this._relaxCoef = relax ? Math.exp(log1 / (relax * this._sampleRate)) : 0;
    this._prevRelax = relax;
  }

  var clampCoef = this._clampCoef;
  var relaxCoef = this._relaxCoef;

  var val = 0;
  var prevIn = this._prevIn;

  for (var i = 0; i < inNumSamples; i++) {
    val = Math.abs(inIn[i]);

    if (val < prevIn) {
      val += (prevIn - val) * relaxCoef;
    } else {
      val += (prevIn - val) * clampCoef;
    }

    out[i] = prevIn = val;
  }

  this._prevIn = prevIn;
};

dspProcess["akk/atok"] = function (inNumSamples) {
  var inIn = this.inputs[0];
  var clamp = this.inputs[1][0];
  var relax = this.inputs[2][0];

  if (clamp !== this._prevClamp) {
    this._clampCoef = clamp ? Math.exp(log1 / (clamp * this._sampleRate)) : 0;
    this._prevClamp = clamp;
  }
  if (relax !== this._prevRelax) {
    this._relaxCoef = relax ? Math.exp(log1 / (relax * this._sampleRate)) : 0;
    this._prevRelax = relax;
  }

  var clampCoef = this._clampCoef;
  var relaxCoef = this._relaxCoef;

  var val = 0;
  var prevIn = this._prevIn;

  for (var i = 0; i < inNumSamples; i++) {
    val = Math.abs(inIn[i]);

    if (val < prevIn) {
      val += (prevIn - val) * relaxCoef;
    } else {
      val += (prevIn - val) * clampCoef;
    }

    prevIn = val;
  }

  this.outputs[0][0] = val;
  this._prevIn = prevIn;
};

SCUnitRepository.registerSCUnitClass("Amplitude", SCUnitAmplitude);

module.exports = SCUnitAmplitude;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],22:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitBPF = function (_SCUnit) {
  _inherits(SCUnitBPF, _SCUnit);

  function SCUnitBPF() {
    _classCallCheck(this, SCUnitBPF);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitBPF).apply(this, arguments));
  }

  _createClass(SCUnitBPF, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._a0 = 0;
      this._b1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._freq = NaN;
      this._bw = NaN;
      this.dspProcess(1);
    }
  }]);

  return SCUnitBPF;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var bw = this.inputs[2][0];
  var a0 = this._a0;
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  if (freq !== this._freq || bw !== this._bw) {
    var pfreq = freq * this._radiansPerSample;
    var pbw = bw * pfreq * 0.5;
    var C = pbw ? 1 / Math.tan(pbw) : 0;
    var D = 2 * Math.cos(pfreq);
    var next_a0 = 1 / (1 + C);
    var next_b1 = C * D * next_a0;
    var next_b2 = (1 - C) * next_a0;
    var a0_slope = (next_a0 - a0) * this._slopeFactor;
    var b1_slope = (next_b1 - b1) * this._slopeFactor;
    var b2_slope = (next_b2 - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var y0 = inIn[i] + (b1 + b1_slope * i) * y1 + (b2 + b2_slope * i) * y2;
      out[i] = (a0 + a0_slope * i) * (y0 - y2);
      y2 = y1;
      y1 = y0;
    }
    this._freq = freq;
    this._bw = bw;
    this._a0 = next_a0;
    this._b1 = next_b1;
    this._b2 = next_b2;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y = inIn[_i] + b1 * y1 + b2 * y2;
      out[_i] = a0 * (_y - y2);
      y2 = y1;
      y1 = _y;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("BPF", SCUnitBPF);
module.exports = SCUnitBPF;
},{"../SCUnit":11,"../SCUnitRepository":12}],23:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitBPZ2 = function (_SCUnit) {
  _inherits(SCUnitBPZ2, _SCUnit);

  function SCUnitBPZ2() {
    _classCallCheck(this, SCUnitBPZ2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitBPZ2).apply(this, arguments));
  }

  _createClass(SCUnitBPZ2, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._x1 = this.inputs[0][0];
      this._x2 = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitBPZ2;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var x1 = this._x1;
  var x2 = this._x2;
  for (var i = 0; i < inNumSamples; i++) {
    var x0 = inIn[i];
    out[i] = (x0 - x2) * 0.25;
    x2 = x1;
    x1 = x0;
  }
  this._x1 = x1;
  this._x2 = x2;
};
SCUnitRepository.registerSCUnitClass("BPZ2", SCUnitBPZ2);
module.exports = SCUnitBPZ2;
},{"../SCUnit":11,"../SCUnitRepository":12}],24:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitBRF = function (_SCUnit) {
  _inherits(SCUnitBRF, _SCUnit);

  function SCUnitBRF() {
    _classCallCheck(this, SCUnitBRF);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitBRF).apply(this, arguments));
  }

  _createClass(SCUnitBRF, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._a0 = 0;
      this._a1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._freq = NaN;
      this._bw = NaN;
      this.dspProcess(1);
    }
  }]);

  return SCUnitBRF;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var bw = this.inputs[2][0];
  var a0 = this._a0;
  var a1 = this._a1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  if (freq !== this._freq || bw !== this._bw) {
    var pfreq = freq * this._radiansPerSample;
    var pbw = bw * pfreq * 0.5;
    var C = Math.tan(pbw);
    var D = 2 * Math.cos(pfreq);
    var next_a0 = 1 / (1 + C);
    var next_a1 = -D * next_a0;
    var next_b2 = (1 - C) * next_a0;
    var a0_slope = (next_a0 - a0) * this._slopeFactor;
    var a1_slope = (next_a1 - a1) * this._slopeFactor;
    var b2_slope = (next_b2 - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var ay = (a1 + a1_slope * i) * y1;
      var y0 = inIn[i] - ay - (b2 + b2_slope * i) * y2;
      out[i] = (a0 + a0_slope * i) * (y0 + y2) + ay;
      y2 = y1;
      y1 = y0;
    }
    this._freq = freq;
    this._bw = bw;
    this._a0 = next_a0;
    this._a1 = next_a1;
    this._b2 = next_b2;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _ay = a1 * y1;
      var _y = inIn[_i] - _ay - b2 * y2;
      out[_i] = a0 * (_y + y2) + _ay;
      y2 = y1;
      y1 = _y;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("BRF", SCUnitBRF);
module.exports = SCUnitBRF;
},{"../SCUnit":11,"../SCUnitRepository":12}],25:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitBRZ2 = function (_SCUnit) {
  _inherits(SCUnitBRZ2, _SCUnit);

  function SCUnitBRZ2() {
    _classCallCheck(this, SCUnitBRZ2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitBRZ2).apply(this, arguments));
  }

  _createClass(SCUnitBRZ2, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._x1 = this.inputs[0][0];
      this._x2 = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitBRZ2;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var x1 = this._x1;
  var x2 = this._x2;
  for (var i = 0; i < inNumSamples; i++) {
    var x0 = inIn[i];
    out[i] = (x0 + x2) * 0.25;
    x2 = x1;
    x1 = x0;
  }
  this._x1 = x1;
  this._x2 = x2;
};
SCUnitRepository.registerSCUnitClass("BRZ2", SCUnitBRZ2);
module.exports = SCUnitBRZ2;
},{"../SCUnit":11,"../SCUnitRepository":12}],26:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var clamp = require("../util/clamp");
var sine = require("./_sine");

var gSine = sine.gSine;
var dspProcess = {};

var SCUnitBalance2 = function (_SCUnit) {
  _inherits(SCUnitBalance2, _SCUnit);

  function SCUnitBalance2() {
    _classCallCheck(this, SCUnitBalance2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitBalance2).apply(this, arguments));
  }

  _createClass(SCUnitBalance2, [{
    key: "initialize",
    value: function initialize(rate) {

      if (this.inputSpecs[2].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["aaak"];
      } else {
        this.dspProcess = dspProcess["aakk"];
      }

      var ipos = void 0;

      this._slopeFactor = rate.slopeFactor;
      this._pos = this.inputs[2][0];
      this._level = this.inputs[3][0];

      ipos = 1024 * this._pos + 1024 + 0.5 | 0;
      ipos = clamp(ipos, 0, 2048);

      this._leftAmp = this._level * gSine[2048 - ipos];
      this._rightAmp = this._level * gSine[ipos];

      this.dspProcess(1);
    }
  }]);

  return SCUnitBalance2;
}(SCUnit);

dspProcess["aaak"] = function (inNumSamples) {
  var leftOut = this.outputs[0];
  var rightOut = this.outputs[1];
  var leftIn = this.inputs[0];
  var rightIn = this.inputs[1];
  var posIn = this.inputs[2];
  var level = this._level;
  var next_level = this.inputs[3][0];

  var ipos = void 0;

  if (level !== next_level) {
    var level_slope = (next_level - level) * this._slopeFactor;

    for (var i = 0; i < inNumSamples; i++) {
      ipos = 1024 * posIn[i] + 1024 + 0.5 | 0;
      ipos = clamp(ipos, 0, 2048);

      var amp = level + level_slope * i;
      var leftAmp = amp * gSine[2048 - ipos];
      var rightAmp = amp * gSine[ipos];

      leftOut[i] = leftIn[i] * leftAmp;
      rightOut[i] = rightIn[i] * rightAmp;
    }

    this._level = next_level;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      ipos = 1024 * posIn[_i] + 1024 + 0.5 | 0;
      ipos = clamp(ipos, 0, 2048);

      leftOut[_i] = leftIn[_i] * level * gSine[2048 - ipos];
      rightOut[_i] = rightIn[_i] * level * gSine[ipos];
    }
  }
};

dspProcess["aakk"] = function (inNumSamples) {
  var leftOut = this.outputs[0];
  var rightOut = this.outputs[1];
  var leftIn = this.inputs[0];
  var rightIn = this.inputs[1];
  var next_pos = this.inputs[2][0];
  var next_level = this.inputs[3][0];
  var leftAmp = this._leftAmp;
  var rightAmp = this._rightAmp;

  var ipos = void 0;

  if (this._pos !== next_pos || this._level !== next_level) {
    ipos = 1024 * next_pos + 1024 + 0.5 | 0;
    ipos = clamp(ipos, 0, 2048);

    var next_leftAmp = next_level * gSine[2048 - ipos];
    var next_rightAmp = next_level * gSine[ipos];
    var leftAmp_slope = (next_leftAmp - this._leftAmp) * this._slopeFactor;
    var rightAmp_slope = (next_rightAmp - this._rightAmp) * this._slopeFactor;

    for (var i = 0; i < inNumSamples; i++) {
      leftOut[i] = leftIn[i] * (leftAmp + leftAmp_slope * i);
      rightOut[i] = rightIn[i] * (rightAmp + rightAmp_slope * i);
    }

    this._pos = next_pos;
    this._level = next_level;
    this._leftAmp = next_leftAmp;
    this._rightAmp = next_rightAmp;
  } else {
    for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
      leftOut[_i2] = leftIn[_i2] * leftAmp;
      rightOut[_i2] = rightIn[_i2] * rightAmp;
    }
  }
};

SCUnitRepository.registerSCUnitClass("Balance2", SCUnitBalance2);

module.exports = SCUnitBalance2;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"../util/clamp":212,"./_sine":210}],27:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var sc_wrap = require("../util/sc_wrap");
var sc_fold = require("../util/sc_fold");
var sc_exprandrange = require("../util/sc_exprandrange");
var sc_randrange = require("../util/sc_randrange");
var $i2n = "\n+ - * / / % eq ne lt gt le ge min max bitAnd bitOr bitXor lcm gcd round roundUp trunc atan2 hypot\nhypotApx pow leftShift rightShift unsignedRightShift fill ring1 ring2 ring3 ring4 difsqr sumsqr\nsqrsum sqrdif absdif thresh amclip scaleneg clip2 excess fold2 wrap2 firstarg randrange exprandrange\nnumbinaryselectors".trim().split(/\s/);
var dspProcess = {};

var SCUnitBinaryOpUGen = function (_SCUnit) {
  _inherits(SCUnitBinaryOpUGen, _SCUnit);

  function SCUnitBinaryOpUGen() {
    _classCallCheck(this, SCUnitBinaryOpUGen);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitBinaryOpUGen).apply(this, arguments));
  }

  _createClass(SCUnitBinaryOpUGen, [{
    key: "initialize",
    value: function initialize(rate) {
      var dspFunc = dspProcess[$i2n[this.specialIndex]];

      if (!dspFunc) {
        throw new Error("BinaryOpUGen[" + $i2n[this.specialIndex] + "] is not defined.");
      }

      if (this.calcRate === C.RATE_DEMAND) {
        this.dspProcess = dspFunc["dd"];
      } else {
        this.dspProcess = dspFunc[$r2k(this)];

        this._slopeFactor = rate.slopeFactor;
        this._a = this.inputs[0][0];
        this._b = this.inputs[1][0];

        this.outputs[0][0] = dspFunc(this._a, this._b);
      }
    }
  }]);

  return SCUnitBinaryOpUGen;
}(SCUnit);

function $r2k(unit) {
  return unit.inputSpecs.map(function (_ref) {
    var rate = _ref.rate;

    if (rate === C.RATE_AUDIO) {
      return "a";
    }
    return rate === C.RATE_SCALAR ? "i" : "k";
  }).join("");
}

function gcd(a, b) {
  a = Math.floor(a);
  b = Math.floor(b);
  while (b !== 0) {
    var _ref2 = [b, a % b];
    a = _ref2[0];
    b = _ref2[1];
  }
  return Math.abs(a);
}

dspProcess["+"] = function (a, b) {
  return a + b;
};
dspProcess["-"] = function (a, b) {
  return a - b;
};
dspProcess["*"] = function (a, b) {
  return a * b;
};
dspProcess["/"] = function (a, b) {
  return b === 0 ? 0 : a / b;
};
dspProcess["%"] = function (a, b) {
  return b === 0 ? 0 : a % b;
};
dspProcess["eq"] = function (a, b) {
  return a === b ? 1 : 0;
};
dspProcess["ne"] = function (a, b) {
  return a !== b ? 1 : 0;
};
dspProcess["lt"] = function (a, b) {
  return a < b ? 1 : 0;
};
dspProcess["gt"] = function (a, b) {
  return a > b ? 1 : 0;
};
dspProcess["le"] = function (a, b) {
  return a <= b ? 1 : 0;
};
dspProcess["ge"] = function (a, b) {
  return a >= b ? 1 : 0;
};
dspProcess["min"] = function (a, b) {
  return Math.min(a, b);
};
dspProcess["max"] = function (a, b) {
  return Math.max(a, b);
};
dspProcess["bitAnd"] = function (a, b) {
  return a & b;
};
dspProcess["bitOr"] = function (a, b) {
  return a | b;
};
dspProcess["bitXor"] = function (a, b) {
  return a ^ b;
};
dspProcess["lcm"] = function (a, b) {
  if (a === 0 && b === 0) {
    return 0;
  }
  return Math.abs(a * b) / gcd(a, b);
};
dspProcess["gcd"] = function (a, b) {
  return gcd(a, b);
};
dspProcess["round"] = function (a, b) {
  return b === 0 ? a : Math.round(a / b) * b;
};
dspProcess["roundUp"] = function (a, b) {
  return b === 0 ? a : Math.ceil(a / b) * b;
};
dspProcess["trunc"] = function (a, b) {
  return b === 0 ? a : Math.floor(a / b) * b;
};
dspProcess["atan2"] = function (a, b) {
  return Math.atan2(a, b);
};
dspProcess["hypot"] = function (a, b) {
  return Math.hypot(a, b);
};
dspProcess["hypotApx"] = function (a, b) {
  var x = Math.abs(a);
  var y = Math.abs(b);
  var minxy = Math.min(x, y);

  return x + y - (Math.sqrt(2) - 1) * minxy;
};
dspProcess["pow"] = function (a, b) {
  return Math.pow(Math.abs(a), b);
};
dspProcess["leftShift"] = function (a, b) {
  if (b < 0) {
    return (a | 0) >> (-b | 0);
  }
  return (a | 0) << (b | 0);
};
dspProcess["rightShift"] = function (a, b) {
  if (b < 0) {
    return (a | 0) << (-b | 0);
  }
  return (a | 0) >> (b | 0);
};
dspProcess["unsignedRightShift"] = function (a, b) {
  if (b < 0) {
    return (a | 0) << (-b | 0);
  }
  return (a | 0) >> (b | 0);
};
// dspProcess["fill"] = function(a, b) {
//   return 0;
// };
dspProcess["ring1"] = function (a, b) {
  return a * b + a;
};
dspProcess["ring2"] = function (a, b) {
  return a * b + a + b;
};
dspProcess["ring3"] = function (a, b) {
  return a * a * b;
};
dspProcess["ring4"] = function (a, b) {
  return a * a * b - a * b * b;
};
dspProcess["difsqr"] = function (a, b) {
  return a * a - b * b;
};
dspProcess["sumsqr"] = function (a, b) {
  return a * a + b * b;
};
dspProcess["sqrsum"] = function (a, b) {
  return (a + b) * (a + b);
};
dspProcess["sqrdif"] = function (a, b) {
  return (a - b) * (a - b);
};
dspProcess["absdif"] = function (a, b) {
  return Math.abs(a - b);
};
dspProcess["thresh"] = function (a, b) {
  return a < b ? 0 : a;
};
dspProcess["amclip"] = function (a, b) {
  return a * 0.5 * (b + Math.abs(b));
};
dspProcess["scaleneg"] = function (a, b) {
  b = 0.5 * b + 0.5;
  return (Math.abs(a) - a) * b + a;
};
dspProcess["clip2"] = function (a, b) {
  return Math.max(-b, Math.min(a, b));
};
dspProcess["excess"] = function (a, b) {
  return a - Math.max(-b, Math.min(a, b));
};
dspProcess["fold2"] = function (val, hi) {
  return sc_fold(val, -hi, hi);
};
dspProcess["wrap2"] = function (val, hi) {
  return sc_wrap(val, -hi, hi);
};
dspProcess["firstarg"] = function (a) {
  return a;
};
dspProcess["randrange"] = function (a, b) {
  return sc_randrange(a, b);
};
dspProcess["exprandrange"] = function (a, b) {
  return sc_exprandrange(a, b);
};

dspProcess["+"]["aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var bIn = this.inputs[1];

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = aIn[i] + bIn[i];
  }
};
dspProcess["+"]["ak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var b = this._b;
  var next_b = this.inputs[1][0];
  var b_slope = (next_b - this._b) * this._slopeFactor;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = aIn[i] + (b + b_slope * i);
  }

  this._b = next_b;
};
dspProcess["+"]["ai"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var b = this._b;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = aIn[i] + b;
  }
};
dspProcess["+"]["ka"] = function (inNumSamples) {
  var out = this.outputs[0];
  var a = this._a;
  var bIn = this.inputs[1];
  var next_a = this.inputs[0][0];
  var a_slope = (next_a - this._a) * this._slopeFactor;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = a + a_slope * i + bIn[i];
  }

  this._a = next_a;
};
dspProcess["+"]["kk"] = function () {
  this.outputs[0][0] = this.inputs[0][0] + this.inputs[1][0];
};
dspProcess["+"]["ki"] = function () {
  this.outputs[0][0] = this.inputs[0][0] + this._b;
};
dspProcess["+"]["ia"] = function (inNumSamples) {
  var out = this.outputs[0];
  var a = this._a;
  var bIn = this.inputs[1];

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = a + bIn[i];
  }
};
dspProcess["+"]["ik"] = function () {
  this.outputs[0][0] = this._a + this.inputs[1][0];
};

dspProcess["-"]["aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var bIn = this.inputs[1];

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = aIn[i] - bIn[i];
  }
};
dspProcess["-"]["ak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var b = this._b;
  var next_b = this.inputs[1][0];
  var b_slope = (next_b - this._b) * this._slopeFactor;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = aIn[i] - (b + b_slope * i);
  }

  this._b = next_b;
};
dspProcess["-"]["ai"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var b = this._b;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = aIn[i] - b;
  }
};
dspProcess["-"]["ka"] = function (inNumSamples) {
  var out = this.outputs[0];
  var a = this._a;
  var bIn = this.inputs[1];
  var next_a = this.inputs[0][0];
  var a_slope = (next_a - this._a) * this._slopeFactor;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = a + a_slope * i - bIn[i];
  }

  this._a = next_a;
};
dspProcess["-"]["kk"] = function () {
  this.outputs[0][0] = this.inputs[0][0] - this.inputs[1][0];
};
dspProcess["-"]["ki"] = function () {
  this.outputs[0][0] = this.inputs[0][0] - this._b;
};
dspProcess["-"]["ia"] = function (inNumSamples) {
  var out = this.outputs[0];
  var a = this._a;
  var bIn = this.inputs[1];

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = a - bIn[i];
  }
};
dspProcess["-"]["ik"] = function () {
  this.outputs[0][0] = this._a - this.inputs[1][0];
};

dspProcess["*"]["aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var bIn = this.inputs[1];

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = aIn[i] * bIn[i];
  }
};
dspProcess["*"]["ak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var b = this._b;
  var next_b = this.inputs[1][0];
  var b_slope = (next_b - this._b) * this._slopeFactor;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = aIn[i] * (b + b_slope * i);
  }
  this._b = next_b;
};
dspProcess["*"]["ai"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var b = this._b;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = aIn[i] * b;
  }
};
dspProcess["*"]["ka"] = function (inNumSamples) {
  var out = this.outputs[0];
  var a = this._a;
  var bIn = this.inputs[1];
  var next_a = this.inputs[0][0];
  var a_slope = (next_a - this._a) * this._slopeFactor;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = (a + a_slope * i) * bIn[i];
  }

  this._a = next_a;
};
dspProcess["*"]["kk"] = function () {
  this.outputs[0][0] = this.inputs[0][0] * this.inputs[1][0];
};
dspProcess["*"]["ki"] = function () {
  this.outputs[0][0] = this.inputs[0][0] * this._b;
};
dspProcess["*"]["ia"] = function (inNumSamples) {
  var out = this.outputs[0];
  var a = this._a;
  var bIn = this.inputs[1];

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = a * bIn[i];
  }
};
dspProcess["*"]["ik"] = function () {
  this.outputs[0][0] = this._a * this.inputs[1][0];
};

function binary_aa(func) {
  return function (inNumSamples) {
    var out = this.outputs[0];
    var aIn = this.inputs[0];
    var bIn = this.inputs[1];

    for (var i = 0; i < inNumSamples; i++) {
      out[i] = func(aIn[i], bIn[i]);
    }
  };
}

function binary_ak(func) {
  return function (inNumSamples) {
    var out = this.outputs[0];
    var aIn = this.inputs[0];
    var b = this._b;
    var next_b = this.inputs[1][0];
    var b_slope = (next_b - this._b) * this._slopeFactor;

    for (var i = 0; i < inNumSamples; i++) {
      out[i] = func(aIn[i], b + b_slope * i);
    }

    this._b = next_b;
  };
}

function binary_ai(func) {
  return function (inNumSamples) {
    var out = this.outputs[0];
    var aIn = this.inputs[0];
    var b = this._b;

    for (var i = 0; i < inNumSamples; i++) {
      out[i] = func(aIn[i], b);
    }
  };
}

function binary_ka(func) {
  return function (inNumSamples) {
    var out = this.outputs[0];
    var a = this._a;
    var bIn = this.inputs[1];
    var next_a = this.inputs[0][0];
    var a_slope = (next_a - this._a) * this._slopeFactor;

    for (var i = 0; i < inNumSamples; i += 8) {
      out[i] = func(a + a_slope * i, bIn[i]);
    }

    this._a = next_a;
  };
}

function binary_kk(func) {
  return function () {
    this.outputs[0][0] = func(this.inputs[0][0], this.inputs[1][0]);
  };
}

function binary_ki(func) {
  return function () {
    this.outputs[0][0] = func(this.inputs[0][0], this._b);
  };
}

function binary_ia(func) {
  return function (inNumSamples) {
    var out = this.outputs[0];
    var a = this._a;
    var bIn = this.inputs[1];

    for (var i = 0; i < inNumSamples; i++) {
      out[i] = func(a, bIn[i]);
    }
  };
}

function binary_ik(func) {
  return function () {
    this.outputs[0][0] = func(this._a, this.inputs[1][0]);
  };
}

function binary_dd(func) {
  return function (inNumSamples) {
    if (inNumSamples) {
      var a = demand.next(this, 0, inNumSamples);
      var b = demand.next(this, 1, inNumSamples);

      this.outputs[0][0] = isNaN(a) || isNaN(b) ? NaN : func(a, b);
    } else {
      demand.reset(this, 0);
      demand.reset(this, 1);
    }
  };
}

Object.keys(dspProcess).forEach(function (key) {
  var func = dspProcess[key];

  func["aa"] = func["aa"] || binary_aa(func);
  func["ak"] = func["ak"] || binary_ak(func);
  func["ai"] = func["ai"] || binary_ai(func);
  func["ka"] = func["ka"] || binary_ka(func);
  func["kk"] = func["kk"] || binary_kk(func);
  func["ki"] = func["ki"] || binary_ki(func);
  func["ia"] = func["ia"] || binary_ia(func);
  func["ik"] = func["ik"] || binary_ik(func);
  func["dd"] = binary_dd(func);
});

SCUnitRepository.registerSCUnitClass("BinaryOpUGen", SCUnitBinaryOpUGen);

module.exports = SCUnitBinaryOpUGen;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"../util/sc_exprandrange":217,"../util/sc_fold":218,"../util/sc_randrange":219,"../util/sc_wrap":220,"./_demand":209}],28:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var sine = require("./_sine");
var dspProcess = {};
var gSine = sine.gSine;
var gInvSine = sine.gInvSine;
var kSineSize = sine.kSineSize;
var kSineMask = sine.kSineMask;
var kBadValue = sine.kBadValue;

var SCUnitBlip = function (_SCUnit) {
  _inherits(SCUnitBlip, _SCUnit);

  function SCUnitBlip() {
    _classCallCheck(this, SCUnitBlip);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitBlip).apply(this, arguments));
  }

  _createClass(SCUnitBlip, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._freq = this.inputs[0][0];
      this._numharm = this.inputs[1][0] | 0;
      this._cpstoinc = kSineSize * rate.sampleDur * 0.5;
      var N = this._numharm;
      var maxN = Math.max(1, rate.sampleRate * 0.5 / this._freq | 0);
      this._N = Math.max(1, Math.min(N, maxN));
      this._mask = kSineMask;
      this._scale = 0.5 / this._N;
      this._phase = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitBlip;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];
  var numharm = this.inputs[1][0] | 0;
  var phase = this._phase;
  var mask = this._mask;
  var numtbl = gSine,
      dentbl = gInvSine;
  var N = void 0,
      N2 = void 0,
      maxN = void 0,
      prevN = void 0,
      prevN2 = void 0,
      scale = void 0,
      prevScale = void 0,
      crossfade = void 0;
  var tblIndex = void 0,
      t0 = void 0,
      t1 = void 0,
      pfrac = void 0,
      denom = void 0,
      rphase = void 0,
      numer = void 0,
      n1 = void 0,
      n2 = void 0;
  var i = void 0,
      xfade = void 0,
      xfade_slope = void 0;
  if (numharm !== this._numharm || freq !== this._freq) {
    N = numharm;
    maxN = Math.max(1, this._sampleRate * 0.5 / this._freq | 0);
    if (maxN < N) {
      N = maxN;
      freq = this._cpstoinc * Math.max(this._freq, freq);
    } else {
      if (N < 1) {
        N = 1;
      }
      freq = this._cpstoinc * freq;
    }
    crossfade = N !== this._N;
    prevN = this._N;
    prevScale = this._scale;
    this._N = Math.max(1, Math.min(N, maxN));
    this._scale = scale = 0.5 / N;
  } else {
    N = this._N;
    freq = this._cpstoinc * freq;
    scale = this._scale;
    crossfade = false;
  }
  N2 = 2 * N + 1;
  if (crossfade) {
    prevN2 = 2 * prevN + 1;
    xfade_slope = this._slopeFactor;
    xfade = 0;
    for (i = 0; i < inNumSamples; ++i) {
      tblIndex = phase & mask;
      t0 = dentbl[tblIndex];
      t1 = dentbl[tblIndex + 1];
      if (t0 === kBadValue || t1 === kBadValue) {
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        if (Math.abs(denom) < 0.0005) {
          out[i] = 1;
        } else {
          rphase = phase * prevN2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          n1 = (numer / denom - 1) * prevScale;
          rphase = phase * N2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          n2 = (numer / denom - 1) * scale;
          out[i] = n1 + xfade * (n2 - n1);
        }
      } else {
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        rphase = phase * prevN2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        n1 = (numer * denom - 1) * prevScale;
        rphase = phase * N2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        n2 = (numer * denom - 1) * scale;
        out[i] = n1 + xfade * (n2 - n1);
      }
      phase += freq;
      xfade += xfade_slope;
    }
  } else {
    for (i = 0; i < inNumSamples; ++i) {
      tblIndex = phase & mask;
      t0 = dentbl[tblIndex];
      t1 = dentbl[tblIndex + 1];
      if (t0 === kBadValue || t1 === kBadValue) {
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        if (Math.abs(denom) < 0.0005) {
          out[i] = 1;
        } else {
          rphase = phase * N2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          out[i] = (numer / denom - 1) * scale;
        }
      } else {
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        rphase = phase * N2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        out[i] = (numer * denom - 1) * scale;
      }
      phase += freq;
    }
  }
  if (phase >= 65536) {
    phase -= 65536;
  }
  this._phase = phase;
  this._freq = this.inputs[0][0];
  this._numharm = numharm;
};
SCUnitRepository.registerSCUnitClass("Blip", SCUnitBlip);
module.exports = SCUnitBlip;
},{"../SCUnit":11,"../SCUnitRepository":12,"./_sine":210}],29:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitBrownNoise = function (_SCUnit) {
  _inherits(SCUnitBrownNoise, _SCUnit);

  function SCUnitBrownNoise() {
    _classCallCheck(this, SCUnitBrownNoise);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitBrownNoise).apply(this, arguments));
  }

  _createClass(SCUnitBrownNoise, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._level = Math.random() * 2 - 1;
      this.outputs[0][0] = this._level;
    }
  }]);

  return SCUnitBrownNoise;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var z = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    z += Math.random() * 0.25 - 0.125;
    if (z > 1) {
      z = 2 - z;
    } else if (z < -1) {
      z = -2 - z;
    }
    out[i] = z;
  }
  this._level = z;
};
SCUnitRepository.registerSCUnitClass("BrownNoise", SCUnitBrownNoise);
module.exports = SCUnitBrownNoise;
},{"../SCUnit":11,"../SCUnitRepository":12}],30:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitClip = function (_SCUnit) {
  _inherits(SCUnitClip, _SCUnit);

  function SCUnitClip() {
    _classCallCheck(this, SCUnitClip);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitClip).apply(this, arguments));
  }

  _createClass(SCUnitClip, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[1].rate === C.RATE_AUDIO && this.inputSpecs[2].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_aa"];
      } else {
        this.dspProcess = dspProcess["next_kk"];
      }
      this._slopeFactor = rate.slopeFactor;
      this._lo = this.inputs[1][0];
      this._hi = this.inputs[2][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitClip;
}(SCUnit);

dspProcess["next_aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var loIn = this.inputs[1];
  var hiIn = this.inputs[2];
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = Math.max(loIn[i], Math.min(inIn[i], hiIn[i]));
  }
};
dspProcess["next_kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var next_lo = this.inputs[1][0];
  var next_hi = this.inputs[2][0];
  var lo = this._lo;
  var hi = this._hi;
  if (next_lo === lo && next_hi === hi) {
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = Math.max(lo, Math.min(inIn[i], hi));
    }
  } else {
    var lo_slope = (next_lo - lo) * this._slopeFactor;
    var hi_slope = (next_hi - hi) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      out[_i] = Math.max(lo + lo_slope * _i, Math.min(inIn[_i], hi + hi_slope * _i));
    }
    this._lo = next_lo;
    this._hi = next_hi;
  }
};
SCUnitRepository.registerSCUnitClass("Clip", SCUnitClip);
module.exports = SCUnitClip;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],31:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitClipNoise = function (_SCUnit) {
  _inherits(SCUnitClipNoise, _SCUnit);

  function SCUnitClipNoise() {
    _classCallCheck(this, SCUnitClipNoise);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitClipNoise).apply(this, arguments));
  }

  _createClass(SCUnitClipNoise, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this.dspProcess(1);
    }
  }]);

  return SCUnitClipNoise;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = Math.random() < 0.5 ? -1 : +1;
  }
};
SCUnitRepository.registerSCUnitClass("ClipNoise", SCUnitClipNoise);
module.exports = SCUnitClipNoise;
},{"../SCUnit":11,"../SCUnitRepository":12}],32:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitCoinGate = function (_SCUnit) {
  _inherits(SCUnitCoinGate, _SCUnit);

  function SCUnitCoinGate() {
    _classCallCheck(this, SCUnitCoinGate);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitCoinGate).apply(this, arguments));
  }

  _createClass(SCUnitCoinGate, [{
    key: "initialize",
    value: function initialize() {
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      this._trig = this.inputs[1][0];
    }
  }]);

  return SCUnitCoinGate;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[1];
  var prob = this.inputs[0][0];
  var prevTrig = this._trig;
  for (var i = 0; i < inNumSamples; i++) {
    var curTrig = trigIn[i];
    var level = 0;
    if (prevTrig <= 0 && curTrig > 0) {
      if (Math.random() < prob) {
        level = curTrig;
      }
    }
    prevTrig = curTrig;
    out[i] = level;
  }
  this._trig = prevTrig;
};
dspProcess["next_k"] = function () {
  var trig = this.inputs[1][0];
  var level = 0;
  if (trig > 0 && this._trig <= 0) {
    if (Math.random() < this.inputs[0][0]) {
      level = trig;
    }
  }
  this.outputs[0][0] = level;
  this._trig = trig;
};
SCUnitRepository.registerSCUnitClass("CoinGate", SCUnitCoinGate);
module.exports = SCUnitCoinGate;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],33:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var delay = require("./_delay");
var toPowerOfTwo = require("../util/toPowerOfTwo");
var sc_cubicinterp = require("../util/sc_cubicinterp");
var clamp = require("../util/clamp");
var dspProcess = {};

var SCUnitCombC = function (_SCUnit) {
  _inherits(SCUnitCombC, _SCUnit);

  function SCUnitCombC() {
    _classCallCheck(this, SCUnitCombC);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitCombC).apply(this, arguments));
  }

  _createClass(SCUnitCombC, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["kk"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._maxdelaytime = this.inputs[1][0];
      this._delaytime = this.inputs[2][0];
      this._decaytime = this.inputs[3][0];
      this._fdelaylen = toPowerOfTwo(this._maxdelaytime * this._sampleRate + 1 + this.bufferLength);
      this._idelaylen = this._fdelaylen;
      this._dlybuf = new Float32Array(this._fdelaylen);
      this._mask = this._fdelaylen - 1;
      this._dsamp = clamp(this._delaytime * this._sampleRate, 1, this._fdelaylen);
      this._iwrphase = 0;
      this._feedbk = delay.feedback(this._delaytime, this._decaytime);
    }
  }]);

  return SCUnitCombC;
}(SCUnit);

dspProcess["kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var delaytime = this.inputs[2][0];
  var decaytime = this.inputs[3][0];
  var dlybuf = this._dlybuf;
  var mask = this._mask;
  var dsamp = this._dsamp;
  var frac = dsamp - (dsamp | 0);
  var feedbk = this._feedbk;
  var iwrphase = this._iwrphase;
  var irdphase = void 0;
  if (delaytime === this._delaytime) {
    irdphase = iwrphase - (dsamp | 0);
    if (decaytime === this._decaytime) {
      for (var i = 0; i < inNumSamples; i++) {
        var d0 = dlybuf[irdphase + 1 & mask];
        var d1 = dlybuf[irdphase & mask];
        var d2 = dlybuf[irdphase - 1 & mask];
        var d3 = dlybuf[irdphase - 2 & mask];
        var value = sc_cubicinterp(frac, d0, d1, d2, d3) || 0;
        dlybuf[iwrphase & mask] = inIn[i] + feedbk * value || 0;
        out[i] = value;
        irdphase++;
        iwrphase++;
      }
    } else {
      var nextFeedbk = delay.feedback(delaytime, decaytime);
      var feedbkSlope = (nextFeedbk - feedbk) * this._slopeFactor;
      for (var _i = 0; _i < inNumSamples; _i++) {
        var _d = dlybuf[irdphase + 1 & mask];
        var _d2 = dlybuf[irdphase & mask];
        var _d3 = dlybuf[irdphase - 1 & mask];
        var _d4 = dlybuf[irdphase - 2 & mask];
        var _value = sc_cubicinterp(frac, _d, _d2, _d3, _d4) || 0;
        dlybuf[iwrphase & mask] = inIn[_i] + feedbk * _value || 0;
        out[_i] = _value;
        feedbk += feedbkSlope;
        irdphase++;
        iwrphase++;
      }
      this._feedbk = nextFeedbk;
      this._decaytime = decaytime;
    }
  } else {
    var nextDsamp = clamp(this, delaytime * this._sampleRate, 1, this._fdelaylen);
    var dsampSlope = (nextDsamp - dsamp) * this._slopeFactor;
    var _nextFeedbk = delay.feedback(delaytime, decaytime);
    var _feedbkSlope = (_nextFeedbk - feedbk) * this._slopeFactor;
    for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
      irdphase = iwrphase - (dsamp + dsampSlope * _i2 | 0);
      var _d5 = dlybuf[irdphase + 1 & mask];
      var _d6 = dlybuf[irdphase & mask];
      var _d7 = dlybuf[irdphase - 1 & mask];
      var _d8 = dlybuf[irdphase - 2 & mask];
      var _value2 = sc_cubicinterp(frac, _d5, _d6, _d7, _d8) || 0;
      dlybuf[iwrphase & mask] = inIn[_i2] + feedbk * _value2 || 0;
      out[_i2] = _value2;
      feedbk += _feedbkSlope;
      irdphase++;
      iwrphase++;
    }
    this._feedbk = feedbk;
    this._dsamp = dsamp;
    this._delaytime = delaytime;
    this._decaytime = decaytime;
  }
  this._iwrphase = iwrphase;
};
SCUnitRepository.registerSCUnitClass("CombC", SCUnitCombC);
module.exports = SCUnitCombC;
},{"../SCUnit":11,"../SCUnitRepository":12,"../util/clamp":212,"../util/sc_cubicinterp":216,"../util/toPowerOfTwo":222,"./_delay":208}],34:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var delay = require("./_delay");
var toPowerOfTwo = require("../util/toPowerOfTwo");
var clamp = require("../util/clamp");
var dspProcess = {};

var SCUnitCombL = function (_SCUnit) {
  _inherits(SCUnitCombL, _SCUnit);

  function SCUnitCombL() {
    _classCallCheck(this, SCUnitCombL);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitCombL).apply(this, arguments));
  }

  _createClass(SCUnitCombL, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["kk"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._maxdelaytime = this.inputs[1][0];
      this._delaytime = this.inputs[2][0];
      this._decaytime = this.inputs[3][0];
      this._fdelaylen = toPowerOfTwo(this._maxdelaytime * this._sampleRate + 1 + this.bufferLength);
      this._idelaylen = this._fdelaylen;
      this._dlybuf = new Float32Array(this._fdelaylen);
      this._mask = this._fdelaylen - 1;
      this._dsamp = clamp(this._delaytime * this._sampleRate, 1, this._fdelaylen);
      this._iwrphase = 0;
      this._feedbk = delay.feedback(this._delaytime, this._decaytime);
    }
  }]);

  return SCUnitCombL;
}(SCUnit);

dspProcess["kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var delaytime = this.inputs[2][0];
  var decaytime = this.inputs[3][0];
  var dlybuf = this._dlybuf;
  var mask = this._mask;
  var dsamp = this._dsamp;
  var frac = dsamp - (dsamp | 0);
  var feedbk = this._feedbk;
  var iwrphase = this._iwrphase;
  var irdphase = void 0;
  if (delaytime === this._delaytime) {
    irdphase = iwrphase - (dsamp | 0);
    if (decaytime === this._decaytime) {
      for (var i = 0; i < inNumSamples; i++) {
        var d1 = dlybuf[irdphase & mask];
        var d2 = dlybuf[irdphase - 1 & mask];
        var value = d1 + frac * (d2 - d1) || 0;
        dlybuf[iwrphase & mask] = inIn[i] + feedbk * value || 0;
        out[i] = value;
        irdphase++;
        iwrphase++;
      }
    } else {
      var nextFeedbk = delay.feedback(delaytime, decaytime);
      var feedbkSlope = (nextFeedbk - feedbk) * this._slopeFactor;
      for (var _i = 0; _i < inNumSamples; _i++) {
        var _d = dlybuf[irdphase & mask];
        var _d2 = dlybuf[irdphase - 1 & mask];
        var _value = _d + frac * (_d2 - _d) || 0;
        dlybuf[iwrphase & mask] = inIn[_i] + feedbk * _value || 0;
        out[_i] = _value;
        feedbk += feedbkSlope;
        irdphase++;
        iwrphase++;
      }
      this._feedbk = nextFeedbk;
      this._decaytime = decaytime;
    }
  } else {
    var nextDsamp = clamp(this, delaytime * this._sampleRate, 1, this._fdelaylen);
    var dsampSlope = (nextDsamp - dsamp) * this._slopeFactor;
    var _nextFeedbk = delay.feedback(delaytime, decaytime);
    var _feedbkSlope = (_nextFeedbk - feedbk) * this._slopeFactor;
    for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
      irdphase = iwrphase - (dsamp + dsampSlope * _i2 | 0);
      var _d3 = dlybuf[irdphase & mask];
      var _d4 = dlybuf[irdphase - 1 & mask];
      var _value2 = _d3 + frac * (_d4 - _d3) || 0;
      dlybuf[iwrphase & mask] = inIn[_i2] + feedbk * _value2 || 0;
      out[_i2] = _value2;
      feedbk += _feedbkSlope;
      irdphase++;
      iwrphase++;
    }
    this._feedbk = feedbk;
    this._dsamp = dsamp;
    this._delaytime = delaytime;
    this._decaytime = decaytime;
  }
  this._iwrphase = iwrphase;
};
SCUnitRepository.registerSCUnitClass("CombL", SCUnitCombL);
module.exports = SCUnitCombL;
},{"../SCUnit":11,"../SCUnitRepository":12,"../util/clamp":212,"../util/toPowerOfTwo":222,"./_delay":208}],35:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var delay = require("./_delay");
var toPowerOfTwo = require("../util/toPowerOfTwo");
var clamp = require("../util/clamp");
var dspProcess = {};

var SCUnitCombN = function (_SCUnit) {
  _inherits(SCUnitCombN, _SCUnit);

  function SCUnitCombN() {
    _classCallCheck(this, SCUnitCombN);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitCombN).apply(this, arguments));
  }

  _createClass(SCUnitCombN, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["kk"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._maxdelaytime = this.inputs[1][0];
      this._delaytime = this.inputs[2][0];
      this._decaytime = this.inputs[3][0];
      this._fdelaylen = toPowerOfTwo(this._maxdelaytime * this._sampleRate + 1 + this.bufferLength);
      this._idelaylen = this._fdelaylen;
      this._dlybuf = new Float32Array(this._fdelaylen);
      this._mask = this._fdelaylen - 1;
      this._dsamp = clamp(this._delaytime * this._sampleRate, 1, this._fdelaylen);
      this._iwrphase = 0;
      this._feedbk = delay.feedback(this._delaytime, this._decaytime);
    }
  }]);

  return SCUnitCombN;
}(SCUnit);

dspProcess["kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var delaytime = this.inputs[2][0];
  var decaytime = this.inputs[3][0];
  var dlybuf = this._dlybuf;
  var mask = this._mask;
  var dsamp = this._dsamp;
  var feedbk = this._feedbk;
  var iwrphase = this._iwrphase;
  var irdphase = void 0;
  if (delaytime === this._delaytime) {
    irdphase = iwrphase - (dsamp | 0);
    if (decaytime === this._decaytime) {
      for (var i = 0; i < inNumSamples; i++) {
        var value = dlybuf[irdphase & mask] || 0;
        dlybuf[iwrphase & mask] = inIn[i] + feedbk * value || 0;
        out[i] = value;
        irdphase++;
        iwrphase++;
      }
    } else {
      var nextFeedbk = delay.feedback(delaytime, decaytime);
      var feedbkSlope = (nextFeedbk - feedbk) * this._slopeFactor;
      for (var _i = 0; _i < inNumSamples; _i++) {
        var _value = dlybuf[irdphase & mask] || 0;
        dlybuf[iwrphase & mask] = inIn[_i] + feedbk * _value || 0;
        out[_i] = _value;
        feedbk += feedbkSlope;
        irdphase++;
        iwrphase++;
      }
      this._feedbk = nextFeedbk;
      this._decaytime = decaytime;
    }
  } else {
    var nextDsamp = clamp(this, delaytime * this._sampleRate, 1, this._fdelaylen);
    var dsampSlope = (nextDsamp - dsamp) * this._slopeFactor;
    var _nextFeedbk = delay.feedback(delaytime, decaytime);
    var _feedbkSlope = (_nextFeedbk - feedbk) * this._slopeFactor;
    for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
      irdphase = iwrphase - (dsamp | 0);
      var _value2 = dlybuf[irdphase & mask] || 0;
      dlybuf[iwrphase & mask] = inIn[_i2] + feedbk * _value2 || 0;
      out[_i2] = _value2;
      dsamp += dsampSlope;
      feedbk += _feedbkSlope;
      irdphase++;
      iwrphase++;
    }
    this._feedbk = feedbk;
    this._dsamp = dsamp;
    this._delaytime = delaytime;
    this._decaytime = decaytime;
  }
  this._iwrphase = iwrphase;
};
SCUnitRepository.registerSCUnitClass("CombN", SCUnitCombN);
module.exports = SCUnitCombN;
},{"../SCUnit":11,"../SCUnitRepository":12,"../util/clamp":212,"../util/toPowerOfTwo":222,"./_delay":208}],36:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var log1 = Math.log(0.1);

var SCUnitCompander = function (_SCUnit) {
  _inherits(SCUnitCompander, _SCUnit);

  function SCUnitCompander() {
    _classCallCheck(this, SCUnitCompander);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitCompander).apply(this, arguments));
  }

  _createClass(SCUnitCompander, [{
    key: "initialize",
    value: function initialize(rate) {

      this.dspProcess = dspProcess["aakkkkk"];

      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._clamp = 0;
      this._relax = 0;
      this._clampCoef = 0;
      this._relaxCoef = 0;
      this._prevMaxVal = 0;
      this._gain = 0;

      this.dspProcess(1);
    }
  }]);

  return SCUnitCompander;
}(SCUnit);

dspProcess["aakkkkk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var controlIn = this.inputs[1];
  var thresh = this.inputs[2][0];
  var slope_below = this.inputs[3][0];
  var slope_above = this.inputs[4][0];
  var clamp = this.inputs[5][0];
  var relax = this.inputs[6][0];

  if (clamp !== this._prevClamp) {
    this._clampCoef = clamp ? Math.exp(log1 / (clamp * this._sampleRate)) : 0;
    this._prevClamp = clamp;
  }
  if (relax !== this._prevRelax) {
    this._relaxCoef = relax ? Math.exp(log1 / (relax * this._sampleRate)) : 0;
    this._prevRelax = relax;
  }

  var clampCoef = this._clampCoef;
  var relaxCoef = this._relaxCoef;

  var prevMaxVal = this._prevMaxVal;

  for (var i = 0; i < inNumSamples; i++) {
    var val = Math.abs(controlIn[i]);

    if (val < prevMaxVal) {
      val += (prevMaxVal - val) * relaxCoef;
    } else {
      val += (prevMaxVal - val) * clampCoef;
    }

    prevMaxVal = val;
  }

  this._prevMaxVal = prevMaxVal;

  var next_gain = void 0;

  if (prevMaxVal < thresh) {
    if (slope_below === 1) {
      next_gain = 1;
    } else {
      next_gain = Math.pow(prevMaxVal / thresh, slope_below - 1);
      var absx = Math.abs(next_gain);

      next_gain = (absx < 1e-15 ? 0 : 1e15 < absx ? 1 : next_gain) || 0;
    }
  } else {
    if (slope_above === 1) {
      next_gain = 1;
    } else {
      next_gain = Math.pow(prevMaxVal / thresh, slope_above - 1) || 0;
    }
  }

  var gain = this._gain;
  var gain_slope = (next_gain - gain) * this._slopeFactor;

  for (var _i = 0; _i < inNumSamples; _i++) {
    out[_i] = inIn[_i] * (gain + gain_slope * _i);
  }

  this._gain = next_gain;
};

SCUnitRepository.registerSCUnitClass("Compander", SCUnitCompander);

module.exports = SCUnitCompander;
},{"../SCUnit":11,"../SCUnitRepository":12}],37:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitControl = function (_SCUnit) {
  _inherits(SCUnitControl, _SCUnit);

  function SCUnitControl() {
    _classCallCheck(this, SCUnitControl);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitControl).apply(this, arguments));
  }

  _createClass(SCUnitControl, [{
    key: "initialize",
    value: function initialize() {
      if (this.outputs.length === 1) {
        this.dspProcess = dspProcess["1"];
      } else {
        this.dspProcess = dspProcess["k"];
      }
      this._controls = this.synth.params;
      this.dspProcess(1);
    }
  }]);

  return SCUnitControl;
}(SCUnit);

dspProcess["1"] = function () {
  this.outputs[0][0] = this._controls[this.specialIndex];
};
dspProcess["k"] = function () {
  var controls = this._controls;
  var outputs = this.outputs;
  var numerOfOutputs = outputs.length;
  var specialIndex = this.specialIndex;
  for (var i = 0; i < numerOfOutputs; i++) {
    outputs[i][0] = controls[specialIndex + i];
  }
};
SCUnitRepository.registerSCUnitClass("Control", SCUnitControl);
module.exports = SCUnitControl;
},{"../SCUnit":11,"../SCUnitRepository":12}],38:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitControlDur = function (_SCUnit) {
  _inherits(SCUnitControlDur, _SCUnit);

  function SCUnitControlDur() {
    _classCallCheck(this, SCUnitControlDur);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitControlDur).apply(this, arguments));
  }

  _createClass(SCUnitControlDur, [{
    key: "initialize",
    value: function initialize() {
      this.outputs[0][0] = this.context.kRate.sampleDur;
    }
  }]);

  return SCUnitControlDur;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("ControlDur", SCUnitControlDur);
module.exports = SCUnitControlDur;
},{"../SCUnit":11,"../SCUnitRepository":12}],39:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitControlRate = function (_SCUnit) {
  _inherits(SCUnitControlRate, _SCUnit);

  function SCUnitControlRate() {
    _classCallCheck(this, SCUnitControlRate);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitControlRate).apply(this, arguments));
  }

  _createClass(SCUnitControlRate, [{
    key: "initialize",
    value: function initialize() {
      this.outputs[0][0] = this.context.kRate.sampleRate;
    }
  }]);

  return SCUnitControlRate;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("ControlRate", SCUnitControlRate);
module.exports = SCUnitControlRate;
},{"../SCUnit":11,"../SCUnitRepository":12}],40:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitCrackle = function (_SCUnit) {
  _inherits(SCUnitCrackle, _SCUnit);

  function SCUnitCrackle() {
    _classCallCheck(this, SCUnitCrackle);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitCrackle).apply(this, arguments));
  }

  _createClass(SCUnitCrackle, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._y1 = Math.random();
      this._y2 = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitCrackle;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var paramf = this.inputs[0][0];
  var y1 = this._y1;
  var y2 = this._y2;
  for (var i = 0; i < inNumSamples; i++) {
    var y0 = Math.abs(y1 * paramf - y2 - 0.05) || 0;
    out[i] = y0;
    y2 = y1;
    y1 = y0;
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("Crackle", SCUnitCrackle);
module.exports = SCUnitCrackle;
},{"../SCUnit":11,"../SCUnitRepository":12}],41:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var fill = require("../util/fill");

var SCUnitDC = function (_SCUnit) {
  _inherits(SCUnitDC, _SCUnit);

  function SCUnitDC() {
    _classCallCheck(this, SCUnitDC);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDC).apply(this, arguments));
  }

  _createClass(SCUnitDC, [{
    key: "initialize",
    value: function initialize() {
      fill(this.outputs[0], this.inputs[0][0]);
    }
  }]);

  return SCUnitDC;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("DC", SCUnitDC);

module.exports = SCUnitDC;
},{"../SCUnit":11,"../SCUnitRepository":12,"../util/fill":213}],42:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var sc_fold = require("../util/sc_fold");
var dspProcess = {};

var SCUnitDbrown = function (_SCUnit) {
  _inherits(SCUnitDbrown, _SCUnit);

  function SCUnitDbrown() {
    _classCallCheck(this, SCUnitDbrown);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDbrown).apply(this, arguments));
  }

  _createClass(SCUnitDbrown, [{
    key: "initialize",
    value: function initialize() {

      this.dspProcess = dspProcess["d"];

      this._lo = 0;
      this._hi = 0;
      this._step = 0;
      this._value = 0;

      this.reset();
    }
  }, {
    key: "reset",
    value: function reset() {
      this._repeats = -1;
      this._repeatCount = 0;
    }
  }]);

  return SCUnitDbrown;
}(SCUnit);

dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples === 0) {
    return this.reset();
  }

  var lo = demand.next(this, 1, inNumSamples);
  var hi = demand.next(this, 2, inNumSamples);
  var step = demand.next(this, 3, inNumSamples);

  if (!Number.isNaN(lo)) {
    this._lo = lo;
  }
  if (!Number.isNaN(hi)) {
    this._hi = hi;
  }
  if (!Number.isNaN(step)) {
    this._step = step;
  }

  if (this._repeats < 0) {
    var x = demand.next(this, 0, inNumSamples);

    this._repeats = Number.isNaN(x) ? 0 : Math.max(0, Math.floor(x + 0.5));
    this._value = Math.random() * (this._hi - this._lo) + this._lo;
  }

  var out = this.outputs[0];

  if (this._repeats <= this._repeatCount) {
    out[0] = NaN;
    return;
  }

  this._repeatCount += 1;

  out[0] = this._value;

  var value = this._value + (Math.random() * 2 - 1) * this._step;

  this._value = sc_fold(value, this._lo, this._hi);
};

SCUnitRepository.registerSCUnitClass("Dbrown", SCUnitDbrown);

module.exports = SCUnitDbrown;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"../util/sc_fold":218,"./_demand":209}],43:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitDecay = function (_SCUnit) {
  _inherits(SCUnitDecay, _SCUnit);

  function SCUnitDecay() {
    _classCallCheck(this, SCUnitDecay);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDecay).apply(this, arguments));
  }

  _createClass(SCUnitDecay, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._decayTime = NaN;
      this._b1 = 0;
      this._y1 = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitDecay;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var decayTime = this.inputs[1][0];
  var b1 = this._b1;
  var y1 = this._y1;
  if (decayTime === this._decayTime) {
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = y1 = inIn[i] + b1 * y1;
    }
  } else {
    var next_b1 = decayTime !== 0 ? Math.exp(log001 / (decayTime * this._sampleRate)) : 0;
    var b1_slope = (next_b1 - b1) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      out[_i] = y1 = inIn[_i] + (b1 + b1_slope * _i) * y1;
    }
    this._b1 = next_b1;
    this._decayTime = decayTime;
  }
  this._y1 = y1;
};
SCUnitRepository.registerSCUnitClass("Decay", SCUnitDecay);
module.exports = SCUnitDecay;
},{"../SCUnit":11,"../SCUnitRepository":12}],44:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitDecay2 = function (_SCUnit) {
  _inherits(SCUnitDecay2, _SCUnit);

  function SCUnitDecay2() {
    _classCallCheck(this, SCUnitDecay2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDecay2).apply(this, arguments));
  }

  _createClass(SCUnitDecay2, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._attackTime = NaN;
      this._decayTime = NaN;
      this._b1a = 0;
      this._b1b = 0;
      this._y1a = 0;
      this._y1b = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitDecay2;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var attackTime = this.inputs[1][0];
  var decayTime = this.inputs[2][0];
  var b1a = this._b1a;
  var b1b = this._b1b;
  var y1a = this._y1a;
  var y1b = this._y1b;
  if (attackTime === this._attackTime && decayTime === this._decayTime) {
    for (var i = 0; i < inNumSamples; i++) {
      y1a = inIn[i] + b1a * y1a;
      y1b = inIn[i] + b1b * y1b;
      out[i] = y1a - y1b;
    }
  } else {
    var next_b1a = decayTime !== 0 ? Math.exp(log001 / (decayTime * this._sampleRate)) : 0;
    var next_b1b = attackTime !== 0 ? Math.exp(log001 / (attackTime * this._sampleRate)) : 0;
    var b1a_slope = (next_b1a - b1a) * this._slopeFactor;
    var b1b_slope = (next_b1b - b1b) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      y1a = inIn[_i] + (b1a + b1a_slope * _i) * y1a;
      y1b = inIn[_i] + (b1b + b1b_slope * _i) * y1b;
      out[_i] = y1a - y1b;
    }
    this._b1a = next_b1a;
    this._b1b = next_b1b;
    this._decayTime = decayTime;
    this._attackTime = attackTime;
  }
  this._y1a = y1a;
  this._y1b = y1b;
};
SCUnitRepository.registerSCUnitClass("Decay2", SCUnitDecay2);
module.exports = SCUnitDecay2;
},{"../SCUnit":11,"../SCUnitRepository":12}],45:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitDelay1 = function (_SCUnit) {
  _inherits(SCUnitDelay1, _SCUnit);

  function SCUnitDelay1() {
    _classCallCheck(this, SCUnitDelay1);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDelay1).apply(this, arguments));
  }

  _createClass(SCUnitDelay1, [{
    key: "initialize",
    value: function initialize() {
      if (this.bufferLength === 1) {
        this.dspProcess = dspProcess["next_1"];
      } else {
        this.dspProcess = dspProcess["next"];
      }
      this._x1 = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitDelay1;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var x1 = this._x1;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = x1;
    x1 = inIn[i];
  }
  this._x1 = x1;
};
dspProcess["next_1"] = function () {
  this.outputs[0][0] = this._x1;
  this._x1 = this.inputs[0][0];
};
SCUnitRepository.registerSCUnitClass("Delay1", SCUnitDelay1);
module.exports = SCUnitDelay1;
},{"../SCUnit":11,"../SCUnitRepository":12}],46:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitDelay2 = function (_SCUnit) {
  _inherits(SCUnitDelay2, _SCUnit);

  function SCUnitDelay2() {
    _classCallCheck(this, SCUnitDelay2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDelay2).apply(this, arguments));
  }

  _createClass(SCUnitDelay2, [{
    key: "initialize",
    value: function initialize() {
      if (this.bufferLength === 1) {
        this.dspProcess = dspProcess["next_1"];
      } else {
        this.dspProcess = dspProcess["next"];
      }
      this._x1 = 0;
      this._x2 = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitDelay2;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var x1 = this._x1;
  var x2 = this._x2;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = x1;
    x1 = x2;
    x2 = inIn[i];
  }
  this._x1 = x1;
  this._x2 = x2;
};
dspProcess["next_1"] = function () {
  this.outputs[0][0] = this._x1;
  this._x1 = this._x2;
  this._x2 = this.inputs[0][0];
};
SCUnitRepository.registerSCUnitClass("Delay2", SCUnitDelay2);
module.exports = SCUnitDelay2;
},{"../SCUnit":11,"../SCUnitRepository":12}],47:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var toPowerOfTwo = require("../util/toPowerOfTwo");
var sc_cubicinterp = require("../util/sc_cubicinterp");
var clamp = require("../util/clamp");
var dspProcess = {};

var SCUnitDelayC = function (_SCUnit) {
  _inherits(SCUnitDelayC, _SCUnit);

  function SCUnitDelayC() {
    _classCallCheck(this, SCUnitDelayC);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDelayC).apply(this, arguments));
  }

  _createClass(SCUnitDelayC, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["k"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._maxdelaytime = this.inputs[1][0];
      this._delaytime = this.inputs[2][0];
      this._fdelaylen = toPowerOfTwo(this._maxdelaytime * this._sampleRate + 1 + this.bufferLength);
      this._fdelaylen = this._fdelaylen;
      this._idelaylen = this._fdelaylen;
      this._dlybuf = new Float32Array(this._fdelaylen);
      this._mask = this._fdelaylen - 1;
      this._dsamp = clamp(this, this._delaytime * this._sampleRate, 1, this._fdelaylen);
      this._numoutput = 0;
      this._iwrphase = 0;
    }
  }]);

  return SCUnitDelayC;
}(SCUnit);

dspProcess["k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var delaytime = this.inputs[2][0];
  var mask = this._mask;
  var dlybuf = this._dlybuf;
  var iwrphase = this._iwrphase;
  var dsamp = this._dsamp;
  if (delaytime === this._delaytime) {
    var frac = dsamp - (dsamp | 0);
    for (var i = 0; i < inNumSamples; i++) {
      dlybuf[iwrphase & mask] = inIn[i];
      var irdphase = iwrphase - (dsamp | 0);
      var d0 = dlybuf[irdphase + 1 & mask];
      var d1 = dlybuf[irdphase & mask];
      var d2 = dlybuf[irdphase - 1 & mask];
      var d3 = dlybuf[irdphase - 2 & mask];
      out[i] = sc_cubicinterp(frac, d0, d1, d2, d3);
      iwrphase += 1;
    }
  } else {
    var nextDsamp = clamp(this, delaytime * this._sampleRate, 1, this._fdelaylen);
    var dsampSlope = (nextDsamp - dsamp) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      dlybuf[iwrphase & mask] = inIn[_i];
      dsamp += dsampSlope;
      var _frac = dsamp - (dsamp | 0);
      var _irdphase = iwrphase - (dsamp | 0);
      var _d = dlybuf[_irdphase + 1 & mask];
      var _d2 = dlybuf[_irdphase & mask];
      var _d3 = dlybuf[_irdphase - 1 & mask];
      var _d4 = dlybuf[_irdphase - 2 & mask];
      out[_i] = sc_cubicinterp(_frac, _d, _d2, _d3, _d4);
      iwrphase += 1;
    }
    this._dsamp = nextDsamp;
    this._delaytime = delaytime;
  }
  if (iwrphase > dlybuf.length) {
    iwrphase -= dlybuf.length;
  }
  this._iwrphase = iwrphase;
};
SCUnitRepository.registerSCUnitClass("DelayC", SCUnitDelayC);
module.exports = SCUnitDelayC;
},{"../SCUnit":11,"../SCUnitRepository":12,"../util/clamp":212,"../util/sc_cubicinterp":216,"../util/toPowerOfTwo":222}],48:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var toPowerOfTwo = require("../util/toPowerOfTwo");
var clamp = require("../util/clamp");
var dspProcess = {};

var SCUnitDelayL = function (_SCUnit) {
  _inherits(SCUnitDelayL, _SCUnit);

  function SCUnitDelayL() {
    _classCallCheck(this, SCUnitDelayL);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDelayL).apply(this, arguments));
  }

  _createClass(SCUnitDelayL, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["k"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._maxdelaytime = this.inputs[1][0];
      this._delaytime = this.inputs[2][0];
      this._fdelaylen = toPowerOfTwo(this._maxdelaytime * this._sampleRate + 1 + this.bufferLength);
      this._fdelaylen = this._fdelaylen;
      this._idelaylen = this._fdelaylen;
      this._dlybuf = new Float32Array(this._fdelaylen);
      this._mask = this._fdelaylen - 1;
      this._dsamp = clamp(this, this._delaytime * this._sampleRate, 1, this._fdelaylen);
      this._numoutput = 0;
      this._iwrphase = 0;
    }
  }]);

  return SCUnitDelayL;
}(SCUnit);

dspProcess["k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var delaytime = this.inputs[2][0];
  var mask = this._mask;
  var dlybuf = this._dlybuf;
  var iwrphase = this._iwrphase;
  var dsamp = this._dsamp;
  if (delaytime === this._delaytime) {
    var frac = dsamp - (dsamp | 0);
    for (var i = 0; i < inNumSamples; i++) {
      dlybuf[iwrphase & mask] = inIn[i];
      var irdphase = iwrphase - (dsamp | 0);
      var d1 = dlybuf[irdphase & mask];
      var d2 = dlybuf[irdphase - 1 & mask];
      out[i] = d1 + frac * (d2 - d1);
      iwrphase += 1;
    }
  } else {
    var nextDsamp = clamp(this, delaytime * this._sampleRate, 1, this._fdelaylen);
    var dsampSlope = (nextDsamp - dsamp) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      dlybuf[iwrphase & mask] = inIn[_i];
      dsamp += dsampSlope;
      var _frac = dsamp - (dsamp | 0);
      var _irdphase = iwrphase - (dsamp | 0);
      var _d = dlybuf[_irdphase & mask];
      var _d2 = dlybuf[_irdphase - 1 & mask];
      out[_i] = _d + _frac * (_d2 - _d);
      iwrphase += 1;
    }
    this._dsamp = nextDsamp;
    this._delaytime = delaytime;
  }
  if (iwrphase > dlybuf.length) {
    iwrphase -= dlybuf.length;
  }
  this._iwrphase = iwrphase;
};
SCUnitRepository.registerSCUnitClass("DelayL", SCUnitDelayL);
module.exports = SCUnitDelayL;
},{"../SCUnit":11,"../SCUnitRepository":12,"../util/clamp":212,"../util/toPowerOfTwo":222}],49:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var toPowerOfTwo = require("../util/toPowerOfTwo");
var clamp = require("../util/clamp");
var dspProcess = {};

var SCUnitDelayN = function (_SCUnit) {
  _inherits(SCUnitDelayN, _SCUnit);

  function SCUnitDelayN() {
    _classCallCheck(this, SCUnitDelayN);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDelayN).apply(this, arguments));
  }

  _createClass(SCUnitDelayN, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["k"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._maxdelaytime = this.inputs[1][0];
      this._delaytime = this.inputs[2][0];
      this._fdelaylen = toPowerOfTwo(this._maxdelaytime * this._sampleRate + 1 + this.bufferLength);
      this._fdelaylen = this._fdelaylen;
      this._idelaylen = this._fdelaylen;
      this._dlybuf = new Float32Array(this._fdelaylen);
      this._mask = this._fdelaylen - 1;
      this._dsamp = clamp(this, this._delaytime * this._sampleRate, 1, this._fdelaylen);
      this._numoutput = 0;
      this._iwrphase = 0;
    }
  }]);

  return SCUnitDelayN;
}(SCUnit);

dspProcess["k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var delaytime = this.inputs[2][0];
  var mask = this._mask;
  var dlybuf = this._dlybuf;
  var iwrphase = this._iwrphase;
  var dsamp = this._dsamp;
  if (delaytime === this._delaytime) {
    for (var i = 0; i < inNumSamples; i++) {
      dlybuf[iwrphase & mask] = inIn[i];
      var irdphase = iwrphase - (dsamp | 0);
      out[i] = dlybuf[irdphase & mask];
      iwrphase += 1;
    }
  } else {
    var nextDsamp = clamp(this, delaytime * this._sampleRate, 1, this._fdelaylen);
    var dsampSlope = (nextDsamp - dsamp) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      dlybuf[iwrphase & mask] = inIn[_i];
      dsamp += dsampSlope;
      var _irdphase = iwrphase - (dsamp | 0);
      out[_i] = dlybuf[_irdphase & mask];
      iwrphase += 1;
    }
    this._dsamp = nextDsamp;
    this._delaytime = delaytime;
  }
  if (iwrphase > dlybuf.length) {
    iwrphase -= dlybuf.length;
  }
  this._iwrphase = iwrphase;
};
SCUnitRepository.registerSCUnitClass("DelayN", SCUnitDelayN);
module.exports = SCUnitDelayN;
},{"../SCUnit":11,"../SCUnitRepository":12,"../util/clamp":212,"../util/toPowerOfTwo":222}],50:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};

var SCUnitDemand = function (_SCUnit) {
  _inherits(SCUnitDemand, _SCUnit);

  function SCUnitDemand() {
    _classCallCheck(this, SCUnitDemand);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDemand).apply(this, arguments));
  }

  _createClass(SCUnitDemand, [{
    key: "initialize",
    value: function initialize() {

      this.dspProcess = dspProcess[$r2k(this)];

      this._prevtrig = 0;
      this._prevreset = 0;
      this._prevout = new Float32Array(this.outputs.length);
    }
  }]);

  return SCUnitDemand;
}(SCUnit);

function $r2k(unit) {
  return unit.inputSpecs.slice(0, 2).map(function (_ref) {
    var rate = _ref.rate;

    if (rate === C.RATE_AUDIO) {
      return "a";
    }
    return rate === C.RATE_SCALAR ? "i" : "k";
  }).join("");
}

dspProcess["aa"] = function (inNumSamples) {
  var outputs = this.outputs;
  var trigIn = this.inputs[0];
  var resetIn = this.inputs[1];
  var prevout = this._prevout;
  var numberOfDemandUGens = prevout.length;

  var prevtrig = this._prevtrig;
  var prevreset = this._prevreset;

  for (var i = 0; i < inNumSamples; i++) {
    var ztrig = trigIn[i];
    var zreset = resetIn[i];

    if (0 < zreset && prevreset <= 0) {
      for (var j = 0; j < numberOfDemandUGens; j++) {
        demand.reset(this, j + 2);
      }
    }
    if (0 < ztrig && prevtrig <= 0) {
      for (var _j = 0; _j < numberOfDemandUGens; _j++) {
        var x = demand.next(this, _j + 2, i + 1);

        if (Number.isNaN(x)) {
          outputs[_j][i] = prevout[_j];
          this.done = true;
        } else {
          outputs[_j][i] = prevout[_j] = x;
        }
      }
    } else {
      for (var _j2 = 0; _j2 < numberOfDemandUGens; _j2++) {
        outputs[_j2][i] = prevout[_j2];
      }
    }
    prevtrig = ztrig;
    prevreset = zreset;
  }

  this._prevtrig = prevtrig;
  this._prevreset = prevreset;
};

dspProcess["ak"] = function (inNumSamples) {
  var outputs = this.outputs;
  var trigIn = this.inputs[0];
  var zreset = this.inputs[1][0];
  var prevout = this._prevout;
  var numberOfDemandUGens = prevout.length;

  if (0 < zreset && this._prevreset <= 0) {
    for (var j = 0; j < numberOfDemandUGens; j++) {
      demand.reset(this, j + 2);
    }
  }
  this._prevreset = zreset;

  var prevtrig = this._prevtrig;

  for (var i = 0; i < inNumSamples; i++) {
    var ztrig = trigIn[i];

    if (0 < ztrig && prevtrig <= 0) {
      for (var _j3 = 0; _j3 < numberOfDemandUGens; _j3++) {
        var x = demand.next(this, _j3 + 2, i + 1);

        if (Number.isNaN(x)) {
          outputs[_j3][i] = prevout[_j3];
          this.done = true;
        } else {
          outputs[_j3][i] = prevout[_j3] = x;
        }
      }
    } else {
      for (var _j4 = 0; _j4 < numberOfDemandUGens; _j4++) {
        outputs[_j4][i] = prevout[_j4];
      }
    }
    prevtrig = ztrig;
  }

  this._prevtrig = prevtrig;
};

dspProcess["ai"] = dspProcess["ak"];
dspProcess["ad"] = dspProcess["ak"];

dspProcess["kk"] = function () {
  var outputs = this.outputs;
  var trig = this.inputs[0][0];
  var reset = this.inputs[1][0];
  var prevout = this._prevout;
  var numberOfDemandUGens = prevout.length;

  if (0 < reset && this._prevreset <= 0) {
    for (var j = 0; j < numberOfDemandUGens; j++) {
      demand.reset(this, j + 2);
    }
  }
  if (0 < trig && this._prevtrig <= 0) {
    for (var _j5 = 0; _j5 < numberOfDemandUGens; _j5++) {
      var x = demand.next(this, _j5 + 2, 1);

      if (Number.isNaN(x)) {
        outputs[_j5][0] = prevout[_j5];
        this.done = true;
      } else {
        outputs[_j5][0] = prevout[_j5] = x;
      }
    }
  } else {
    for (var _j6 = 0; _j6 < numberOfDemandUGens; _j6++) {
      outputs[_j6][0] = prevout[_j6];
    }
  }

  this._prevtrig = trig;
  this._prevreset = reset;
};

dspProcess["ka"] = dspProcess["kk"];
dspProcess["ki"] = dspProcess["kk"];
dspProcess["kd"] = dspProcess["kk"];

SCUnitRepository.registerSCUnitClass("Demand", SCUnitDemand);

module.exports = SCUnitDemand;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_demand":209}],51:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitDetectSilence = function (_SCUnit) {
  _inherits(SCUnitDetectSilence, _SCUnit);

  function SCUnitDetectSilence() {
    _classCallCheck(this, SCUnitDetectSilence);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDetectSilence).apply(this, arguments));
  }

  _createClass(SCUnitDetectSilence, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._thresh = this.inputs[1][0];
      this._endCounter = rate.sampleRate * this.inputs[2][0] | 0;
      this._counter = -1;
    }
  }]);

  return SCUnitDetectSilence;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var thresh = this._thresh;
  var counter = this._counter;
  for (var i = 0; i < inNumSamples; i++) {
    var val = Math.abs(inIn[i]);
    if (val > thresh) {
      counter = 0;
      out[i] = 0;
    } else if (counter >= 0) {
      counter += 1;
      if (counter >= this._endCounter) {
        this.doneAction(this.inputs[3][0] | 0);
        out[i] = 1;
      } else {
        out[i] = 0;
      }
    } else {
      out[i] = 0;
    }
  }
  this._counter = counter;
};
SCUnitRepository.registerSCUnitClass("DetectSilence", SCUnitDetectSilence);
module.exports = SCUnitDetectSilence;
},{"../SCUnit":11,"../SCUnitRepository":12}],52:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};

var SCUnitDgeom = function (_SCUnit) {
  _inherits(SCUnitDgeom, _SCUnit);

  function SCUnitDgeom() {
    _classCallCheck(this, SCUnitDgeom);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDgeom).apply(this, arguments));
  }

  _createClass(SCUnitDgeom, [{
    key: "initialize",
    value: function initialize() {

      this.dspProcess = dspProcess["d"];

      this._grow = 1;
      this._value = 0;

      this.reset();
    }
  }, {
    key: "reset",
    value: function reset() {
      this._repeats = -1;
      this._repeatCount = 0;
    }
  }]);

  return SCUnitDgeom;
}(SCUnit);

dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples === 0) {
    return this.reset();
  }

  var out = this.outputs[0];
  var grow = demand.next(this, 2, inNumSamples);

  if (!Number.isNaN(grow)) {
    this._grow = grow;
  }
  if (this._repeats < 0) {
    var x = demand.next(this, 0, inNumSamples);

    this._repeats = Math.floor(x);
    this._value = demand.next(this, 1, inNumSamples);
  }

  if (this._repeats <= this._repeatCount) {
    out[0] = NaN;
    return;
  }

  out[0] = this._value;
  this._value *= this._grow;
  this._repeatCount += 1;
};

SCUnitRepository.registerSCUnitClass("Dgeom", SCUnitDgeom);

module.exports = SCUnitDgeom;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_demand":209}],53:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var sc_fold = require("../util/sc_fold");
var dspProcess = {};

var SCUnitDibrown = function (_SCUnit) {
  _inherits(SCUnitDibrown, _SCUnit);

  function SCUnitDibrown() {
    _classCallCheck(this, SCUnitDibrown);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDibrown).apply(this, arguments));
  }

  _createClass(SCUnitDibrown, [{
    key: "initialize",
    value: function initialize() {

      this.dspProcess = dspProcess["d"];

      this._lo = 0;
      this._hi = 0;
      this._step = 0;
      this._value = 0;

      this.reset();
    }
  }, {
    key: "reset",
    value: function reset() {
      this._repeats = -1;
      this._repeatCount = 0;
    }
  }]);

  return SCUnitDibrown;
}(SCUnit);

dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples === 0) {
    return this.reset();
  }

  var lo = demand.next(this, 1, inNumSamples);
  var hi = demand.next(this, 2, inNumSamples);
  var step = demand.next(this, 3, inNumSamples);

  if (!Number.isNaN(lo)) {
    this._lo = lo;
  }
  if (!Number.isNaN(hi)) {
    this._hi = hi;
  }
  if (!Number.isNaN(step)) {
    this._step = step;
  }

  if (this._repeats < 0) {
    var x = demand.next(this, 0, inNumSamples);

    this._repeats = Number.isNaN(x) ? 0 : Math.max(0, Math.floor(x + 0.5));
    this._value = Math.floor(Math.random() * (this._hi - this._lo) + this._lo);
  }

  var out = this.outputs[0];

  if (this._repeats <= this._repeatCount) {
    out[0] = NaN;
    return;
  }

  this._repeatCount += 1;

  out[0] = this._value;

  var value = this._value + (Math.random() * 2 - 1) * this._step;

  this._value = Math.floor(sc_fold(value, this._lo, this._hi));
};

SCUnitRepository.registerSCUnitClass("Dibrown", SCUnitDibrown);

module.exports = SCUnitDibrown;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"../util/sc_fold":218,"./_demand":209}],54:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};

var SCUnitDiwhite = function (_SCUnit) {
  _inherits(SCUnitDiwhite, _SCUnit);

  function SCUnitDiwhite() {
    _classCallCheck(this, SCUnitDiwhite);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDiwhite).apply(this, arguments));
  }

  _createClass(SCUnitDiwhite, [{
    key: "initialize",
    value: function initialize() {

      this.dspProcess = dspProcess["d"];

      this._lo = 0;
      this._range = 0;

      this.reset();
    }
  }, {
    key: "reset",
    value: function reset() {
      this._repeats = -1;
      this._repeatCount = 0;
    }
  }]);

  return SCUnitDiwhite;
}(SCUnit);

dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples === 0) {
    return this.reset();
  }

  if (this._repeats < 0) {
    var x = demand.next(this, 0, inNumSamples);

    this._repeats = Number.isNaN(x) ? 0 : Math.max(0, Math.floor(x + 0.5));
  }

  var out = this.outputs[0];

  if (this._repeats <= this._repeatCount) {
    out[0] = NaN;
    return;
  }

  this._repeatCount += 1;

  var lo = demand.next(this, 1, inNumSamples);
  var hi = demand.next(this, 2, inNumSamples);

  if (!Number.isNaN(lo)) {
    this._lo = lo;
  }
  if (!Number.isNaN(hi)) {
    this._range = hi - this._lo + 1;
  }

  out[0] = Math.floor(Math.random() * this._range + this._lo);
};

SCUnitRepository.registerSCUnitClass("Diwhite", SCUnitDiwhite);

module.exports = SCUnitDiwhite;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_demand":209}],55:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};

var SCUnitDrand = function (_SCUnit) {
  _inherits(SCUnitDrand, _SCUnit);

  function SCUnitDrand() {
    _classCallCheck(this, SCUnitDrand);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDrand).apply(this, arguments));
  }

  _createClass(SCUnitDrand, [{
    key: "initialize",
    value: function initialize() {

      this.dspProcess = dspProcess["d"];
      this.reset();
    }
  }, {
    key: "reset",
    value: function reset() {
      this._repeats = -1;
      this._repeatCount = 0;
      this._needToResetChild = true;
    }
  }]);

  return SCUnitDrand;
}(SCUnit);

dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples === 0) {
    return this.reset();
  }

  if (this._repeats < 0) {
    var x = demand.next(this, 0, inNumSamples);

    this._repeats = Number.isNaN(x) ? 0 : Math.max(0, Math.floor(x + 0.5));
  }

  var out = this.outputs[0];

  for (;;) {
    if (this._repeats <= this._repeatCount) {
      out[0] = NaN;
      return;
    }

    var index = Math.floor(Math.random() * (this.inputs.length - 1)) + 1;

    if (!demand.isDemand(this, index)) {
      out[0] = demand.next(this, index, inNumSamples);
      this._repeatCount += 1;
      this._needToResetChild = true;
      return;
    }

    if (this._needToResetChild) {
      this._needToResetChild = false;
      demand.reset(this, index);
    }

    var _x = demand.next(this, index, inNumSamples);

    if (Number.isNaN(_x)) {
      this._repeatCount += 1;
      this._needToResetChild = true;
    } else {
      out[0] = _x;
      return;
    }
  }
};

SCUnitRepository.registerSCUnitClass("Drand", SCUnitDrand);

module.exports = SCUnitDrand;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_demand":209}],56:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};

var SCUnitDreset = function (_SCUnit) {
  _inherits(SCUnitDreset, _SCUnit);

  function SCUnitDreset() {
    _classCallCheck(this, SCUnitDreset);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDreset).apply(this, arguments));
  }

  _createClass(SCUnitDreset, [{
    key: "initialize",
    value: function initialize() {

      this._prev_reset = 0;

      this.dspProcess = dspProcess["d"];
    }
  }, {
    key: "reset",
    value: function reset() {
      demand.reset(this, 0);
    }
  }]);

  return SCUnitDreset;
}(SCUnit);

dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples === 0) {
    return this.reset();
  }

  var out = this.outputs[0];
  var x = demand.next(this, 0, inNumSamples);
  var reset = demand.next(this, 1, inNumSamples);

  if (Number.isNaN(x)) {
    out[0] = NaN;
    return;
  }

  if (0 < reset && this._prev_reset <= 0) {
    demand.reset(this, 0);
  }
  this._prev_reset = reset;

  out[0] = x;
};

SCUnitRepository.registerSCUnitClass("Dreset", SCUnitDreset);

module.exports = SCUnitDreset;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_demand":209}],57:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};

var SCUnitDseq = function (_SCUnit) {
  _inherits(SCUnitDseq, _SCUnit);

  function SCUnitDseq() {
    _classCallCheck(this, SCUnitDseq);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDseq).apply(this, arguments));
  }

  _createClass(SCUnitDseq, [{
    key: "initialize",
    value: function initialize() {

      this.dspProcess = dspProcess["d"];
      this.reset();
    }
  }, {
    key: "reset",
    value: function reset() {
      this._repeats = -1;
      this._repeatCount = 0;
      this._index = 1;
      this._needToResetChild = true;
    }
  }]);

  return SCUnitDseq;
}(SCUnit);

dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples === 0) {
    return this.reset();
  }

  if (this._repeats < 0) {
    var x = demand.next(this, 0, inNumSamples);

    this._repeats = Number.isNaN(x) ? 0 : Math.max(0, Math.floor(x + 0.5));
  }

  var out = this.outputs[0];

  for (;;) {
    if (this.inputs.length <= this._index) {
      this._index = 1;
      this._repeatCount += 1;
    }

    if (this._repeats <= this._repeatCount) {
      out[0] = NaN;
      return;
    }

    var index = this._index;

    if (!demand.isDemand(this, index)) {
      out[0] = demand.next(this, index, inNumSamples);
      this._index += 1;
      this._needToResetChild = true;
      return;
    }

    if (this._needToResetChild) {
      this._needToResetChild = false;
      demand.reset(this, index);
    }

    var _x = demand.next(this, index, inNumSamples);

    if (Number.isNaN(_x)) {
      this._index += 1;
      this._needToResetChild = true;
    } else {
      out[0] = _x;
      return;
    }
  }
};

SCUnitRepository.registerSCUnitClass("Dseq", SCUnitDseq);

module.exports = SCUnitDseq;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_demand":209}],58:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};

var SCUnitDser = function (_SCUnit) {
  _inherits(SCUnitDser, _SCUnit);

  function SCUnitDser() {
    _classCallCheck(this, SCUnitDser);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDser).apply(this, arguments));
  }

  _createClass(SCUnitDser, [{
    key: "initialize",
    value: function initialize() {

      this.dspProcess = dspProcess["d"];
      this.reset();
    }
  }, {
    key: "reset",
    value: function reset() {
      this._repeats = -1;
      this._repeatCount = 0;
      this._index = 1;
      this._needToResetChild = true;
    }
  }]);

  return SCUnitDser;
}(SCUnit);

dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples === 0) {
    return this.reset();
  }

  if (this._repeats < 0) {
    var x = demand.next(this, 0, inNumSamples);

    this._repeats = Number.isNaN(x) ? 0 : Math.max(0, Math.floor(x + 0.5));
  }

  var out = this.outputs[0];

  for (;;) {
    if (this.inputs.length <= this._index) {
      this._index = 1;
    }

    if (this._repeats <= this._repeatCount) {
      out[0] = NaN;
      return;
    }

    var index = this._index;

    if (!demand.isDemand(this, index)) {
      out[0] = demand.next(this, index, inNumSamples);
      this._index += 1;
      this._repeatCount += 1;
      this._needToResetChild = true;
      return;
    }

    if (this._needToResetChild) {
      this._needToResetChild = false;
      demand.reset(this, index);
    }

    var _x = demand.next(this, index, inNumSamples);

    if (Number.isNaN(_x)) {
      this._index += 1;
      this._repeatCount += 1;
      this._needToResetChild = true;
    } else {
      out[0] = _x;
      return;
    }
  }
};

SCUnitRepository.registerSCUnitClass("Dser", SCUnitDser);

module.exports = SCUnitDser;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_demand":209}],59:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};

var SCUnitDseries = function (_SCUnit) {
  _inherits(SCUnitDseries, _SCUnit);

  function SCUnitDseries() {
    _classCallCheck(this, SCUnitDseries);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDseries).apply(this, arguments));
  }

  _createClass(SCUnitDseries, [{
    key: "initialize",
    value: function initialize() {

      this.dspProcess = dspProcess["d"];

      this._step = 0;
      this._value = 0;

      this.reset();
    }
  }, {
    key: "reset",
    value: function reset() {
      this._repeats = -1;
      this._repeatCount = 0;
    }
  }]);

  return SCUnitDseries;
}(SCUnit);

dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples === 0) {
    return this.reset();
  }

  var out = this.outputs[0];
  var step = demand.next(this, 2, inNumSamples);

  if (!Number.isNaN(step)) {
    this._step = step;
  }
  if (this._repeats < 0) {
    var x = demand.next(this, 0, inNumSamples);

    this._repeats = Math.floor(x);
    this._value = demand.next(this, 1, inNumSamples);
  }

  if (this._repeats <= this._repeatCount) {
    out[0] = NaN;
    return;
  }

  out[0] = this._value;
  this._value += this._step;
  this._repeatCount += 1;
};

SCUnitRepository.registerSCUnitClass("Dseries", SCUnitDseries);

module.exports = SCUnitDseries;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_demand":209}],60:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var nmap = require("nmap");
var shuffle = require("shuffle-array");
var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};

var SCUnitDShuf = function (_SCUnit) {
  _inherits(SCUnitDShuf, _SCUnit);

  function SCUnitDShuf() {
    _classCallCheck(this, SCUnitDShuf);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDShuf).apply(this, arguments));
  }

  _createClass(SCUnitDShuf, [{
    key: "initialize",
    value: function initialize() {

      this.dspProcess = dspProcess["d"];

      this._indices = shuffle(nmap(this.inputs.length - 1, function (_, i) {
        return i + 1;
      }));

      this.reset();
    }
  }, {
    key: "reset",
    value: function reset() {
      this._repeats = -1;
      this._repeatCount = 0;
      this._index = 0;
      this._needToResetChild = true;
    }
  }]);

  return SCUnitDShuf;
}(SCUnit);

dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples === 0) {
    return this.reset();
  }

  if (this._repeats < 0) {
    var x = demand.next(this, 0, inNumSamples);

    this._repeats = Number.isNaN(x) ? 0 : Math.max(0, Math.floor(x + 0.5));
  }

  var out = this.outputs[0];

  for (;;) {
    if (this._indices.length <= this._index) {
      this._index = 0;
      this._repeatCount += 1;
    }

    if (this._repeats <= this._repeatCount) {
      out[0] = NaN;
      return;
    }

    var index = this._indices[this._index];

    if (!demand.isDemand(this, index)) {
      out[0] = demand.next(this, index, inNumSamples);
      this._index += 1;
      this._needToResetChild = true;
      return;
    }

    if (this._needToResetChild) {
      this._needToResetChild = false;
      demand.reset(this, index);
    }

    var _x = demand.next(this, index, inNumSamples);

    if (Number.isNaN(_x)) {
      this._index += 1;
      this._needToResetChild = true;
    } else {
      out[0] = _x;
      return;
    }
  }
};

SCUnitRepository.registerSCUnitClass("DShuf", SCUnitDShuf);

module.exports = SCUnitDShuf;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_demand":209,"nmap":2,"shuffle-array":228}],61:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};

var SCUnitDstutter = function (_SCUnit) {
  _inherits(SCUnitDstutter, _SCUnit);

  function SCUnitDstutter() {
    _classCallCheck(this, SCUnitDstutter);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDstutter).apply(this, arguments));
  }

  _createClass(SCUnitDstutter, [{
    key: "initialize",
    value: function initialize() {

      this.dspProcess = dspProcess["d"];

      this.reset();
    }
  }, {
    key: "reset",
    value: function reset() {
      this._repeats = -1;
      this._repeatCount = 0;
      demand.reset(this, 0);
      demand.reset(this, 1);
    }
  }]);

  return SCUnitDstutter;
}(SCUnit);

dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples === 0) {
    return this.reset();
  }

  var out = this.outputs[0];

  if (this._repeats <= this._repeatCount) {
    var value = demand.next(this, 1, inNumSamples);
    var repeats = demand.next(this, 0, inNumSamples);

    if (Number.isNaN(value) || Number.isNaN(repeats)) {
      out[0] = NaN;
      return;
    }

    this._value = value;
    this._repeats = Math.max(0, Math.floor(repeats + 0.5));
    this._repeatCount = 0;
  }

  out[0] = this._value;
  this._repeatCount += 1;
};

SCUnitRepository.registerSCUnitClass("Dstutter", SCUnitDstutter);

module.exports = SCUnitDstutter;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_demand":209}],62:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};

var SCUnitDswitch = function (_SCUnit) {
  _inherits(SCUnitDswitch, _SCUnit);

  function SCUnitDswitch() {
    _classCallCheck(this, SCUnitDswitch);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDswitch).apply(this, arguments));
  }

  _createClass(SCUnitDswitch, [{
    key: "initialize",
    value: function initialize() {

      this._index = computeIndex(demand.next(this, 0, 1), this.inputs.length);

      this.dspProcess = dspProcess["d"];
    }
  }, {
    key: "reset",
    value: function reset() {
      for (var i = 0, imax = this.inputs.length; i < imax; i++) {
        demand.reset(this, i);
      }
      this._index = computeIndex(demand.next(this, 0, 1), this.inputs.length);
    }
  }]);

  return SCUnitDswitch;
}(SCUnit);

function computeIndex(index, length) {
  index = index = (index | 0) % (length - 1);
  if (index < 0) {
    index += length - 1;
  }
  return index + 1;
}

dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples === 0) {
    return this.reset();
  }

  var out = this.outputs[0];

  var val = demand.next(this, this._index, inNumSamples);

  if (Number.isNaN(val)) {
    var ival = demand.next(this, 0, inNumSamples);

    if (Number.isNaN(ival)) {
      val = NaN;
    } else {
      var index = computeIndex(ival, this.inputs.length);

      val = demand.next(this, index, inNumSamples);
      demand.reset(this, this._index);

      this._index = index;
    }
  }

  out[0] = val;
};

SCUnitRepository.registerSCUnitClass("Dswitch", SCUnitDswitch);

module.exports = SCUnitDswitch;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_demand":209}],63:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};

var SCUnitDswitch1 = function (_SCUnit) {
  _inherits(SCUnitDswitch1, _SCUnit);

  function SCUnitDswitch1() {
    _classCallCheck(this, SCUnitDswitch1);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDswitch1).apply(this, arguments));
  }

  _createClass(SCUnitDswitch1, [{
    key: "initialize",
    value: function initialize() {

      this.dspProcess = dspProcess["d"];
    }
  }, {
    key: "reset",
    value: function reset() {
      for (var i = 0, imax = this.inputs.length; i < imax; i++) {
        demand.reset(this, i);
      }
    }
  }]);

  return SCUnitDswitch1;
}(SCUnit);

dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples === 0) {
    return this.reset();
  }

  var out = this.outputs[0];
  var x = demand.next(this, 0);

  if (Number.isNaN(x)) {
    out[0] = NaN;
    return;
  }

  var index = Math.floor(x + 0.5) % (this.inputs.length - 1) + 1;

  out[0] = demand.next(this, index, inNumSamples);
};

SCUnitRepository.registerSCUnitClass("Dswitch1", SCUnitDswitch1);

module.exports = SCUnitDswitch1;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_demand":209}],64:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitDust = function (_SCUnit) {
  _inherits(SCUnitDust, _SCUnit);

  function SCUnitDust() {
    _classCallCheck(this, SCUnitDust);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDust).apply(this, arguments));
  }

  _createClass(SCUnitDust, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleDur = rate.sampleDur;
      this._density = 0;
      this._scale = 0;
      this._thresh = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitDust;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var density = this.inputs[0][0];
  if (density !== this._density) {
    this._thresh = density * this._sampleDur;
    this._scale = this._thresh > 0 ? 1 / this._thresh : 0;
    this._density = density;
  }
  var thresh = this._thresh;
  var scale = this._scale;
  for (var i = 0; i < inNumSamples; i++) {
    var z = Math.random();
    out[i] = z < thresh ? z * scale : 0;
  }
};
SCUnitRepository.registerSCUnitClass("Dust", SCUnitDust);
module.exports = SCUnitDust;
},{"../SCUnit":11,"../SCUnitRepository":12}],65:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitDust2 = function (_SCUnit) {
  _inherits(SCUnitDust2, _SCUnit);

  function SCUnitDust2() {
    _classCallCheck(this, SCUnitDust2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDust2).apply(this, arguments));
  }

  _createClass(SCUnitDust2, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleDur = rate.sampleDur;
      this._density = 0;
      this._scale = 0;
      this._thresh = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitDust2;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var density = this.inputs[0][0];
  if (density !== this._density) {
    this._thresh = density * this._sampleDur;
    this._scale = this._thresh > 0 ? 2 / this._thresh : 0;
    this._density = density;
  }
  var thresh = this._thresh;
  var scale = this._scale;
  for (var i = 0; i < inNumSamples; i++) {
    var z = Math.random();
    out[i] = z < thresh ? z * scale - 1 : 0;
  }
};
SCUnitRepository.registerSCUnitClass("Dust2", SCUnitDust2);
module.exports = SCUnitDust2;
},{"../SCUnit":11,"../SCUnitRepository":12}],66:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _$r2k;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};
var $r2k = (_$r2k = {}, _defineProperty(_$r2k, C.RATE_SCALAR, "di"), _defineProperty(_$r2k, C.RATE_CONTROL, "dk"), _defineProperty(_$r2k, C.RATE_AUDIO, "da"), _defineProperty(_$r2k, C.RATE_DEMAND, "dd"), _$r2k);

var SCUnitDuty = function (_SCUnit) {
  _inherits(SCUnitDuty, _SCUnit);

  function SCUnitDuty() {
    _classCallCheck(this, SCUnitDuty);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDuty).apply(this, arguments));
  }

  _createClass(SCUnitDuty, [{
    key: "initialize",
    value: function initialize(rate) {

      this.dspProcess = dspProcess[$r2k[this.inputSpecs[1].rate]];

      this._sampleRate = rate.sampleRate;
      this._prevreset = 0;
      this._count = demand.next(this, 0, 1) * this._sampleRate - 1;
      this._prevout = demand.next(this, 3, 1);

      if (this.inputSpecs[1].rate === C.RATE_DEMAND) {
        this._prevreset = demand.next(this, 1, 1) * this._sampleRate;
      }

      this.outputs[0][0] = this._prevout;
    }
  }]);

  return SCUnitDuty;
}(SCUnit);

dspProcess["da"] = function (inNumSamples) {
  var out = this.outputs[0];
  var resetIn = this.inputs[1];
  var sampleRate = this._sampleRate;

  var prevout = this._prevout;
  var count = this._count;
  var prevreset = this._prevreset;

  for (var i = 0; i < inNumSamples; i++) {
    var zreset = resetIn[i];

    if (0 < zreset && prevreset <= 0) {
      demand.reset(this, 0);
      demand.reset(this, 3);
      count = 0;
    }

    if (count <= 0) {
      count += demand.next(this, 0, i + 1) * sampleRate;
      if (Number.isNaN(count)) {
        this.doneAction(this.inputs[2][0]);
      }

      var x = demand.next(this, 3, i + 1);

      if (Number.isNaN(x)) {
        x = prevout;
        this.doneAction(this.inputs[2][0]);
      } else {
        prevout = x;
      }
      out[i] = x;
    } else {
      out[i] = prevout;
    }

    count -= 1;
    prevreset = zreset;
  }

  this._count = count;
  this._prevreset = prevreset;
  this._prevout = prevout;
};

dspProcess["dk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var zreset = this.inputs[1][0];
  var sampleRate = this._sampleRate;

  var prevout = this._prevout;
  var count = this._count;

  if (0 < zreset && this._prevreset <= 0) {
    demand.reset(this, 0);
    demand.reset(this, 3);
    count = 0;
  }

  for (var i = 0; i < inNumSamples; i++) {
    if (count <= 0) {
      count += demand.next(this, 0, i + 1) * sampleRate;
      if (Number.isNaN(count)) {
        this.doneAction(this.inputs[2][0]);
      }

      var x = demand.next(this, 3, i + 1);

      if (Number.isNaN(x)) {
        x = prevout;
        this.doneAction(this.inputs[2][0]);
      } else {
        prevout = x;
      }
      out[i] = x;
    } else {
      out[i] = prevout;
    }
    count -= 1;
  }

  this._count = count;
  this._prevreset = zreset;
  this._prevout = prevout;
};

dspProcess["di"] = dspProcess["dk"];

dspProcess["dd"] = function (inNumSamples) {
  var out = this.outputs[0];
  var sampleRate = this._sampleRate;

  var prevout = this._prevout;
  var count = this._count;
  var reset = this._prevreset;

  for (var i = 0; i < inNumSamples; i++) {
    if (reset <= 0) {
      demand.next(this, 0);
      demand.next(this, 3);
      count = 0;
      reset += demand.next(this, 1, i + 1) * sampleRate;
    } else {
      reset -= 1;
    }

    if (count <= 0) {
      count += demand.next(this, 0, i + 1) * sampleRate;
      if (Number.isNaN(count)) {
        this.doneAction(this.inputs[2][0]);
      }
      var x = demand.next(this, 3, i + 1);

      if (Number.isNaN(x)) {
        x = prevout;
        this.doneAction(this.inputs[2][0]);
      } else {
        prevout = x;
      }
    }

    out[i] = prevout;
    count -= 1;
  }

  this._count = count;
  this._prevreset = reset;
  this._prevout = prevout;
};

SCUnitRepository.registerSCUnitClass("Duty", SCUnitDuty);

module.exports = SCUnitDuty;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_demand":209}],67:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};

var SCUnitDwhite = function (_SCUnit) {
  _inherits(SCUnitDwhite, _SCUnit);

  function SCUnitDwhite() {
    _classCallCheck(this, SCUnitDwhite);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDwhite).apply(this, arguments));
  }

  _createClass(SCUnitDwhite, [{
    key: "initialize",
    value: function initialize() {

      this.dspProcess = dspProcess["d"];

      this._lo = 0;
      this._range = 0;

      this.reset();
    }
  }, {
    key: "reset",
    value: function reset() {
      this._repeats = -1;
      this._repeatCount = 0;
    }
  }]);

  return SCUnitDwhite;
}(SCUnit);

dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples === 0) {
    return this.reset();
  }

  if (this._repeats < 0) {
    var x = demand.next(this, 0, inNumSamples);

    this._repeats = Number.isNaN(x) ? 0 : Math.max(0, Math.floor(x + 0.5));
  }

  var out = this.outputs[0];

  if (this._repeats <= this._repeatCount) {
    out[0] = NaN;
    return;
  }

  this._repeatCount += 1;

  var lo = demand.next(this, 1, inNumSamples);
  var hi = demand.next(this, 2, inNumSamples);

  if (!Number.isNaN(lo)) {
    this._lo = lo;
  }
  if (!Number.isNaN(hi)) {
    this._range = hi - this._lo;
  }

  out[0] = Math.random() * this._range + this._lo;
};

SCUnitRepository.registerSCUnitClass("Dwhite", SCUnitDwhite);

module.exports = SCUnitDwhite;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_demand":209}],68:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};

var SCUnitDwrand = function (_SCUnit) {
  _inherits(SCUnitDwrand, _SCUnit);

  function SCUnitDwrand() {
    _classCallCheck(this, SCUnitDwrand);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDwrand).apply(this, arguments));
  }

  _createClass(SCUnitDwrand, [{
    key: "initialize",
    value: function initialize() {

      this.dspProcess = dspProcess["d"];

      this._weightsSize = this.inputs[1][0];

      this._index = 2 + this._weightsSize;

      this.reset();
    }
  }, {
    key: "reset",
    value: function reset() {
      this._repeats = -1;
      this._repeatCount = 0;
      this._needToResetChild = true;
    }
  }]);

  return SCUnitDwrand;
}(SCUnit);

function nextIndex(inputs, length) {
  var r = Math.random();

  var sum = 0;

  for (var i = 0; i < length; i++) {
    sum += inputs[i + 2][0];
    if (r <= sum) {
      return i + (2 + length);
    }
  }

  return inputs.length - 1;
}

dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples === 0) {
    return this.reset();
  }

  if (this._repeats < 0) {
    var x = demand.next(this, 0, inNumSamples);

    this._repeats = Number.isNaN(x) ? 0 : Math.max(0, Math.floor(x + 0.5));
  }

  var out = this.outputs[0];

  for (;;) {
    if (this._repeats <= this._repeatCount) {
      out[0] = NaN;
      return;
    }

    if (!demand.isDemand(this, this._index)) {
      out[0] = demand.next(this, this._index, inNumSamples);
      this._index = nextIndex(this.inputs, this._weightsSize);
      this._repeatCount += 1;
      this._needToResetChild = true;
      return;
    }

    if (this._needToResetChild) {
      this._needToResetChild = false;
      demand.reset(this, this._index);
    }

    var _x = demand.next(this, this._index, inNumSamples);

    if (Number.isNaN(_x)) {
      this._index = nextIndex(this.inputs, this._weightsSize);
      this._repeatCount += 1;
      this._needToResetChild = true;
    } else {
      out[0] = _x;
      return;
    }
  }
};

SCUnitRepository.registerSCUnitClass("Dwrand", SCUnitDwrand);

module.exports = SCUnitDwrand;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_demand":209}],69:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};

var SCUnitDxrand = function (_SCUnit) {
  _inherits(SCUnitDxrand, _SCUnit);

  function SCUnitDxrand() {
    _classCallCheck(this, SCUnitDxrand);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitDxrand).apply(this, arguments));
  }

  _createClass(SCUnitDxrand, [{
    key: "initialize",
    value: function initialize() {

      this.dspProcess = dspProcess["d"];
      this.reset();
    }
  }, {
    key: "reset",
    value: function reset() {
      this._repeats = -1;
      this._repeatCount = 0;
      this._index = nextIndex(this.inputs.length);
      this._needToResetChild = true;
    }
  }]);

  return SCUnitDxrand;
}(SCUnit);

function nextIndex(length) {
  return Math.floor(Math.random() * (length - 2)) + 1;
}

dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples === 0) {
    return this.reset();
  }

  if (this._repeats < 0) {
    var x = demand.next(this, 0, inNumSamples);

    this._repeats = Number.isNaN(x) ? 0 : Math.max(0, Math.floor(x + 0.5));
  }

  var out = this.outputs[0];

  for (;;) {
    if (this._repeats <= this._repeatCount) {
      out[0] = NaN;
      return;
    }

    var newIndex = nextIndex(this.inputs.length);
    var index = newIndex < this._index ? newIndex : newIndex + 1;

    this._index = index;

    if (!demand.isDemand(this, index)) {
      out[0] = demand.next(this, index, inNumSamples);
      this._repeatCount += 1;
      this._needToResetChild = true;
      return;
    }

    if (this._needToResetChild) {
      this._needToResetChild = false;
      demand.reset(this, index);
    }

    var _x = demand.next(this, index, inNumSamples);

    if (Number.isNaN(_x)) {
      this._repeatCount += 1;
      this._needToResetChild = true;
    } else {
      out[0] = _x;
      return;
    }
  }
};

SCUnitRepository.registerSCUnitClass("Dxrand", SCUnitDxrand);

module.exports = SCUnitDxrand;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_demand":209}],70:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var kEnvGen_gate = 0;
var kEnvGen_levelScale = 1;
var kEnvGen_levelBias = 2;
var kEnvGen_timeScale = 3;
var kEnvGen_doneAction = 4;
var kEnvGen_initLevel = 5;
var kEnvGen_numStages = 6;
var kEnvGen_releaseNode = 7;
var kEnvGen_loopNode = 8;
var kEnvGen_nodeOffset = 9;
var shape_Step = 0;
var shape_Linear = 1;
var shape_Exponential = 2;
var shape_Sine = 3;
var shape_Welch = 4;
var shape_Curve = 5;
var shape_Squared = 6;
var shape_Cubed = 7;
var shape_Sustain = 9999;

var SCUnitEnvGen = function (_SCUnit) {
  _inherits(SCUnitEnvGen, _SCUnit);

  function SCUnitEnvGen() {
    _classCallCheck(this, SCUnitEnvGen);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitEnvGen).apply(this, arguments));
  }

  _createClass(SCUnitEnvGen, [{
    key: "initialize",
    value: function initialize(rate) {
      this.rate = rate;
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_ak"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      this._level = this.inputs[kEnvGen_initLevel][0] * this.inputs[kEnvGen_levelScale][0] + this.inputs[kEnvGen_levelBias][0];
      this._endLevel = this._level;
      this._counter = 0;
      this._stage = 1000000000;
      this._prevGate = 0;
      this._released = false;
      this._releaseNode = this.inputs[kEnvGen_releaseNode][0] | 0;
      this._a1 = 0;
      this._a2 = 0;
      this._b1 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._grow = 0;
      this._shape = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitEnvGen;
}(SCUnit);

dspProcess["next_ak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var gate = this.inputs[kEnvGen_gate][0];
  var counter = this._counter;
  var level = this._level;
  var prevGate = this._prevGate;
  var numstages = void 0,
      doneAction = void 0,
      loopNode = void 0;
  var envPtr = void 0,
      stageOffset = void 0,
      endLevel = void 0,
      dur = void 0,
      shape = void 0,
      curve = void 0;
  var w = void 0,
      a1 = void 0,
      a2 = void 0,
      b1 = void 0,
      y0 = void 0,
      y1 = void 0,
      y2 = void 0,
      grow = void 0;
  var i = void 0,
      j = 0;
  var counterOffset = 0;
  if (prevGate <= 0 && gate > 0) {
    this._stage = -1;
    this._released = false;
    this.done = false;
    counter = counterOffset;
  } else if (gate <= -1 && prevGate > -1 && !this._released) {
    numstages = this.inputs[kEnvGen_numStages][0] | 0;
    dur = -gate - 1;
    counter = Math.max(1, dur * this.rate.sampleRate | 0) + counterOffset;
    this._stage = numstages;
    this._shape = shape_Linear;
    this._endLevel = this.inputs[this.inputs.length - 4][0] * this.inputs[kEnvGen_levelScale][0] + this.inputs[kEnvGen_levelBias][0];
    this._grow = (this._endLevel - level) / counter;
    this._released = true;
  } else if (prevGate > 0 && gate <= 0 && this._releaseNode >= 0 && !this._released) {
    counter = counterOffset;
    this._stage = this._releaseNode - 1;
    this._released = true;
  }
  this._prevGate = gate;
  var remain = inNumSamples;
  while (remain) {
    var initSegment = false;
    if (counter === 0) {
      numstages = this.inputs[kEnvGen_numStages][0] | 0;
      if (this._stage + 1 >= numstages) {
        counter = Infinity;
        this._shape = 0;
        level = this._endLevel;
        this.done = true;
        doneAction = this.inputs[kEnvGen_doneAction][0] | 0;
        this.doneAction(doneAction);
      } else if (this._stage + 1 === this._releaseNode && !this._released) {
        loopNode = this.inputs[kEnvGen_loopNode][0] | 0;
        if (loopNode >= 0 && loopNode < numstages) {
          this._stage = loopNode;
          initSegment = true;
        } else {
          counter = Infinity;
          this._shape = shape_Sustain;
          level = this._endLevel;
        }
      } else {
        this._stage += 1;
        initSegment = true;
      }
    }
    if (initSegment) {
      stageOffset = (this._stage << 2) + kEnvGen_nodeOffset;
      if (stageOffset + 4 > this.inputs.length) {
        return;
      }
      envPtr = this.inputs;
      endLevel = envPtr[0 + stageOffset][0] * this.inputs[kEnvGen_levelScale][0] + this.inputs[kEnvGen_levelBias][0];
      dur = envPtr[1 + stageOffset][0] * this.inputs[kEnvGen_timeScale][0];
      shape = envPtr[2 + stageOffset][0] | 0;
      curve = envPtr[3 + stageOffset][0];
      this._endLevel = endLevel;
      this._shape = shape;
      counter = Math.max(1, dur * this.rate.sampleRate | 0);
      if (counter === 1) {
        this._shape = shape_Linear;
      }
      switch (this._shape) {
        case shape_Step:
          level = endLevel;
          break;
        case shape_Linear:
          this._grow = (endLevel - level) / counter;
          break;
        case shape_Exponential:
          if (Math.abs(level) < 0.000001) {
            level = 0.000001;
          }
          this._grow = Math.pow(endLevel / level, 1 / counter);
          break;
        case shape_Sine:
          w = Math.PI / counter;
          this._a2 = (endLevel + level) * 0.5;
          this._b1 = 2 * Math.cos(w);
          this._y1 = (endLevel - level) * 0.5;
          this._y2 = this._y1 * Math.sin(Math.PI * 0.5 - w);
          level = this._a2 - this._y1;
          break;
        case shape_Welch:
          w = Math.PI * 0.5 / counter;
          this._b1 = 2 * Math.cos(w);
          if (endLevel >= level) {
            this._a2 = level;
            this._y1 = 0;
            this._y2 = -Math.sin(w) * (endLevel - level);
          } else {
            this._a2 = endLevel;
            this._y1 = level - endLevel;
            this._y2 = Math.cos(w) * (level - endLevel);
          }
          level = this._a2 + this._y1;
          break;
        case shape_Curve:
          if (Math.abs(curve) < 0.001) {
            this._shape = shape_Linear;
            this._grow = (endLevel - level) / counter;
          } else {
            a1 = (endLevel - level) / (1 - Math.exp(curve));
            this._a2 = level + a1;
            this._b1 = a1;
            this._grow = Math.exp(curve / counter);
          }
          break;
        case shape_Squared:
          this._y1 = Math.sqrt(level);
          this._y2 = Math.sqrt(endLevel);
          this._grow = (this._y2 - this._y1) / counter;
          break;
        case shape_Cubed:
          this._y1 = Math.pow(level, 0.33333333);
          this._y2 = Math.pow(endLevel, 0.33333333);
          this._grow = (this._y2 - this._y1) / counter;
          break;
      }
    }
    var nsmps = Math.min(remain, counter);
    grow = this._grow;
    a2 = this._a2;
    b1 = this._b1;
    y1 = this._y1;
    y2 = this._y2;
    switch (this._shape) {
      case shape_Step:
        for (i = 0; i < nsmps; ++i) {
          out[j++] = level;
        }
        break;
      case shape_Linear:
        for (i = 0; i < nsmps; ++i) {
          out[j++] = level;
          level += grow;
        }
        break;
      case shape_Exponential:
        for (i = 0; i < nsmps; ++i) {
          out[j++] = level;
          level *= grow;
        }
        break;
      case shape_Sine:
        for (i = 0; i < nsmps; ++i) {
          out[j++] = level;
          y0 = b1 * y1 - y2;
          level = a2 - y0;
          y2 = y1;
          y1 = y0;
        }
        break;
      case shape_Welch:
        for (i = 0; i < nsmps; ++i) {
          out[j++] = level;
          y0 = b1 * y1 - y2;
          level = a2 + y0;
          y2 = y1;
          y1 = y0;
        }
        break;
      case shape_Curve:
        for (i = 0; i < nsmps; ++i) {
          out[j++] = level;
          b1 *= grow;
          level = a2 - b1;
        }
        break;
      case shape_Squared:
        for (i = 0; i < nsmps; ++i) {
          out[j++] = level;
          y1 += grow;
          level = y1 * y1;
        }
        break;
      case shape_Cubed:
        for (i = 0; i < nsmps; ++i) {
          out[j++] = level;
          y1 += grow;
          level = y1 * y1 * y1;
        }
        break;
      case shape_Sustain:
        for (i = 0; i < nsmps; ++i) {
          out[j++] = level;
        }
        break;
    }
    remain -= nsmps;
    counter -= nsmps;
  }
  this._level = level;
  this._counter = counter;
  this._a2 = a2;
  this._b1 = b1;
  this._y1 = y1;
  this._y2 = y2;
};
dspProcess["next_k"] = function () {
  var out = this.outputs[0];
  var gate = this.inputs[kEnvGen_gate][0];
  var counter = this._counter;
  var level = this._level;
  var prevGate = this._prevGate;
  var numstages = void 0,
      doneAction = void 0,
      loopNode = void 0;
  var envPtr = void 0,
      stageOffset = void 0,
      endLevel = void 0,
      dur = void 0,
      shape = void 0,
      curve = void 0;
  var w = void 0,
      a1 = void 0,
      a2 = void 0,
      b1 = void 0,
      y0 = void 0,
      y1 = void 0,
      y2 = void 0,
      grow = void 0;
  var counterOffset = 0;
  if (prevGate <= 0 && gate > 0) {
    this._stage = -1;
    this._released = false;
    this.done = false;
    counter = counterOffset;
  } else if (gate <= -1 && prevGate > -1 && !this._released) {
    numstages = this.inputs[kEnvGen_numStages][0] | 0;
    dur = -gate - 1;
    counter = Math.max(1, dur * this.rate.sampleRate | 0) + counterOffset;
    this._stage = numstages;
    this._shape = shape_Linear;
    this._endLevel = this.inputs[this.inputs.length - 4][0] * this.inputs[kEnvGen_levelScale][0] + this.inputs[kEnvGen_levelBias][0];
    this._grow = (this._endLevel - level) / counter;
    this._released = true;
  } else if (prevGate > 0 && gate <= 0 && this._releaseNode >= 0 && !this._released) {
    counter = counterOffset;
    this._stage = this._releaseNode - 1;
    this._released = true;
  }
  this._prevGate = gate;
  var initSegment = false;
  if (counter <= 0) {
    numstages = this.inputs[kEnvGen_numStages][0] | 0;
    if (this._stage + 1 >= numstages) {
      counter = Infinity;
      this._shape = 0;
      level = this._endLevel;
      this.done = true;
      doneAction = this.inputs[kEnvGen_doneAction][0] | 0;
      this.doneAction(doneAction);
    } else if (this._stage + 1 === this._releaseNode && !this._released) {
      loopNode = this.inputs[kEnvGen_loopNode][0] | 0;
      if (loopNode >= 0 && loopNode < numstages) {
        this._stage = loopNode;
        initSegment = true;
      } else {
        counter = Infinity;
        this._shape = shape_Sustain;
        level = this._endLevel;
      }
    } else {
      this._stage += 1;
      initSegment = true;
    }
  }
  if (initSegment) {
    stageOffset = (this._stage << 2) + kEnvGen_nodeOffset;
    if (stageOffset + 4 > this.inputs.length) {
      return;
    }
    envPtr = this.inputs;
    endLevel = envPtr[0 + stageOffset][0] * this.inputs[kEnvGen_levelScale][0] + this.inputs[kEnvGen_levelBias][0];
    dur = envPtr[1 + stageOffset][0] * this.inputs[kEnvGen_timeScale][0];
    shape = envPtr[2 + stageOffset][0] | 0;
    curve = envPtr[3 + stageOffset][0];
    this._endLevel = endLevel;
    this._shape = shape;
    counter = Math.max(1, dur * this.rate.sampleRate | 0);
    if (counter === 1) {
      this._shape = shape_Linear;
    }
    switch (this._shape) {
      case shape_Step:
        level = endLevel;
        break;
      case shape_Linear:
        this._grow = (endLevel - level) / counter;
        break;
      case shape_Exponential:
        if (Math.abs(level) < 0.000001) {
          level = 0.000001;
        }
        this._grow = Math.pow(endLevel / level, 1 / counter);
        break;
      case shape_Sine:
        w = Math.PI / counter;
        this._a2 = (endLevel + level) * 0.5;
        this._b1 = 2 * Math.cos(w);
        this._y1 = (endLevel - level) * 0.5;
        this._y2 = this._y1 * Math.sin(Math.PI * 0.5 - w);
        level = this._a2 - this._y1;
        break;
      case shape_Welch:
        w = Math.PI * 0.5 / counter;
        this._b1 = 2 * Math.cos(w);
        if (endLevel >= level) {
          this._a2 = level;
          this._y1 = 0;
          this._y2 = -Math.sin(w) * (endLevel - level);
        } else {
          this._a2 = endLevel;
          this._y1 = level - endLevel;
          this._y2 = Math.cos(w) * (level - endLevel);
        }
        level = this._a2 + this._y1;
        break;
      case shape_Curve:
        if (Math.abs(curve) < 0.001) {
          this._shape = shape_Linear;
          this._grow = (endLevel - level) / counter;
        } else {
          a1 = (endLevel - level) / (1 - Math.exp(curve));
          this._a2 = level + a1;
          this._b1 = a1;
          this._grow = Math.exp(curve / counter);
        }
        break;
      case shape_Squared:
        this._y1 = Math.sqrt(level);
        this._y2 = Math.sqrt(endLevel);
        this._grow = (this._y2 - this._y1) / counter;
        break;
      case shape_Cubed:
        this._y1 = Math.pow(level, 0.33333333);
        this._y2 = Math.pow(endLevel, 0.33333333);
        this._grow = (this._y2 - this._y1) / counter;
        break;
    }
  }
  grow = this._grow;
  a2 = this._a2;
  b1 = this._b1;
  y1 = this._y1;
  y2 = this._y2;
  switch (this._shape) {
    case shape_Step:
      break;
    case shape_Linear:
      level += grow;
      break;
    case shape_Exponential:
      level *= grow;
      break;
    case shape_Sine:
      y0 = b1 * y1 - y2;
      level = a2 - y0;
      y2 = y1;
      y1 = y0;
      break;
    case shape_Welch:
      y0 = b1 * y1 - y2;
      level = a2 + y0;
      y2 = y1;
      y1 = y0;
      break;
    case shape_Curve:
      b1 *= grow;
      level = a2 - b1;
      break;
    case shape_Squared:
      y1 += grow;
      level = y1 * y1;
      break;
    case shape_Cubed:
      y1 += grow;
      level = y1 * y1 * y1;
      break;
    case shape_Sustain:
      break;
  }
  out[0] = level;
  this._level = level;
  this._counter = counter - 1;
  this._a2 = a2;
  this._b1 = b1;
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("EnvGen", SCUnitEnvGen);
module.exports = SCUnitEnvGen;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],71:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitExpRand = function (_SCUnit) {
  _inherits(SCUnitExpRand, _SCUnit);

  function SCUnitExpRand() {
    _classCallCheck(this, SCUnitExpRand);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitExpRand).apply(this, arguments));
  }

  _createClass(SCUnitExpRand, [{
    key: "initialize",
    value: function initialize() {
      var lo = this.inputs[0][0] || 0.01;
      var hi = this.inputs[1][0];
      var ratio = hi / lo;
      this.outputs[0][0] = Math.pow(ratio, Math.random()) * lo;
    }
  }]);

  return SCUnitExpRand;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("ExpRand", SCUnitExpRand);
module.exports = SCUnitExpRand;
},{"../SCUnit":11,"../SCUnitRepository":12}],72:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitFOS = function (_SCUnit) {
  _inherits(SCUnitFOS, _SCUnit);

  function SCUnitFOS() {
    _classCallCheck(this, SCUnitFOS);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitFOS).apply(this, arguments));
  }

  _createClass(SCUnitFOS, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.bufferLength === 1) {
        this.dspProcess = dspProcess["next_1"];
      } else {
        if (this.inputSpecs[1].rate === C.RATE_AUDIO && this.inputSpecs[2].rate === C.RATE_AUDIO && this.inputSpecs[3].rate === C.RATE_AUDIO) {
          this.dspProcess = dspProcess["next_a"];
        } else {
          this.dspProcess = dspProcess["next_k"];
        }
      }
      this._filterSlope = rate.filterSlope;
      this._y1 = 0;
      this._a0 = 0;
      this._a1 = 0;
      this._b1 = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitFOS;
}(SCUnit);

dspProcess["next_a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var a0In = this.inputs[1];
  var a1In = this.inputs[2];
  var b1In = this.inputs[3];
  var y1 = this._y1;
  for (var i = 0; i < inNumSamples; i++) {
    var y0 = inIn[i] + b1In[i] * y1;
    out[i] = a0In[i] * y0 + a1In[i] * y1 || 0;
    y1 = y0;
  }
  this._y1 = y1;
};
dspProcess["next_1"] = function () {
  var _in = this.inputs[0][0];
  var a0 = this.inputs[1][0];
  var a1 = this.inputs[2][0];
  var b1 = this.inputs[3][0];
  var y1 = this._y1;
  var y0 = _in + b1 * y1;
  this.outputs[0][0] = a0 * y0 + a1 * y1 || 0;
  this._y1 = y0;
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var next_a0 = this.inputs[1][0];
  var next_a1 = this.inputs[2][0];
  var next_b1 = this.inputs[3][0];
  var a0 = this._a0;
  var a1 = this._a1;
  var b1 = this._b1;
  var a0_slope = (next_a0 - a0) * this._filterSlope;
  var a1_slope = (next_a1 - a1) * this._filterSlope;
  var b1_slope = (next_b1 - b1) * this._filterSlope;
  var y1 = this._y1;
  for (var i = 0; i < inNumSamples; i++) {
    var y0 = inIn[i] + (b1 + b1_slope * i) * y1;
    out[i] = (a0 + a0_slope * i) * y0 + (a1 + a1_slope * i) * y1 || 0;
    y1 = y0;
  }
  this._y1 = y1;
  this._a0 = a0;
  this._a1 = a1;
  this._b1 = b1;
};
SCUnitRepository.registerSCUnitClass("FOS", SCUnitFOS);
module.exports = SCUnitFOS;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],73:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitFSinOsc = function (_SCUnit) {
  _inherits(SCUnitFSinOsc, _SCUnit);

  function SCUnitFSinOsc() {
    _classCallCheck(this, SCUnitFSinOsc);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitFSinOsc).apply(this, arguments));
  }

  _createClass(SCUnitFSinOsc, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[0].rate === C.RATE_SCALAR) {
        this.dspProcess = dspProcess["ii"];
      } else {
        this.dspProcess = dspProcess["ki"];
      }

      var freq = this.inputs[0][0];
      var iphase = this.inputs[1][0];
      var w = freq * rate.radiansPerSample;

      this._radiansPerSample = rate.radiansPerSample;
      this._freq = freq;
      this._b1 = 2 * Math.cos(w);
      this._y1 = Math.sin(iphase);
      this._y2 = Math.sin(iphase - w);

      this.outputs[0][0] = this._y1;
    }
  }]);

  return SCUnitFSinOsc;
}(SCUnit);

dspProcess["ki"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];

  if (freq !== this._freq) {
    this._freq = freq;
    this._b1 = 2 * Math.cos(freq * this._radiansPerSample);
  }

  var b1 = this._b1;

  var y1 = this._y1;
  var y2 = this._y2;

  for (var i = 0; i < inNumSamples; i++) {
    var y0 = b1 * y1 - y2;

    out[i] = y0;

    y2 = y1;
    y1 = y0;
  }

  this._y1 = y1;
  this._y2 = y2;
};

dspProcess["ii"] = function (inNumSamples) {
  var out = this.outputs[0];
  var b1 = this._b1;

  var y1 = this._y1;
  var y2 = this._y2;

  for (var i = 0; i < inNumSamples; i++) {
    var y0 = b1 * y1 - y2;

    out[i] = y0;

    y2 = y1;
    y1 = y0;
  }

  this._y1 = y1;
  this._y2 = y2;
};

SCUnitRepository.registerSCUnitClass("FSinOsc", SCUnitFSinOsc);

module.exports = SCUnitFSinOsc;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],74:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var sc_fold = require("../util/sc_fold");
var dspProcess = {};

var SCUnitFold = function (_SCUnit) {
  _inherits(SCUnitFold, _SCUnit);

  function SCUnitFold() {
    _classCallCheck(this, SCUnitFold);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitFold).apply(this, arguments));
  }

  _createClass(SCUnitFold, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[1].rate === C.RATE_AUDIO && this.inputSpecs[2].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_aa"];
      } else {
        this.dspProcess = dspProcess["next_kk"];
      }
      this._slopeFactor = rate.slopeFactor;
      this._lo = this.inputs[1][0];
      this._hi = this.inputs[2][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitFold;
}(SCUnit);

dspProcess["next_aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var loIn = this.inputs[1];
  var hiIn = this.inputs[2];
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = sc_fold(inIn[i], loIn[i], hiIn[i]);
  }
};
dspProcess["next_kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var next_lo = this.inputs[1][0];
  var next_hi = this.inputs[2][0];
  var lo = this._lo;
  var hi = this._hi;
  if (next_lo === lo && next_hi === hi) {
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = sc_fold(inIn[i], lo, hi);
    }
  } else {
    var lo_slope = (next_lo - lo) * this._slopeFactor;
    var hi_slope = (next_hi - hi) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      out[_i] = sc_fold(inIn[_i], lo + lo_slope * _i, hi + hi_slope * _i);
    }
    this._lo = next_lo;
    this._hi = next_hi;
  }
};
SCUnitRepository.registerSCUnitClass("Fold", SCUnitFold);
module.exports = SCUnitFold;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"../util/sc_fold":218}],75:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var log001 = Math.log(0.001);
var dspProcess = {};

var SCUnitFormlet = function (_SCUnit) {
  _inherits(SCUnitFormlet, _SCUnit);

  function SCUnitFormlet() {
    _classCallCheck(this, SCUnitFormlet);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitFormlet).apply(this, arguments));
  }

  _createClass(SCUnitFormlet, [{
    key: "initialize",
    value: function initialize(rate) {

      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["a"];
      } else {
        this.dspProcess = dspProcess["1"];
      }

      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._radiansPerSample = rate.radiansPerSample;

      this._b01 = 0;
      this._b02 = 0;
      this._y01 = 0;
      this._y02 = 0;
      this._b11 = 0;
      this._b12 = 0;
      this._y11 = 0;
      this._y12 = 0;
      this._freq = NaN;
      this._attackTime = NaN;
      this._decayTime = NaN;

      this.dspProcess(1);
    }
  }]);

  return SCUnitFormlet;
}(SCUnit);

dspProcess["a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var attackTime = this.inputs[2][0];
  var decayTime = this.inputs[3][0];
  var b01 = this._b01;
  var b11 = this._b11;
  var b02 = this._b02;
  var b12 = this._b12;

  var y00 = void 0;
  var y10 = void 0;
  var y01 = this._y01;
  var y11 = this._y11;
  var y02 = this._y02;
  var y12 = this._y12;
  var R = void 0,
      twoR = void 0,
      R2 = void 0,
      cost = void 0;

  if (freq != this._freq || decayTime != this._decayTime || attackTime != this._attackTime) {
    var ffreq = freq * this._radiansPerSample;

    R = decayTime ? Math.exp(log001 / (decayTime * this._sampleRate)) : 0;
    twoR = 2 * R;
    R2 = R * R;
    cost = twoR * Math.cos(ffreq) / (1 + R2);

    var b01_next = twoR * cost;
    var b02_next = -R2;
    var b01_slope = (b01_next - b01) * this._slopeFactor;
    var b02_slope = (b02_next - b02) * this._slopeFactor;

    R = attackTime ? Math.exp(log001 / (attackTime * this._sampleRate)) : 0;
    twoR = 2 * R;
    R2 = R * R;
    cost = twoR * Math.cos(ffreq) / (1 + R2);

    var b11_next = twoR * cost;
    var b12_next = -R2;
    var b11_slope = (b11_next - b11) * this._slopeFactor;
    var b12_slope = (b12_next - b12) * this._slopeFactor;

    for (var i = 0; i < inNumSamples; i++) {
      y00 = inIn[i] + (b01 + b01_slope * i) * y01 + (b02 + b02_slope * i) * y02;
      y10 = inIn[i] + (b11 + b11_slope * i) * y11 + (b12 + b12_slope * i) * y12;

      out[i] = 0.25 * (y00 - y02 - (y10 - y12));

      y02 = y01;
      y01 = y00;
      y12 = y11;
      y11 = y10;
    }

    this._freq = freq;
    this._attackTime = attackTime;
    this._decayTime = decayTime;
    this._b01 = b01_next;
    this._b02 = b02_next;
    this._b11 = b11_next;
    this._b12 = b12_next;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      y00 = inIn[_i] + b01 * y01 + b02 * y02;
      y10 = inIn[_i] + b11 * y11 + b12 * y12;

      out[_i] = 0.25 * (y00 - y02 - (y10 - y12));

      y02 = y01;
      y01 = y00;
      y12 = y11;
      y11 = y10;
    }
  }

  this._y01 = y01;
  this._y02 = y02;
  this._y11 = y11;
  this._y12 = y12;
};

dspProcess["1"] = function () {
  var _in = this.inputs[0][0];
  var freq = this.inputs[1][0];
  var attackTime = this.inputs[2][0];
  var decayTime = this.inputs[3][0];

  var y00 = void 0;
  var y10 = void 0;
  var y01 = this._y01;
  var y11 = this._y11;
  var y02 = this._y02;
  var y12 = this._y12;

  var b01 = this._b01;
  var b11 = this._b11;
  var b02 = this._b02;
  var b12 = this._b12;
  var R = void 0,
      twoR = void 0,
      R2 = void 0,
      cost = void 0;

  if (freq != this._freq || decayTime != this._decayTime || attackTime != this._attackTime) {
    var ffreq = freq * this._radiansPerSample;

    R = decayTime ? Math.exp(log001 / (decayTime * this._sampleRate)) : 0;
    twoR = 2 * R;
    R2 = R * R;
    cost = twoR * Math.cos(ffreq) / (1 + R2);
    b01 = twoR * cost;
    b02 = -R2;

    R = attackTime ? Math.exp(log001 / (attackTime * this._sampleRate)) : 0;
    twoR = 2 * R;
    R2 = R * R;
    cost = twoR * Math.cos(ffreq) / (1 + R2);
    b11 = twoR * cost;
    b12 = -R2;

    y00 = _in + b01 * y01 + b02 * y02;
    y10 = _in + b11 * y11 + b12 * y12;

    this.outputs[0][0] = 0.25 * (y00 - y02 - (y10 - y12));

    y02 = y01;
    y01 = y00;
    y12 = y11;
    y11 = y10;

    this._freq = freq;
    this._attackTime = attackTime;
    this._decayTime = decayTime;
    this._b01 = b01;
    this._b02 = b02;
    this._b11 = b11;
    this._b12 = b12;
  } else {
    y00 = _in + b01 * y01 + b02 * y02;
    y10 = _in + b11 * y11 + b12 * y12;

    this.outputs[0][0] = 0.25 * (y00 - y02 - (y10 - y12));

    y02 = y01;
    y01 = y00;
    y12 = y11;
    y11 = y10;
  }

  this._y01 = y01;
  this._y02 = y02;
  this._y11 = y11;
  this._y12 = y12;
};

SCUnitRepository.registerSCUnitClass("Formlet", SCUnitFormlet);

module.exports = SCUnitFormlet;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],76:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var clamp = require("../util/clamp");
var dspProcess = {};

var SCUnitFreeVerb = function (_SCUnit) {
  _inherits(SCUnitFreeVerb, _SCUnit);

  function SCUnitFreeVerb() {
    _classCallCheck(this, SCUnitFreeVerb);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitFreeVerb).apply(this, arguments));
  }

  _createClass(SCUnitFreeVerb, [{
    key: "initialize",
    value: function initialize() {

      this.dspProcess = dspProcess["akkk"];

      this._iota0 = 0;
      this._iota1 = 0;
      this._iota2 = 0;
      this._iota3 = 0;
      this._iota4 = 0;
      this._iota5 = 0;
      this._iota6 = 0;
      this._iota7 = 0;
      this._iota8 = 0;
      this._iota9 = 0;
      this._iota10 = 0;
      this._iota11 = 0;
      this._R0_0 = 0;
      this._R1_0 = 0;
      this._R2_0 = 0;
      this._R3_0 = 0;
      this._R4_0 = 0;
      this._R5_0 = 0;
      this._R6_0 = 0;
      this._R7_0 = 0;
      this._R8_0 = 0;
      this._R9_0 = 0;
      this._R10_0 = 0;
      this._R11_0 = 0;
      this._R12_0 = 0;
      this._R13_0 = 0;
      this._R14_0 = 0;
      this._R15_0 = 0;
      this._R16_0 = 0;
      this._R17_0 = 0;
      this._R18_0 = 0;
      this._R19_0 = 0;
      this._R0_1 = 0;
      this._R1_1 = 0;
      this._R2_1 = 0;
      this._R3_1 = 0;
      this._dline0 = new Float32Array(225);
      this._dline1 = new Float32Array(341);
      this._dline2 = new Float32Array(441);
      this._dline3 = new Float32Array(556);
      this._dline4 = new Float32Array(1617);
      this._dline5 = new Float32Array(1557);
      this._dline6 = new Float32Array(1491);
      this._dline7 = new Float32Array(1422);
      this._dline8 = new Float32Array(1277);
      this._dline9 = new Float32Array(1116);
      this._dline10 = new Float32Array(1188);
      this._dline11 = new Float32Array(1356);

      this.dspProcess(1);
    }
  }]);

  return SCUnitFreeVerb;
}(SCUnit);

dspProcess["akkk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var mix = clamp(this.inputs[1][0], 0, 1);
  var room = clamp(this.inputs[2][0], 0, 1);
  var damp = clamp(this.inputs[3][0], 0, 1);
  var ftemp0 = mix;
  var ftemp1 = 1 - ftemp0;
  var ftemp5 = 0.7 + 0.28 * room;
  var ftemp6 = 0.4 * damp;
  var ftemp7 = 1 - ftemp6;
  var dline0 = this._dline0;
  var dline1 = this._dline1;
  var dline2 = this._dline2;
  var dline3 = this._dline3;
  var dline4 = this._dline4;
  var dline5 = this._dline5;
  var dline6 = this._dline6;
  var dline7 = this._dline7;
  var dline8 = this._dline8;
  var dline9 = this._dline9;
  var dline10 = this._dline10;
  var dline11 = this._dline11;

  var iota0 = this._iota0;
  var iota1 = this._iota1;
  var iota2 = this._iota2;
  var iota3 = this._iota3;
  var iota4 = this._iota4;
  var iota5 = this._iota5;
  var iota6 = this._iota6;
  var iota7 = this._iota7;
  var iota8 = this._iota8;
  var iota9 = this._iota9;
  var iota10 = this._iota10;
  var iota11 = this._iota11;
  var R0_0 = this._R0_0;
  var R1_0 = this._R1_0;
  var R2_0 = this._R2_0;
  var R3_0 = this._R3_0;
  var R4_0 = this._R4_0;
  var R5_0 = this._R5_0;
  var R6_0 = this._R6_0;
  var R7_0 = this._R7_0;
  var R8_0 = this._R8_0;
  var R9_0 = this._R9_0;
  var R10_0 = this._R10_0;
  var R11_0 = this._R11_0;
  var R12_0 = this._R12_0;
  var R13_0 = this._R13_0;
  var R14_0 = this._R14_0;
  var R15_0 = this._R15_0;
  var R16_0 = this._R16_0;
  var R17_0 = this._R17_0;
  var R18_0 = this._R18_0;
  var R19_0 = this._R19_0;
  var R0_1 = this._R0_1;
  var R1_1 = this._R1_1;
  var R2_1 = this._R2_1;
  var R3_1 = this._R3_1;

  for (var i = 0; i < inNumSamples; i++) {
    var ftemp2 = inIn[i];
    var ftemp4 = 0.015 * ftemp2;

    iota0 = ++iota0 % 225;
    iota1 = ++iota1 % 341;
    iota2 = ++iota2 % 441;
    iota3 = ++iota3 % 556;
    iota4 = ++iota4 % 1617;
    iota5 = ++iota5 % 1557;
    iota6 = ++iota6 % 1491;
    iota7 = ++iota7 % 1422;
    iota8 = ++iota8 % 1277;
    iota9 = ++iota9 % 1116;
    iota10 = ++iota10 % 1188;
    iota11 = ++iota11 % 1356;

    var T0 = dline0[iota0];
    var T1 = dline1[iota1];
    var T2 = dline2[iota2];
    var T3 = dline3[iota3];
    var T4 = dline4[iota4];
    var T5 = dline5[iota5];
    var T6 = dline6[iota6];
    var T7 = dline7[iota7];
    var T8 = dline8[iota8];
    var T9 = dline9[iota9];
    var T10 = dline10[iota10];
    var T11 = dline11[iota11];

    R5_0 = ftemp7 * R4_0 + ftemp6 * R5_0;
    dline4[iota4] = ftemp4 + ftemp5 * R5_0;
    R4_0 = T4;

    R7_0 = ftemp7 * R6_0 + ftemp6 * R7_0;
    dline5[iota5] = ftemp4 + ftemp5 * R7_0;
    R6_0 = T5;

    R9_0 = ftemp7 * R8_0 + ftemp6 * R9_0;
    dline6[iota6] = ftemp4 + ftemp5 * R9_0;
    R8_0 = T6;

    R11_0 = ftemp7 * R10_0 + ftemp6 * R11_0;
    dline7[iota7] = ftemp4 + ftemp5 * R11_0;
    R10_0 = T7;

    R13_0 = ftemp7 * R12_0 + ftemp6 * R13_0;
    dline8[iota8] = ftemp4 + ftemp5 * R13_0;
    R12_0 = T8;

    R15_0 = ftemp7 * R14_0 + ftemp6 * R15_0;
    dline9[iota9] = ftemp4 + ftemp5 * R15_0;
    R14_0 = T9;

    R17_0 = ftemp7 * R16_0 + ftemp6 * R17_0;
    dline10[iota10] = ftemp4 + ftemp5 * R17_0;
    R16_0 = T10;

    R19_0 = ftemp7 * R18_0 + ftemp6 * R19_0;
    dline11[iota11] = ftemp4 + ftemp5 * R19_0;
    R18_0 = T11;

    dline3[iota3] = 0.5 * R3_0 + R4_0 + (R6_0 + R8_0) + (R10_0 + R12_0 + (R14_0 + (R16_0 + R18_0)));
    R3_0 = T3;

    R3_1 = R3_0 - (R4_0 + R6_0 + (R8_0 + R10_0) + (R12_0 + R14_0 + (R16_0 + R18_0)));
    dline2[iota2] = 0.5 * R2_0 + R3_1;
    R2_0 = T2;

    R2_1 = R2_0 - R3_1;
    dline1[iota1] = 0.5 * R1_0 + R2_1;
    R1_0 = T1;

    R1_1 = R1_0 - R2_1;
    dline0[iota0] = 0.5 * R0_0 + R1_1;
    R0_0 = T0;

    R0_1 = R0_0 - R1_1;
    out[i] = ftemp1 * ftemp2 + ftemp0 * R0_1;
  }

  this._iota0 = iota0;
  this._iota1 = iota1;
  this._iota2 = iota2;
  this._iota3 = iota3;
  this._iota4 = iota4;
  this._iota5 = iota5;
  this._iota6 = iota6;
  this._iota7 = iota7;
  this._iota8 = iota8;
  this._iota9 = iota9;
  this._iota10 = iota10;
  this._iota11 = iota11;
  this._R0_1 = R0_1;
  this._R1_1 = R1_1;
  this._R2_1 = R2_1;
  this._R3_1 = R3_1;
  this._R0_0 = R0_0;
  this._R1_0 = R1_0;
  this._R2_0 = R2_0;
  this._R3_0 = R3_0;
  this._R4_0 = R4_0;
  this._R5_0 = R5_0;
  this._R6_0 = R6_0;
  this._R7_0 = R7_0;
  this._R8_0 = R8_0;
  this._R9_0 = R9_0;
  this._R10_0 = R10_0;
  this._R11_0 = R11_0;
  this._R12_0 = R12_0;
  this._R13_0 = R13_0;
  this._R14_0 = R14_0;
  this._R15_0 = R15_0;
  this._R16_0 = R16_0;
  this._R17_0 = R17_0;
  this._R18_0 = R18_0;
  this._R19_0 = R19_0;
};

SCUnitRepository.registerSCUnitClass("FreeVerb", SCUnitFreeVerb);

module.exports = SCUnitFreeVerb;
},{"../SCUnit":11,"../SCUnitRepository":12,"../util/clamp":212}],77:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var clamp = require("../util/clamp");
var dspProcess = {};

var SCUnitFreeVerb2 = function (_SCUnit) {
  _inherits(SCUnitFreeVerb2, _SCUnit);

  function SCUnitFreeVerb2() {
    _classCallCheck(this, SCUnitFreeVerb2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitFreeVerb2).apply(this, arguments));
  }

  _createClass(SCUnitFreeVerb2, [{
    key: "initialize",
    value: function initialize() {

      this.dspProcess = dspProcess["aakkk"];

      this._iota0 = 0;
      this._iota1 = 0;
      this._iota2 = 0;
      this._iota3 = 0;
      this._iota4 = 0;
      this._iota5 = 0;
      this._iota6 = 0;
      this._iota7 = 0;
      this._iota8 = 0;
      this._iota9 = 0;
      this._iota10 = 0;
      this._iota11 = 0;
      this._iota12 = 0;
      this._iota13 = 0;
      this._iota14 = 0;
      this._iota15 = 0;
      this._iota16 = 0;
      this._iota17 = 0;
      this._iota18 = 0;
      this._iota19 = 0;
      this._iota20 = 0;
      this._iota21 = 0;
      this._iota22 = 0;
      this._iota23 = 0;
      this._R0_1 = 0;
      this._R1_1 = 0;
      this._R2_1 = 0;
      this._R3_1 = 0;
      this._R0_0 = 0;
      this._R1_0 = 0;
      this._R2_0 = 0;
      this._R3_0 = 0;
      this._R4_0 = 0;
      this._R5_0 = 0;
      this._R6_0 = 0;
      this._R7_0 = 0;
      this._R8_0 = 0;
      this._R9_0 = 0;
      this._R10_0 = 0;
      this._R11_0 = 0;
      this._R12_0 = 0;
      this._R13_0 = 0;
      this._R14_0 = 0;
      this._R15_0 = 0;
      this._R16_0 = 0;
      this._R17_0 = 0;
      this._R18_0 = 0;
      this._R19_0 = 0;
      this._R20_0 = 0;
      this._R21_0 = 0;
      this._R22_0 = 0;
      this._R23_0 = 0;
      this._R24_0 = 0;
      this._R25_0 = 0;
      this._R26_0 = 0;
      this._R27_0 = 0;
      this._R28_0 = 0;
      this._R29_0 = 0;
      this._R30_0 = 0;
      this._R31_0 = 0;
      this._R32_0 = 0;
      this._R33_0 = 0;
      this._R34_0 = 0;
      this._R35_0 = 0;
      this._R36_0 = 0;
      this._R37_0 = 0;
      this._R38_0 = 0;
      this._R39_0 = 0;
      this._R20_1 = 0;
      this._R21_1 = 0;
      this._R22_1 = 0;
      this._R23_1 = 0;
      this._dline0 = new Float32Array(225);
      this._dline1 = new Float32Array(341);
      this._dline2 = new Float32Array(441);
      this._dline3 = new Float32Array(556);
      this._dline4 = new Float32Array(1617);
      this._dline5 = new Float32Array(1557);
      this._dline6 = new Float32Array(1491);
      this._dline7 = new Float32Array(1422);
      this._dline8 = new Float32Array(1277);
      this._dline9 = new Float32Array(1116);
      this._dline10 = new Float32Array(1188);
      this._dline11 = new Float32Array(1356);
      this._dline12 = new Float32Array(248);
      this._dline13 = new Float32Array(364);
      this._dline14 = new Float32Array(464);
      this._dline15 = new Float32Array(579);
      this._dline16 = new Float32Array(1640);
      this._dline17 = new Float32Array(1580);
      this._dline18 = new Float32Array(1514);
      this._dline19 = new Float32Array(1445);
      this._dline20 = new Float32Array(1300);
      this._dline21 = new Float32Array(1139);
      this._dline22 = new Float32Array(1211);
      this._dline23 = new Float32Array(1379);
    }
  }]);

  return SCUnitFreeVerb2;
}(SCUnit);

dspProcess["aakkk"] = function (inNumSamples) {
  var outL = this.outputs[0];
  var outR = this.outputs[1];
  var inInL = this.inputs[0];
  var inInR = this.inputs[1];
  var mix = clamp(this.inputs[2][0], 0, 1);
  var room = clamp(this.inputs[3][0], 0, 1);
  var damp = clamp(this.inputs[4][0], 0, 1);
  var ftemp0 = mix;
  var ftemp1 = 1 - ftemp0;
  var ftemp5 = 0.7 + 0.28 * room;
  var ftemp6 = 0.4 * damp;
  var ftemp7 = 1 - ftemp6;
  var dline0 = this._dline0;
  var dline1 = this._dline1;
  var dline2 = this._dline2;
  var dline3 = this._dline3;
  var dline4 = this._dline4;
  var dline5 = this._dline5;
  var dline6 = this._dline6;
  var dline7 = this._dline7;
  var dline8 = this._dline8;
  var dline9 = this._dline9;
  var dline10 = this._dline10;
  var dline11 = this._dline11;
  var dline12 = this._dline12;
  var dline13 = this._dline13;
  var dline14 = this._dline14;
  var dline15 = this._dline15;
  var dline16 = this._dline16;
  var dline17 = this._dline17;
  var dline18 = this._dline18;
  var dline19 = this._dline19;
  var dline20 = this._dline20;
  var dline21 = this._dline21;
  var dline22 = this._dline22;
  var dline23 = this._dline23;

  var iota0 = this._iota0;
  var iota1 = this._iota1;
  var iota2 = this._iota2;
  var iota3 = this._iota3;
  var iota4 = this._iota4;
  var iota5 = this._iota5;
  var iota6 = this._iota6;
  var iota7 = this._iota7;
  var iota8 = this._iota8;
  var iota9 = this._iota9;
  var iota10 = this._iota10;
  var iota11 = this._iota11;
  var iota12 = this._iota12;
  var iota13 = this._iota13;
  var iota14 = this._iota14;
  var iota15 = this._iota15;
  var iota16 = this._iota16;
  var iota17 = this._iota17;
  var iota18 = this._iota18;
  var iota19 = this._iota19;
  var iota20 = this._iota20;
  var iota21 = this._iota21;
  var iota22 = this._iota22;
  var iota23 = this._iota23;
  var R0_0 = this._R0_0;
  var R1_0 = this._R1_0;
  var R2_0 = this._R2_0;
  var R3_0 = this._R3_0;
  var R4_0 = this._R4_0;
  var R5_0 = this._R5_0;
  var R6_0 = this._R6_0;
  var R7_0 = this._R7_0;
  var R8_0 = this._R8_0;
  var R9_0 = this._R9_0;
  var R10_0 = this._R10_0;
  var R11_0 = this._R11_0;
  var R12_0 = this._R12_0;
  var R13_0 = this._R13_0;
  var R14_0 = this._R14_0;
  var R15_0 = this._R15_0;
  var R16_0 = this._R16_0;
  var R17_0 = this._R17_0;
  var R18_0 = this._R18_0;
  var R19_0 = this._R19_0;
  var R20_0 = this._R20_0;
  var R21_0 = this._R21_0;
  var R22_0 = this._R22_0;
  var R23_0 = this._R23_0;
  var R24_0 = this._R24_0;
  var R25_0 = this._R25_0;
  var R26_0 = this._R26_0;
  var R27_0 = this._R27_0;
  var R28_0 = this._R28_0;
  var R29_0 = this._R29_0;
  var R30_0 = this._R30_0;
  var R31_0 = this._R31_0;
  var R32_0 = this._R32_0;
  var R33_0 = this._R33_0;
  var R34_0 = this._R34_0;
  var R35_0 = this._R35_0;
  var R36_0 = this._R36_0;
  var R37_0 = this._R37_0;
  var R38_0 = this._R38_0;
  var R39_0 = this._R39_0;
  var R0_1 = this._R0_1;
  var R1_1 = this._R1_1;
  var R2_1 = this._R2_1;
  var R3_1 = this._R3_1;
  var R23_1 = this._R23_1;
  var R22_1 = this._R22_1;
  var R21_1 = this._R21_1;
  var R20_1 = this._R20_1;

  for (var i = 0; i < inNumSamples; i++) {
    var ftemp2 = inInL[i];
    var ftemp3 = inInR[i];
    var ftemp4 = 1.5e-02 * (ftemp2 + ftemp3);

    // left ch
    iota0 = ++iota0 % 225;
    iota1 = ++iota1 % 331;
    iota2 = ++iota2 % 441;
    iota3 = ++iota3 % 556;
    iota4 = ++iota4 % 1617;
    iota5 = ++iota5 % 1557;
    iota6 = ++iota6 % 1491;
    iota7 = ++iota7 % 1422;
    iota8 = ++iota8 % 1277;
    iota9 = ++iota9 % 1116;
    iota10 = ++iota10 % 1188;
    iota11 = ++iota11 % 1356;

    var T0 = dline0[iota0];
    var T1 = dline1[iota1];
    var T2 = dline2[iota2];
    var T3 = dline3[iota3];
    var T4 = dline4[iota4];
    var T5 = dline5[iota5];
    var T6 = dline6[iota6];
    var T7 = dline7[iota7];
    var T8 = dline8[iota8];
    var T9 = dline9[iota9];
    var T10 = dline10[iota10];
    var T11 = dline11[iota11];

    R5_0 = ftemp7 * R4_0 + ftemp6 * R5_0;
    dline4[iota4] = ftemp4 + ftemp5 * R5_0;
    R4_0 = T4;

    R7_0 = ftemp7 * R6_0 + ftemp6 * R7_0;
    dline5[iota5] = ftemp4 + ftemp5 * R7_0;
    R6_0 = T5;

    R9_0 = ftemp7 * R8_0 + ftemp6 * R9_0;
    dline6[iota6] = ftemp4 + ftemp5 * R9_0;
    R8_0 = T6;

    R11_0 = ftemp7 * R10_0 + ftemp6 * R11_0;
    dline7[iota7] = ftemp4 + ftemp5 * R11_0;
    R10_0 = T7;

    R13_0 = ftemp7 * R12_0 + ftemp6 * R13_0;
    dline8[iota8] = ftemp4 + ftemp5 * R13_0;
    R12_0 = T8;

    R15_0 = ftemp7 * R14_0 + ftemp6 * R15_0;
    dline9[iota9] = ftemp4 + ftemp5 * R15_0;
    R14_0 = T9;

    R17_0 = ftemp7 * R16_0 + ftemp6 * R17_0;
    dline10[iota10] = ftemp4 + ftemp5 * R17_0;
    R16_0 = T10;

    R19_0 = ftemp7 * R18_0 + ftemp6 * R19_0;
    dline11[iota11] = ftemp4 + ftemp5 * R19_0;
    R18_0 = T11;

    dline3[iota3] = 0.5 * R3_0 + R4_0 + (R6_0 + R8_0) + (R10_0 + R12_0 + (R14_0 + (R16_0 + R18_0)));
    R3_0 = T3;

    R3_1 = R3_0 - (R4_0 + R6_0 + (R8_0 + R10_0) + (R12_0 + R14_0 + (R16_0 + R18_0)));
    dline2[iota2] = 0.5 * R2_0 + R3_1;
    R2_0 = T2;

    R2_1 = R2_0 - R3_1;
    dline1[iota1] = 0.5 * R1_0 + R2_1;
    R1_0 = T1;

    R1_1 = R1_0 - R2_1;
    dline0[iota0] = 0.5 * R0_0 + R1_1;
    R0_0 = T0;

    R0_1 = R0_0 - R1_1;
    outL[i] = ftemp1 * ftemp2 + ftemp0 * R0_1;

    // right ch
    iota12 = ++iota12 % 248;
    iota13 = ++iota13 % 364;
    iota14 = ++iota14 % 464;
    iota15 = ++iota15 % 579;
    iota16 = ++iota16 % 1640;
    iota17 = ++iota17 % 1580;
    iota18 = ++iota18 % 1514;
    iota19 = ++iota19 % 1445;
    iota20 = ++iota20 % 1300;
    iota21 = ++iota21 % 1139;
    iota22 = ++iota22 % 1211;
    iota23 = ++iota23 % 1379;

    var T12 = dline12[iota12];
    var T13 = dline13[iota13];
    var T14 = dline14[iota14];
    var T15 = dline15[iota15];
    var T16 = dline16[iota16];
    var T17 = dline17[iota17];
    var T18 = dline18[iota18];
    var T19 = dline19[iota19];
    var T20 = dline20[iota20];
    var T21 = dline21[iota21];
    var T22 = dline22[iota22];
    var T23 = dline23[iota23];

    R25_0 = ftemp7 * R24_0 + ftemp6 * R25_0;
    dline16[iota16] = ftemp4 + ftemp5 * R25_0;
    R24_0 = T16;

    R27_0 = ftemp7 * R26_0 + ftemp6 * R27_0;
    dline17[iota17] = ftemp4 + ftemp5 * R27_0;
    R26_0 = T17;

    R29_0 = ftemp7 * R28_0 + ftemp6 * R29_0;
    dline18[iota18] = ftemp4 + ftemp5 * R29_0;
    R28_0 = T18;

    R31_0 = ftemp7 * R30_0 + ftemp6 * R31_0;
    dline19[iota19] = ftemp4 + ftemp5 * R31_0;
    R30_0 = T19;

    R33_0 = ftemp7 * R32_0 + ftemp6 * R33_0;
    dline20[iota20] = ftemp4 + ftemp5 * R33_0;
    R32_0 = T20;

    R35_0 = ftemp7 * R34_0 + ftemp6 * R35_0;
    dline21[iota21] = ftemp4 + ftemp5 * R35_0;
    R34_0 = T21;

    R37_0 = ftemp7 * R36_0 + ftemp6 * R37_0;
    dline22[iota22] = ftemp4 + ftemp5 * R37_0;
    R36_0 = T22;

    R39_0 = ftemp7 * R38_0 + ftemp6 * R39_0;
    dline23[iota23] = ftemp4 + ftemp5 * R39_0;
    R38_0 = T23;

    dline15[iota15] = 0.5 * R23_0 + R24_0 + (R26_0 + R28_0) + (R30_0 + R32_0 + (R34_0 + (R36_0 + R38_0)));
    R23_0 = T15;

    R23_1 = R23_0 - (R24_0 + R26_0 + (R28_0 + R30_0) + (R32_0 + R34_0 + (R36_0 + R38_0)));
    dline14[iota14] = 0.5 * R22_0 + R23_1;
    R22_0 = T14;

    R22_1 = R22_0 - R23_1;
    dline13[iota13] = 0.5 * R21_0 + R22_1;
    R21_0 = T13;

    R21_1 = R21_0 - R22_1;
    dline12[iota12] = 0.5 * R20_0 + R21_1;
    R20_0 = T12;

    R20_1 = R20_0 - R21_1;
    outR[i] = ftemp1 * ftemp3 + ftemp0 * R20_1;
  }

  this._iota0 = iota0;
  this._iota1 = iota1;
  this._iota2 = iota2;
  this._iota3 = iota3;
  this._iota4 = iota4;
  this._iota5 = iota5;
  this._iota6 = iota6;
  this._iota7 = iota7;
  this._iota8 = iota8;
  this._iota9 = iota9;
  this._iota10 = iota10;
  this._iota11 = iota11;
  this._iota12 = iota12;
  this._iota13 = iota13;
  this._iota14 = iota14;
  this._iota15 = iota15;
  this._iota16 = iota16;
  this._iota17 = iota17;
  this._iota18 = iota18;
  this._iota19 = iota19;
  this._iota20 = iota20;
  this._iota21 = iota21;
  this._iota22 = iota22;
  this._iota23 = iota23;

  this._R0_1 = R0_1;
  this._R1_1 = R1_1;
  this._R2_1 = R2_1;
  this._R3_1 = R3_1;

  this._R20_1 = R20_1;
  this._R21_1 = R21_1;
  this._R22_1 = R22_1;
  this._R23_1 = R23_1;

  this._R0_0 = R0_0;
  this._R1_0 = R1_0;
  this._R2_0 = R2_0;
  this._R3_0 = R3_0;
  this._R4_0 = R4_0;
  this._R5_0 = R5_0;
  this._R6_0 = R6_0;
  this._R7_0 = R7_0;
  this._R8_0 = R8_0;
  this._R9_0 = R9_0;
  this._R10_0 = R10_0;
  this._R11_0 = R11_0;
  this._R12_0 = R12_0;
  this._R13_0 = R13_0;
  this._R14_0 = R14_0;
  this._R15_0 = R15_0;
  this._R16_0 = R16_0;
  this._R17_0 = R17_0;
  this._R18_0 = R18_0;
  this._R19_0 = R19_0;
  this._R20_0 = R20_0;
  this._R21_0 = R21_0;
  this._R22_0 = R22_0;
  this._R23_0 = R23_0;
  this._R24_0 = R24_0;
  this._R25_0 = R25_0;
  this._R26_0 = R26_0;
  this._R27_0 = R27_0;
  this._R28_0 = R28_0;
  this._R29_0 = R29_0;
  this._R30_0 = R30_0;
  this._R31_0 = R31_0;
  this._R32_0 = R32_0;
  this._R33_0 = R33_0;
  this._R34_0 = R34_0;
  this._R35_0 = R35_0;
  this._R36_0 = R36_0;
  this._R37_0 = R37_0;
  this._R38_0 = R38_0;
  this._R39_0 = R39_0;
};

SCUnitRepository.registerSCUnitClass("FreeVerb2", SCUnitFreeVerb2);

module.exports = SCUnitFreeVerb2;
},{"../SCUnit":11,"../SCUnitRepository":12,"../util/clamp":212}],78:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var fillRange = require("../util/fillRange");
var dspProcess = {};

var SCUnitGate = function (_SCUnit) {
  _inherits(SCUnitGate, _SCUnit);

  function SCUnitGate() {
    _classCallCheck(this, SCUnitGate);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitGate).apply(this, arguments));
  }

  _createClass(SCUnitGate, [{
    key: "initialize",
    value: function initialize() {
      if (this.inputSpecs[1].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_aa"];
      } else {
        this.dspProcess = dspProcess["next_ak"];
      }
      this._level = 0;
      this.outputs[0][0] = 0;
    }
  }]);

  return SCUnitGate;
}(SCUnit);

dspProcess["next_aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var trigIn = this.inputs[1];
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curTrig = trigIn[i];
    if (curTrig > 0) {
      level = inIn[i];
    }
    out[i] = level;
  }
  this._level = level;
};
dspProcess["next_ak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var trig = this.inputs[1][0];
  if (trig > 0) {
    out.set(inIn.subarray(0, inNumSamples));
    this._level = inIn[inNumSamples - 1];
  } else {
    fillRange(out, this._level, 0, inNumSamples);
  }
};
SCUnitRepository.registerSCUnitClass("Gate", SCUnitGate);
module.exports = SCUnitGate;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"../util/fillRange":214}],79:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitGrayNoise = function (_SCUnit) {
  _inherits(SCUnitGrayNoise, _SCUnit);

  function SCUnitGrayNoise() {
    _classCallCheck(this, SCUnitGrayNoise);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitGrayNoise).apply(this, arguments));
  }

  _createClass(SCUnitGrayNoise, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._counter = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitGrayNoise;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var counter = this._counter;
  for (var i = 0; i < inNumSamples; i++) {
    counter ^= 1 << (Math.random() * 31 | 0);
    out[i] = counter * 4.65661287308e-10;
  }
  this._counter = counter;
};
SCUnitRepository.registerSCUnitClass("GrayNoise", SCUnitGrayNoise);
module.exports = SCUnitGrayNoise;
},{"../SCUnit":11,"../SCUnitRepository":12}],80:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var sqrt2 = Math.sqrt(2);

var SCUnitHPF = function (_SCUnit) {
  _inherits(SCUnitHPF, _SCUnit);

  function SCUnitHPF() {
    _classCallCheck(this, SCUnitHPF);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitHPF).apply(this, arguments));
  }

  _createClass(SCUnitHPF, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._a0 = 0;
      this._b1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._freq = NaN;
      this.dspProcess(1);
    }
  }]);

  return SCUnitHPF;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var a0 = this._a0;
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  if (freq !== this._freq) {
    var pfreq = freq * this._radiansPerSample * 0.5;
    var C = Math.tan(pfreq);
    var C2 = C * C;
    var sqrt2C = C * sqrt2;
    var next_a0 = 1 / (1 + sqrt2C + C2);
    var next_b1 = 2 * (1 - C2) * next_a0;
    var next_b2 = -(1 - sqrt2C + C2) * next_a0;
    var a0_slope = (next_a0 - a0) * this._slopeFactor;
    var b1_slope = (next_b1 - b1) * this._slopeFactor;
    var b2_slope = (next_b2 - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var y0 = inIn[i] + (b1 + b1_slope * i) * y1 + (b2 + b2_slope * i) * y2;
      out[i] = (a0 + a0_slope * i) * (y0 - 2 * y1 + y2);
      y2 = y1;
      y1 = y0;
    }
    this._freq = freq;
    this._a0 = next_a0;
    this._b1 = next_b1;
    this._b2 = next_b2;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y = inIn[_i] + b1 * y1 + b2 * y2;
      out[_i] = a0 * (_y - 2 * y1 + y2);
      y2 = y1;
      y1 = _y;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("HPF", SCUnitHPF);
module.exports = SCUnitHPF;
},{"../SCUnit":11,"../SCUnitRepository":12}],81:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitHPZ1 = function (_SCUnit) {
  _inherits(SCUnitHPZ1, _SCUnit);

  function SCUnitHPZ1() {
    _classCallCheck(this, SCUnitHPZ1);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitHPZ1).apply(this, arguments));
  }

  _createClass(SCUnitHPZ1, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._x1 = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitHPZ1;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var x1 = this._x1;
  for (var i = 0; i < inNumSamples; i++) {
    var x0 = inIn[i];
    out[i] = 0.5 * (x0 - x1);
    x1 = x0;
  }
  this._x1 = x1;
};
SCUnitRepository.registerSCUnitClass("HPZ1", SCUnitHPZ1);
module.exports = SCUnitHPZ1;
},{"../SCUnit":11,"../SCUnitRepository":12}],82:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitHPZ2 = function (_SCUnit) {
  _inherits(SCUnitHPZ2, _SCUnit);

  function SCUnitHPZ2() {
    _classCallCheck(this, SCUnitHPZ2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitHPZ2).apply(this, arguments));
  }

  _createClass(SCUnitHPZ2, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._x1 = this.inputs[0][0];
      this._x2 = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitHPZ2;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var x1 = this._x1;
  var x2 = this._x2;
  for (var i = 0; i < inNumSamples; i++) {
    var x0 = inIn[i];
    out[i] = (x0 - 2 * x1 + x2) * 0.25;
    x2 = x1;
    x1 = x0;
  }
  this._x1 = x1;
  this._x2 = x2;
};
SCUnitRepository.registerSCUnitClass("HPZ2", SCUnitHPZ2);
module.exports = SCUnitHPZ2;
},{"../SCUnit":11,"../SCUnitRepository":12}],83:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var f32 = new Float32Array(1);
var i32 = new Int32Array(f32.buffer);
var dspProcess = {};

var SCUnitHasher = function (_SCUnit) {
  _inherits(SCUnitHasher, _SCUnit);

  function SCUnitHasher() {
    _classCallCheck(this, SCUnitHasher);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitHasher).apply(this, arguments));
  }

  _createClass(SCUnitHasher, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["a"];
      this.dspProcess(1);
    }
  }]);

  return SCUnitHasher;
}(SCUnit);

dspProcess["a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];

  for (var i = 0; i < inNumSamples; i++) {
    f32[0] = inIn[i];
    i32[0] = 0x40000000 | hash(i32[0]) >>> 9;
    out[i] = f32[0] - 3;
  }
};

function hash(hash) {
  hash += ~(hash << 15);
  hash ^= hash >> 10;
  hash += hash << 3;
  hash ^= hash >> 6;
  hash += ~(hash << 11);
  hash ^= hash >> 16;
  return hash;
}

SCUnitRepository.registerSCUnitClass("Hasher", SCUnitHasher);

module.exports = SCUnitHasher;
},{"../SCUnit":11,"../SCUnitRepository":12}],84:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitIRand = function (_SCUnit) {
  _inherits(SCUnitIRand, _SCUnit);

  function SCUnitIRand() {
    _classCallCheck(this, SCUnitIRand);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitIRand).apply(this, arguments));
  }

  _createClass(SCUnitIRand, [{
    key: "initialize",
    value: function initialize() {
      var lo = this.inputs[0][0];
      var hi = this.inputs[1][0];
      var range = hi - lo;
      this.outputs[0][0] = Math.random() * range + lo | 0;
    }
  }]);

  return SCUnitIRand;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("IRand", SCUnitIRand);
module.exports = SCUnitIRand;
},{"../SCUnit":11,"../SCUnitRepository":12}],85:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitImpulse = function (_SCUnit) {
  _inherits(SCUnitImpulse, _SCUnit);

  function SCUnitImpulse() {
    _classCallCheck(this, SCUnitImpulse);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitImpulse).apply(this, arguments));
  }

  _createClass(SCUnitImpulse, [{
    key: "initialize",
    value: function initialize(rate) {
      this._phase = this.inputs[1][0];
      if (this.inputSpecs[0].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_a"];
        if (this.inputSpecs[1].rate !== C.RATE_SCALAR) {
          this._phase = 1;
        }
      } else {
        this.dspProcess = dspProcess["next_k"];
        if (this.inputSpecs[1].rate !== C.RATE_SCALAR) {
          this._phase = 1;
        }
      }
      this._slopeFactor = rate.slopeFactor;
      this._phaseOffset = 0;
      this._cpstoinc = rate.sampleDur;
      if (this._phase === 0) {
        this._phase = 1;
      }
    }
  }]);

  return SCUnitImpulse;
}(SCUnit);

dspProcess["next_a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freqIn = this.inputs[0];
  var cpstoinc = this._cpstoinc;
  var phaseOffset = this.inputs[1][0];
  var prevPhaseOffset = this._phaseOffset;
  var phase_slope = (phaseOffset - prevPhaseOffset) * this._slopeFactor;
  var phase = this._phase + prevPhaseOffset;
  for (var i = 0; i < inNumSamples; i++) {
    phase += phase_slope;
    if (phase >= 1) {
      phase -= 1;
      out[i] = 1;
    } else {
      out[i] = 0;
    }
    phase += freqIn[i] * cpstoinc;
  }
  this._phase = phase - phaseOffset;
  this._phaseOffset = phaseOffset;
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0] * this._cpstoinc;
  var phaseOffset = this.inputs[1][0];
  var prevPhaseOffset = this._phaseOffset;
  var phase_slope = (phaseOffset - prevPhaseOffset) * this._slopeFactor;
  var phase = this._phase + prevPhaseOffset;
  for (var i = 0; i < inNumSamples; i++) {
    phase += phase_slope;
    if (phase >= 1) {
      phase -= 1;
      out[i] = 1;
    } else {
      out[i] = 0;
    }
    phase += freq;
  }
  this._phase = phase - phaseOffset;
  this._phaseOffset = phaseOffset;
};
SCUnitRepository.registerSCUnitClass("Impulse", SCUnitImpulse);
module.exports = SCUnitImpulse;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],86:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var dspProcess = {};

var SCUnitIn = function (_SCUnit) {
  _inherits(SCUnitIn, _SCUnit);

  function SCUnitIn() {
    _classCallCheck(this, SCUnitIn);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitIn).apply(this, arguments));
  }

  _createClass(SCUnitIn, [{
    key: "initialize",
    value: function initialize() {
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["a"];
        this._buses = this.context.audioBuses;
      } else {
        this.dspProcess = dspProcess["k"];
        this._buses = this.context.controlBuses;
      }
    }
  }]);

  return SCUnitIn;
}(SCUnit);

dspProcess["a"] = function () {
  var outputs = this.outputs;
  var buses = this._buses;
  var firstBusChannel = this.inputs[0][0] | 0;

  for (var ch = 0, chmax = outputs.length; ch < chmax; ch++) {
    outputs[ch].set(buses[firstBusChannel + ch]);
  }
};

dspProcess["k"] = function () {
  var outputs = this.outputs;
  var buses = this._buses;
  var firstBusChannel = this.inputs[0][0] | 0;

  for (var ch = 0, chmax = outputs.length; ch < chmax; ch++) {
    outputs[ch][0] = buses[firstBusChannel + ch][0];
  }
};

SCUnitRepository.registerSCUnitClass("In", SCUnitIn);

module.exports = SCUnitIn;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],87:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitInRange = function (_SCUnit) {
  _inherits(SCUnitInRange, _SCUnit);

  function SCUnitInRange() {
    _classCallCheck(this, SCUnitInRange);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitInRange).apply(this, arguments));
  }

  _createClass(SCUnitInRange, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this.dspProcess(1);
    }
  }]);

  return SCUnitInRange;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var loIn = this.inputs[1];
  var hiIn = this.inputs[2];
  for (var i = 0; i < inNumSamples; i++) {
    var _in = inIn[i];
    out[i] = loIn[i] <= _in && _in <= hiIn[i] ? 1 : 0;
  }
};
SCUnitRepository.registerSCUnitClass("InRange", SCUnitInRange);
module.exports = SCUnitInRange;
},{"../SCUnit":11,"../SCUnitRepository":12}],88:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitInRect = function (_SCUnit) {
  _inherits(SCUnitInRect, _SCUnit);

  function SCUnitInRect() {
    _classCallCheck(this, SCUnitInRect);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitInRect).apply(this, arguments));
  }

  _createClass(SCUnitInRect, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["aakkkk"];
    }
  }]);

  return SCUnitInRect;
}(SCUnit);

dspProcess["aakkkk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var xIn = this.inputs[0];
  var yIn = this.inputs[1];
  var left = this.inputs[2][0];
  var top = this.inputs[3][0];
  var right = this.inputs[4][0];
  var bottom = this.inputs[5][0];

  for (var i = 0; i < inNumSamples; i++) {
    var x = xIn[i];
    var y = yIn[i];

    out[i] = left <= x && x <= right && top <= y && y <= bottom ? 1 : 0;
  }
};

SCUnitRepository.registerSCUnitClass("InRect", SCUnitInRect);

module.exports = SCUnitInRect;
},{"../SCUnit":11,"../SCUnitRepository":12}],89:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitIntegrator = function (_SCUnit) {
  _inherits(SCUnitIntegrator, _SCUnit);

  function SCUnitIntegrator() {
    _classCallCheck(this, SCUnitIntegrator);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitIntegrator).apply(this, arguments));
  }

  _createClass(SCUnitIntegrator, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._slopeFactor = rate.slopeFactor;
      this._b1 = this.inputs[1][0];
      this._y1 = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitIntegrator;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var next_b1 = this.inputs[1][0];
  var b1 = this._b1;
  var y1 = this._y1;
  if (b1 === next_b1) {
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = y1 = inIn[i] + b1 * y1;
    }
  } else {
    var b1_slope = (next_b1 - b1) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      out[_i] = y1 = inIn[_i] + (b1 + b1_slope * _i) * y1;
    }
    this._b1 = next_b1;
  }
  this._y1 = y1;
};
SCUnitRepository.registerSCUnitClass("Integrator", SCUnitIntegrator);
module.exports = SCUnitIntegrator;
},{"../SCUnit":11,"../SCUnitRepository":12}],90:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var fillRange = require("../util/fillRange");
var dspProcess = {};

var SCUnitK2A = function (_SCUnit) {
  _inherits(SCUnitK2A, _SCUnit);

  function SCUnitK2A() {
    _classCallCheck(this, SCUnitK2A);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitK2A).apply(this, arguments));
  }

  _createClass(SCUnitK2A, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["a"];
    }
  }]);

  return SCUnitK2A;
}(SCUnit);

dspProcess["a"] = function (inNumSamples) {
  fillRange(this.outputs[0], this.inputs[0][0], 0, inNumSamples);
};

SCUnitRepository.registerSCUnitClass("K2A", SCUnitK2A);

module.exports = SCUnitK2A;
},{"../SCUnit":11,"../SCUnitRepository":12,"../util/fillRange":214}],91:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitKeyState = function (_SCUnit) {
  _inherits(SCUnitKeyState, _SCUnit);

  function SCUnitKeyState() {
    _classCallCheck(this, SCUnitKeyState);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitKeyState).apply(this, arguments));
  }

  _createClass(SCUnitKeyState, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._y1 = 0;
      this._b1 = 0;
      this._lag = 0;
      this._pointVal = this.context.uiValues.subarray(C.UI_KEY_STATE, C.UI_KEY_STATE + 1);
      this.dspProcess(1);
    }
  }]);

  return SCUnitKeyState;
}(SCUnit);

dspProcess["next"] = function () {
  var keyState = this.inputs[0][0];
  var minval = this.inputs[1][0];
  var maxval = this.inputs[2][0];
  var lag = this.inputs[3][0];
  var y1 = this._y1;
  var b1 = this._b1;
  if (lag !== this._lag) {
    this._b1 = lag === 0 ? 0 : Math.exp(log001 / (lag * this._sampleRate));
    this._lag = lag;
  }
  var y0 = (keyState | 0) === this._pointVal[0] ? maxval : minval;
  this.outputs[0][0] = y1 = y0 + b1 * (y1 - y0);
  this._y1 = y1;
};
SCUnitRepository.registerSCUnitClass("KeyState", SCUnitKeyState);
module.exports = SCUnitKeyState;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],92:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var fill = require("../util/fill");
var dspProcess = {};

var SCUnitKlang = function (_SCUnit) {
  _inherits(SCUnitKlang, _SCUnit);

  function SCUnitKlang() {
    _classCallCheck(this, SCUnitKlang);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitKlang).apply(this, arguments));
  }

  _createClass(SCUnitKlang, [{
    key: "initialize",
    value: function initialize(rate) {
      var outf = setCoefs(this, rate);

      this._prep = dspProcess["prep" + this._numpartials % 4];
      this.dspProcess = dspProcess["aii"];

      this.outputs[0][0] = outf;
    }
  }]);

  return SCUnitKlang;
}(SCUnit);

function setCoefs(unit, rate) {
  var numpartials = Math.floor((unit.inputs.length - 2) / 3);
  var numcoefs = 3 * numpartials;
  var coefs = new Float32Array(numcoefs);
  var inputs = unit.inputs;
  var freqscale = inputs[0][0] * rate.radiansPerSample;
  var freqoffset = inputs[1][0] * rate.radiansPerSample;

  var outf = 0;

  for (var i = 0; i < numpartials; i++) {
    var w = inputs[i * 3 + 2][0] * freqscale + freqoffset;
    var level = inputs[i * 3 + 3][0];
    var phase = inputs[i * 3 + 4][0];

    coefs[i * 3] = level * Math.sin(phase);
    coefs[i * 3 + 1] = level * Math.sin(phase - w);
    coefs[i * 3 + 2] = 2 * Math.cos(w);

    outf += coefs[i * 3];
  }

  unit._numpartials = numpartials;
  unit._n = numpartials >> 2;
  unit._coefs = coefs;

  return outf;
}

dspProcess["prep3"] = function (inNumSamples) {
  var out = this.outputs[0];
  var coefs = this._coefs;
  var b1_0 = coefs[2];
  var b1_1 = coefs[5];
  var b1_2 = coefs[8];

  var y1_0 = coefs[0];
  var y2_0 = coefs[1];
  var y1_1 = coefs[3];
  var y2_1 = coefs[4];
  var y1_2 = coefs[6];
  var y2_2 = coefs[7];

  for (var i = 0; i < inNumSamples; i++) {
    var y0_0 = b1_0 * y1_0 - y2_0;
    var y0_1 = b1_1 * y1_1 - y2_1;
    var y0_2 = b1_2 * y1_2 - y2_2;

    out[i] = y0_0 + y0_1 + y0_2;

    y2_0 = y1_0;
    y1_0 = y0_0;
    y2_1 = y1_1;
    y1_1 = y0_1;
    y2_2 = y1_2;
    y1_2 = y0_2;
  }

  coefs[0] = y1_0;
  coefs[1] = y2_0;
  coefs[3] = y1_1;
  coefs[4] = y2_1;
  coefs[6] = y1_2;
  coefs[7] = y2_2;
};

dspProcess["prep2"] = function (inNumSamples) {
  var out = this.outputs[0];
  var coefs = this._coefs;
  var b1_0 = coefs[2];
  var b1_1 = coefs[5];

  var y1_0 = coefs[0];
  var y2_0 = coefs[1];
  var y1_1 = coefs[3];
  var y2_1 = coefs[4];

  for (var i = 0; i < inNumSamples; i++) {
    var y0_0 = b1_0 * y1_0 - y2_0;
    var y0_1 = b1_1 * y1_1 - y2_1;

    out[i] = y0_0 + y0_1;

    y2_0 = y1_0;
    y1_0 = y0_0;
    y2_1 = y1_1;
    y1_1 = y0_1;
  }

  coefs[0] = y1_0;
  coefs[1] = y2_0;
  coefs[3] = y1_1;
  coefs[4] = y2_1;
};

dspProcess["prep1"] = function (inNumSamples) {
  var out = this.outputs[0];
  var coefs = this._coefs;
  var b1_0 = coefs[2];

  var y1_0 = coefs[0];
  var y2_0 = coefs[1];

  for (var i = 0; i < inNumSamples; i++) {
    var y0_0 = b1_0 * y1_0 - y2_0;

    out[i] = y0_0;

    y2_0 = y1_0;
    y1_0 = y0_0;
  }

  coefs[0] = y1_0;
  coefs[1] = y2_0;
};

dspProcess["prep0"] = function () {
  fill(this.outputs[0], 0);
};

dspProcess["aii"] = function (inNumSamples) {
  var out = this.outputs[0];
  var coefs = this._coefs;

  this._prep(inNumSamples);

  for (var n = 0, nmax = this._n; n < nmax; n++) {
    var k = n * 12;
    var b1_0 = coefs[k + 2];
    var b1_1 = coefs[k + 5];
    var b1_2 = coefs[k + 8];
    var b1_3 = coefs[k + 11];

    var y1_0 = coefs[k + 0];
    var y2_0 = coefs[k + 1];
    var y1_1 = coefs[k + 3];
    var y2_1 = coefs[k + 4];
    var y1_2 = coefs[k + 6];
    var y2_2 = coefs[k + 7];
    var y1_3 = coefs[k + 9];
    var y2_3 = coefs[k + 10];

    for (var i = 0; i < inNumSamples; i++) {
      var y0_0 = b1_0 * y1_0 - y2_0;
      var y0_1 = b1_1 * y1_1 - y2_1;
      var y0_2 = b1_2 * y1_2 - y2_2;
      var y0_3 = b1_3 * y1_3 - y2_3;

      out[i] += y0_0 + y0_1 + y0_2 + y0_3;

      y2_0 = y1_0;
      y1_0 = y0_0;
      y2_1 = y1_1;
      y1_1 = y0_1;
      y2_2 = y1_2;
      y1_2 = y0_2;
      y2_3 = y1_3;
      y1_3 = y0_3;
    }

    coefs[k + 0] = y1_0;
    coefs[k + 1] = y2_0;
    coefs[k + 3] = y1_1;
    coefs[k + 4] = y2_1;
    coefs[k + 6] = y1_2;
    coefs[k + 7] = y2_2;
    coefs[k + 9] = y1_3;
    coefs[k + 10] = y2_3;
  }
};

SCUnitRepository.registerSCUnitClass("Klang", SCUnitKlang);

module.exports = SCUnitKlang;
},{"../SCUnit":11,"../SCUnitRepository":12,"../util/fill":213}],93:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var fill = require("../util/fill");
var dspProcess = {};

var BYTES_PER_ELEMENT = Float32Array.BYTES_PER_ELEMENT;
var log001 = Math.log(0.001);

var SCUnitKlank = function (_SCUnit) {
  _inherits(SCUnitKlank, _SCUnit);

  function SCUnitKlank() {
    _classCallCheck(this, SCUnitKlank);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitKlank).apply(this, arguments));
  }

  _createClass(SCUnitKlank, [{
    key: "initialize",
    value: function initialize(rate) {
      setCoefs(this, rate);

      this._prep = dspProcess["prep" + this._numpartials % 4];
      this.dspProcess = dspProcess["aiii"];

      this._x1 = 0;
      this._x2 = 0;
    }
  }]);

  return SCUnitKlank;
}(SCUnit);

function setCoefs(unit, rate) {
  var numpartials = Math.floor((unit.inputs.length - 4) / 3);
  var numcoefs = 20 * Math.ceil(numpartials / 4);
  var coefs = new Float32Array(numcoefs + rate.bufferLength);
  var buf = new Float32Array(coefs.buffer, numcoefs * BYTES_PER_ELEMENT);
  var inputs = unit.inputs;
  var freqscale = inputs[1][0] * rate.radiansPerSample;
  var freqoffset = inputs[2][0] * rate.radiansPerSample;
  var decayscale = inputs[3][0];
  var sampleRate = rate.sampleRate;

  for (var i = 0, j = 4; i < numpartials; i++, j += 3) {
    var w = inputs[j][0] * freqscale + freqoffset;
    var level = inputs[j + 1][0];
    var time = inputs[j + 2][0] * decayscale;
    var R = time ? Math.exp(log001 / (time * sampleRate)) : 0;
    var twoR = 2 * R;
    var R2 = R * R;
    var cost = twoR * Math.cos(w) / (1 + R2);
    var k = 20 * (i >> 2) + (i & 3);

    coefs[k] = 0;
    coefs[k + 4] = 0;
    coefs[k + 8] = twoR * cost;
    coefs[k + 12] = -R2;
    coefs[k + 16] = level * 0.25;
  }

  unit._numpartials = numpartials;
  unit._n = numpartials >> 2;
  unit._coefs = coefs;
  unit._buf = buf;
}

dspProcess["prep3"] = function (inNumSamples) {
  var inIn = this.inputs[0];
  var coefs = this._coefs;
  var buf = this._buf;
  var k = this._n * 20;
  var b1_0 = coefs[k + 8];
  var b2_0 = coefs[k + 12];
  var a0_0 = coefs[k + 16];
  var b1_1 = coefs[k + 9];
  var b2_1 = coefs[k + 13];
  var a0_1 = coefs[k + 17];
  var b1_2 = coefs[k + 10];
  var b2_2 = coefs[k + 14];
  var a0_2 = coefs[k + 18];

  var y1_0 = coefs[k + 0];
  var y2_0 = coefs[k + 4];
  var y1_1 = coefs[k + 1];
  var y2_1 = coefs[k + 5];
  var y1_2 = coefs[k + 2];
  var y2_2 = coefs[k + 6];

  for (var i = 0; i < inNumSamples; i++) {
    var inf = inIn[i];
    var y0_0 = inf + b1_0 * y1_0 + b2_0 * y2_0;
    var y0_1 = inf + b1_1 * y1_1 + b2_1 * y2_1;
    var y0_2 = inf + b1_2 * y1_2 + b2_2 * y2_2;

    buf[i] = a0_0 * y0_0 + a0_1 * y0_1 + a0_2 * y0_2;

    y2_0 = y1_0;
    y1_0 = y0_0;
    y2_1 = y1_1;
    y1_1 = y0_1;
    y2_2 = y1_2;
    y1_2 = y0_2;
  }

  coefs[k + 0] = y1_0;
  coefs[k + 4] = y2_0;
  coefs[k + 1] = y1_1;
  coefs[k + 5] = y2_1;
  coefs[k + 2] = y1_2;
  coefs[k + 6] = y2_2;
};

dspProcess["prep2"] = function (inNumSamples) {
  var inIn = this.inputs[0];
  var coefs = this._coefs;
  var buf = this._buf;
  var k = this._n * 20;
  var b1_0 = coefs[k + 8];
  var b2_0 = coefs[k + 12];
  var a0_0 = coefs[k + 16];
  var b1_1 = coefs[k + 9];
  var b2_1 = coefs[k + 13];
  var a0_1 = coefs[k + 17];

  var y1_0 = coefs[k + 0];
  var y2_0 = coefs[k + 4];
  var y1_1 = coefs[k + 1];
  var y2_1 = coefs[k + 5];

  for (var i = 0; i < inNumSamples; i++) {
    var inf = inIn[i];
    var y0_0 = inf + b1_0 * y1_0 + b2_0 * y2_0;
    var y0_1 = inf + b1_1 * y1_1 + b2_1 * y2_1;

    buf[i] = a0_0 * y0_0 + a0_1 * y0_1;

    y2_0 = y1_0;
    y1_0 = y0_0;
    y2_1 = y1_1;
    y1_1 = y0_1;
  }

  coefs[k + 0] = y1_0;
  coefs[k + 4] = y2_0;
  coefs[k + 1] = y1_1;
  coefs[k + 5] = y2_1;
};

dspProcess["prep1"] = function (inNumSamples) {
  var inIn = this.inputs[0];
  var coefs = this._coefs;
  var buf = this._buf;
  var k = this._n * 20;
  var b1_0 = coefs[k + 8];
  var b2_0 = coefs[k + 12];
  var a0_0 = coefs[k + 16];

  var y1_0 = coefs[k + 0];
  var y2_0 = coefs[k + 4];

  for (var i = 0; i < inNumSamples; i++) {
    var inf = inIn[i];
    var y0_0 = inf + b1_0 * y1_0 + b2_0 * y2_0;

    buf[i] = a0_0 * y0_0;

    y2_0 = y1_0;
    y1_0 = y0_0;
  }

  coefs[k + 0] = y1_0;
  coefs[k + 4] = y2_0;
};

dspProcess["prep0"] = function () {
  fill(this._buf, 0);
};

dspProcess["aiii"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var coefs = this._coefs;
  var buf = this._buf;

  this._prep(inNumSamples);

  for (var n = 0, nmax = this._n; n < nmax; n++) {
    var k = n * 20;
    var b1_0 = coefs[k + 8];
    var b2_0 = coefs[k + 12];
    var a0_0 = coefs[k + 16];
    var b1_1 = coefs[k + 9];
    var b2_1 = coefs[k + 13];
    var a0_1 = coefs[k + 17];
    var b1_2 = coefs[k + 10];
    var b2_2 = coefs[k + 14];
    var a0_2 = coefs[k + 18];
    var b1_3 = coefs[k + 11];
    var b2_3 = coefs[k + 15];
    var a0_3 = coefs[k + 19];

    var y1_0 = coefs[k + 0];
    var y2_0 = coefs[k + 4];
    var y1_1 = coefs[k + 1];
    var y2_1 = coefs[k + 5];
    var y1_2 = coefs[k + 2];
    var y2_2 = coefs[k + 6];
    var y1_3 = coefs[k + 3];
    var y2_3 = coefs[k + 7];

    for (var i = 0; i < inNumSamples; i++) {
      var inf = inIn[i];
      var y0_0 = inf + b1_0 * y1_0 + b2_0 * y2_0;
      var y0_1 = inf + b1_1 * y1_1 + b2_1 * y2_1;
      var y0_2 = inf + b1_2 * y1_2 + b2_2 * y2_2;
      var y0_3 = inf + b1_3 * y1_3 + b2_3 * y2_3;

      buf[i] += a0_0 * y0_0 + a0_1 * y0_1 + a0_2 * y0_2 + a0_3 * y0_3;

      y2_0 = y1_0;
      y1_0 = y0_0;
      y2_1 = y1_1;
      y1_1 = y0_1;
      y2_2 = y1_2;
      y1_2 = y0_2;
      y2_3 = y1_3;
      y1_3 = y0_3;
    }

    coefs[k + 0] = y1_0;
    coefs[k + 4] = y2_0;
    coefs[k + 1] = y1_1;
    coefs[k + 5] = y2_1;
    coefs[k + 2] = y1_2;
    coefs[k + 6] = y2_2;
    coefs[k + 3] = y1_3;
    coefs[k + 7] = y2_3;
  }

  var x1 = this._x1;
  var x2 = this._x2;

  for (var _i = 0; _i < inNumSamples; _i++) {
    var x0 = buf[_i];

    out[_i] = x0 - x2;

    x2 = x1;
    x1 = x0;
  }

  this._x1 = x1;
  this._x2 = x2;
};

SCUnitRepository.registerSCUnitClass("Klank", SCUnitKlank);

module.exports = SCUnitKlank;
},{"../SCUnit":11,"../SCUnitRepository":12,"../util/fill":213}],94:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFClipNoise = function (_SCUnit) {
  _inherits(SCUnitLFClipNoise, _SCUnit);

  function SCUnitLFClipNoise() {
    _classCallCheck(this, SCUnitLFClipNoise);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFClipNoise).apply(this, arguments));
  }

  _createClass(SCUnitLFClipNoise, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._counter = 0;
      this._level = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFClipNoise;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];
  var level = this._level;
  var counter = this._counter;
  var remain = inNumSamples;
  var j = 0;
  do {
    if (counter <= 0) {
      counter = Math.max(1, this._sampleRate / Math.max(freq, 0.001) | 0);
      level = Math.random() < 0.5 ? -1 : +1;
    }
    var nsmps = Math.min(remain, counter);
    for (var i = 0; i < nsmps; i++) {
      out[j++] = level;
    }
    remain -= nsmps;
    counter -= nsmps;
  } while (remain);
  this._level = level;
  this._counter = counter;
};
SCUnitRepository.registerSCUnitClass("LFClipNoise", SCUnitLFClipNoise);
module.exports = SCUnitLFClipNoise;
},{"../SCUnit":11,"../SCUnitRepository":12}],95:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFCub = function (_SCUnit) {
  _inherits(SCUnitLFCub, _SCUnit);

  function SCUnitLFCub() {
    _classCallCheck(this, SCUnitLFCub);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFCub).apply(this, arguments));
  }

  _createClass(SCUnitLFCub, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._cpstoinc = 2 * rate.sampleDur;
      this._phase = this.inputs[1][0] + 0.5;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFCub;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0] * this._cpstoinc;
  var phase = this._phase;
  for (var i = 0; i < inNumSamples; i++) {
    var z = void 0;
    if (phase < 1) {
      z = phase;
    } else if (phase < 2) {
      z = 2 - phase;
    } else {
      phase -= 2;
      z = phase;
    }
    out[i] = z * z * (6 - 4 * z) - 1;
    phase += freq;
  }
  this._phase = phase;
};
SCUnitRepository.registerSCUnitClass("LFCub", SCUnitLFCub);
module.exports = SCUnitLFCub;
},{"../SCUnit":11,"../SCUnitRepository":12}],96:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFDClipNoise = function (_SCUnit) {
  _inherits(SCUnitLFDClipNoise, _SCUnit);

  function SCUnitLFDClipNoise() {
    _classCallCheck(this, SCUnitLFDClipNoise);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFDClipNoise).apply(this, arguments));
  }

  _createClass(SCUnitLFDClipNoise, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[0].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      this._sampleDur = rate.sampleDur;
      this._level = 0;
      this._phase = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFDClipNoise;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freqIn = this.inputs[0];
  var smpdur = this._sampleDur;
  var level = this._level;
  var phase = this._phase;
  for (var i = 0; i < inNumSamples; i++) {
    phase -= freqIn[i] * smpdur;
    if (phase < 0) {
      phase = 1 + phase % 1;
      level = Math.random() < 0.5 ? -1 : +1;
    }
    out[i] = level;
  }
  this._level = level;
  this._phase = phase;
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];
  var smpdur = this._sampleDur;
  var dphase = smpdur * freq;
  var level = this._level;
  var phase = this._phase;
  for (var i = 0; i < inNumSamples; i++) {
    phase -= dphase;
    if (phase < 0) {
      phase = 1 + phase % 1;
      level = Math.random() < 0.5 ? -1 : +1;
    }
    out[i] = level;
  }
  this._level = level;
  this._phase = phase;
};
SCUnitRepository.registerSCUnitClass("LFDClipNoise", SCUnitLFDClipNoise);
module.exports = SCUnitLFDClipNoise;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],97:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFDNoise0 = function (_SCUnit) {
  _inherits(SCUnitLFDNoise0, _SCUnit);

  function SCUnitLFDNoise0() {
    _classCallCheck(this, SCUnitLFDNoise0);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFDNoise0).apply(this, arguments));
  }

  _createClass(SCUnitLFDNoise0, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[0].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      this._sampleDur = rate.sampleDur;
      this._level = 0;
      this._phase = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFDNoise0;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freqIn = this.inputs[0];
  var smpdur = this._sampleDur;
  var level = this._level;
  var phase = this._phase;
  for (var i = 0; i < inNumSamples; i++) {
    phase -= freqIn[i] * smpdur;
    if (phase < 0) {
      phase = 1 + phase % 1;
      level = Math.random() * 2 - 1;
    }
    out[i] = level;
  }
  this._level = level;
  this._phase = phase;
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];
  var smpdur = this._sampleDur;
  var dphase = smpdur * freq;
  var level = this._level;
  var phase = this._phase;
  for (var i = 0; i < inNumSamples; i++) {
    phase -= dphase;
    if (phase < 0) {
      phase = 1 + phase % 1;
      level = Math.random() * 2 - 1;
    }
    out[i] = level;
  }
  this._level = level;
  this._phase = phase;
};
SCUnitRepository.registerSCUnitClass("LFDNoise0", SCUnitLFDNoise0);
module.exports = SCUnitLFDNoise0;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],98:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFDNoise1 = function (_SCUnit) {
  _inherits(SCUnitLFDNoise1, _SCUnit);

  function SCUnitLFDNoise1() {
    _classCallCheck(this, SCUnitLFDNoise1);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFDNoise1).apply(this, arguments));
  }

  _createClass(SCUnitLFDNoise1, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[0].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      this._sampleDur = rate.sampleDur;
      this._phase = 0;
      this._prevLevel = 0;
      this._nextLevel = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFDNoise1;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freqIn = this.inputs[0];
  var smpdur = this._sampleDur;
  var prevLevel = this._prevLevel;
  var nextLevel = this._nextLevel;
  var phase = this._phase;
  for (var i = 0; i < inNumSamples; i++) {
    phase -= freqIn[i] * smpdur;
    if (phase < 0) {
      phase = 1 + phase % 1;
      prevLevel = nextLevel;
      nextLevel = Math.random() * 2 - 1;
    }
    out[i] = nextLevel + phase * (prevLevel - nextLevel);
  }
  this._prevLevel = prevLevel;
  this._nextLevel = nextLevel;
  this._phase = phase;
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];
  var smpdur = this._sampleDur;
  var dphase = freq * smpdur;
  var prevLevel = this._prevLevel;
  var nextLevel = this._nextLevel;
  var phase = this._phase;
  for (var i = 0; i < inNumSamples; i++) {
    phase -= dphase;
    if (phase < 0) {
      phase = 1 + phase % 1;
      prevLevel = nextLevel;
      nextLevel = Math.random() * 2 - 1;
    }
    out[i] = nextLevel + phase * (prevLevel - nextLevel);
  }
  this._prevLevel = prevLevel;
  this._nextLevel = nextLevel;
  this._phase = phase;
};
SCUnitRepository.registerSCUnitClass("LFDNoise1", SCUnitLFDNoise1);
module.exports = SCUnitLFDNoise1;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],99:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var sc_cubicinterp = require("../util/sc_cubicinterp");
var dspProcess = {};

var SCUnitLFDNoise3 = function (_SCUnit) {
  _inherits(SCUnitLFDNoise3, _SCUnit);

  function SCUnitLFDNoise3() {
    _classCallCheck(this, SCUnitLFDNoise3);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFDNoise3).apply(this, arguments));
  }

  _createClass(SCUnitLFDNoise3, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[0].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      this._sampleDur = rate.sampleDur;
      this._phase = 0;
      this._levelA = 0;
      this._levelB = 0;
      this._levelC = 0;
      this._levelD = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFDNoise3;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freqIn = this.inputs[0];
  var smpdur = this._sampleDur;
  var a = this._levelA;
  var b = this._levelB;
  var c = this._levelC;
  var d = this._levelD;
  var phase = this._phase;
  for (var i = 0; i < inNumSamples; i++) {
    phase -= freqIn[i] * smpdur;
    if (phase < 0) {
      phase = 1 + phase % 1;
      a = b;
      b = c;
      c = d;
      d = Math.random() * 2 - 1;
    }
    out[i] = sc_cubicinterp(1 - phase, a, b, c, d);
  }
  this._levelA = a;
  this._levelB = b;
  this._levelC = c;
  this._levelD = d;
  this._phase = phase;
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];
  var smpdur = this._sampleDur;
  var dphase = freq * smpdur;
  var a = this._levelA;
  var b = this._levelB;
  var c = this._levelC;
  var d = this._levelD;
  var phase = this._phase;
  for (var i = 0; i < inNumSamples; i++) {
    phase -= dphase;
    if (phase < 0) {
      phase = 1 + phase % 1;
      a = b;
      b = c;
      c = d;
      d = Math.random() * 2 - 1;
    }
    out[i] = sc_cubicinterp(1 - phase, a, b, c, d);
  }
  this._levelA = a;
  this._levelB = b;
  this._levelC = c;
  this._levelD = d;
  this._phase = phase;
};
SCUnitRepository.registerSCUnitClass("LFDNoise3", SCUnitLFDNoise3);
module.exports = SCUnitLFDNoise3;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"../util/sc_cubicinterp":216}],100:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFNoise0 = function (_SCUnit) {
  _inherits(SCUnitLFNoise0, _SCUnit);

  function SCUnitLFNoise0() {
    _classCallCheck(this, SCUnitLFNoise0);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFNoise0).apply(this, arguments));
  }

  _createClass(SCUnitLFNoise0, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._level = 0;
      this._counter = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFNoise0;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];
  var level = this._level;
  var counter = this._counter;
  var remain = inNumSamples;
  var j = 0;
  do {
    if (counter <= 0) {
      counter = Math.max(1, this._sampleRate / Math.max(freq, 0.001) | 0);
      level = Math.random() * 2 - 1;
    }
    var nsmps = Math.min(remain, counter);
    for (var i = 0; i < nsmps; i++) {
      out[j++] = level;
    }
    remain -= nsmps;
    counter -= nsmps;
  } while (remain);
  this._level = level;
  this._counter = counter;
};
SCUnitRepository.registerSCUnitClass("LFNoise0", SCUnitLFNoise0);
module.exports = SCUnitLFNoise0;
},{"../SCUnit":11,"../SCUnitRepository":12}],101:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFNoise1 = function (_SCUnit) {
  _inherits(SCUnitLFNoise1, _SCUnit);

  function SCUnitLFNoise1() {
    _classCallCheck(this, SCUnitLFNoise1);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFNoise1).apply(this, arguments));
  }

  _createClass(SCUnitLFNoise1, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._level = Math.random() * 2 - 1;
      this._counter = 0;
      this._slope = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFNoise1;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];
  var level = this._level;
  var slope = this._slope;
  var counter = this._counter;
  var remain = inNumSamples;
  var j = 0;
  do {
    if (counter <= 0) {
      counter = Math.max(1, this._sampleRate / Math.max(freq, 0.001) | 0);
      var nextLevel = Math.random() * 2 - 1;
      slope = (nextLevel - level) / counter;
    }
    var nsmps = Math.min(remain, counter);
    for (var i = 0; i < nsmps; i++) {
      out[j++] = level;
      level += slope;
    }
    remain -= nsmps;
    counter -= nsmps;
  } while (remain);
  this._level = level;
  this._slope = slope;
  this._counter = counter;
};
SCUnitRepository.registerSCUnitClass("LFNoise1", SCUnitLFNoise1);
module.exports = SCUnitLFNoise1;
},{"../SCUnit":11,"../SCUnitRepository":12}],102:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFNoise2 = function (_SCUnit) {
  _inherits(SCUnitLFNoise2, _SCUnit);

  function SCUnitLFNoise2() {
    _classCallCheck(this, SCUnitLFNoise2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFNoise2).apply(this, arguments));
  }

  _createClass(SCUnitLFNoise2, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._level = 0;
      this._counter = 0;
      this._slope = 0;
      this._curve = 0;
      this._nextValue = Math.random() * 2 - 1;
      this._nextMidPt = this._nextValue * 0.5;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFNoise2;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];
  var level = this._level;
  var slope = this._slope;
  var curve = this._curve;
  var counter = this._counter;
  var remain = inNumSamples;
  var j = 0;
  do {
    if (counter <= 0) {
      var value = this._nextValue;
      this._nextValue = Math.random() * 2 - 1;
      level = this._nextMidPt;
      this._nextMidPt = (this._nextValue + value) * 0.5;
      counter = Math.max(2, this._sampleRate / Math.max(freq, 0.001) | 0);
      var fseglen = counter;
      curve = 2 * (this._nextMidPt - level - fseglen * slope) / (fseglen * fseglen + fseglen);
    }
    var nsmps = Math.min(remain, counter);
    for (var i = 0; i < nsmps; i++) {
      out[j++] = level;
      slope += curve;
      level += slope;
    }
    remain -= nsmps;
    counter -= nsmps;
  } while (remain);
  this._level = level;
  this._slope = slope;
  this._curve = curve;
  this._counter = counter;
};
SCUnitRepository.registerSCUnitClass("LFNoise2", SCUnitLFNoise2);
module.exports = SCUnitLFNoise2;
},{"../SCUnit":11,"../SCUnitRepository":12}],103:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFPar = function (_SCUnit) {
  _inherits(SCUnitLFPar, _SCUnit);

  function SCUnitLFPar() {
    _classCallCheck(this, SCUnitLFPar);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFPar).apply(this, arguments));
  }

  _createClass(SCUnitLFPar, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._cpstoinc = 4 * rate.sampleDur;
      this._phase = this.inputs[1][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFPar;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0] * this._cpstoinc;
  var phase = this._phase;
  var z = void 0,
      y = void 0;
  for (var i = 0; i < inNumSamples; i++) {
    if (phase < 1) {
      z = phase;
      y = 1 - z * z;
    } else if (phase < 3) {
      z = phase - 2;
      y = z * z - 1;
    } else {
      phase -= 4;
      z = phase;
      y = 1 - z * z;
    }
    out[i] = y;
    phase += freq;
  }
  this._phase = phase;
};
SCUnitRepository.registerSCUnitClass("LFPar", SCUnitLFPar);
module.exports = SCUnitLFPar;
},{"../SCUnit":11,"../SCUnitRepository":12}],104:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFPulse = function (_SCUnit) {
  _inherits(SCUnitLFPulse, _SCUnit);

  function SCUnitLFPulse() {
    _classCallCheck(this, SCUnitLFPulse);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFPulse).apply(this, arguments));
  }

  _createClass(SCUnitLFPulse, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._cpstoinc = rate.sampleDur;
      this._phase = this.inputs[1][0];
      this._duty = this.inputs[2][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFPulse;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0] * this._cpstoinc;
  var nextDuty = this.inputs[2][0];
  var duty = this._duty;
  var phase = this._phase;
  var z = void 0;
  for (var i = 0; i < inNumSamples; i++) {
    if (phase > 1) {
      phase -= 1;
      duty = nextDuty;
      z = duty < 0.5 ? 1 : 0;
    } else {
      z = phase < duty ? 1 : 0;
    }
    out[i] = z;
    phase += freq;
  }
  this._duty = duty;
  this._phase = phase;
};
SCUnitRepository.registerSCUnitClass("LFPulse", SCUnitLFPulse);
module.exports = SCUnitLFPulse;
},{"../SCUnit":11,"../SCUnitRepository":12}],105:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFSaw = function (_SCUnit) {
  _inherits(SCUnitLFSaw, _SCUnit);

  function SCUnitLFSaw() {
    _classCallCheck(this, SCUnitLFSaw);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFSaw).apply(this, arguments));
  }

  _createClass(SCUnitLFSaw, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._cpstoinc = 2 * rate.sampleDur;
      this._phase = this.inputs[1][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFSaw;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0] * this._cpstoinc;
  var phase = this._phase;
  if (freq >= 0) {
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = phase;
      phase += freq;
      if (phase >= 1) {
        phase -= 2;
      }
    }
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      out[_i] = phase;
      phase += freq;
      if (phase <= -1) {
        phase += 2;
      }
    }
  }
  this._phase = phase;
};
SCUnitRepository.registerSCUnitClass("LFSaw", SCUnitLFSaw);
module.exports = SCUnitLFSaw;
},{"../SCUnit":11,"../SCUnitRepository":12}],106:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLFTri = function (_SCUnit) {
  _inherits(SCUnitLFTri, _SCUnit);

  function SCUnitLFTri() {
    _classCallCheck(this, SCUnitLFTri);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLFTri).apply(this, arguments));
  }

  _createClass(SCUnitLFTri, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._cpstoinc = 4 * rate.sampleDur;
      this._phase = this.inputs[1][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLFTri;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0] * this._cpstoinc;
  var phase = this._phase;
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = phase > 1 ? 2 - phase : phase;
    phase += freq;
    if (phase >= 3) {
      phase -= 4;
    }
  }
  this._phase = phase;
};
SCUnitRepository.registerSCUnitClass("LFTri", SCUnitLFTri);
module.exports = SCUnitLFTri;
},{"../SCUnit":11,"../SCUnitRepository":12}],107:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var sqrt2 = Math.sqrt(2);

var SCUnitLPF = function (_SCUnit) {
  _inherits(SCUnitLPF, _SCUnit);

  function SCUnitLPF() {
    _classCallCheck(this, SCUnitLPF);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLPF).apply(this, arguments));
  }

  _createClass(SCUnitLPF, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._a0 = 0;
      this._b1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._freq = NaN;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLPF;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = Math.max(0.001, this.inputs[1][0]);
  var a0 = this._a0;
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  if (freq !== this._freq) {
    var pfreq = freq * this._radiansPerSample * 0.5;
    var C = 1 / Math.tan(pfreq);
    var C2 = C * C;
    var sqrt2C = C * sqrt2;
    var next_a0 = 1 / (1 + sqrt2C + C2);
    var next_b1 = -2 * (1 - C2) * next_a0;
    var next_b2 = -(1 - sqrt2C + C2) * next_a0;
    var a0_slope = (next_a0 - a0) * this._slopeFactor;
    var b1_slope = (next_b1 - b1) * this._slopeFactor;
    var b2_slope = (next_b2 - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var y0 = inIn[i] + (b1 + b1_slope * i) * y1 + (b2 + b2_slope * i) * y2;
      out[i] = (a0 + a0_slope * i) * (y0 + 2 * y1 + y2);
      y2 = y1;
      y1 = y0;
    }
    this._freq = freq;
    this._a0 = next_a0;
    this._b1 = next_b1;
    this._b2 = next_b2;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y = inIn[_i] + b1 * y1 + b2 * y2;
      out[_i] = a0 * (_y + 2 * y1 + y2);
      y2 = y1;
      y1 = _y;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("LPF", SCUnitLPF);
module.exports = SCUnitLPF;
},{"../SCUnit":11,"../SCUnitRepository":12}],108:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLPZ1 = function (_SCUnit) {
  _inherits(SCUnitLPZ1, _SCUnit);

  function SCUnitLPZ1() {
    _classCallCheck(this, SCUnitLPZ1);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLPZ1).apply(this, arguments));
  }

  _createClass(SCUnitLPZ1, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._x1 = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLPZ1;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var x1 = this._x1;
  for (var i = 0; i < inNumSamples; i++) {
    var x0 = inIn[i];
    out[i] = 0.5 * (x0 + x1);
    x1 = x0;
  }
  this._x1 = x1;
};
SCUnitRepository.registerSCUnitClass("LPZ1", SCUnitLPZ1);
module.exports = SCUnitLPZ1;
},{"../SCUnit":11,"../SCUnitRepository":12}],109:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLPZ2 = function (_SCUnit) {
  _inherits(SCUnitLPZ2, _SCUnit);

  function SCUnitLPZ2() {
    _classCallCheck(this, SCUnitLPZ2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLPZ2).apply(this, arguments));
  }

  _createClass(SCUnitLPZ2, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._x1 = this.inputs[0][0];
      this._x2 = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLPZ2;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var x1 = this._x1;
  var x2 = this._x2;
  for (var i = 0; i < inNumSamples; i++) {
    var x0 = inIn[i];
    out[i] = (x0 + 2 * x1 + x2) * 0.25;
    x2 = x1;
    x1 = x0;
  }
  this._x1 = x1;
  this._x2 = x2;
};
SCUnitRepository.registerSCUnitClass("LPZ2", SCUnitLPZ2);
module.exports = SCUnitLPZ2;
},{"../SCUnit":11,"../SCUnitRepository":12}],110:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitLag = function (_SCUnit) {
  _inherits(SCUnitLag, _SCUnit);

  function SCUnitLag() {
    _classCallCheck(this, SCUnitLag);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLag).apply(this, arguments));
  }

  _createClass(SCUnitLag, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.bufferLength === 1) {
        this.dspProcess = dspProcess["next_1"];
      } else {
        this.dspProcess = dspProcess["next"];
      }
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._lag = NaN;
      this._b1 = 0;
      this._y1 = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLag;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var lag = this.inputs[1][0];
  var y1 = this._y1;
  var b1 = this._b1;
  if (lag === this._lag) {
    for (var i = 0; i < inNumSamples; i++) {
      var y0 = inIn[i];
      out[i] = y1 = y0 + b1 * (y1 - y0);
    }
  } else {
    this._b1 = lag === 0 ? 0 : Math.exp(log001 / (lag * this._sampleRate));
    this._lag = lag;
    var b1_slope = (this._b1 - b1) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y = inIn[_i];
      out[_i] = y1 = _y + (b1 + b1_slope * _i) * (y1 - _y);
    }
  }
  this._y1 = y1;
};
dspProcess["next_1"] = function () {
  var out = this.outputs[0];
  var lag = this.inputs[1][0];
  var y1 = this._y1;
  var b1 = this._b1;
  if (lag !== this._lag) {
    this._b1 = b1 = lag === 0 ? 0 : Math.exp(log001 / (lag * this._sampleRate));
    this._lag = lag;
  }
  var y0 = this.inputs[0][0];
  out[0] = y1 = y0 + b1 * (y1 - y0);
  this._y1 = y1;
};
SCUnitRepository.registerSCUnitClass("Lag", SCUnitLag);
module.exports = SCUnitLag;
},{"../SCUnit":11,"../SCUnitRepository":12}],111:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitLag2 = function (_SCUnit) {
  _inherits(SCUnitLag2, _SCUnit);

  function SCUnitLag2() {
    _classCallCheck(this, SCUnitLag2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLag2).apply(this, arguments));
  }

  _createClass(SCUnitLag2, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[1].rate !== C.RATE_SCALAR) {
        this.dspProcess = dspProcess["next_k"];
      } else {
        if (this.bufferLength === 1) {
          this.dspProcess = dspProcess["next_1_i"];
        } else {
          this.dspProcess = dspProcess["next_i"];
        }
      }
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._lag = NaN;
      this._b1 = 0;
      this._y1a = this.inputs[0][0];
      this._y1b = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLag2;
}(SCUnit);

dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var lag = this.inputs[1][0];
  var y1a = this._y1a;
  var y1b = this._y1b;
  var b1 = this._b1;
  if (lag === this._lag) {
    for (var i = 0; i < inNumSamples; i++) {
      var y0a = inIn[i];
      y1a = y0a + b1 * (y1a - y0a);
      y1b = y1a + b1 * (y1b - y1a);
      out[i] = y1b;
    }
  } else {
    this._b1 = lag === 0 ? 0 : Math.exp(log001 / (lag * this._sampleRate));
    this._lag = lag;
    var b1_slope = (this._b1 - b1) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y0a = inIn[_i];
      b1 += b1_slope;
      y1a = _y0a + b1 * (y1a - _y0a);
      y1b = y1a + b1 * (y1b - y1a);
      out[_i] = y1b;
    }
  }
  this._y1a = y1a;
  this._y1b = y1b;
};
dspProcess["next_i"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var b1 = this._b1;
  var y1a = this._y1a;
  var y1b = this._y1b;
  for (var i = 0; i < inNumSamples; i++) {
    var y0a = inIn[i];
    y1a = y0a + b1 * (y1a - y0a);
    y1b = y1a + b1 * (y1b - y1a);
    out[i] = y1b;
  }
  this._y1a = y1a;
  this._y1b = y1b;
};
dspProcess["next_1_i"] = function () {
  var out = this.outputs[0];
  var y0a = this.inputs[0][0];
  var y1a = this._y1a;
  var y1b = this._y1b;
  var b1 = this._b1;
  y1a = y0a + b1 * (y1a - y0a);
  y1b = y1a + b1 * (y1b - y1a);
  out[0] = y1b;
  this._y1a = y1a;
  this._y1b = y1b;
};
SCUnitRepository.registerSCUnitClass("Lag2", SCUnitLag2);
module.exports = SCUnitLag2;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],112:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitLag2UD = function (_SCUnit) {
  _inherits(SCUnitLag2UD, _SCUnit);

  function SCUnitLag2UD() {
    _classCallCheck(this, SCUnitLag2UD);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLag2UD).apply(this, arguments));
  }

  _createClass(SCUnitLag2UD, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._lagu = 0;
      this._lagd = 0;
      this._b1u = 0;
      this._b1d = 0;
      this._y1a = this.inputs[0][0];
      this._y1b = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLag2UD;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var lagu = this.inputs[1][0];
  var lagd = this.inputs[2][0];
  var y1a = this._y1a;
  var y1b = this._y1b;
  var b1u = this._b1u;
  var b1d = this._b1d;
  if (lagu === this._lagu && lagd === this._lagd) {
    for (var i = 0; i < inNumSamples; i++) {
      var y0a = inIn[i];
      if (y0a > y1a) {
        y1a = y0a + b1u * (y1a - y0a);
      } else {
        y1a = y0a + b1d * (y1a - y0a);
      }
      if (y1a > y1b) {
        y1b = y1a + b1u * (y1b - y1a);
      } else {
        y1b = y1a + b1d * (y1b - y1a);
      }
      out[i] = y1b;
    }
  } else {
    this._b1u = lagu === 0 ? 0 : Math.exp(log001 / (lagu * this._sampleRate));
    this._b1d = lagd === 0 ? 0 : Math.exp(log001 / (lagd * this._sampleRate));
    this._lagu = lagu;
    this._lagd = lagd;
    var b1u_slope = (this._b1u - b1u) * this._slopeFactor;
    var b1d_slope = (this._b1d - b1d) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y0a = inIn[_i];
      b1u += b1u_slope;
      b1d += b1d_slope;
      if (_y0a > y1a) {
        y1a = _y0a + b1u * (y1a - _y0a);
      } else {
        y1a = _y0a + b1d * (y1a - _y0a);
      }
      if (y1a > y1b) {
        y1b = y1a + b1u * (y1b - y1a);
      } else {
        y1b = y1a + b1d * (y1b - y1a);
      }
      out[_i] = y1b;
    }
  }
  this._y1a = y1a;
  this._y1b = y1b;
};
SCUnitRepository.registerSCUnitClass("Lag2UD", SCUnitLag2UD);
module.exports = SCUnitLag2UD;
},{"../SCUnit":11,"../SCUnitRepository":12}],113:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitLag3 = function (_SCUnit) {
  _inherits(SCUnitLag3, _SCUnit);

  function SCUnitLag3() {
    _classCallCheck(this, SCUnitLag3);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLag3).apply(this, arguments));
  }

  _createClass(SCUnitLag3, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[1].rate !== C.RATE_SCALAR) {
        this.dspProcess = dspProcess["next"];
      } else {
        if (this.bufferLength === 1) {
          this.dspProcess = dspProcess["next_1_i"];
        } else {
          this.dspProcess = dspProcess["next"];
        }
      }
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._lag = NaN;
      this._b1 = 0;
      this._y1a = this.inputs[0][0];
      this._y1b = this.inputs[0][0];
      this._y1c = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLag3;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var lag = this.inputs[1][0];
  var y1a = this._y1a;
  var y1b = this._y1b;
  var y1c = this._y1c;
  var b1 = this._b1;
  if (lag === this._lag) {
    for (var i = 0; i < inNumSamples; i++) {
      var y0a = inIn[i];
      y1a = y0a + b1 * (y1a - y0a);
      y1b = y1a + b1 * (y1b - y1a);
      y1c = y1b + b1 * (y1c - y1b);
      out[i] = y1c;
    }
  } else {
    this._b1 = lag === 0 ? 0 : Math.exp(log001 / (lag * this._sampleRate));
    this._lag = lag;
    var b1_slope = (this._b1 - b1) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y0a = inIn[_i];
      b1 += b1_slope;
      y1a = _y0a + b1 * (y1a - _y0a);
      y1b = y1a + b1 * (y1b - y1a);
      y1c = y1b + b1 * (y1c - y1b);
      out[_i] = y1c;
    }
  }
  this._y1a = y1a;
  this._y1b = y1b;
  this._y1c = y1c;
};
dspProcess["next_1_i"] = function () {
  var out = this.outputs[0];
  var y0a = this.inputs[0][0];
  var b1 = this._b1;
  var y1a = this._y1a;
  var y1b = this._y1b;
  var y1c = this._y1c;
  y1a = y0a + b1 * (y1a - y0a);
  y1b = y1a + b1 * (y1b - y1a);
  y1c = y1b + b1 * (y1c - y1b);
  out[0] = y1c;
  this._y1a = y1a;
  this._y1b = y1b;
  this._y1c = y1c;
};
SCUnitRepository.registerSCUnitClass("Lag3", SCUnitLag3);
module.exports = SCUnitLag3;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],114:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitLag3UD = function (_SCUnit) {
  _inherits(SCUnitLag3UD, _SCUnit);

  function SCUnitLag3UD() {
    _classCallCheck(this, SCUnitLag3UD);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLag3UD).apply(this, arguments));
  }

  _createClass(SCUnitLag3UD, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._lagu = 0;
      this._lagd = 0;
      this._b1u = 0;
      this._b1d = 0;
      this._y1a = this.inputs[0][0];
      this._y1b = this.inputs[0][0];
      this._y1c = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLag3UD;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var lagu = this.inputs[1][0];
  var lagd = this.inputs[2][0];
  var y1a = this._y1a;
  var y1b = this._y1b;
  var y1c = this._y1c;
  var b1u = this._b1u;
  var b1d = this._b1d;
  if (lagu === this._lagu && lagd === this._lagd) {
    for (var i = 0; i < inNumSamples; i++) {
      var y0a = inIn[i];
      if (y0a > y1a) {
        y1a = y0a + b1u * (y1a - y0a);
      } else {
        y1a = y0a + b1d * (y1a - y0a);
      }
      if (y1a > y1b) {
        y1b = y1a + b1u * (y1b - y1a);
      } else {
        y1b = y1a + b1d * (y1b - y1a);
      }
      if (y1a > y1b) {
        y1c = y1b + b1u * (y1c - y1b);
      } else {
        y1c = y1b + b1d * (y1c - y1b);
      }
      out[i] = y1c;
    }
  } else {
    this._b1u = lagu === 0 ? 0 : Math.exp(log001 / (lagu * this._sampleRate));
    this._b1d = lagd === 0 ? 0 : Math.exp(log001 / (lagd * this._sampleRate));
    this._lagu = lagu;
    this._lagd = lagd;
    var b1u_slope = (this._b1u - b1u) * this._slopeFactor;
    var b1d_slope = (this._b1d - b1d) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y0a = inIn[_i];
      b1u += b1u_slope;
      b1d += b1d_slope;
      if (_y0a > y1a) {
        y1a = _y0a + b1u * (y1a - _y0a);
      } else {
        y1a = _y0a + b1d * (y1a - _y0a);
      }
      if (y1a > y1b) {
        y1b = y1a + b1u * (y1b - y1a);
      } else {
        y1b = y1a + b1d * (y1b - y1a);
      }
      if (y1a > y1b) {
        y1c = y1b + b1u * (y1c - y1b);
      } else {
        y1c = y1b + b1d * (y1c - y1b);
      }
      out[_i] = y1c;
    }
  }
  this._y1a = y1a;
  this._y1b = y1b;
  this._y1c = y1c;
};
SCUnitRepository.registerSCUnitClass("Lag3UD", SCUnitLag3UD);
module.exports = SCUnitLag3UD;
},{"../SCUnit":11,"../SCUnitRepository":12}],115:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitLagControl = function (_SCUnit) {
  _inherits(SCUnitLagControl, _SCUnit);

  function SCUnitLagControl() {
    _classCallCheck(this, SCUnitLagControl);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLagControl).apply(this, arguments));
  }

  _createClass(SCUnitLagControl, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.outputs.length === 1) {
        this.dspProcess = dspProcess["1"];
      } else {
        this.dspProcess = dspProcess["k"];
      }
      var numberOfOutputs = this.outputs.length;
      var sampleRate = rate.sampleRate;
      this._controls = this.synth.params;
      this._y1 = new Float32Array(numberOfOutputs);
      this._b1 = new Float32Array(numberOfOutputs);
      for (var i = 0; i < numberOfOutputs; i++) {
        var lag = this.inputs[i][0];
        this._y1[i] = this._controls[i];
        this._b1[i] = lag === 0 ? 0 : Math.exp(log001 / (lag * sampleRate));
      }
      this.dspProcess(1);
    }
  }]);

  return SCUnitLagControl;
}(SCUnit);

dspProcess["1"] = function () {
  var y1 = this._y1;
  var b1 = this._b1;
  var z = this._controls[this.specialIndex];
  var x = z + b1[0] * (y1[0] - z);
  this.outputs[0][0] = y1[0] = x;
};
dspProcess["k"] = function () {
  var controls = this._controls;
  var outputs = this.outputs;
  var numberOfOutputs = this.outputs.length;
  var specialIndex = this.specialIndex;
  var y1 = this._y1;
  var b1 = this._b1;
  for (var i = 0; i < numberOfOutputs; i++) {
    var z = controls[specialIndex + i];
    var x = z + b1[i] * (y1[i] - z);
    outputs[i][0] = y1[i] = x;
  }
};
SCUnitRepository.registerSCUnitClass("LagControl", SCUnitLagControl);
module.exports = SCUnitLagControl;
},{"../SCUnit":11,"../SCUnitRepository":12}],116:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitLagUD = function (_SCUnit) {
  _inherits(SCUnitLagUD, _SCUnit);

  function SCUnitLagUD() {
    _classCallCheck(this, SCUnitLagUD);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLagUD).apply(this, arguments));
  }

  _createClass(SCUnitLagUD, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._lagu = NaN;
      this._lagd = NaN;
      this._b1u = 0;
      this._b1d = 0;
      this._y1 = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitLagUD;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var lagu = this.inputs[1][0];
  var lagd = this.inputs[2][0];
  var b1u = this._b1u;
  var b1d = this._b1d;
  var y1 = this._y1;
  if (lagu === this._lagu && lagd === this._lagd) {
    for (var i = 0; i < inNumSamples; i++) {
      var y0 = inIn[i];
      if (y0 > y1) {
        out[i] = y1 = y0 + b1u * (y1 - y0);
      } else {
        out[i] = y1 = y0 + b1d * (y1 - y0);
      }
    }
  } else {
    this._b1u = lagu === 0 ? 0 : Math.exp(log001 / (lagu * this._sampleRate));
    this._b1d = lagd === 0 ? 0 : Math.exp(log001 / (lagd * this._sampleRate));
    this._lagu = lagu;
    this._lagd = lagd;
    var b1u_slope = (this._b1u - b1u) * this._slopeFactor;
    var b1d_slope = (this._b1d - b1d) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y = inIn[_i];
      if (_y > y1) {
        out[_i] = y1 = _y + (b1u + b1u_slope * _i) * (y1 - _y);
      } else {
        out[_i] = y1 = _y + (b1d + b1d_slope * _i) * (y1 - _y);
      }
    }
  }
  this._y1 = y1;
};
SCUnitRepository.registerSCUnitClass("LagUD", SCUnitLagUD);
module.exports = SCUnitLagUD;
},{"../SCUnit":11,"../SCUnitRepository":12}],117:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var fill = require("../util/fill");

var dspProcess = {};

var SCUnitLastValue = function (_SCUnit) {
  _inherits(SCUnitLastValue, _SCUnit);

  function SCUnitLastValue() {
    _classCallCheck(this, SCUnitLastValue);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLastValue).apply(this, arguments));
  }

  _createClass(SCUnitLastValue, [{
    key: "initialize",
    value: function initialize() {

      if (this.inputSpecs[0].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["ak"];
      } else {
        this.dspProcess = dspProcess["kk"];
      }

      this._prev = this.inputs[0][0];
      this._curr = this.inputs[0][0];
    }
  }]);

  return SCUnitLastValue;
}(SCUnit);

dspProcess["ak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var delta = this.inputs[1][0];

  var prev = this._prev;
  var curr = this._curr;

  for (var i = 0; i < inNumSamples; i++) {
    var inval = inIn[i];
    var diff = Math.abs(inval - curr);

    if (delta <= diff) {
      prev = curr;
      curr = inval;
    }
    out[i] = prev;
  }

  this._prev = prev;
  this._curr = curr;
};

dspProcess["kk"] = function () {
  var out = this.outputs[0];
  var inval = this.inputs[0][0];
  var delta = this.inputs[1][0];

  var prev = this._prev;
  var curr = this._curr;

  var diff = Math.abs(inval - curr);

  if (delta <= diff) {
    prev = curr;
    curr = inval;
  }

  fill(out, prev);

  this._prev = prev;
  this._curr = curr;
};

SCUnitRepository.registerSCUnitClass("LastValue", SCUnitLastValue);

module.exports = SCUnitLastValue;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"../util/fill":213}],118:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var fill = require("../util/fill");
var dspProcess = {};

var SCUnitLatch = function (_SCUnit) {
  _inherits(SCUnitLatch, _SCUnit);

  function SCUnitLatch() {
    _classCallCheck(this, SCUnitLatch);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLatch).apply(this, arguments));
  }

  _createClass(SCUnitLatch, [{
    key: "initialize",
    value: function initialize() {
      if (this.inputSpecs[1].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["aa"];
      } else {
        this.dspProcess = dspProcess["ak"];
      }
      var level = this.inputs[0][0];
      var trig = this.inputs[1][0];

      this._trig = 0;
      this._level = 0;

      this.outputs[0][0] = 0 < trig ? level : 0;
    }
  }]);

  return SCUnitLatch;
}(SCUnit);

dspProcess["aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var trigIn = this.inputs[1];

  var trig = this._trig;
  var level = this._level;

  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];

    if (trig <= 0 && 0 < curtrig) {
      level = inIn[i];
    }

    out[i] = level;
    trig = curtrig;
  }

  this._trig = trig;
  this._level = level;
};

dspProcess["ak"] = function () {
  var out = this.outputs[0];
  var trig = this.inputs[1][0];

  var level = this._level;

  if (this._trig <= 0 && 0 < trig) {
    level = this.inputs[0][0];
  }

  fill(out, level);

  this._trig = trig;
  this._level = level;
};

SCUnitRepository.registerSCUnitClass("Latch", SCUnitLatch);

module.exports = SCUnitLatch;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"../util/fill":213}],119:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLeakDC = function (_SCUnit) {
  _inherits(SCUnitLeakDC, _SCUnit);

  function SCUnitLeakDC() {
    _classCallCheck(this, SCUnitLeakDC);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLeakDC).apply(this, arguments));
  }

  _createClass(SCUnitLeakDC, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.bufferLength === 1) {
        this.dspProcess = dspProcess["next_1"];
      } else {
        if (this.inputSpecs[1].rate === C.RATE_SCALAR) {
          this.dspProcess = dspProcess["next_i"];
        } else {
          this.dspProcess = dspProcess["next"];
        }
      }
      this._filterSlope = rate.filterSlope;
      this._b1 = 0;
      this._x1 = this.inputs[0][0];
      this._y1 = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLeakDC;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var b1 = this._b1;
  var b1_next = this.inputs[1][0];
  var y1 = this._y1;
  var x1 = this._x1;
  if (b1 === b1_next) {
    for (var i = 0; i < inNumSamples; i++) {
      var x0 = inIn[i];
      out[i] = y1 = x0 - x1 + b1 * y1;
      x1 = x0;
    }
  } else {
    var b1_slope = (b1_next - b1) * this._filterSlope;
    for (var _i = 0; _i < inNumSamples; _i) {
      var _x = inIn[_i];
      out[_i] = y1 = _x - x1 + (b1 + b1_slope * _i) * y1;
      x1 = _x;
    }
    this._b1 = b1_next;
  }
  this._x1 = x1;
  this._y1 = y1;
};
dspProcess["next_i"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var b1 = this._b1;
  var y1 = this._y1;
  var x1 = this._x1;
  for (var i = 0; i < inNumSamples; i++) {
    var x0 = inIn[i];
    out[i] = y1 = x0 - x1 + b1 * y1;
    x1 = x0;
  }
  this._x1 = x1;
  this._y1 = y1;
};
dspProcess["next_1"] = function () {
  var x0 = this.inputs[0][0];
  var b1 = this.inputs[1][0];
  var y1 = this._y1;
  var x1 = this._x1;
  this.outputs[0][0] = y1 = x0 - x1 + b1 * y1;
  x1 = x0;
  this._x1 = x1;
  this._y1 = y1;
};
SCUnitRepository.registerSCUnitClass("LeakDC", SCUnitLeakDC);
module.exports = SCUnitLeakDC;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],120:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var dspProcess = {};

var SCUnitLeastChange = function (_SCUnit) {
  _inherits(SCUnitLeastChange, _SCUnit);

  function SCUnitLeastChange() {
    _classCallCheck(this, SCUnitLeastChange);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLeastChange).apply(this, arguments));
  }

  _createClass(SCUnitLeastChange, [{
    key: "initialize",
    value: function initialize() {

      if (this.inputSpecs[0].rate === C.RATE_AUDIO) {
        if (this.inputSpecs[1].rate === C.RATE_AUDIO) {
          this.dspProcess = dspProcess["aa"];
        } else {
          this.dspProcess = dspProcess["ak"];
        }
      } else if (this.inputSpecs[1].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["ka"];
      } else {
        this.dspProcess = dspProcess["aa"];
      }

      this._prevA = 0;
      this._prevB = 0;
      this._recent = 1;

      this.dspProcess(1);
    }
  }]);

  return SCUnitLeastChange;
}(SCUnit);

dspProcess["aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var bIn = this.inputs[1];

  var prevA = this._prevA;
  var prevB = this._prevB;
  var recent = this._recent;

  for (var i = 0; i < inNumSamples; i++) {
    var xa = aIn[i];
    var xb = bIn[i];
    var diff = Math.abs(xa - prevA) - Math.abs(xb - prevB);

    if (diff < 0) {
      recent = 0;
      out[i] = xa;
    } else if (0 < diff) {
      recent = 1;
      out[i] = xb;
    } else {
      out[i] = recent ? xb : xa;
    }

    prevA = xa;
    prevB = xb;
  }

  this._prevA = prevA;
  this._prevB = prevB;
  this._recent = recent;
};

dspProcess["ak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var xb = this.inputs[1][0];
  var db = Math.abs(xb - this._prevB);

  var prevA = this._prevA;
  var recent = this._recent;

  for (var i = 0; i < inNumSamples; i++) {
    var xa = aIn[i];
    var diff = Math.abs(xa - prevA) - db;

    if (diff < 0) {
      recent = 0;
      out[i] = xa;
    } else if (0 < diff) {
      recent = 1;
      out[i] = xb;
    } else {
      out[i] = recent ? xb : xa;
    }

    prevA = xa;
  }

  this._prevA = prevA;
  this._prevB = db;
  this._recent = recent;
};

dspProcess["ka"] = function (inNumSamples) {
  var out = this.outputs[0];
  var xa = this.inputs[0][0];
  var da = Math.abs(xa - this._prevA);
  var bIn = this.inputs[1];

  var prevB = this._prevB;
  var recent = this._recent;

  for (var i = 0; i < inNumSamples; i++) {
    var xb = bIn[i];
    var diff = da - Math.abs(xb - prevB);

    if (diff < 0) {
      recent = 0;
      out[i] = xa;
    } else if (0 < diff) {
      recent = 1;
      out[i] = xb;
    } else {
      out[i] = recent ? xb : xa;
    }

    prevB = xb;
  }

  this._prevA = xa;
  this._prevB = prevB;
  this._recent = recent;
};

SCUnitRepository.registerSCUnitClass("LeastChange", SCUnitLeastChange);

module.exports = SCUnitLeastChange;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],121:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLimiter = function (_SCUnit) {
  _inherits(SCUnitLimiter, _SCUnit);

  function SCUnitLimiter() {
    _classCallCheck(this, SCUnitLimiter);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLimiter).apply(this, arguments));
  }

  _createClass(SCUnitLimiter, [{
    key: "initialize",
    value: function initialize(rate) {

      this.dspProcess = dspProcess["aki"];

      var dur = Math.max(rate.bufferDuration, this.inputs[2][0]);
      var bufSize = Math.ceil(dur * rate.sampleRate);

      this._bufSize = bufSize;
      this._flips = 0;
      this._pos = 0;
      this._level = 1;
      this._level_slope = 0;
      this._prevmaxval = 0;
      this._curmaxval = 0;
      this._slopeFactor = 1 / bufSize;
      this._xinbuf = new Float32Array(bufSize);
      this._xmidbuf = new Float32Array(bufSize);
      this._xoutbuf = new Float32Array(bufSize);
    }
  }]);

  return SCUnitLimiter;
}(SCUnit);

dspProcess["aki"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var amp = this.inputs[1][0];
  var bufSize = this._bufSize;
  var level = this._level;

  var pos = this._pos;
  var next_level = this._level;
  var level_slope = this._level_slope;
  var curmaxval = this._curmaxval;

  var bufRemain = bufSize - pos;
  var remain = inNumSamples;
  var val = void 0,
      j = 0;

  while (remain) {
    var nsmps = Math.min(remain, bufRemain);
    var xinbuf = this._xinbuf;
    var xoutbuf = this._xoutbuf;

    if (2 <= this._flips) {
      for (var i = 0; i < nsmps; i++) {
        var x = (level + level_slope * i) * xoutbuf[pos + j];
        xinbuf[pos + j] = val = inIn[j];
        out[j++] = x;
        curmaxval = Math.max(curmaxval, Math.abs(val));
      }
    } else {
      for (var _i = 0; _i < nsmps; _i++) {
        xinbuf[pos + j] = val = inIn[j];
        out[j++] = 0;
        curmaxval = Math.max(curmaxval, Math.abs(val));
      }
    }

    pos += nsmps;

    if (bufSize <= pos) {
      pos = 0;
      bufRemain = bufSize;

      var maxval2 = Math.max(this._prevmaxval, curmaxval);

      this._prevmaxval = curmaxval;
      this._curmaxval = curmaxval = 0;

      next_level = amp < maxval2 ? amp / maxval2 : 1;
      level_slope = (next_level - level) * this._slopeFactor;

      var _ref = [this._xmidbuf, this._xinbuf, this._xoutbuf];
      this._xoutbuf = _ref[0];
      this._xmidbuf = _ref[1];
      this._xinbuf = _ref[2];


      this._flips += 1;
    }

    remain -= nsmps;
  }

  this._pos = pos;
  this._level = next_level;
  this._level_slope = level_slope;
  this._curmaxval = curmaxval;
};

SCUnitRepository.registerSCUnitClass("Limiter", SCUnitLimiter);

module.exports = SCUnitLimiter;
},{"../SCUnit":11,"../SCUnitRepository":12}],122:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLinExp = function (_SCUnit) {
  _inherits(SCUnitLinExp, _SCUnit);

  function SCUnitLinExp() {
    _classCallCheck(this, SCUnitLinExp);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLinExp).apply(this, arguments));
  }

  _createClass(SCUnitLinExp, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next"];
      } else {
        this.dspProcess = dspProcess["next_1"];
      }
      this._slopeFactor = rate.slopeFactor;
      this._srclo = 0;
      this._srchi = 0;
      this._dstlo = 0;
      this._dsthi = 0;
      this._x = 0;
      this._y = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLinExp;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var next_srclo = this.inputs[1][0];
  var next_srchi = this.inputs[2][0];
  var next_dstlo = this.inputs[3][0] || 0.001;
  var next_dsthi = this.inputs[4][0] || 0.001;
  var srclo = this._srclo;
  var srchi = this._srchi;
  var dstlo = this._dstlo;
  var dsthi = this._dsthi;
  var x = this._x;
  var y = this._y;
  if (srclo !== next_srclo || srchi !== next_srchi || dstlo !== next_dstlo || dsthi !== next_dsthi) {
    var next_x = dsthi / dstlo;
    var next_y = srchi - srclo || 0.001;
    var x_slope = (next_x - x) * this._slopeFactor;
    var y_slope = (next_y - y) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = Math.pow(x + x_slope * i, (inIn[i] - srclo) / (y + y_slope * i)) * dstlo;
    }
    this._srclo = next_srclo;
    this._srchi = next_srchi;
    this._dstlo = next_dstlo;
    this._dsthi = next_dsthi;
    this._x = next_x;
    this._y = next_y;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      out[_i] = Math.pow(x, (inIn[_i] - srclo) / y) * dstlo;
    }
  }
};
dspProcess["next_1"] = function () {
  var _in = this.inputs[0][0];
  var srclo = this.inputs[1][0];
  var srchi = this.inputs[2][0];
  var dstlo = this.inputs[3][0] || 0.001;
  var dsthi = this.inputs[4][0] || 0.001;
  if (this._srclo !== srclo || this._srchi !== srchi || this._dstlo !== dstlo || this._dsthi !== dsthi) {
    this._srclo = srclo;
    this._srchi = srchi;
    this._dstlo = dstlo;
    this._dsthi = dsthi;
    this._x = dsthi / dstlo;
    this._y = srchi - srclo || 0.001;
  }
  this.outputs[0][0] = Math.pow(this._x, (_in - srclo) / this._y) * dstlo;
};
SCUnitRepository.registerSCUnitClass("LinExp", SCUnitLinExp);
module.exports = SCUnitLinExp;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],123:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLinLin = function (_SCUnit) {
  _inherits(SCUnitLinLin, _SCUnit);

  function SCUnitLinLin() {
    _classCallCheck(this, SCUnitLinLin);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLinLin).apply(this, arguments));
  }

  _createClass(SCUnitLinLin, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next"];
      } else {
        this.dspProcess = dspProcess["next_1"];
      }
      this._slopeFactor = rate.slopeFactor;
      this._srclo = 0;
      this._srchi = 0;
      this._dstlo = 0;
      this._dsthi = 0;
      this._scale = 1;
      this._offset = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLinLin;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var next_srclo = this.inputs[1][0];
  var next_srchi = this.inputs[2][0];
  var next_dstlo = this.inputs[3][0];
  var next_dsthi = this.inputs[4][0];
  var srclo = this._srclo;
  var srchi = this._srchi;
  var dstlo = this._dstlo;
  var dsthi = this._dsthi;
  var scale = this._scale;
  var offset = this._offset;
  if (srclo !== next_srclo || srchi !== next_srchi || dstlo !== next_dstlo || dsthi !== next_dsthi) {
    var next_scale = (next_dsthi - next_dstlo) / (next_srchi - next_srclo) || 0;
    var next_offset = next_dstlo - next_scale * next_srclo;
    var scale_slope = (next_scale - scale) * this._slopeFactor;
    var offset_slope = (next_offset - offset) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = inIn[i] * (scale + scale_slope * i) + (offset + offset_slope * i);
    }
    this._srclo = next_srclo;
    this._srchi = next_srchi;
    this._dstlo = next_dstlo;
    this._dsthi = next_dsthi;
    this._scale = next_scale;
    this._offset = next_offset;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      out[_i] = inIn[_i] * scale + offset;
    }
  }
};
dspProcess["next_1"] = function () {
  var _in = this.inputs[0][0];
  var srclo = this.inputs[1][0];
  var srchi = this.inputs[2][0];
  var dstlo = this.inputs[3][0];
  var dsthi = this.inputs[4][0];
  if (this._srclo !== srclo || this._srchi !== srchi || this._dstlo !== dstlo || this._dsthi !== dsthi) {
    this._srclo = srclo;
    this._srchi = srchi;
    this._dstlo = dstlo;
    this._dsthi = dsthi;
    this._scale = (dsthi - dstlo) / (srchi - srclo) || 0;
    this._offset = dstlo - this._scale * srclo;
  }
  this.outputs[0][0] = _in * this._scale + this._offset;
};
SCUnitRepository.registerSCUnitClass("LinLin", SCUnitLinLin);
module.exports = SCUnitLinLin;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],124:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var clamp = require("../util/clamp");

var dspProcess = {};

var SCUnitLinPan2 = function (_SCUnit) {
  _inherits(SCUnitLinPan2, _SCUnit);

  function SCUnitLinPan2() {
    _classCallCheck(this, SCUnitLinPan2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLinPan2).apply(this, arguments));
  }

  _createClass(SCUnitLinPan2, [{
    key: "initialize",
    value: function initialize(rate) {

      if (this.inputSpecs[1].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["aak"];
      } else {
        this.dspProcess = dspProcess["akk"];
      }

      this._slopeFactor = rate.slopeFactor;
      this._level = this.inputs[2][0];
      this._pan = clamp(this.inputs[1][0] * 0.5 + 0.5, 0, 1);
      this._rightAmp = this._level * this._pan;
      this._leftAmp = this._level * (1 - this._pan);

      this.dspProcess(1);
    }
  }]);

  return SCUnitLinPan2;
}(SCUnit);

dspProcess["aak"] = function (inNumSamples) {
  var leftOut = this.outputs[0];
  var rightOut = this.outputs[1];
  var inIn = this.inputs[0];
  var posIn = this.inputs[1];
  var level = this._level;
  var next_level = this.inputs[2][0];

  var pan = void 0;

  if (level !== next_level) {
    var level_slope = (next_level - level) * this._slopeFactor;

    for (var i = 0; i < inNumSamples; i++) {
      pan = clamp(posIn[i] * 0.5 + 0.5, 0, 1);

      var amp = level + level_slope * i;
      var rightAmp = amp * pan;
      var leftAmp = amp * (1 - pan);

      leftOut[i] = inIn[i] * leftAmp;
      rightOut[i] = inIn[i] * rightAmp;
    }

    this._level = next_level;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      pan = clamp(posIn[_i] * 0.5 + 0.5, 0, 1);
      leftOut[_i] = inIn[_i] * (level * (1 - pan));
      rightOut[_i] = inIn[_i] * (level * pan);
    }
  }
};

dspProcess["akk"] = function (inNumSamples) {
  var leftOut = this.outputs[0];
  var rightOut = this.outputs[1];
  var inIn = this.inputs[0];
  var next_pan = clamp(this.inputs[1][0] * 0.5 + 0.5, 0, 1);
  var next_level = this.inputs[2][0];
  var leftAmp = this._leftAmp;
  var rightAmp = this._rightAmp;

  if (this._pan !== next_pan || this._level !== next_level) {
    var next_rightAmp = next_level * next_pan;
    var next_leftAmp = next_level * (1 - next_pan);
    var leftAmp_slope = (next_leftAmp - leftAmp) * this._slopeFactor;
    var rightAmp_slope = (next_rightAmp - rightAmp) * this._slopeFactor;

    for (var i = 0; i < inNumSamples; i++) {
      leftOut[i] = inIn[i] * (leftAmp + leftAmp_slope * i);
      rightOut[i] = inIn[i] * (rightAmp + rightAmp_slope * i);
    }

    this._pan = next_pan;
    this._level = next_level;
    this._leftAmp = next_leftAmp;
    this._rightAmp = next_rightAmp;
  } else {
    for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
      leftOut[_i2] = inIn[_i2] * leftAmp;
      rightOut[_i2] = inIn[_i2] * rightAmp;
    }
  }
};

SCUnitRepository.registerSCUnitClass("LinPan2", SCUnitLinPan2);

module.exports = SCUnitLinPan2;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"../util/clamp":212}],125:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitLinRand = function (_SCUnit) {
  _inherits(SCUnitLinRand, _SCUnit);

  function SCUnitLinRand() {
    _classCallCheck(this, SCUnitLinRand);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLinRand).apply(this, arguments));
  }

  _createClass(SCUnitLinRand, [{
    key: "initialize",
    value: function initialize() {
      var lo = this.inputs[0][0];
      var hi = this.inputs[1][0];
      var n = this.inputs[2][0] | 0;
      var range = hi - lo;
      var a = Math.random();
      var b = Math.random();
      if (n <= 0) {
        this.outputs[0][0] = Math.min(a, b) * range + lo;
      } else {
        this.outputs[0][0] = Math.max(a, b) * range + lo;
      }
    }
  }]);

  return SCUnitLinRand;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("LinRand", SCUnitLinRand);
module.exports = SCUnitLinRand;
},{"../SCUnit":11,"../SCUnitRepository":12}],126:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLinXFade2 = function (_SCUnit) {
  _inherits(SCUnitLinXFade2, _SCUnit);

  function SCUnitLinXFade2() {
    _classCallCheck(this, SCUnitLinXFade2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLinXFade2).apply(this, arguments));
  }

  _createClass(SCUnitLinXFade2, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[2].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_a"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      this._slopeFactor = rate.slopeFactor;
      this._pos = Math.max(-1, Math.min(this.inputs[2][0], 1));
      this._amp = this._pos * 0.5 + 0.5;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLinXFade2;
}(SCUnit);

dspProcess["next_a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var leftIn = this.inputs[0];
  var rightIn = this.inputs[1];
  var posIn = this.inputs[2];
  for (var i = 0; i < inNumSamples; i++) {
    var pos = Math.max(-1, Math.min(posIn[i], 1));
    var amp = pos * 0.5 + 0.5;
    out[i] = leftIn[i] + amp * (rightIn[i] - leftIn[i]);
  }
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var leftIn = this.inputs[0];
  var rightIn = this.inputs[1];
  var nextPos = this.inputs[2][0];
  var amp = this._amp;
  if (this._pos !== nextPos) {
    var pos = Math.max(-1, Math.min(nextPos, 1));
    var nextAmp = pos * 0.5 + 0.5;
    var amp_slope = (nextAmp - amp) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = leftIn[i] + (amp + amp_slope * i) * (rightIn[i] - leftIn[i]);
    }
    this._pos = nextPos;
    this._amp = nextAmp;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      out[_i] = leftIn[_i] + amp * (rightIn[_i] - leftIn[_i]);
    }
  }
};
SCUnitRepository.registerSCUnitClass("LinXFade2", SCUnitLinXFade2);
module.exports = SCUnitLinXFade2;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],127:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLine = function (_SCUnit) {
  _inherits(SCUnitLine, _SCUnit);

  function SCUnitLine() {
    _classCallCheck(this, SCUnitLine);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLine).apply(this, arguments));
  }

  _createClass(SCUnitLine, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      var start = this.inputs[0][0];
      var end = this.inputs[1][0];
      var dur = this.inputs[2][0];
      var counter = Math.round(dur * rate.sampleRate);
      this._counter = Math.max(1, counter);
      if (counter === 0) {
        this._level = end;
        this._slope = 0;
      } else {
        this._slope = (end - start) / this._counter;
        this._level = start + this._slope;
      }
      this._endLevel = end;
      this._doneAction = this.inputs[3][0];
      this.outputs[0][0] = this._level;
    }
  }]);

  return SCUnitLine;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var slope = this._slope;
  var level = this._level;
  var counter = this._counter;
  var remain = inNumSamples;
  var j = 0;
  do {
    if (counter === 0) {
      var endLevel = this._endLevel;
      for (var i = 0; i < remain; i++) {
        out[j++] = endLevel;
      }
      remain = 0;
    } else {
      var nsmps = Math.min(remain, counter);
      counter -= nsmps;
      remain -= nsmps;
      for (var _i = 0; _i < nsmps; _i++) {
        out[j++] = level;
        level += slope;
      }
      if (counter === 0) {
        this.doneAction(this._doneAction);
      }
    }
  } while (remain);
  this._counter = counter;
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("Line", SCUnitLine);
module.exports = SCUnitLine;
},{"../SCUnit":11,"../SCUnitRepository":12}],128:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLinen = function (_SCUnit) {
  _inherits(SCUnitLinen, _SCUnit);

  function SCUnitLinen() {
    _classCallCheck(this, SCUnitLinen);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLinen).apply(this, arguments));
  }

  _createClass(SCUnitLinen, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._level = 0;
      this._stage = 4;
      this._prevGate = 0;
      this._slope = 0;
      this._counter = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLinen;
}(SCUnit);

dspProcess["next"] = function () {
  var out = this.outputs[0];
  var gate = this.inputs[0][0];
  if (this._prevGate <= 0 && gate > 0) {
    this.done = false;
    this._stage = 0;
    var attackTime = this.inputs[1][0];
    var susLevel = this.inputs[2][0];
    var counter = Math.max(1, attackTime * this._sampleRate | 0);
    this._slope = (susLevel - this._level) / counter;
    this._counter = counter;
  }
  switch (this._stage) {
    case 0:
    case 2:
      out[0] = this._level;
      this._level += this._slope;
      this._counter -= 1;
      if (this._counter === 0) {
        this._stage += 1;
      }
      break;
    case 1:
      out[0] = this._level;
      if (gate <= -1) {
        var releaseTime = -gate - 1;
        var _counter = Math.max(1, releaseTime * this._sampleRate | 0);
        this._stage = 2;
        this._slope = -this._level / _counter;
        this._counter = _counter;
      } else if (gate <= 0) {
        var _releaseTime = this.inputs[3][0];
        var _counter2 = Math.max(1, _releaseTime * this._sampleRate | 0);
        this._stage = 2;
        this._slope = -this._level / _counter2;
        this._counter = _counter2;
      }
      break;
    case 3:
      out[0] = 0;
      this.done = true;
      this._stage = 4;
      this.doneAction(this.inputs[4][0]);
      break;
    case 4:
      out[0] = 0;
      break;
  }
  this._prevGate = gate;
};
SCUnitRepository.registerSCUnitClass("Linen", SCUnitLinen);
module.exports = SCUnitLinen;
},{"../SCUnit":11,"../SCUnitRepository":12}],129:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitLogistic = function (_SCUnit) {
  _inherits(SCUnitLogistic, _SCUnit);

  function SCUnitLogistic() {
    _classCallCheck(this, SCUnitLogistic);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitLogistic).apply(this, arguments));
  }

  _createClass(SCUnitLogistic, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._y1 = this.inputs[2][0];
      this._counter = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitLogistic;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var paramf = this.inputs[0][0];
  var freq = this.inputs[1][0];
  var sampleRate = this._sampleRate;
  var y1 = this._y1;
  var counter = this._counter;
  var remain = inNumSamples;
  var j = 0;
  do {
    if (counter <= 0) {
      counter = Math.max(1, sampleRate / Math.max(0.001, freq)) | 0;
      y1 = paramf * y1 * (1 - y1);
    }
    var nsmps = Math.min(counter, remain);
    counter -= nsmps;
    remain -= nsmps;
    for (var i = 0; i < nsmps; i++) {
      out[j++] = y1;
    }
  } while (remain);
  this._y1 = y1;
  this._counter = counter;
};
SCUnitRepository.registerSCUnitClass("Logistic", SCUnitLogistic);
module.exports = SCUnitLogistic;
},{"../SCUnit":11,"../SCUnitRepository":12}],130:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var f32 = new Float32Array(1);
var i32 = new Int32Array(f32.buffer);
var dspProcess = {};

var SCUnitMantissaMask = function (_SCUnit) {
  _inherits(SCUnitMantissaMask, _SCUnit);

  function SCUnitMantissaMask() {
    _classCallCheck(this, SCUnitMantissaMask);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitMantissaMask).apply(this, arguments));
  }

  _createClass(SCUnitMantissaMask, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["ak"];
      this.dspProcess(1);
    }
  }]);

  return SCUnitMantissaMask;
}(SCUnit);

dspProcess["ak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var bits = this.inputs[0][1] | 0;
  var mask = -1 << 23 - bits;

  for (var i = 0; i < inNumSamples; i++) {
    f32[0] = inIn[i];
    i32[0] = mask & i32[0];
    out[i] = f32[0];
  }
};

SCUnitRepository.registerSCUnitClass("MantissaMask", SCUnitMantissaMask);

module.exports = SCUnitMantissaMask;
},{"../SCUnit":11,"../SCUnitRepository":12}],131:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var nmap = require("nmap");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var clamp = require("../util/clamp");
var dspProcess = {};

var kMAXMEDIANSIZE = 31;

var SCUnitMedian = function (_SCUnit) {
  _inherits(SCUnitMedian, _SCUnit);

  function SCUnitMedian() {
    _classCallCheck(this, SCUnitMedian);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitMedian).apply(this, arguments));
  }

  _createClass(SCUnitMedian, [{
    key: "initialize",
    value: function initialize() {

      this.dspProcess = dspProcess["ia"];

      var medianSize = clamp(this.inputs[0][0] | 0, 3, kMAXMEDIANSIZE);

      if (medianSize % 2 === 0) {
        medianSize += 1;
      }

      var _in = this.inputs[1][0];

      this._medianSize = medianSize;
      this._medialVal = new Float32Array(nmap(medianSize, function () {
        return _in;
      }));
      this._medianAge = new Uint8Array(nmap(medianSize, function (_, i) {
        return i;
      }));

      this.outputs[0][0] = _in;
    }
  }]);

  return SCUnitMedian;
}(SCUnit);

function computeMedian(unit, value) {
  var medianSize = unit._medianSize;
  var medialVal = unit._medialVal;
  var medianAge = unit._medianAge;
  var last = medianSize - 1;

  var pos = -1;

  for (var i = 0; i < medianSize; i++) {
    if (medianAge[i] === last) {
      pos = i;
    } else {
      medianAge[i] += 1;
    }
  }

  while (1 <= pos && value < medialVal[pos - 1]) {
    medialVal[pos] = medialVal[pos - 1];
    medianAge[pos] = medianAge[pos - 1];
    pos -= 1;
  }

  while (pos < last && medialVal[pos + 1] < value) {
    medialVal[pos] = medialVal[pos + 1];
    medianAge[pos] = medianAge[pos + 1];
    pos += 1;
  }

  medialVal[pos] = value;
  medianAge[pos] = 0;

  return medialVal[medianSize >> 1];
}

dspProcess["ia"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[1];

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = computeMedian(this, inIn[i]);
  }
};

SCUnitRepository.registerSCUnitClass("Median", SCUnitMedian);

module.exports = SCUnitMedian;
},{"../SCUnit":11,"../SCUnitRepository":12,"../util/clamp":212,"nmap":2}],132:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitMidEQ = function (_SCUnit) {
  _inherits(SCUnitMidEQ, _SCUnit);

  function SCUnitMidEQ() {
    _classCallCheck(this, SCUnitMidEQ);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitMidEQ).apply(this, arguments));
  }

  _createClass(SCUnitMidEQ, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._a0 = 0;
      this._b1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._freq = NaN;
      this._bw = NaN;
      this._db = NaN;
      this.dspProcess(1);
    }
  }]);

  return SCUnitMidEQ;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var bw = this.inputs[2][0];
  var db = this.inputs[3][0];
  var a0 = this._a0;
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  if (freq !== this._freq || bw !== this._bw || db !== this._db) {
    var amp = Math.pow(10, db * 0.05) - 1;
    var pfreq = freq * this._radiansPerSample;
    var pbw = bw * pfreq * 0.5;
    var C = pbw ? 1 / Math.tan(pbw) : 0;
    var D = 2 * Math.cos(pfreq);
    var next_a0 = 1 / (1 + C);
    var next_b1 = C * D * next_a0;
    var next_b2 = (1 - C) * next_a0;
    var a0_slope = (next_a0 * amp - a0) * this._slopeFactor;
    var b1_slope = (next_b1 - b1) * this._slopeFactor;
    var b2_slope = (next_b2 - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var zin = inIn[i];
      var y0 = zin + (b1 + b1_slope * i) * y1 + (b2 + b2_slope * i) * y2;
      out[i] = zin + (a0 + a0_slope * i) * (y0 - y2);
      y2 = y1;
      y1 = y0;
    }
    this._freq = freq;
    this._bw = bw;
    this._db = db;
    this._a0 = next_a0;
    this._b1 = next_b1;
    this._b2 = next_b2;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _zin = inIn[_i];
      var _y = _zin + b1 * y1 + b2 * y2;
      out[_i] = _zin + a0 * (_y - y2);
      y2 = y1;
      y1 = _y;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("MidEQ", SCUnitMidEQ);
module.exports = SCUnitMidEQ;
},{"../SCUnit":11,"../SCUnitRepository":12}],133:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitModDif = function (_SCUnit) {
  _inherits(SCUnitModDif, _SCUnit);

  function SCUnitModDif() {
    _classCallCheck(this, SCUnitModDif);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitModDif).apply(this, arguments));
  }

  _createClass(SCUnitModDif, [{
    key: "initialize",
    value: function initialize(rate) {

      if (this.calcRate !== C.RATE_AUDIO) {
        this.dspProcess = dspProcess["aaa"];
      } else {
        if (this.inputSpecs[1].rate === C.RATE_AUDIO) {
          if (this.inputSpecs[2].rate === C.RATE_AUDIO) {
            this.dspProcess = dspProcess["aaa"];
          } else {
            this.dspProcess = dspProcess["aak"];
          }
        } else if (this.inputSpecs[2].rate === C.RATE_AUDIO) {
          this.dspProcess = dspProcess["aka"];
        } else {
          this.dspProcess = dspProcess["akk"];
        }
      }

      this.dspProcess = dspProcess["a"];

      this._slopeFactor = rate.slopeFactor;
      this._dif = this.inputs[1][0];
      this._mod = this.inputs[2][0];
    }
  }]);

  return SCUnitModDif;
}(SCUnit);

dspProcess["aaa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var difIn = this.inputs[1];
  var modIn = this.inputs[2];

  for (var i = 0; i < inNumSamples; i++) {
    var _in = inIn[i];
    var curmod = modIn[i];
    var diff = Math.abs(_in - difIn[i]) % curmod;
    var modhalf = curmod * 0.5;

    out[i] = modhalf - Math.abs(diff - modhalf);
  }
};

dspProcess["aak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var difIn = this.inputs[1];
  var mod = this._mod;
  var next_mod = this.inputs[2][0];
  var mod_slope = (next_mod - mod) * this._slopeFactor;

  for (var i = 0; i < inNumSamples; i++) {
    var _in = inIn[i];
    var curmod = mod + mod_slope * i;
    var diff = Math.abs(_in - difIn[i]) % curmod;
    var modhalf = curmod * 0.5;

    out[i] = modhalf - Math.abs(diff - modhalf);
  }

  this._mod = next_mod;
};

dspProcess["aka"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var dif = this._dif;
  var modIn = this.inputs[2];
  var next_dif = this.inputs[1][0];
  var dif_slope = (next_dif - dif) * this._slopeFactor;

  for (var i = 0; i < inNumSamples; i++) {
    var _in = inIn[i];
    var curmod = modIn[i];
    var diff = Math.abs(_in - (dif + dif_slope * i)) % curmod;
    var modhalf = curmod * 0.5;

    out[i] = modhalf - Math.abs(diff - modhalf);
  }

  this._dif = next_dif;
};

dspProcess["akk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var dif = this._dif;
  var mod = this._mod;
  var next_dif = this.inputs[1][0];
  var next_mod = this.inputs[2][0];
  var dif_slope = (next_dif - dif) * this._slopeFactor;
  var mod_slope = (next_mod - mod) * this._slopeFactor;

  for (var i = 0; i < inNumSamples; i++) {
    var _in = inIn[i];
    var curmod = mod + mod_slope * i;
    var diff = Math.abs(_in - (dif + dif_slope * i)) % curmod;
    var modhalf = curmod * 0.5;

    out[i] = modhalf - Math.abs(diff - modhalf);
  }

  this._dif = next_dif;
  this._mod = next_mod;
};

SCUnitRepository.registerSCUnitClass("ModDif", SCUnitModDif);

module.exports = SCUnitModDif;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],134:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var dspProcess = {};

var SCUnitMostChange = function (_SCUnit) {
  _inherits(SCUnitMostChange, _SCUnit);

  function SCUnitMostChange() {
    _classCallCheck(this, SCUnitMostChange);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitMostChange).apply(this, arguments));
  }

  _createClass(SCUnitMostChange, [{
    key: "initialize",
    value: function initialize() {

      if (this.inputSpecs[0].rate === C.RATE_AUDIO) {
        if (this.inputSpecs[1].rate === C.RATE_AUDIO) {
          this.dspProcess = dspProcess["aa"];
        } else {
          this.dspProcess = dspProcess["ak"];
        }
      } else if (this.inputSpecs[1].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["ka"];
      } else {
        this.dspProcess = dspProcess["aa"];
      }

      this._prevA = 0;
      this._prevB = 0;
      this._recent = 1;

      this.dspProcess(1);
    }
  }]);

  return SCUnitMostChange;
}(SCUnit);

dspProcess["aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var bIn = this.inputs[1];

  var prevA = this._prevA;
  var prevB = this._prevB;
  var recent = this._recent;

  for (var i = 0; i < inNumSamples; i++) {
    var xa = aIn[i];
    var xb = bIn[i];
    var diff = Math.abs(xa - prevA) - Math.abs(xb - prevB);

    if (0 < diff) {
      recent = 0;
      out[i] = xa;
    } else if (diff < 0) {
      recent = 1;
      out[i] = xb;
    } else {
      out[i] = recent ? xb : xa;
    }

    prevA = xa;
    prevB = xb;
  }

  this._prevA = prevA;
  this._prevB = prevB;
  this._recent = recent;
};

dspProcess["ak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var aIn = this.inputs[0];
  var xb = this.inputs[1][0];
  var db = Math.abs(xb - this._prevB);

  var prevA = this._prevA;
  var recent = this._recent;

  for (var i = 0; i < inNumSamples; i++) {
    var xa = aIn[i];
    var diff = Math.abs(xa - prevA) - db;

    if (0 < diff) {
      recent = 0;
      out[i] = xa;
    } else if (diff < 0) {
      recent = 1;
      out[i] = xb;
    } else {
      out[i] = recent ? xb : xa;
    }

    prevA = xa;
  }

  this._prevA = prevA;
  this._prevB = db;
  this._recent = recent;
};

dspProcess["ka"] = function (inNumSamples) {
  var out = this.outputs[0];
  var xa = this.inputs[0][0];
  var da = Math.abs(xa - this._prevA);
  var bIn = this.inputs[1];

  var prevB = this._prevB;
  var recent = this._recent;

  for (var i = 0; i < inNumSamples; i++) {
    var xb = bIn[i];
    var diff = da - Math.abs(xb - prevB);

    if (0 < diff) {
      recent = 0;
      out[i] = xa;
    } else if (diff < 0) {
      recent = 1;
      out[i] = xb;
    } else {
      out[i] = recent ? xb : xa;
    }

    prevB = xb;
  }

  this._prevA = xa;
  this._prevB = prevB;
  this._recent = recent;
};

SCUnitRepository.registerSCUnitClass("MostChange", SCUnitMostChange);

module.exports = SCUnitMostChange;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],135:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitMouseButton = function (_SCUnit) {
  _inherits(SCUnitMouseButton, _SCUnit);

  function SCUnitMouseButton() {
    _classCallCheck(this, SCUnitMouseButton);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitMouseButton).apply(this, arguments));
  }

  _createClass(SCUnitMouseButton, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._y1 = 0;
      this._b1 = 0;
      this._lag = 0;
      this._pointVal = this.context.uiValues.subarray(C.UI_MOUSE_BUTTON, C.UI_MOUSE_BUTTON + 1);
      this.dspProcess(1);
    }
  }]);

  return SCUnitMouseButton;
}(SCUnit);

dspProcess["next"] = function () {
  var minval = this.inputs[0][0];
  var maxval = this.inputs[1][0];
  var lag = this.inputs[2][0];
  var y1 = this._y1;
  var b1 = this._b1;
  if (lag !== this._lag) {
    this._b1 = lag === 0 ? 0 : Math.exp(log001 / (lag * this.ç));
    this._lag = lag;
  }
  var y0 = this._pointVal[0] ? maxval : minval;
  this.outputs[0][0] = y1 = y0 + b1 * (y1 - y0);
  this._y1 = y1;
};
SCUnitRepository.registerSCUnitClass("MouseButton", SCUnitMouseButton);
module.exports = SCUnitMouseButton;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],136:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitMouseX = function (_SCUnit) {
  _inherits(SCUnitMouseX, _SCUnit);

  function SCUnitMouseX() {
    _classCallCheck(this, SCUnitMouseX);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitMouseX).apply(this, arguments));
  }

  _createClass(SCUnitMouseX, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._y1 = 0;
      this._b1 = 0;
      this._lag = 0;
      this._pointVal = this.context.uiValues.subarray(C.UI_MOUSE_X, C.UI_MOUSE_X + 1);
      this.dspProcess(1);
    }
  }]);

  return SCUnitMouseX;
}(SCUnit);

dspProcess["next"] = function () {
  var minval = this.inputs[0][0] || 0.01;
  var maxval = this.inputs[1][0];
  var warp = this.inputs[2][0];
  var lag = this.inputs[3][0];
  var y1 = this._y1;
  var b1 = this._b1;
  if (lag !== this._lag) {
    this._b1 = lag === 0 ? 0 : Math.exp(log001 / (lag * this._sampleRate));
    this._lag = lag;
  }
  var y0 = this._pointVal[0];
  if (warp === 0) {
    y0 = (maxval - minval) * y0 + minval;
  } else {
    y0 = Math.pow(maxval / minval, y0) * minval;
    if (isNaN(y0)) {
      y0 = 0;
    }
  }
  this.outputs[0][0] = y1 = y0 + b1 * (y1 - y0);
  this._y1 = y1;
};
SCUnitRepository.registerSCUnitClass("MouseX", SCUnitMouseX);
module.exports = SCUnitMouseX;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],137:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitMouseY = function (_SCUnit) {
  _inherits(SCUnitMouseY, _SCUnit);

  function SCUnitMouseY() {
    _classCallCheck(this, SCUnitMouseY);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitMouseY).apply(this, arguments));
  }

  _createClass(SCUnitMouseY, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._y1 = 0;
      this._b1 = 0;
      this._lag = 0;
      this._pointVal = this.context.uiValues.subarray(C.UI_MOUSE_Y, C.UI_MOUSE_Y + 1);
      this.dspProcess(1);
    }
  }]);

  return SCUnitMouseY;
}(SCUnit);

dspProcess["next"] = function () {
  var minval = this.inputs[0][0] || 0.01;
  var maxval = this.inputs[1][0];
  var warp = this.inputs[2][0];
  var lag = this.inputs[3][0];
  var y1 = this._y1;
  var b1 = this._b1;
  if (lag !== this._lag) {
    this._b1 = lag === 0 ? 0 : Math.exp(log001 / (lag * this._sampleRate));
    this._lag = lag;
  }
  var y0 = this._pointVal[0];
  if (warp === 0) {
    y0 = (maxval - minval) * y0 + minval;
  } else {
    y0 = Math.pow(maxval / minval, y0) * minval;
    if (isNaN(y0)) {
      y0 = 0;
    }
  }
  this.outputs[0][0] = y1 = y0 + b1 * (y1 - y0);
  this._y1 = y1;
};
SCUnitRepository.registerSCUnitClass("MouseY", SCUnitMouseY);
module.exports = SCUnitMouseY;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],138:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};

var SCUnitMulAdd = function (_SCUnit) {
  _inherits(SCUnitMulAdd, _SCUnit);

  function SCUnitMulAdd() {
    _classCallCheck(this, SCUnitMulAdd);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitMulAdd).apply(this, arguments));
  }

  _createClass(SCUnitMulAdd, [{
    key: "initialize",
    value: function initialize(rate) {
      this._slopeFactor = rate.slopeFactor;

      if (this.calcRate === C.RATE_DEMAND) {
        this.dspProcess = dspProcess["d"];
      } else {
        this.dspProcess = dspProcess[$r2k(this)];

        this._in = this.inputs[0][0];
        this._mul = this.inputs[1][0];
        this._add = this.inputs[2][0];

        this.outputs[0][0] = this._in * this._mul + this._add;
      }
    }
  }]);

  return SCUnitMulAdd;
}(SCUnit);

function $r2k(unit) {
  return unit.inputSpecs.map(function (_ref) {
    var rate = _ref.rate;

    if (rate === C.RATE_AUDIO) {
      return "a";
    }
    return rate === C.RATE_SCALAR ? "i" : "k";
  }).join("");
}

dspProcess["aaa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var mulIn = this.inputs[1];
  var addIn = this.inputs[2];

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn[i] * mulIn[i] + addIn[i];
  }
};

dspProcess["aak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var mulIn = this.inputs[1];
  var add = this._add;
  var next_add = this.inputs[2][0];
  var add_slope = (next_add - add) * this._slopeFactor;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn[i] * mulIn[i] + (add + add_slope * i);
  }

  this._add = next_add;
};

dspProcess["aai"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var mulIn = this.inputs[1];
  var add = this._add;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn[i] * mulIn[i] + add;
  }
};

dspProcess["aka"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var mul = this._mul;
  var addIn = this.inputs[2];
  var next_mul = this.inputs[1][0];
  var mul_slope = (next_mul - mul) * this._slopeFactor;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn[i] * (mul + mul_slope * i) + addIn[i];
  }

  this._mul = next_mul;
};

dspProcess["akk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var mul = this._mul;
  var add = this._add;
  var next_mul = this.inputs[1][0];
  var mul_slope = (next_mul - mul) * this._slopeFactor;
  var next_add = this.inputs[2][0];
  var add_slope = (next_add - add) * this._slopeFactor;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn[i] * (mul + mul_slope * i) + (add + add_slope * i);
  }

  this._mul = next_mul;
  this._add = next_add;
};

dspProcess["aki"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var mul = this._mul;
  var add = this._add;
  var next_mul = this.inputs[1][0];
  var mul_slope = (next_mul - mul) * this._slopeFactor;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn[i] * (mul + mul_slope * i) + add;
  }

  this._mul = next_mul;
};

dspProcess["aia"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var mul = this._mul;
  var addIn = this.inputs[2];

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn[i] * mul + addIn[i];
  }
};

dspProcess["aik"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var mul = this._mul;
  var add = this._add;
  var next_add = this.inputs[2][0];
  var add_slope = (next_add - add) * this._slopeFactor;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn[i] * mul + (add + add_slope * i);
  }

  this._add = next_add;
};

dspProcess["aii"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var mul = this._mul;
  var add = this._add;
  var next_mul = this.inputs[1][0];
  var mul_slope = (next_mul - mul) * this._slopeFactor;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn[i] * (mul + mul_slope * i) + add;
  }

  this._mul = next_mul;
};

dspProcess["kkk"] = function () {
  this.outputs[0][0] = this.inputs[0][0] * this.inputs[1][0] + this.inputs[2][0];
};

dspProcess["kki"] = function () {
  this.outputs[0][0] = this.inputs[0][0] * this.inputs[1][0] + this._add;
};

dspProcess["kik"] = function () {
  this.outputs[0][0] = this.inputs[0][0] * this._mul + this.inputs[2][0];
};

dspProcess["kii"] = function () {
  this.outputs[0][0] = this.inputs[0][0] * this._mul + this._add;
};

dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples) {
    var a = demand.next(this, 0, inNumSamples);
    var b = demand.next(this, 1, inNumSamples);
    var c = demand.next(this, 2, inNumSamples);

    this.outputs[0][0] = isNaN(a) || isNaN(b) || isNaN(c) ? NaN : a * b + c;
  } else {
    demand.reset(this, 0);
    demand.reset(this, 1);
    demand.reset(this, 2);
  }
};
SCUnitRepository.registerSCUnitClass("MulAdd", SCUnitMulAdd);
module.exports = SCUnitMulAdd;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_demand":209}],139:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitNRand = function (_SCUnit) {
  _inherits(SCUnitNRand, _SCUnit);

  function SCUnitNRand() {
    _classCallCheck(this, SCUnitNRand);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitNRand).apply(this, arguments));
  }

  _createClass(SCUnitNRand, [{
    key: "initialize",
    value: function initialize() {
      var lo = this.inputs[0][0];
      var hi = this.inputs[1][0];
      var n = this.inputs[2][0] | 0;
      if (n) {
        var sum = 0;
        for (var i = 0; i < n; i++) {
          sum += Math.random();
        }
        this.outputs[0][0] = sum / n * (hi - lo) + lo;
      }
    }
  }]);

  return SCUnitNRand;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("NRand", SCUnitNRand);
module.exports = SCUnitNRand;
},{"../SCUnit":11,"../SCUnitRepository":12}],140:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitNormalizer = function (_SCUnit) {
  _inherits(SCUnitNormalizer, _SCUnit);

  function SCUnitNormalizer() {
    _classCallCheck(this, SCUnitNormalizer);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitNormalizer).apply(this, arguments));
  }

  _createClass(SCUnitNormalizer, [{
    key: "initialize",
    value: function initialize(rate) {

      this.dspProcess = dspProcess["aki"];

      var dur = Math.max(rate.bufferDuration, this.inputs[2][0]);
      var bufSize = Math.ceil(dur * rate.sampleRate);

      this._bufSize = bufSize;
      this._pos = 0;
      this._flips = 0;
      this._level = 1;
      this._level_slope = 0;
      this._prevmaxval = 0;
      this._curmaxval = 0;
      this._slopeFactor = 1 / bufSize;
      this._xinbuf = new Float32Array(bufSize);
      this._xmidbuf = new Float32Array(bufSize);
      this._xoutbuf = new Float32Array(bufSize);
    }
  }]);

  return SCUnitNormalizer;
}(SCUnit);

dspProcess["aki"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var amp = this.inputs[1][0];
  var bufSize = this._bufSize;
  var level = this._level;

  var pos = this._pos;
  var next_level = this._level;
  var level_slope = this._level_slope;
  var curmaxval = this._curmaxval;

  var bufRemain = bufSize - pos;
  var remain = inNumSamples;
  var val = void 0,
      j = 0;

  while (remain) {
    var nsmps = Math.min(remain, bufRemain);
    var xinbuf = this._xinbuf;
    var xoutbuf = this._xoutbuf;

    if (2 <= this._flips) {
      for (var i = 0; i < nsmps; i++) {
        var x = (level + level_slope * i) * xoutbuf[pos + j];
        xinbuf[pos + j] = val = inIn[j];
        out[j++] = x;
        curmaxval = Math.max(curmaxval, Math.abs(val));
      }
    } else {
      for (var _i = 0; _i < nsmps; _i++) {
        xinbuf[pos + j] = val = inIn[j];
        out[j++] = 0;
        curmaxval = Math.max(curmaxval, Math.abs(val));
      }
    }

    pos += nsmps;

    if (bufSize <= pos) {
      pos = 0;
      bufRemain = bufSize;

      var maxval2 = Math.max(this._prevmaxval, curmaxval, 0.00001);

      this._prevmaxval = curmaxval;
      this._curmaxval = curmaxval = 0;

      next_level = amp / maxval2;
      level_slope = (next_level - level) * this._slopeFactor;

      var _ref = [this._xmidbuf, this._xinbuf, this._xoutbuf];
      this._xoutbuf = _ref[0];
      this._xmidbuf = _ref[1];
      this._xinbuf = _ref[2];


      this._flips += 1;
    }

    remain -= nsmps;
  }

  this._pos = pos;
  this._level = next_level;
  this._level_slope = level_slope;
  this._curmaxval = curmaxval;
};

SCUnitRepository.registerSCUnitClass("Normalizer", SCUnitNormalizer);

module.exports = SCUnitNormalizer;
},{"../SCUnit":11,"../SCUnitRepository":12}],141:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitNumAudioBuses = function (_SCUnit) {
  _inherits(SCUnitNumAudioBuses, _SCUnit);

  function SCUnitNumAudioBuses() {
    _classCallCheck(this, SCUnitNumAudioBuses);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitNumAudioBuses).apply(this, arguments));
  }

  _createClass(SCUnitNumAudioBuses, [{
    key: "initialize",
    value: function initialize() {
      this.outputs[0][0] = this.context.numberOfAudioBus;
    }
  }]);

  return SCUnitNumAudioBuses;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("NumAudioBuses", SCUnitNumAudioBuses);
module.exports = SCUnitNumAudioBuses;
},{"../SCUnit":11,"../SCUnitRepository":12}],142:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitNumControlBuses = function (_SCUnit) {
  _inherits(SCUnitNumControlBuses, _SCUnit);

  function SCUnitNumControlBuses() {
    _classCallCheck(this, SCUnitNumControlBuses);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitNumControlBuses).apply(this, arguments));
  }

  _createClass(SCUnitNumControlBuses, [{
    key: "initialize",
    value: function initialize() {
      this.outputs[0][0] = this.context.numberOfControlBus;
    }
  }]);

  return SCUnitNumControlBuses;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("NumControlBuses", SCUnitNumControlBuses);
module.exports = SCUnitNumControlBuses;
},{"../SCUnit":11,"../SCUnitRepository":12}],143:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitNumInputBuses = function (_SCUnit) {
  _inherits(SCUnitNumInputBuses, _SCUnit);

  function SCUnitNumInputBuses() {
    _classCallCheck(this, SCUnitNumInputBuses);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitNumInputBuses).apply(this, arguments));
  }

  _createClass(SCUnitNumInputBuses, [{
    key: "initialize",
    value: function initialize() {
      this.outputs[0][0] = this.context.numberOfChannels;
    }
  }]);

  return SCUnitNumInputBuses;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("NumInputBuses", SCUnitNumInputBuses);
module.exports = SCUnitNumInputBuses;
},{"../SCUnit":11,"../SCUnitRepository":12}],144:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitNumOutputBuses = function (_SCUnit) {
  _inherits(SCUnitNumOutputBuses, _SCUnit);

  function SCUnitNumOutputBuses() {
    _classCallCheck(this, SCUnitNumOutputBuses);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitNumOutputBuses).apply(this, arguments));
  }

  _createClass(SCUnitNumOutputBuses, [{
    key: "initialize",
    value: function initialize() {
      this.outputs[0][0] = this.context.numberOfChannels;
    }
  }]);

  return SCUnitNumOutputBuses;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("NumOutputBuses", SCUnitNumOutputBuses);
module.exports = SCUnitNumOutputBuses;
},{"../SCUnit":11,"../SCUnitRepository":12}],145:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

// TODO: use the sample offset ??
// Now, SCUnitOffsetOut == SCUnitOut

var SCUnitOffsetOut = function (_SCUnit) {
  _inherits(SCUnitOffsetOut, _SCUnit);

  function SCUnitOffsetOut() {
    _classCallCheck(this, SCUnitOffsetOut);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitOffsetOut).apply(this, arguments));
  }

  _createClass(SCUnitOffsetOut, [{
    key: "initialize",
    value: function initialize() {
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["a"];
        this._buses = this.context.audioBuses;
      } else {
        this.dspProcess = dspProcess["k"];
        this._buses = this.context.controlBuses;
      }
    }
  }]);

  return SCUnitOffsetOut;
}(SCUnit);

dspProcess["a"] = function (inNumSamples) {
  var inputs = this.inputs;
  var buses = this._buses;
  var firstBusChannel = inputs[0][0] | 0;

  for (var ch = 0, chmax = inputs.length - 1; ch < chmax; ch++) {
    var out = buses[firstBusChannel + ch];
    var inIn = inputs[ch + 1];

    for (var i = 0; i < inNumSamples; i++) {
      out[i] += inIn[i];
    }
  }
};

dspProcess["k"] = function () {
  var inputs = this.inputs;
  var buses = this._buses;
  var firstBusChannel = inputs[0][0] | 0;

  for (var ch = 0, chmax = inputs.length - 1; ch < chmax; ch++) {
    var out = buses[firstBusChannel + ch];
    var _in = inputs[ch + 1][0];

    out[0] += _in;
  }
};

SCUnitRepository.registerSCUnitClass("OffsetOut", SCUnitOffsetOut);

module.exports = SCUnitOffsetOut;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],146:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitOnePole = function (_SCUnit) {
  _inherits(SCUnitOnePole, _SCUnit);

  function SCUnitOnePole() {
    _classCallCheck(this, SCUnitOnePole);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitOnePole).apply(this, arguments));
  }

  _createClass(SCUnitOnePole, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._slopeFactor = rate.slopeFactor;
      this._b1 = this.inputs[1][0];
      this._y1 = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitOnePole;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var b1 = this._b1;
  var next_b1 = Math.max(-1, Math.min(this.inputs[1][0], 1));
  var y1 = this._y1;
  if (b1 !== next_b1) {
    var b1_slope = (next_b1 - b1) * this._slopeFactor;
    if (b1 > 0 && next_b1 >= 0) {
      for (var i = 0; i < inNumSamples; i++) {
        var y0 = inIn[i];
        out[i] = y1 = y0 + (b1 + b1_slope * i) * (y1 - y0);
      }
    } else if (b1 <= 0 && next_b1 <= 0) {
      for (var _i = 0; _i < inNumSamples; _i++) {
        var _y = inIn[_i];
        out[_i] = y1 = _y + (b1 + b1_slope * _i) * (y1 + _y);
      }
    } else {
      for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
        var _y2 = inIn[_i2];
        out[_i2] = y1 = (1 - Math.abs(b1 + b1_slope * _i2)) * _y2 + b1 * y1;
      }
    }
    this._b1 = next_b1;
  } else {
    if (b1 >= 0) {
      for (var _i3 = 0; _i3 < inNumSamples; _i3++) {
        var _y3 = inIn[_i3];
        out[_i3] = y1 = _y3 + b1 * (y1 - _y3);
      }
    } else {
      for (var _i4 = 0; _i4 < inNumSamples; _i4++) {
        var _y4 = inIn[_i4];
        out[_i4] = y1 = _y4 + b1 * (y1 + _y4);
      }
    }
  }
  this._y1 = y1;
};
SCUnitRepository.registerSCUnitClass("OnePole", SCUnitOnePole);
module.exports = SCUnitOnePole;
},{"../SCUnit":11,"../SCUnitRepository":12}],147:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitOneZero = function (_SCUnit) {
  _inherits(SCUnitOneZero, _SCUnit);

  function SCUnitOneZero() {
    _classCallCheck(this, SCUnitOneZero);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitOneZero).apply(this, arguments));
  }

  _createClass(SCUnitOneZero, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._slopeFactor = rate.slopeFactor;
      this._b1 = this.inputs[1][0];
      this._x1 = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitOneZero;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var b1 = this._b1;
  var next_b1 = Math.max(-1, Math.min(this.inputs[1][0], 1));
  var x1 = this._x1;
  if (b1 !== next_b1) {
    var b1_slope = (next_b1 - b1) * this._slopeFactor;
    if (b1 >= 0 && next_b1 >= 0) {
      for (var i = 0; i < inNumSamples; i++) {
        var x0 = inIn[i];
        out[i] = x0 + (b1 + b1_slope * i) * (x1 - x0);
        x1 = x0;
      }
    } else if (b1 <= 0 && next_b1 <= 0) {
      for (var _i = 0; _i < inNumSamples; _i++) {
        var _x = inIn[_i];
        out[_i] = _x + (b1 + b1_slope * _i) * (x1 + _x);
        x1 = _x;
      }
    } else {
      for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
        var _x2 = inIn[_i2];
        out[_i2] = (1 - Math.abs(b1 + b1_slope * _i2)) * _x2 + b1 * x1;
        x1 = _x2;
      }
    }
    this._b1 = next_b1;
  } else {
    if (b1 >= 0) {
      for (var _i3 = 0; _i3 < inNumSamples; _i3++) {
        var _x3 = inIn[_i3];
        out[_i3] = _x3 + b1 * (x1 - _x3);
        x1 = _x3;
      }
    } else {
      for (var _i4 = 0; _i4 < inNumSamples; _i4++) {
        var _x4 = inIn[_i4];
        out[_i4] = _x4 + b1 * (x1 + _x4);
        x1 = _x4;
      }
    }
  }
  this._x1 = x1;
};
SCUnitRepository.registerSCUnitClass("OneZero", SCUnitOneZero);
module.exports = SCUnitOneZero;
},{"../SCUnit":11,"../SCUnitRepository":12}],148:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitOut = function (_SCUnit) {
  _inherits(SCUnitOut, _SCUnit);

  function SCUnitOut() {
    _classCallCheck(this, SCUnitOut);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitOut).apply(this, arguments));
  }

  _createClass(SCUnitOut, [{
    key: "initialize",
    value: function initialize() {
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["a"];
        this._buses = this.context.audioBuses;
      } else {
        this.dspProcess = dspProcess["k"];
        this._buses = this.context.controlBuses;
      }
    }
  }]);

  return SCUnitOut;
}(SCUnit);

dspProcess["a"] = function (inNumSamples) {
  var inputs = this.inputs;
  var buses = this._buses;
  var firstBusChannel = inputs[0][0] | 0;

  for (var ch = 0, chmax = inputs.length - 1; ch < chmax; ch++) {
    var out = buses[firstBusChannel + ch];
    var inIn = inputs[ch + 1];

    for (var i = 0; i < inNumSamples; i++) {
      out[i] += inIn[i];
    }
  }
};

dspProcess["k"] = function () {
  var inputs = this.inputs;
  var buses = this._buses;
  var firstBusChannel = inputs[0][0] | 0;

  for (var ch = 0, chmax = inputs.length - 1; ch < chmax; ch++) {
    var out = buses[firstBusChannel + ch];
    var _in = inputs[ch + 1][0];

    out[0] += _in;
  }
};

SCUnitRepository.registerSCUnitClass("Out", SCUnitOut);

module.exports = SCUnitOut;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],149:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var clamp = require("../util/clamp");
var sine = require("./_sine");

var gSine = sine.gSine;
var dspProcess = {};

var SCUnitPan2 = function (_SCUnit) {
  _inherits(SCUnitPan2, _SCUnit);

  function SCUnitPan2() {
    _classCallCheck(this, SCUnitPan2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitPan2).apply(this, arguments));
  }

  _createClass(SCUnitPan2, [{
    key: "initialize",
    value: function initialize(rate) {

      if (this.inputSpecs[1].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["aak"];
      } else {
        this.dspProcess = dspProcess["akk"];
      }

      var ipos = void 0;

      this._slopeFactor = rate.slopeFactor;
      this._pos = this.inputs[1][0];
      this._level = this.inputs[2][0];

      ipos = 1024 * this._pos + 1024 + 0.5 | 0;
      ipos = clamp(ipos, 0, 2048);

      this._leftAmp = this._level * gSine[2048 - ipos];
      this._rightAmp = this._level * gSine[ipos];

      this.dspProcess(1);
    }
  }]);

  return SCUnitPan2;
}(SCUnit);

dspProcess["aak"] = function (inNumSamples) {
  var leftOut = this.outputs[0];
  var rightOut = this.outputs[1];
  var inIn = this.inputs[0];
  var posIn = this.inputs[1];
  var level = this._level;
  var next_level = this.inputs[2][0];

  var ipos = void 0;

  if (level !== next_level) {
    var level_slope = (next_level - level) * this._slopeFactor;

    for (var i = 0; i < inNumSamples; i++) {
      ipos = 1024 * posIn[i] + 1024 + 0.5 | 0;
      ipos = clamp(ipos, 0, 2048);

      var amp = level + level_slope * i;
      var leftAmp = amp * gSine[2048 - ipos];
      var rightAmp = amp * gSine[ipos];

      leftOut[i] = inIn[i] * leftAmp;
      rightOut[i] = inIn[i] * rightAmp;
    }

    this._level = next_level;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      ipos = 1024 * posIn[_i] + 1024 + 0.5 | 0;
      ipos = clamp(ipos, 0, 2048);
      leftOut[_i] = inIn[_i] * level * gSine[2048 - ipos];
      rightOut[_i] = inIn[_i] * level * gSine[ipos];
    }
  }
};

dspProcess["akk"] = function (inNumSamples) {
  var leftOut = this.outputs[0];
  var rightOut = this.outputs[1];
  var inIn = this.inputs[0];
  var next_pos = this.inputs[1][0];
  var next_level = this.inputs[2][0];
  var leftAmp = this._leftAmp;
  var rightAmp = this._rightAmp;

  var ipos = void 0;

  if (this._pos !== next_pos || this._level !== next_level) {
    ipos = 1024 * next_pos + 1024 + 0.5 | 0;
    ipos = clamp(ipos, 0, 2048);

    var next_leftAmp = next_level * gSine[2048 - ipos];
    var next_rightAmp = next_level * gSine[ipos];
    var leftAmp_slope = (next_leftAmp - leftAmp) * this._slopeFactor;
    var rightAmp_slope = (next_rightAmp - rightAmp) * this._slopeFactor;

    for (var i = 0; i < inNumSamples; i++) {
      leftOut[i] = inIn[i] * (leftAmp + leftAmp_slope * i);
      rightOut[i] = inIn[i] * (rightAmp + rightAmp_slope * i);
    }

    this._pos = next_pos;
    this._level = next_level;
    this._leftAmp = next_leftAmp;
    this._rightAmp = next_rightAmp;
  } else {
    for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
      leftOut[_i2] = inIn[_i2] * leftAmp;
      rightOut[_i2] = inIn[_i2] * rightAmp;
    }
  }
};

SCUnitRepository.registerSCUnitClass("Pan2", SCUnitPan2);

module.exports = SCUnitPan2;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"../util/clamp":212,"./_sine":210}],150:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var $r2k = ["i", "k", "a"];

var SCUnitPeak = function (_SCUnit) {
  _inherits(SCUnitPeak, _SCUnit);

  function SCUnitPeak() {
    _classCallCheck(this, SCUnitPeak);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitPeak).apply(this, arguments));
  }

  _createClass(SCUnitPeak, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess[$r2k[this.inputSpecs[1].rate]];
      this._prevtrig = 0;
      this._level = this.inputs[0][0];
      this.outputs[0][0] = this._level;
    }
  }]);

  return SCUnitPeak;
}(SCUnit);

dspProcess["a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var trigIn = this.inputs[1];
  var prevtrig = this._prevtrig;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    var inlevel = Math.abs(inIn[i]);
    out[i] = level = Math.max(inlevel, level);
    if (prevtrig <= 0 && curtrig > 0) {
      level = inlevel;
    }
    prevtrig = curtrig;
  }
  this._prevtrig = prevtrig;
  this._level = level;
};
dspProcess["k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var curtrig = this.inputs[1][0];
  var prevtrig = this._prevtrig;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var inlevel = Math.abs(inIn[i]);
    out[i] = level = Math.max(inlevel, level);
    if (prevtrig <= 0 && curtrig > 0) {
      level = inlevel;
    }
    prevtrig = curtrig;
  }
  this._prevtrig = prevtrig;
  this._level = level;
};
dspProcess["i"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var inlevel = Math.abs(inIn[i]);
    out[i] = level = Math.max(inlevel, level);
  }
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("Peak", SCUnitPeak);
module.exports = SCUnitPeak;
},{"../SCUnit":11,"../SCUnitRepository":12}],151:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitPeakFollower = function (_SCUnit) {
  _inherits(SCUnitPeakFollower, _SCUnit);

  function SCUnitPeakFollower() {
    _classCallCheck(this, SCUnitPeakFollower);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitPeakFollower).apply(this, arguments));
  }

  _createClass(SCUnitPeakFollower, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._slopeFactor = rate.slopeFactor;
      this._decay = this.inputs[1][0];
      this.outputs[0][0] = this._level = this.inputs[0][0];
    }
  }]);

  return SCUnitPeakFollower;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var decay = this.inputs[1][0];
  var level = this._level;
  if (decay === this._decay) {
    for (var i = 0; i < inNumSamples; i++) {
      var inlevel = Math.abs(inIn[i]);
      if (inlevel >= level) {
        level = inlevel;
      } else {
        level = inlevel + decay * (level - inlevel);
      }
      out[i] = level;
    }
  } else {
    var decay_slope = (decay - this._decay) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _inlevel = Math.abs(inIn[_i]);
      if (_inlevel >= level) {
        level = _inlevel;
      } else {
        level = (1 - Math.abs(decay + decay_slope * _i)) * _inlevel + decay * level;
      }
      out[_i] = level;
    }
  }
  this._level = level;
  this._decay = decay;
};
SCUnitRepository.registerSCUnitClass("PeakFollower", SCUnitPeakFollower);
module.exports = SCUnitPeakFollower;
},{"../SCUnit":11,"../SCUnitRepository":12}],152:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var sc_wrap = require("../util/sc_wrap");
var dspProcess = {};

var SCUnitPhasor = function (_SCUnit) {
  _inherits(SCUnitPhasor, _SCUnit);

  function SCUnitPhasor() {
    _classCallCheck(this, SCUnitPhasor);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitPhasor).apply(this, arguments));
  }

  _createClass(SCUnitPhasor, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._prevtrig = this.inputs[0][0];
      this.outputs[0][0] = this._level = this.inputs[2][0];
    }
  }]);

  return SCUnitPhasor;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var rate = this.inputs[1][0];
  var start = this.inputs[2][0];
  var end = this.inputs[3][0];
  var resetPos = this.inputs[4][0];
  var prevtrig = this._prevtrig;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    if (prevtrig <= 0 && curtrig > 0) {
      var frac = 1 - prevtrig / (curtrig - prevtrig);
      level = resetPos + frac * rate;
    }
    out[i] = level;
    level += rate;
    level = sc_wrap(level, start, end);
    prevtrig = curtrig;
  }
  this._prevtrig = prevtrig;
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("Phasor", SCUnitPhasor);
module.exports = SCUnitPhasor;
},{"../SCUnit":11,"../SCUnitRepository":12,"../util/sc_wrap":220}],153:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var MAX_KEY = 31;

var SCUnitPinkNoise = function (_SCUnit) {
  _inherits(SCUnitPinkNoise, _SCUnit);

  function SCUnitPinkNoise() {
    _classCallCheck(this, SCUnitPinkNoise);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitPinkNoise).apply(this, arguments));
  }

  _createClass(SCUnitPinkNoise, [{
    key: "initialize",
    value: function initialize() {
      var whites = new Uint8Array(5);
      for (var i = 0; i < 5; i++) {
        whites[i] = (Math.random() * 1073741824 | 0) % 25;
      }
      this.dspProcess = dspProcess["next"];
      this._whites = whites;
      this._key = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitPinkNoise;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var whites = this._whites;
  var key = this._key | 0;
  for (var i = 0; i < inNumSamples; i++) {
    var last_key = key++;
    if (key > MAX_KEY) {
      key = 0;
    }
    var diff = last_key ^ key;
    var sum = 0;
    for (var j = 0; j < 5; j++) {
      if (diff & 1 << j) {
        whites[j] = (Math.random() * 1073741824 | 0) % 25;
      }
      sum += whites[j];
    }
    out[i] = sum * 0.01666666 - 1;
  }
  this._key = key;
};
SCUnitRepository.registerSCUnitClass("PinkNoise", SCUnitPinkNoise);
module.exports = SCUnitPinkNoise;
},{"../SCUnit":11,"../SCUnitRepository":12}],154:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var sine = require("./_sine");
var gSine = sine.gSine;
var gInvSine = sine.gInvSine;
var kSineSize = sine.kSineSize;
var kSineMask = sine.kSineMask;
var kBadValue = sine.kBadValue;

var SCUnitPulse = function (_SCUnit) {
  _inherits(SCUnitPulse, _SCUnit);

  function SCUnitPulse() {
    _classCallCheck(this, SCUnitPulse);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitPulse).apply(this, arguments));
  }

  _createClass(SCUnitPulse, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._freq = this.inputs[0][0];
      this._cpstoinc = kSineSize * rate.sampleDur * 0.5;
      this._N = Math.max(1, rate.sampleRate * 0.5 / this._freq | 0);
      this._mask = kSineMask;
      this._scale = 0.5 / this._N;
      this._phase = 0;
      this._duty = 0;
      this._y1 = 0;
    }
  }]);

  return SCUnitPulse;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq = this.inputs[0][0];
  var duty = this._duty;
  var phase = this._phase;
  var y1 = this._y1;
  var mask = this._mask;
  var numtbl = gSine,
      dentbl = gInvSine;
  var N = void 0,
      N2 = void 0,
      prevN = void 0,
      prevN2 = void 0,
      scale = void 0,
      prevScale = void 0,
      crossfade = void 0;
  var tblIndex = void 0,
      t0 = void 0,
      t1 = void 0,
      pfrac = void 0,
      denom = void 0,
      rphase = void 0,
      numer = void 0,
      n1 = void 0,
      n2 = void 0;
  var phase2 = void 0,
      nextDuty = void 0,
      duty_slope = void 0,
      rscale = void 0,
      pul1 = void 0,
      pul2 = void 0;
  var i = void 0,
      xfade = void 0,
      xfade_slope = void 0;
  if (freq !== this._freq) {
    N = Math.max(1, this._sampleRate * 0.5 / freq | 0);
    if (N !== this._N) {
      freq = this._cpstoinc * Math.max(this._freq, freq);
      crossfade = true;
    } else {
      freq = this._cpstoinc * freq;
      crossfade = false;
    }
    prevN = this._N;
    prevScale = this._scale;
    this._N = N;
    this._scale = scale = 0.5 / N;
  } else {
    N = this._N;
    freq = this._cpstoinc * freq;
    scale = this._scale;
    crossfade = false;
  }
  N2 = 2 * N + 1;
  nextDuty = this.inputs[1][0];
  duty_slope = (nextDuty - duty) * this._slopeFactor;
  rscale = 1 / scale + 1;
  if (crossfade) {
    prevN2 = 2 * prevN + 1;
    xfade_slope = this._slopeFactor;
    xfade = 0;
    for (i = 0; i < inNumSamples; i++) {
      tblIndex = phase & mask;
      t0 = dentbl[tblIndex];
      t1 = dentbl[tblIndex + 1];
      if (t0 === kBadValue || t1 === kBadValue) {
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        if (Math.abs(denom) < 0.0005) {
          pul1 = 1;
        } else {
          rphase = phase * prevN2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          n1 = (numer / denom - 1) * prevScale;
          rphase = phase * N2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          n2 = (numer / denom - 1) * scale;
          pul1 = n1 + xfade * (n2 - n1);
        }
      } else {
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        rphase = phase * prevN2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        n1 = (numer * denom - 1) * prevScale;
        rphase = phase * N2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        n2 = (numer * denom - 1) * scale;
        pul1 = n1 + xfade * (n2 - n1);
      }
      phase2 = phase + duty * kSineSize * 0.5;
      tblIndex = phase2 & mask;
      t0 = dentbl[tblIndex];
      t1 = dentbl[tblIndex + 1];
      if (t0 === kBadValue || t1 === kBadValue) {
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        pfrac = phase2 - (phase2 | 0);
        denom = t0 + (t1 - t0) * pfrac;
        if (Math.abs(denom) < 0.0005) {
          pul2 = 1;
        } else {
          rphase = phase2 * prevN2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          n1 = (numer / denom - 1) * prevScale;
          rphase = phase2 * N2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          n2 = (numer / denom - 1) * scale;
          pul2 = n1 + xfade * (n2 - n1);
        }
      } else {
        pfrac = phase2 - (phase2 | 0);
        denom = t0 + (t1 - t0) * pfrac;
        rphase = phase2 * prevN2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        n1 = (numer * denom - 1) * prevScale;
        rphase = phase2 * N2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        n2 = (numer * denom - 1) * scale;
        pul2 = n1 + xfade * (n2 - n1);
      }
      out[i] = y1 = pul1 - pul2 + 0.999 * y1;
      phase += freq;
      duty += duty_slope;
      xfade += xfade_slope;
    }
  } else {
    for (i = 0; i < inNumSamples; i++) {
      tblIndex = phase & mask;
      t0 = dentbl[tblIndex];
      t1 = dentbl[tblIndex + 1];
      if (t0 === kBadValue || t1 === kBadValue) {
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        if (Math.abs(denom) < 0.0005) {
          pul1 = rscale;
        } else {
          rphase = phase * N2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          pul1 = numer / denom;
        }
      } else {
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        rphase = phase * N2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        pul1 = numer * denom;
      }
      phase2 = phase + duty * kSineSize * 0.5;
      tblIndex = phase2 & mask;
      t0 = dentbl[tblIndex];
      t1 = dentbl[tblIndex + 1];
      if (t0 === kBadValue || t1 === kBadValue) {
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        pfrac = phase2 - (phase2 | 0);
        denom = t0 + (t1 - t0) * pfrac;
        if (Math.abs(denom) < 0.0005) {
          pul2 = rscale;
        } else {
          rphase = phase2 * N2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          pul2 = numer / denom;
        }
      } else {
        pfrac = phase2 - (phase2 | 0);
        denom = t0 + (t1 - t0) * pfrac;
        rphase = phase2 * N2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        pul2 = numer * denom;
      }
      out[i] = y1 = (pul1 - pul2) * scale + 0.999 * y1;
      phase += freq;
      duty += duty_slope;
    }
  }
  if (phase >= 65536) {
    phase -= 65536;
  }
  this._y1 = y1;
  this._phase = phase;
  this._freq = this.inputs[0][0];
  this._duty = nextDuty;
};
SCUnitRepository.registerSCUnitClass("Pulse", SCUnitPulse);
module.exports = SCUnitPulse;
},{"../SCUnit":11,"../SCUnitRepository":12,"./_sine":210}],155:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var $r2k = ["i", "k", "a"];

var SCUnitPulseCount = function (_SCUnit) {
  _inherits(SCUnitPulseCount, _SCUnit);

  function SCUnitPulseCount() {
    _classCallCheck(this, SCUnitPulseCount);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitPulseCount).apply(this, arguments));
  }

  _createClass(SCUnitPulseCount, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess[$r2k[this.inputSpecs[1].rate]];
      this._prevtrig = 0;
      this._prevreset = 0;
      this._level = 0;
      this.outputs[0][0] = 0;
    }
  }]);

  return SCUnitPulseCount;
}(SCUnit);

dspProcess["a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var resetIn = this.inputs[1];
  var prevtrig = this._prevtrig;
  var prevreset = this._prevreset;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    var curreset = resetIn[i];
    if (prevreset <= 0 && curreset > 0) {
      level = 0;
    } else if (prevtrig <= 0 && curtrig > 0) {
      level += 1;
    }
    out[i] = level;
    prevtrig = curtrig;
    prevreset = curreset;
  }
  this._level = level;
  this._prevtrig = prevtrig;
  this._prevreset = prevreset;
};
dspProcess["k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var curreset = this.inputs[1][0];
  var prevtrig = this._prevtrig;
  var prevreset = this._prevreset;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    if (prevreset <= 0 && curreset > 0) {
      level = 0;
    } else if (prevtrig <= 0 && curtrig > 0) {
      level += 1;
    }
    out[i] = level;
    prevtrig = curtrig;
    prevreset = curreset;
  }
  this._level = level;
  this._prevtrig = prevtrig;
  this._prevreset = prevreset;
};
dspProcess["i"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var prevtrig = this._prevtrig;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    if (prevtrig <= 0 && curtrig > 0) {
      level += 1;
    }
    out[i] = level;
    prevtrig = curtrig;
  }
  this._level = level;
  this._prevtrig = prevtrig;
};
SCUnitRepository.registerSCUnitClass("PulseCount", SCUnitPulseCount);
module.exports = SCUnitPulseCount;
},{"../SCUnit":11,"../SCUnitRepository":12}],156:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitPulseDivider = function (_SCUnit) {
  _inherits(SCUnitPulseDivider, _SCUnit);

  function SCUnitPulseDivider() {
    _classCallCheck(this, SCUnitPulseDivider);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitPulseDivider).apply(this, arguments));
  }

  _createClass(SCUnitPulseDivider, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._prevtrig = 0;
      this._level = 0;
      this._counter = Math.floor(this.inputs[2][0] + 0.5);
      this.outputs[0][0] = 0;
    }
  }]);

  return SCUnitPulseDivider;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var div = this.inputs[1][0] | 0;
  var prevtrig = this._prevtrig;
  var counter = this._counter;
  var z = void 0;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    if (prevtrig <= 0 && curtrig > 0) {
      counter += 1;
      if (counter >= div) {
        counter = 0;
        z = 1;
      } else {
        z = 0;
      }
    } else {
      z = 0;
    }
    out[i] = z;
    prevtrig = curtrig;
  }
  this._counter = counter;
  this._prevtrig = prevtrig;
};
SCUnitRepository.registerSCUnitClass("PulseDivider", SCUnitPulseDivider);
module.exports = SCUnitPulseDivider;
},{"../SCUnit":11,"../SCUnitRepository":12}],157:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitRHPF = function (_SCUnit) {
  _inherits(SCUnitRHPF, _SCUnit);

  function SCUnitRHPF() {
    _classCallCheck(this, SCUnitRHPF);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitRHPF).apply(this, arguments));
  }

  _createClass(SCUnitRHPF, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._a0 = 0;
      this._b1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._freq = NaN;
      this._reson = NaN;
      this.dspProcess(1);
    }
  }]);

  return SCUnitRHPF;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var reson = this.inputs[2][0];
  var a0 = this._a0;
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  if (freq !== this._freq || reson !== this._reson) {
    var qres = Math.max(0.001, reson);
    var pfreq = freq * this._radiansPerSample;
    var D = Math.tan(pfreq * qres * 0.5);
    var C = (1 - D) / (1 + D);
    var cosf = Math.cos(pfreq);
    var next_b1 = (1 + C) * cosf;
    var next_b2 = -C;
    var next_a0 = (1 + C + next_b1) * 0.25;
    var a0_slope = (next_a0 - a0) * this._slopeFactor;
    var b1_slope = (next_b1 - b1) * this._slopeFactor;
    var b2_slope = (next_b2 - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var y0 = (a0 + a0_slope * i) * inIn[i] + (b1 + b1_slope * i) * y1 + (b2 + b2_slope * i) * y2;
      out[i] = y0 - 2 * y1 + y2;
      y2 = y1;
      y1 = y0;
    }
    this._freq = freq;
    this._reson = reson;
    this._a0 = next_a0;
    this._b1 = next_b1;
    this._b2 = next_b2;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y = a0 * inIn[_i] + b1 * y1 + b2 * y2;
      out[_i] = _y - 2 * y1 + y2;
      y2 = y1;
      y1 = _y;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("RHPF", SCUnitRHPF);
module.exports = SCUnitRHPF;
},{"../SCUnit":11,"../SCUnitRepository":12}],158:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitRLPF = function (_SCUnit) {
  _inherits(SCUnitRLPF, _SCUnit);

  function SCUnitRLPF() {
    _classCallCheck(this, SCUnitRLPF);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitRLPF).apply(this, arguments));
  }

  _createClass(SCUnitRLPF, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._a0 = 0;
      this._b1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._freq = NaN;
      this._reson = NaN;
      this.dspProcess(1);
    }
  }]);

  return SCUnitRLPF;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var reson = this.inputs[2][0];
  var a0 = this._a0;
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  if (freq !== this._freq || reson !== this._reson) {
    var qres = Math.max(0.001, reson);
    var pfreq = freq * this._radiansPerSample;
    var D = Math.tan(pfreq * qres * 0.5);
    var C = (1 - D) / (1 + D);
    var cosf = Math.cos(pfreq);
    var next_b1 = (1 + C) * cosf;
    var next_b2 = -C;
    var next_a0 = (1 + C - next_b1) * 0.25;
    var a0_slope = (next_a0 - a0) * this._slopeFactor;
    var b1_slope = (next_b1 - b1) * this._slopeFactor;
    var b2_slope = (next_b2 - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var y0 = (a0 + a0_slope * i) * inIn[i] + (b1 + b1_slope * i) * y1 + (b2 + b2_slope * i) * y2;
      out[i] = y0 + 2 * y1 + y2;
      y2 = y1;
      y1 = y0;
    }
    this._freq = freq;
    this._reson = reson;
    this._a0 = next_a0;
    this._b1 = next_b1;
    this._b2 = next_b2;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y = a0 * inIn[_i] + b1 * y1 + b2 * y2;
      out[_i] = _y + 2 * y1 + y2;
      y2 = y1;
      y1 = _y;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("RLPF", SCUnitRLPF);
module.exports = SCUnitRLPF;
},{"../SCUnit":11,"../SCUnitRepository":12}],159:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitRadiansPerSample = function (_SCUnit) {
  _inherits(SCUnitRadiansPerSample, _SCUnit);

  function SCUnitRadiansPerSample() {
    _classCallCheck(this, SCUnitRadiansPerSample);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitRadiansPerSample).apply(this, arguments));
  }

  _createClass(SCUnitRadiansPerSample, [{
    key: "initialize",
    value: function initialize() {
      this.outputs[0][0] = this.context.aRate.radiansPerSample;
    }
  }]);

  return SCUnitRadiansPerSample;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("RadiansPerSample", SCUnitRadiansPerSample);
module.exports = SCUnitRadiansPerSample;
},{"../SCUnit":11,"../SCUnitRepository":12}],160:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitRamp = function (_SCUnit) {
  _inherits(SCUnitRamp, _SCUnit);

  function SCUnitRamp() {
    _classCallCheck(this, SCUnitRamp);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitRamp).apply(this, arguments));
  }

  _createClass(SCUnitRamp, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.bufferLength === 1) {
        this.dspProcess = dspProcess["1"];
      } else {
        this.dspProcess = dspProcess["k"];
      }
      this._sampleRate = rate.sampleRate;
      this._counter = 1;
      this._level = this.inputs[0][0];
      this._slope = 0;
      this.outputs[0][0] = this._level;
    }
  }]);

  return SCUnitRamp;
}(SCUnit);

dspProcess["k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var period = this.inputs[1][0];
  var sampleRate = this._sampleRate;
  var slope = this._slope;
  var level = this._level;
  var counter = this._counter;
  var remain = inNumSamples;
  var j = 0;
  while (remain) {
    var nsmps = Math.min(remain, counter);
    for (var i = 0; i < nsmps; i++) {
      out[j++] = level;
      level += slope;
    }
    counter -= nsmps;
    remain -= nsmps;
    if (counter <= 0) {
      counter = period * sampleRate | 0;
      counter = Math.max(1, counter);
      slope = (inIn[j - 1] - level) / counter;
    }
  }
  this._level = level;
  this._slope = slope;
  this._counter = counter;
};
dspProcess["1"] = function () {
  var out = this.outputs[0];
  out[0] = this._level;
  this._level += this._slope;
  this._counter -= 1;
  if (this._counter <= 0) {
    var _in = this.inputs[0][0];
    var period = this.inputs[1][0];
    var counter = period * this._sampleRate | 0;
    this._counter = Math.max(1, counter);
    this._slope = (_in - this._level) / this._counter;
  }
};
SCUnitRepository.registerSCUnitClass("Ramp", SCUnitRamp);
module.exports = SCUnitRamp;
},{"../SCUnit":11,"../SCUnitRepository":12}],161:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitRand = function (_SCUnit) {
  _inherits(SCUnitRand, _SCUnit);

  function SCUnitRand() {
    _classCallCheck(this, SCUnitRand);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitRand).apply(this, arguments));
  }

  _createClass(SCUnitRand, [{
    key: "initialize",
    value: function initialize() {
      var lo = this.inputs[0][0];
      var hi = this.inputs[1][0];
      var range = hi - lo;
      this.outputs[0][0] = Math.random() * range + lo;
    }
  }]);

  return SCUnitRand;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("Rand", SCUnitRand);
module.exports = SCUnitRand;
},{"../SCUnit":11,"../SCUnitRepository":12}],162:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitReplaceOut = function (_SCUnit) {
  _inherits(SCUnitReplaceOut, _SCUnit);

  function SCUnitReplaceOut() {
    _classCallCheck(this, SCUnitReplaceOut);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitReplaceOut).apply(this, arguments));
  }

  _createClass(SCUnitReplaceOut, [{
    key: "initialize",
    value: function initialize() {
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["a"];
        this._buses = this.context.audioBuses;
      } else {
        this.dspProcess = dspProcess["k"];
        this._buses = this.context.controlBuses;
      }
    }
  }]);

  return SCUnitReplaceOut;
}(SCUnit);

dspProcess["a"] = function () {
  var inputs = this.inputs;
  var buses = this._buses;
  var firstBusChannel = inputs[0][0] | 0;

  for (var ch = 0, chmax = inputs.length - 1; ch < chmax; ch++) {
    var out = buses[firstBusChannel + ch];
    var inIn = inputs[ch + 1];

    out.set(inIn);
  }
};

dspProcess["k"] = function () {
  var inputs = this.inputs;
  var buses = this._buses;
  var firstBusChannel = inputs[0][0] | 0;

  for (var ch = 0, chmax = inputs.length - 1; ch < chmax; ch++) {
    var out = buses[firstBusChannel + ch];
    var _in = inputs[ch + 1][0];

    out[0] = _in;
  }
};

SCUnitRepository.registerSCUnitClass("ReplaceOut", SCUnitReplaceOut);

module.exports = SCUnitReplaceOut;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],163:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitResonz = function (_SCUnit) {
  _inherits(SCUnitResonz, _SCUnit);

  function SCUnitResonz() {
    _classCallCheck(this, SCUnitResonz);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitResonz).apply(this, arguments));
  }

  _createClass(SCUnitResonz, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._a0 = 0;
      this._b1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._freq = NaN;
      this._rq = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitResonz;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var rq = this.inputs[2][0];
  var a0 = this._a0;
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  if (freq !== this._freq || rq !== this._rq) {
    var ffreq = freq * this._radiansPerSample;
    var B = ffreq * rq;
    var R = 1 - B * 0.5;
    var twoR = 2 * R;
    var R2 = R * R;
    var cost = twoR * Math.cos(ffreq) / (1 + R2);
    var b1_next = twoR * cost;
    var b2_next = -R2;
    var a0_next = (1 - R2) * 0.5;
    var a0_slope = (a0_next - a0) * this._slopeFactor;
    var b1_slope = (b1_next - b1) * this._slopeFactor;
    var b2_slope = (b2_next - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var y0 = inIn[i] + (b1 + b1_slope * i) * y1 + (b2 + b2_slope * i) * y2;
      out[i] = (a0 + a0_slope * i) * (y0 - y2);
      y2 = y1;
      y1 = y0;
    }
    this._freq = freq;
    this._rq = rq;
    this._a0 = a0_next;
    this._b1 = b1_next;
    this._b2 = b2_next;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y = inIn[_i] + b1 * y1 + b2 * y2;
      out[_i] = a0 * (_y - y2);
      y2 = y1;
      y1 = _y;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("Resonz", SCUnitResonz);
module.exports = SCUnitResonz;
},{"../SCUnit":11,"../SCUnitRepository":12}],164:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var log001 = Math.log(0.001);

var SCUnitRingz = function (_SCUnit) {
  _inherits(SCUnitRingz, _SCUnit);

  function SCUnitRingz() {
    _classCallCheck(this, SCUnitRingz);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitRingz).apply(this, arguments));
  }

  _createClass(SCUnitRingz, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._b1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._freq = NaN;
      this._decayTime = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitRingz;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var decayTime = this.inputs[2][0];
  var a0 = 0.5;
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  if (freq !== this._freq || decayTime !== this._decayTime) {
    var ffreq = freq * this._radiansPerSample;
    var R = decayTime === 0 ? 0 : Math.exp(log001 / (decayTime * this._sampleRate));
    var twoR = 2 * R;
    var R2 = R * R;
    var cost = twoR * Math.cos(ffreq) / (1 + R2);
    var b1_next = twoR * cost;
    var b2_next = -R2;
    var b1_slope = (b1_next - b1) * this._slopeFactor;
    var b2_slope = (b2_next - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var y0 = inIn[i] + (b1 + b1_slope * i) * y1 + (b2 + b2_slope * i) * y2;
      out[i] = a0 * (y0 - y2);
      y2 = y1;
      y1 = y0;
    }
    this._freq = freq;
    this._decayTime = decayTime;
    this._b1 = b1_next;
    this._b2 = b2_next;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y = inIn[_i] + b1 * y1 + b2 * y2;
      out[_i] = a0 * (_y - y2);
      y2 = y1;
      y1 = _y;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("Ringz", SCUnitRingz);
module.exports = SCUnitRingz;
},{"../SCUnit":11,"../SCUnitRepository":12}],165:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var sine = require("./_sine");

var gSine = sine.gSine;
var kSineSize = sine.kSineSize;
var kSineSize2 = kSineSize >> 1;
var kSineSize4 = kSineSize >> 2;
var kSineMask = sine.kSineMask;
var dspProcess = {};

var SCUnitRotate2 = function (_SCUnit) {
  _inherits(SCUnitRotate2, _SCUnit);

  function SCUnitRotate2() {
    _classCallCheck(this, SCUnitRotate2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitRotate2).apply(this, arguments));
  }

  _createClass(SCUnitRotate2, [{
    key: "initialize",
    value: function initialize(rate) {

      this.dspProcess = dspProcess["aak"];

      this._slopeFactor = rate.slopeFactor;
      this._pos = this.inputs[2][0];

      var isinpos = kSineMask & Math.floor(kSineSize2 * this._pos);
      var icospos = kSineMask & kSineSize4 + isinpos;

      this._sint = gSine[isinpos];
      this._cost = gSine[icospos];

      this.dspProcess(1);
    }
  }]);

  return SCUnitRotate2;
}(SCUnit);

dspProcess["aak"] = function (inNumSamples) {
  var outX = this.outputs[0];
  var outY = this.outputs[1];
  var inInX = this.inputs[0];
  var inInY = this.inputs[1];
  var next_pos = this.inputs[2][0];
  var sint = this._sint;
  var cost = this._cost;

  if (this._pos !== next_pos) {
    var isinpos = kSineMask & Math.floor(kSineSize2 * next_pos);
    var icospos = kSineMask & kSineSize4 + isinpos;
    var next_sint = gSine[isinpos];
    var next_cost = gSine[icospos];
    var sint_slope = (next_sint - sint) * this._slopeFactor;
    var cost_slope = (next_cost - cost) * this._slopeFactor;

    for (var i = 0; i < inNumSamples; i++) {
      var x = inInX[i];
      var y = inInY[i];

      outX[i] = (cost + cost_slope * i) * x + (sint + sint_slope * i) * y;
      outY[i] = (cost + cost_slope * i) * x - (sint + sint_slope * i) * y;
    }

    this._pos = next_pos;
    this._sint = next_sint;
    this._cost = next_cost;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _x = inInX[_i];
      var _y = inInY[_i];

      outX[_i] = cost * _x + sint * _y;
      outY[_i] = cost * _x - sint * _y;
    }
  }
};

SCUnitRepository.registerSCUnitClass("Rotate2", SCUnitRotate2);

module.exports = SCUnitRotate2;
},{"../SCUnit":11,"../SCUnitRepository":12,"./_sine":210}],166:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var $r2k = ["i", "k", "a"];
var dspProcess = {};

var SCUnitRunningMax = function (_SCUnit) {
  _inherits(SCUnitRunningMax, _SCUnit);

  function SCUnitRunningMax() {
    _classCallCheck(this, SCUnitRunningMax);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitRunningMax).apply(this, arguments));
  }

  _createClass(SCUnitRunningMax, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess[$r2k[this.inputSpecs[1].rate]];
      this._prevtrig = 0;
      this._level = this.inputs[0][0];
      this.outputs[0][0] = this._level;
    }
  }]);

  return SCUnitRunningMax;
}(SCUnit);

dspProcess["a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var trigIn = this.inputs[1];
  var prevtrig = this._prevtrig;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    var inlevel = inIn[i];
    if (inlevel > level) {
      level = inlevel;
    }
    out[i] = level;
    if (prevtrig <= 0 && curtrig > 0) {
      level = inlevel;
    }
    prevtrig = curtrig;
  }
  this._prevtrig = prevtrig;
  this._level = level;
};
dspProcess["k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var curtrig = this.inputs[1][0];
  var level = this._level;
  var inlevel = 0;
  for (var i = 0; i < inNumSamples; i++) {
    inlevel = inIn[i];
    if (inlevel > level) {
      level = inlevel;
    }
    out[i] = level;
  }
  if (this._prevtrig <= 0 && curtrig > 0) {
    level = inlevel;
  }
  this._prevtrig = curtrig;
  this._level = level;
};
dspProcess["i"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var level = this._level;
  var inlevel = 0;
  for (var i = 0; i < inNumSamples; i++) {
    inlevel = inIn[i];
    if (inlevel > level) {
      level = inlevel;
    }
    out[i] = level;
  }
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("RunningMax", SCUnitRunningMax);
module.exports = SCUnitRunningMax;
},{"../SCUnit":11,"../SCUnitRepository":12}],167:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var $r2k = ["i", "k", "a"];
var dspProcess = {};

var SCUnitRunningMin = function (_SCUnit) {
  _inherits(SCUnitRunningMin, _SCUnit);

  function SCUnitRunningMin() {
    _classCallCheck(this, SCUnitRunningMin);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitRunningMin).apply(this, arguments));
  }

  _createClass(SCUnitRunningMin, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess[$r2k[this.inputSpecs[1].rate]];
      this._prevtrig = 0;
      this._level = this.inputs[0][0];
      this.outputs[0][0] = this._level;
    }
  }]);

  return SCUnitRunningMin;
}(SCUnit);

dspProcess["a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var trigIn = this.inputs[1];
  var prevtrig = this._prevtrig;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    var inlevel = inIn[i];
    if (inlevel < level) {
      level = inlevel;
    }
    out[i] = level;
    if (prevtrig <= 0 && curtrig > 0) {
      level = inlevel;
    }
    prevtrig = curtrig;
  }
  this._prevtrig = prevtrig;
  this._level = level;
};
dspProcess["k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var curtrig = this.inputs[1][0];
  var level = this._level;
  var inlevel = 0;
  for (var i = 0; i < inNumSamples; i++) {
    inlevel = inIn[i];
    if (inlevel < level) {
      level = inlevel;
    }
    out[i] = level;
  }
  if (this._prevtrig <= 0 && curtrig > 0) {
    level = inlevel;
  }
  this._prevtrig = curtrig;
  this._level = level;
};
dspProcess["i"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var level = this._level;
  var inlevel = 0;
  for (var i = 0; i < inNumSamples; i++) {
    inlevel = inIn[i];
    if (inlevel < level) {
      level = inlevel;
    }
    out[i] = level;
  }
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("RunningMin", SCUnitRunningMin);
module.exports = SCUnitRunningMin;
},{"../SCUnit":11,"../SCUnitRepository":12}],168:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitSOS = function (_SCUnit) {
  _inherits(SCUnitSOS, _SCUnit);

  function SCUnitSOS() {
    _classCallCheck(this, SCUnitSOS);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSOS).apply(this, arguments));
  }

  _createClass(SCUnitSOS, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.bufferLength !== 1) {
        if (this.inputSpecs[1].rate === C.RATE_AUDIO && this.inputSpecs[2].rate === C.RATE_AUDIO && this.inputSpecs[3].rate === C.RATE_AUDIO && this.inputSpecs[4].rate === C.RATE_AUDIO && this.inputSpecs[5].rate === C.RATE_AUDIO) {
          this.dspProcess = dspProcess["next_a"];
        } else if (this.inputSpecs[1].rate === C.RATE_SCALAR && this.inputSpecs[2].rate === C.RATE_SCALAR && this.inputSpecs[3].rate === C.RATE_SCALAR && this.inputSpecs[4].rate === C.RATE_SCALAR && this.inputSpecs[5].rate === C.RATE_SCALAR) {
          this.dspProcess = dspProcess["next_i"];
        } else {
          this.dspProcess = dspProcess["next_k"];
        }
      } else {
        this.dspProcess = dspProcess["next_1"];
      }
      this._slopeFactor = rate.slopeFactor;
      this._y1 = 0;
      this._y2 = 0;
      this._a0 = this.inputs[1][0];
      this._a1 = this.inputs[2][0];
      this._a2 = this.inputs[3][0];
      this._b1 = this.inputs[4][0];
      this._b2 = this.inputs[5][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitSOS;
}(SCUnit);

dspProcess["next_a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var a0In = this.inputs[1];
  var a1In = this.inputs[2];
  var a2In = this.inputs[3];
  var b1In = this.inputs[4];
  var b2In = this.inputs[5];
  var y1 = this._y1;
  var y2 = this._y2;
  for (var i = 0; i < inNumSamples; i++) {
    var y0 = inIn[i] + b1In[i] * y1 + b2In[i] * y2;
    out[i] = a0In[i] * y0 + a1In[i] * y1 + a2In[i] * y2;
    y2 = y1;
    y1 = y0;
  }
  this._y1 = y1;
  this._y2 = y2;
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var next_a0 = this.inputs[1][0];
  var next_a1 = this.inputs[2][0];
  var next_a2 = this.inputs[3][0];
  var next_b1 = this.inputs[4][0];
  var next_b2 = this.inputs[5][0];
  var a0 = this._a0;
  var a1 = this._a1;
  var a2 = this._a2;
  var b1 = this._b1;
  var b2 = this._b2;
  var a0_slope = (next_a0 - a0) * this._slopeFactor;
  var a1_slope = (next_a1 - a1) * this._slopeFactor;
  var a2_slope = (next_a2 - a2) * this._slopeFactor;
  var b1_slope = (next_b1 - b1) * this._slopeFactor;
  var b2_slope = (next_b2 - b2) * this._slopeFactor;
  var y1 = this._y1;
  var y2 = this._y2;
  for (var i = 0; i < inNumSamples; i++) {
    var y0 = inIn[i] + (b1 + b1_slope * i) * y1 + (b2 + b2_slope * i) * y2;
    out[i] = (a0 + a0_slope * i) * y0 + (a1 + a1_slope * i) * y1 + (a2 + a2_slope * i) * y2;
    y2 = y1;
    y1 = y0;
  }
  this._a0 = a0;
  this._a1 = a1;
  this._a2 = a2;
  this._b1 = b1;
  this._b2 = b2;
  this._y1 = y1;
  this._y2 = y2;
};
dspProcess["next_i"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var a0 = this._a0;
  var a1 = this._a1;
  var a2 = this._a2;
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  for (var i = 0; i < inNumSamples; i++) {
    var y0 = inIn[i] + b1 * y1 + b2 * y2;
    out[i] = a0 * y0 + a1 * y1 + a2 * y2;
    y2 = y1;
    y1 = y0;
  }
  this._y1 = y1;
  this._y2 = y2;
};
dspProcess["next_1"] = function () {
  var _in = this.inputs[0][0];
  var a0 = this.inputs[1][0];
  var a1 = this.inputs[2][0];
  var a2 = this.inputs[3][0];
  var b1 = this.inputs[4][0];
  var b2 = this.inputs[5][0];
  var y1 = this._y1;
  var y2 = this._y2;
  var y0 = _in + b1 * y1 + b2 * y2;
  this.outputs[0][0] = a0 * y0 + a1 * y1 + a2 * y2;
  y2 = y1;
  y1 = y0;
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("SOS", SCUnitSOS);
module.exports = SCUnitSOS;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],169:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitSampleDur = function (_SCUnit) {
  _inherits(SCUnitSampleDur, _SCUnit);

  function SCUnitSampleDur() {
    _classCallCheck(this, SCUnitSampleDur);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSampleDur).apply(this, arguments));
  }

  _createClass(SCUnitSampleDur, [{
    key: "initialize",
    value: function initialize() {
      this.outputs[0][0] = this.context.aRate.sampleDur;
    }
  }]);

  return SCUnitSampleDur;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("SampleDur", SCUnitSampleDur);
module.exports = SCUnitSampleDur;
},{"../SCUnit":11,"../SCUnitRepository":12}],170:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitSampleRate = function (_SCUnit) {
  _inherits(SCUnitSampleRate, _SCUnit);

  function SCUnitSampleRate() {
    _classCallCheck(this, SCUnitSampleRate);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSampleRate).apply(this, arguments));
  }

  _createClass(SCUnitSampleRate, [{
    key: "initialize",
    value: function initialize() {
      this.outputs[0][0] = this.context.aRate.sampleRate;
    }
  }]);

  return SCUnitSampleRate;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("SampleRate", SCUnitSampleRate);
module.exports = SCUnitSampleRate;
},{"../SCUnit":11,"../SCUnitRepository":12}],171:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var sine = require("./_sine");
var numtbl = sine.gSine;
var dentbl = sine.gInvSine;
var kBadValue = sine.kBadValue;
var kSineSize = sine.kSineSize;
var kSineMask = sine.kSineMask;

var SCUnitSaw = function (_SCUnit) {
  _inherits(SCUnitSaw, _SCUnit);

  function SCUnitSaw() {
    _classCallCheck(this, SCUnitSaw);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSaw).apply(this, arguments));
  }

  _createClass(SCUnitSaw, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._slopeFactor = rate.slopeFactor;
      this._freq = this.inputs[0][0];
      this._cpstoinc = kSineSize * rate.sampleDur * 0.5;
      this._N = Math.max(1, rate.sampleRate * 0.5 / this._freq | 0);
      this._mask = kSineMask;
      this._scale = 0.5 / this._N;
      this._phase = 0;
      this._y1 = -0.46;
      this.dspProcess(1);
    }
  }]);

  return SCUnitSaw;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var mask = this._mask;
  var freq = this.inputs[0][0];
  var phase = this._phase;
  var y1 = this._y1;
  var N = void 0,
      N2 = void 0,
      prevN = void 0,
      prevN2 = void 0,
      scale = void 0,
      prevScale = void 0,
      crossfade = void 0;
  var tblIndex = void 0,
      t0 = void 0,
      t1 = void 0,
      pfrac = void 0,
      denom = void 0,
      rphase = void 0,
      numer = void 0,
      n1 = void 0,
      n2 = void 0;
  var xfade = void 0,
      xfade_slope = void 0;
  if (freq !== this._freq) {
    N = Math.max(1, this._sampleRate * 0.5 / freq | 0);
    if (N !== this._N) {
      freq = this._cpstoinc * Math.max(this._freq, freq);
      crossfade = true;
    } else {
      freq = this._cpstoinc * freq;
      crossfade = false;
    }
    prevN = this._N;
    prevScale = this._scale;
    this._N = N;
    this._scale = scale = 0.5 / N;
  } else {
    N = this._N;
    freq = this._cpstoinc * freq;
    scale = this._scale;
    crossfade = false;
  }
  N2 = 2 * N + 1;
  if (crossfade) {
    prevN2 = 2 * prevN + 1;
    xfade_slope = this._slopeFactor;
    xfade = 0;
    for (var i = 0; i < inNumSamples; i++) {
      tblIndex = phase & mask;
      t0 = dentbl[tblIndex];
      t1 = dentbl[tblIndex + 1];
      if (t0 === kBadValue || t1 === kBadValue) {
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        if (Math.abs(denom) < 0.0005) {
          out[i] = y1 = 1 + 0.999 * y1;
        } else {
          rphase = phase * prevN2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          n1 = (numer / denom - 1) * prevScale;
          rphase = phase * N2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          n2 = (numer / denom - 1) * scale;
          out[i] = y1 = n1 + xfade * (n2 - n1) + 0.999 * y1;
        }
      } else {
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        rphase = phase * prevN2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        n1 = (numer * denom - 1) * prevScale;
        rphase = phase * N2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        n2 = (numer * denom - 1) * scale;
        out[i] = y1 = n1 + xfade * (n2 - n1) + 0.999 * y1;
      }
      phase += freq;
      xfade += xfade_slope;
    }
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      tblIndex = phase & mask;
      t0 = dentbl[tblIndex];
      t1 = dentbl[tblIndex + 1];
      if (t0 === kBadValue || t1 === kBadValue) {
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        if (Math.abs(denom) < 0.0005) {
          out[_i] = y1 = 1 + 0.999 * y1;
        } else {
          rphase = phase * N2;
          pfrac = rphase - (rphase | 0);
          tblIndex = rphase & mask;
          t0 = numtbl[tblIndex];
          t1 = numtbl[tblIndex + 1];
          numer = t0 + (t1 - t0) * pfrac;
          out[_i] = y1 = (numer / denom - 1) * scale + 0.999 * y1;
        }
      } else {
        pfrac = phase - (phase | 0);
        denom = t0 + (t1 - t0) * pfrac;
        rphase = phase * N2;
        pfrac = rphase - (rphase | 0);
        tblIndex = rphase & mask;
        t0 = numtbl[tblIndex];
        t1 = numtbl[tblIndex + 1];
        numer = t0 + (t1 - t0) * pfrac;
        out[_i] = y1 = (numer * denom - 1) * scale + 0.999 * y1;
      }
      phase += freq;
    }
  }
  if (phase >= 65536) {
    phase -= 65536;
  }
  this._y1 = y1;
  this._phase = phase;
  this._freq = this.inputs[0][0];
};
SCUnitRepository.registerSCUnitClass("Saw", SCUnitSaw);
module.exports = SCUnitSaw;
},{"../SCUnit":11,"../SCUnitRepository":12,"./_sine":210}],172:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitSchmidt = function (_SCUnit) {
  _inherits(SCUnitSchmidt, _SCUnit);

  function SCUnitSchmidt() {
    _classCallCheck(this, SCUnitSchmidt);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSchmidt).apply(this, arguments));
  }

  _createClass(SCUnitSchmidt, [{
    key: "initialize",
    value: function initialize() {

      this.dspProcess = dspProcess["akk"];

      this._level = 0;

      this.dspProcess(1);
    }
  }]);

  return SCUnitSchmidt;
}(SCUnit);

dspProcess["akk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var lo = this.inputs[1][0];
  var hi = this.inputs[2][0];

  var level = this._level;

  for (var i = 0; i < inNumSamples; i++) {
    var zin = inIn[i];

    if (level === 1) {
      if (zin < lo) {
        level = 0;
      }
    } else {
      if (hi < zin) {
        level = 1;
      }
    }
    out[i] = level;
  }

  this._level = level;
};

SCUnitRepository.registerSCUnitClass("Schmidt", SCUnitSchmidt);

module.exports = SCUnitSchmidt;
},{"../SCUnit":11,"../SCUnitRepository":12}],173:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitSelect = function (_SCUnit) {
  _inherits(SCUnitSelect, _SCUnit);

  function SCUnitSelect() {
    _classCallCheck(this, SCUnitSelect);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSelect).apply(this, arguments));
  }

  _createClass(SCUnitSelect, [{
    key: "initialize",
    value: function initialize() {
      if (this.bufferLength === 1) {
        this.dspProcess = dspProcess["next_1"];
      } else if (this.inputSpecs[0].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_a"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      this._maxIndex = this.inputs.length - 1;
      this.dspProcess(1);
    }
  }]);

  return SCUnitSelect;
}(SCUnit);

dspProcess["next_a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inputs = this.inputs;
  var whichIn = inputs[0];
  var maxIndex = this._maxIndex;
  for (var i = 0; i < inNumSamples; i++) {
    var index = Math.max(1, Math.min((whichIn[i] | 0) + 1, maxIndex));
    out[i] = inputs[index][i];
  }
};
dspProcess["next_k"] = function () {
  var index = Math.max(1, Math.min((this.inputs[0][0] | 0) + 1, this._maxIndex));
  this.outputs[0].set(this.inputs[index]);
};
dspProcess["next_1"] = function () {
  var index = Math.max(1, Math.min((this.inputs[0][0] | 0) + 1, this._maxIndex));
  this.outputs[0][0] = this.inputs[index][0];
};
SCUnitRepository.registerSCUnitClass("Select", SCUnitSelect);
module.exports = SCUnitSelect;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],174:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitSetResetFF = function (_SCUnit) {
  _inherits(SCUnitSetResetFF, _SCUnit);

  function SCUnitSetResetFF() {
    _classCallCheck(this, SCUnitSetResetFF);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSetResetFF).apply(this, arguments));
  }

  _createClass(SCUnitSetResetFF, [{
    key: "initialize",
    value: function initialize() {
      if (this.inputSpecs[1].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_a"];
      } else {
        this.dspProcess = dspProcess["next"];
      }
      this._prevtrig = 0;
      this._prevreset = 0;
      this._level = 0;
      this.outputs[0][0] = 0;
    }
  }]);

  return SCUnitSetResetFF;
}(SCUnit);

dspProcess["next_a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var resetIn = this.inputs[1];
  var prevtrig = this._prevtrig;
  var prevreset = this._prevreset;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    var curreset = resetIn[i];
    if (prevreset <= 0 && curreset > 0) {
      level = 0;
    } else if (prevtrig <= 0 && curtrig > 0) {
      level = 1;
    }
    out[i] = level;
    prevtrig = curtrig;
    prevreset = curreset;
  }
  this._level = level;
  this._prevtrig = prevtrig;
  this._prevreset = prevreset;
};
dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var resetIn = this.inputs[1];
  var prevtrig = this._prevtrig;
  var prevreset = this._prevreset;
  var level = this._level;
  var curtrig = void 0,
      curreset = void 0;
  curtrig = trigIn[0];
  curreset = resetIn[0];
  if (prevreset <= 0 && curreset > 0) {
    level = 0;
  } else if (prevtrig <= 0 && curtrig > 0) {
    level = 1;
  }
  out[0] = level;
  prevtrig = curtrig;
  prevreset = curreset;
  for (var i = 1; i < inNumSamples; i++) {
    curtrig = trigIn[i];
    if (prevtrig <= 0 && curtrig > 0) {
      level = 1;
    }
    out[i] = level;
    prevtrig = curtrig;
  }
  this._level = level;
  this._prevtrig = prevtrig;
  this._prevreset = prevreset;
};
SCUnitRepository.registerSCUnitClass("SetResetFF", SCUnitSetResetFF);
module.exports = SCUnitSetResetFF;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],175:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var sine = require("./_sine");
var dspProcess = {};
var table = sine.gSineWavetable;
var mask = sine.kSineMask;

var SCUnitSinOsc = function (_SCUnit) {
  _inherits(SCUnitSinOsc, _SCUnit);

  function SCUnitSinOsc() {
    _classCallCheck(this, SCUnitSinOsc);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSinOsc).apply(this, arguments));
  }

  _createClass(SCUnitSinOsc, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess[$r2k(this.inputSpecs)] || null;
      this._slopeFactor = rate.slopeFactor;
      this._freq = this.inputs[0][0];
      this._phase = this.inputs[1][0];
      this._radtoinc = sine.kSineSize / (2 * Math.PI);
      this._cpstoinc = sine.kSineSize * (1 / rate.sampleRate);
      this._x = 0;
      if (this.dspProcess) {
        this.dspProcess(1);
      }
    }
  }]);

  return SCUnitSinOsc;
}(SCUnit);

function $r2k(inputSpecs) {
  return inputSpecs.map(function (x) {
    return x.rate === C.RATE_AUDIO ? "a" : x.rate === C.RATE_SCALAR ? "i" : "k";
  }).join("");
}
dspProcess["aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freqIn = this.inputs[0];
  var phaseIn = this.inputs[1];
  var cpstoinc = this._cpstoinc;
  var radtoinc = this._radtoinc;
  var x = this._x;
  for (var i = 0; i < inNumSamples; i++) {
    var pphase = x + radtoinc * phaseIn[i];
    var index = (pphase & mask) << 1;
    out[i] = table[index] + (pphase - (pphase | 0)) * table[index + 1];
    x += freqIn[i] * cpstoinc;
  }
  this._x = x;
};
dspProcess["ak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freqIn = this.inputs[0];
  var nextPhase = this.inputs[1][0];
  var radtoinc = this._radtoinc;
  var cpstoinc = this._cpstoinc;
  var phase = this._phase;
  var x = this._x;
  if (nextPhase === phase) {
    phase *= radtoinc;
    for (var i = 0; i < inNumSamples; i++) {
      var pphase = x + phase;
      var index = (pphase & mask) << 1;
      out[i] = table[index] + (pphase - (pphase | 0)) * table[index + 1];
      x += freqIn[i] * cpstoinc;
    }
  } else {
    var phaseSlope = (nextPhase - phase) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _pphase = x + radtoinc * phase;
      var _index = (_pphase & mask) << 1;
      out[_i] = table[_index] + (_pphase - (_pphase | 0)) * table[_index + 1];
      phase += phaseSlope;
      x += freqIn[_i] * cpstoinc;
    }
    this._phase = nextPhase;
  }
  this._x = x;
};
dspProcess["ai"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freqIn = this.inputs[0];
  var phase = this._phase * this._radtoinc;
  var cpstoinc = this._cpstoinc;
  var x = this._x;
  for (var i = 0; i < inNumSamples; i++) {
    var pphase = x + phase;
    var index = (pphase & mask) << 1;
    out[i] = table[index] + (pphase - (pphase | 0)) * table[index + 1];
    x += cpstoinc * freqIn[i];
  }
  this._x = x;
};
dspProcess["ka"] = function (inNumSamples) {
  var out = this.outputs[0];
  var nextFreq = this.inputs[0][0];
  var phaseIn = this.inputs[1];
  var radtoinc = this._radtoinc;
  var cpstoinc = this._cpstoinc;
  var freq = this._freq;
  var x = this._x;
  if (nextFreq === freq) {
    freq *= cpstoinc;
    for (var i = 0; i < inNumSamples; i++) {
      var pphase = x + radtoinc * phaseIn[i];
      var index = (pphase & mask) << 1;
      out[i] = table[index] + (pphase - (pphase | 0)) * table[index + 1];
      x += freq;
    }
  } else {
    var freqSlope = (nextFreq - freq) * this._slopeFactor;
    for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
      var _pphase2 = x + radtoinc * phaseIn[_i2];
      var _index2 = (_pphase2 & mask) << 1;
      out[_i2] = table[_index2] + (_pphase2 - (_pphase2 | 0)) * table[_index2 + 1];
      x += freq * cpstoinc;
      freq += freqSlope;
    }
    this._freq = nextFreq;
  }
  this._x = x;
};
dspProcess["kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var nextFreq = this.inputs[0][0];
  var nextPhase = this.inputs[1][0];
  var radtoinc = this._radtoinc;
  var cpstoinc = this._cpstoinc;
  var freq = this._freq;
  var phase = this._phase;
  var x = this._x;
  if (nextFreq === freq && nextPhase === phase) {
    freq *= cpstoinc;
    phase *= radtoinc;
    for (var i = 0; i < inNumSamples; i++) {
      var pphase = x + phase;
      var index = (pphase & mask) << 1;
      out[i] = table[index] + (pphase - (pphase | 0)) * table[index + 1];
      x += freq;
    }
  } else {
    var freqSlope = (nextFreq - freq) * this._slopeFactor;
    var phaseSlope = (nextPhase - phase) * this._slopeFactor;
    for (var _i3 = 0; _i3 < inNumSamples; _i3++) {
      var _pphase3 = x + radtoinc * phase;
      var _index3 = (_pphase3 & mask) << 1;
      out[_i3] = table[_index3] + (_pphase3 - (_pphase3 | 0)) * table[_index3 + 1];
      x += freq * cpstoinc;
      freq += freqSlope;
      phase += phaseSlope;
    }
    this._freq = nextFreq;
    this._phase = nextPhase;
  }
  this._x = x;
};
dspProcess["ki"] = dspProcess["kk"];
dspProcess["ia"] = dspProcess["kk"];
dspProcess["ik"] = dspProcess["kk"];
dspProcess["ii"] = dspProcess["kk"];
SCUnitRepository.registerSCUnitClass("SinOsc", SCUnitSinOsc);
module.exports = SCUnitSinOsc;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_sine":210}],176:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var sine = require("./_sine");
var dspProcess = {};
var gSineWavetable = sine.gSineWavetable;
var kSineSize = sine.kSineSize;
var kSineMask = sine.kSineMask;

var SCUnitSinOscFB = function (_SCUnit) {
  _inherits(SCUnitSinOscFB, _SCUnit);

  function SCUnitSinOscFB() {
    _classCallCheck(this, SCUnitSinOscFB);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSinOscFB).apply(this, arguments));
  }

  _createClass(SCUnitSinOscFB, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._slopeFactor = rate.slopeFactor;
      this._radtoinc = kSineSize / (Math.PI * 2);
      this._cpstoinc = kSineSize * rate.sampleDur;
      this._mask = kSineMask;
      this._table = gSineWavetable;
      this._freq = this.inputs[0][0];
      this._feedback = this.inputs[1][0] * this._radtoinc;
      this._y = 0;
      this._x = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitSinOscFB;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var nextFreq = this.inputs[0][0];
  var nextFeedback = this.inputs[1][0];
  var mask = this._mask;
  var table = this._table;
  var radtoinc = this._radtoinc;
  var cpstoinc = this._cpstoinc;
  var freq = this._freq;
  var feedback = this._feedback;
  var y = this._y;
  var x = this._x;
  if (nextFreq === freq && nextFeedback === feedback) {
    freq *= cpstoinc;
    feedback *= radtoinc;
    for (var i = 0; i < inNumSamples; i++) {
      var pphase = x + feedback * y;
      var index = (pphase & mask) << 1;
      out[i] = y = table[index] + (pphase - (pphase | 0)) * table[index + 1];
      x += freq;
    }
  } else {
    var freq_slope = (nextFreq - freq) * this._slopeFactor;
    var feedback_slope = (nextFeedback - feedback) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _pphase = x + radtoinc * (feedback + feedback_slope * _i) * y;
      var _index = (_pphase & mask) << 1;
      out[_i] = y = table[_index] + (_pphase - (_pphase | 0)) * table[_index + 1];
      x += (freq + freq_slope * _i) * cpstoinc;
    }
    this._freq = nextFreq;
    this._feedback = nextFeedback;
  }
  this._y = y;
  this._x = x;
};
SCUnitRepository.registerSCUnitClass("SinOscFB", SCUnitSinOscFB);
module.exports = SCUnitSinOscFB;
},{"../SCUnit":11,"../SCUnitRepository":12,"./_sine":210}],177:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitSlew = function (_SCUnit) {
  _inherits(SCUnitSlew, _SCUnit);

  function SCUnitSlew() {
    _classCallCheck(this, SCUnitSlew);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSlew).apply(this, arguments));
  }

  _createClass(SCUnitSlew, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleDur = rate.sampleDur;
      this._level = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitSlew;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var upf = +this.inputs[1][0] * this._sampleDur;
  var dnf = -this.inputs[2][0] * this._sampleDur;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var slope = inIn[i] - level;
    level += Math.max(dnf, Math.min(slope, upf));
    out[i] = level;
  }
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("Slew", SCUnitSlew);
module.exports = SCUnitSlew;
},{"../SCUnit":11,"../SCUnitRepository":12}],178:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitSlope = function (_SCUnit) {
  _inherits(SCUnitSlope, _SCUnit);

  function SCUnitSlope() {
    _classCallCheck(this, SCUnitSlope);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSlope).apply(this, arguments));
  }

  _createClass(SCUnitSlope, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sr = rate.sampleRate;
      this._x1 = this.inputs[0][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitSlope;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var sr = this._sr;
  var x1 = this._x1;
  for (var i = 0; i < inNumSamples; i++) {
    var x0 = inIn[i];
    out[i] = sr * (x0 - x1);
    x1 = x0;
  }
  this._x1 = x1;
};
SCUnitRepository.registerSCUnitClass("Slope", SCUnitSlope);
module.exports = SCUnitSlope;
},{"../SCUnit":11,"../SCUnitRepository":12}],179:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var sc_wrap = require("../util/sc_wrap");
var $r2k = ["i", "k", "a"];
var dspProcess = {};

var SCUnitStepper = function (_SCUnit) {
  _inherits(SCUnitStepper, _SCUnit);

  function SCUnitStepper() {
    _classCallCheck(this, SCUnitStepper);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitStepper).apply(this, arguments));
  }

  _createClass(SCUnitStepper, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess[$r2k[this.inputSpecs[1].rate]];
      this._prevtrig = 0;
      this._prevreset = 0;
      this._level = this.inputs[5][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitStepper;
}(SCUnit);

dspProcess["a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var resetIn = this.inputs[1];
  var zmin = this.inputs[2][0];
  var zmax = this.inputs[3][0];
  var step = this.inputs[4][0];
  var resetval = this.inputs[5][0];
  var prevtrig = this._prevtrig;
  var prevreset = this._prevreset;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    var curreset = resetIn[i];
    if (prevreset <= 0 && curreset > 0) {
      level = sc_wrap(resetval, zmin, zmax);
    } else if (prevtrig <= 0 && curtrig > 0) {
      level = sc_wrap(level + step, zmin, zmax);
    }
    out[i] = level;
    prevtrig = curtrig;
    prevreset = curreset;
  }
  this._level = level;
  this._prevtrig = prevtrig;
  this._prevreset = prevreset;
};
dspProcess["k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var curreset = this.inputs[1][0];
  var zmin = this.inputs[2][0];
  var zmax = this.inputs[3][0];
  var step = this.inputs[4][0];
  var resetval = this.inputs[5][0];
  var prevtrig = this._prevtrig;
  var prevreset = this._prevreset;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    if (prevreset <= 0 && curreset > 0) {
      level = sc_wrap(resetval, zmin, zmax);
    } else if (prevtrig <= 0 && curtrig > 0) {
      level = sc_wrap(level + step, zmin, zmax);
    }
    out[i] = level;
    prevtrig = curtrig;
    prevreset = curreset;
  }
  this._level = level;
  this._prevtrig = prevtrig;
  this._prevreset = prevreset;
};
dspProcess["0"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var zmin = this.inputs[2][0];
  var zmax = this.inputs[3][0];
  var step = this.inputs[4][0];
  var prevtrig = this._prevtrig;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    if (prevtrig <= 0 && curtrig > 0) {
      level = sc_wrap(level + step, zmin, zmax);
    }
    out[i] = level;
    prevtrig = curtrig;
  }
  this._level = level;
  this._prevtrig = prevtrig;
};
SCUnitRepository.registerSCUnitClass("Stepper", SCUnitStepper);
module.exports = SCUnitStepper;
},{"../SCUnit":11,"../SCUnitRepository":12,"../util/sc_wrap":220}],180:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");

var SCUnitSubsampleOffset = function (_SCUnit) {
  _inherits(SCUnitSubsampleOffset, _SCUnit);

  function SCUnitSubsampleOffset() {
    _classCallCheck(this, SCUnitSubsampleOffset);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSubsampleOffset).apply(this, arguments));
  }

  _createClass(SCUnitSubsampleOffset, [{
    key: "initialize",
    value: function initialize() {
      this.outputs[0][0] = 0;
    }
  }]);

  return SCUnitSubsampleOffset;
}(SCUnit);

SCUnitRepository.registerSCUnitClass("SubsampleOffset", SCUnitSubsampleOffset);
module.exports = SCUnitSubsampleOffset;
},{"../SCUnit":11,"../SCUnitRepository":12}],181:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};

var SCUnitSum3 = function (_SCUnit) {
  _inherits(SCUnitSum3, _SCUnit);

  function SCUnitSum3() {
    _classCallCheck(this, SCUnitSum3);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSum3).apply(this, arguments));
  }

  _createClass(SCUnitSum3, [{
    key: "initialize",
    value: function initialize(rate) {
      this._slopeFactor = rate.slopeFactor;

      if (this.calcRate === C.RATE_DEMAND) {
        this.dspProcess = dspProcess["d"];
      } else {
        this.dspProcess = dspProcess[$r2k(this)];

        this._in0 = this.inputs[0][0];
        this._in1 = this.inputs[1][0];
        this._in2 = this.inputs[2][0];

        this.outputs[0][0] = this._in0 + this._in1 + this._in2;
      }
    }
  }]);

  return SCUnitSum3;
}(SCUnit);

function $r2k(unit) {
  return unit.inputSpecs.map(function (_ref) {
    var rate = _ref.rate;

    if (rate === C.RATE_AUDIO) {
      return "a";
    }
    return rate === C.RATE_SCALAR ? "i" : "k";
  }).join("");
}

dspProcess["aaa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var inIn1 = this.inputs[1];
  var inIn2 = this.inputs[2];

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + inIn1[i] + inIn2[i];
  }
};

dspProcess["aak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var inIn1 = this.inputs[1];
  var in2 = this._in2;
  var next_in2 = this.inputs[2][0];
  var in2_slope = (next_in2 - in2) * this._slopeFactor;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + inIn1[i] + (in2 + in2_slope * i);
  }

  this._in2 = next_in2;
};

dspProcess["aai"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var inIn1 = this.inputs[1];
  var in2 = this._in2;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + inIn1[i] + in2;
  }
};

dspProcess["akk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var in12 = this._in1 + this._in2;
  var next_in12 = this.inputs[1][0] + this.inputs[2][0];
  var in12_slope = (next_in12 - in12) * this._slopeFactor;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + (in12 + in12_slope * i);
  }

  this._in1 = this.inputs[1][0];
  this._in2 = this.inputs[2][0];
};

dspProcess["aki"] = dspProcess["akk"];

dspProcess["aii"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var in12 = this._in1 + this._in2;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + in12;
  }
};

dspProcess["kkk"] = function () {
  this.outputs[0][0] = this.inputs[0][0] + this.inputs[1][0] + this.inputs[2][0];
};

dspProcess["kki"] = dspProcess["kkk"];

dspProcess["kii"] = dspProcess["kkk"];

dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples) {
    var a = demand.next(this, 0, inNumSamples);
    var b = demand.next(this, 1, inNumSamples);
    var c = demand.next(this, 2, inNumSamples);

    this.outputs[0][0] = isNaN(a) || isNaN(b) || isNaN(c) ? NaN : a + b + c;
  } else {
    demand.reset(this, 0);
    demand.reset(this, 1);
    demand.reset(this, 2);
  }
};

SCUnitRepository.registerSCUnitClass("Sum3", SCUnitSum3);

module.exports = SCUnitSum3;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_demand":209}],182:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};

var SCUnitSum4 = function (_SCUnit) {
  _inherits(SCUnitSum4, _SCUnit);

  function SCUnitSum4() {
    _classCallCheck(this, SCUnitSum4);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSum4).apply(this, arguments));
  }

  _createClass(SCUnitSum4, [{
    key: "initialize",
    value: function initialize(rate) {
      this._slopeFactor = rate.slopeFactor;

      if (this.calcRate === C.RATE_DEMAND) {
        this.dspProcess = dspProcess["d"];
      } else {
        this.dspProcess = dspProcess[$r2k(this)];

        this._in0 = this.inputs[0][0];
        this._in1 = this.inputs[1][0];
        this._in2 = this.inputs[2][0];
        this._in3 = this.inputs[3][0];

        this.outputs[0][0] = this._in0 + this._in1 + this._in2 + this._in3;
      }
    }
  }]);

  return SCUnitSum4;
}(SCUnit);

function $r2k(unit) {
  return unit.inputSpecs.map(function (_ref) {
    var rate = _ref.rate;

    if (rate === C.RATE_AUDIO) {
      return "a";
    }
    return rate === C.RATE_SCALAR ? "i" : "k";
  }).join("");
}

dspProcess["aaaa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var inIn1 = this.inputs[1];
  var inIn2 = this.inputs[2];
  var inIn3 = this.inputs[3];

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + inIn1[i] + inIn2[i] + inIn3[i];
  }
};

dspProcess["aaak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var inIn1 = this.inputs[1];
  var inIn2 = this.inputs[2];
  var in3 = this._in3;
  var next_in3 = this.inputs[3][0];
  var in3_slope = (next_in3 - in3) * this._slopeFactor;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + inIn1[i] + inIn2[i] + (in3 + in3_slope * i);
  }

  this._in3 = next_in3;
};

dspProcess["aaai"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var inIn1 = this.inputs[1];
  var inIn2 = this.inputs[2];
  var in3 = this._in3;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + inIn1[i] + inIn2[i] + in3;
  }
};

dspProcess["aakk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var inIn1 = this.inputs[1];
  var in23 = this._in2 + this._in3;
  var next_in23 = this.inputs[2][0] + this.inputs[3][0];
  var in23_slope = (next_in23 - in23) * this._slopeFactor;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + inIn1[i] + (in23 + in23_slope * i);
  }

  this._in2 = this.inputs[2][0];
  this._in3 = this.inputs[3][0];
};

dspProcess["aaki"] = dspProcess["aakk"];

dspProcess["aaii"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var inIn1 = this.inputs[1];
  var in23 = this._in2 + this._in3;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + inIn1[i] + in23;
  }
};

dspProcess["akkk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var in123 = this._in1 + this._in2 + this._in3;
  var next_in123 = this.inputs[1][0] + this.inputs[2][0] + this.inputs[3][0];
  var in123_slope = (next_in123 - in123) * this._slopeFactor;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + (in123 + in123_slope * i);
  }

  this._in1 = this.inputs[1][0];
  this._in2 = this.inputs[2][0];
  this._in3 = this.inputs[3][0];
};

dspProcess["akki"] = dspProcess["akkk"];

dspProcess["akii"] = dspProcess["akkk"];

dspProcess["aiii"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn0 = this.inputs[0];
  var in123 = this._in1 + this._in2 + this._in3;

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = inIn0[i] + in123;
  }
};

dspProcess["kkkk"] = function () {
  this.outputs[0][0] = this.inputs[0][0] + this.inputs[1][0] + this.inputs[2][0] + this.inputs[3][0];
};

dspProcess["kkki"] = dspProcess["kkkk"];

dspProcess["kkii"] = dspProcess["kkkk"];

dspProcess["kiii"] = dspProcess["kkkk"];

dspProcess["d"] = function (inNumSamples) {
  if (inNumSamples) {
    var a = demand.next(this, 0, inNumSamples);
    var b = demand.next(this, 1, inNumSamples);
    var c = demand.next(this, 2, inNumSamples);
    var d = demand.next(this, 3, inNumSamples);

    this.outputs[0][0] = isNaN(a) || isNaN(b) || isNaN(c) || isNaN(d) ? NaN : a + b + c + d;
  } else {
    demand.reset(this, 0);
    demand.reset(this, 1);
    demand.reset(this, 2);
    demand.reset(this, 3);
  }
};

SCUnitRepository.registerSCUnitClass("Sum4", SCUnitSum4);

module.exports = SCUnitSum4;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_demand":209}],183:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitSweep = function (_SCUnit) {
  _inherits(SCUnitSweep, _SCUnit);

  function SCUnitSweep() {
    _classCallCheck(this, SCUnitSweep);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSweep).apply(this, arguments));
  }

  _createClass(SCUnitSweep, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleDur = rate.sampleDur;
      this._prevtrig = this.inputs[0][0];
      this._level = 0;
    }
  }]);

  return SCUnitSweep;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var rate = this.inputs[1][0] * this._sampleDur;
  var prevtrig = this._prevtrig;
  var level = this._level;
  for (var i = 0; i < inNumSamples; i++) {
    var curtrig = trigIn[i];
    if (prevtrig <= 0 && curtrig > 0) {
      var frac = -prevtrig / (curtrig - prevtrig);
      level = frac * rate;
    } else {
      level += rate;
    }
    out[i] = level;
    prevtrig = curtrig;
  }
  this._prevtrig = prevtrig;
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("Sweep", SCUnitSweep);
module.exports = SCUnitSweep;
},{"../SCUnit":11,"../SCUnitRepository":12}],184:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitSyncSaw = function (_SCUnit) {
  _inherits(SCUnitSyncSaw, _SCUnit);

  function SCUnitSyncSaw() {
    _classCallCheck(this, SCUnitSyncSaw);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitSyncSaw).apply(this, arguments));
  }

  _createClass(SCUnitSyncSaw, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[0].rate === C.RATE_AUDIO) {
        if (this.inputSpecs[1].rate === C.RATE_AUDIO) {
          this.dspProcess = dspProcess["next_aa"];
        } else {
          this.dspProcess = dspProcess["next_ak"];
        }
      } else {
        if (this.inputSpecs[1].rate === C.RATE_AUDIO) {
          this.dspProcess = dspProcess["next_ka"];
        } else {
          this.dspProcess = dspProcess["next_kk"];
        }
      }
      this._freqMul = 2 * rate.sampleDur;
      this._phase1 = 0;
      this._phase2 = 0;
      this.dspProcess(1);
    }
  }]);

  return SCUnitSyncSaw;
}(SCUnit);

dspProcess["next_aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq1In = this.inputs[0];
  var freq2In = this.inputs[1];
  var freqMul = this._freqMul;
  var phase1 = this._phase1;
  var phase2 = this._phase2;
  for (var i = 0; i < inNumSamples; i++) {
    var z = phase2;
    var freq1x = freq1In[i] * freqMul;
    var freq2x = freq2In[i] * freqMul;
    phase2 += freq2x;
    if (phase2 >= 1) {
      phase2 -= 2;
    }
    phase1 += freq1x;
    if (phase1 >= 1) {
      phase1 -= 2;
      phase2 = (phase1 + 1) * freq2x / freq1x - 1;
    }
    out[i] = z;
  }
  this._phase1 = phase1;
  this._phase2 = phase2;
};
dspProcess["next_ak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq1In = this.inputs[0];
  var freq2In = this.inputs[1];
  var freqMul = this._freqMul;
  var freq2x = freq2In[0] * freqMul;
  var phase1 = this._phase1;
  var phase2 = this._phase2;
  for (var i = 0; i < inNumSamples; i++) {
    var z = phase2;
    var freq1x = freq1In[i] * freqMul;
    phase2 += freq2x;
    if (phase2 >= 1) {
      phase2 -= 2;
    }
    phase1 += freq1x;
    if (phase1 >= 1) {
      phase1 -= 2;
      phase2 = (phase1 + 1) * freq2x / freq1x - 1;
    }
    out[i] = z;
  }
  this._phase1 = phase1;
  this._phase2 = phase2;
};
dspProcess["next_ka"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq1In = this.inputs[0];
  var freq2In = this.inputs[1];
  var freqMul = this._freqMul;
  var freq1x = freq1In[0] * freqMul;
  var phase1 = this._phase1;
  var phase2 = this._phase2;
  for (var i = 0; i < inNumSamples; i++) {
    var z = phase2;
    var freq2x = freq2In[i] * freqMul;
    phase2 += freq2x;
    if (phase2 >= 1) {
      phase2 -= 2;
    }
    phase1 += freq1x;
    if (phase1 >= 1) {
      phase1 -= 2;
      phase2 = (phase1 + 1) * freq2x / freq1x - 1;
    }
    out[i] = z;
  }
  this._phase1 = phase1;
  this._phase2 = phase2;
};
dspProcess["next_kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var freq1x = this.inputs[0][0] * this._freqMul;
  var freq2x = this.inputs[1][0] * this._freqMul;
  var phase1 = this._phase1;
  var phase2 = this._phase2;
  for (var i = 0; i < inNumSamples; i++) {
    var z = phase2;
    phase2 += freq2x;
    if (phase2 >= 1) {
      phase2 -= 2;
    }
    phase1 += freq1x;
    if (phase1 >= 1) {
      phase1 -= 2;
      phase2 = (phase1 + 1) * freq2x / freq1x - 1;
    }
    out[i] = z;
  }
  this._phase1 = phase1;
  this._phase2 = phase2;
};
SCUnitRepository.registerSCUnitClass("SyncSaw", SCUnitSyncSaw);
module.exports = SCUnitSyncSaw;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],185:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var fill = require("../util/fill");
var dspProcess = {};

var SCUnitT2A = function (_SCUnit) {
  _inherits(SCUnitT2A, _SCUnit);

  function SCUnitT2A() {
    _classCallCheck(this, SCUnitT2A);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitT2A).apply(this, arguments));
  }

  _createClass(SCUnitT2A, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["ak"];

      this._level = 0;

      this.dspProcess(1);
    }
  }]);

  return SCUnitT2A;
}(SCUnit);

dspProcess["ak"] = function () {
  var out = this.outputs[0];
  var level = this.inputs[0][0];

  fill(out, 0);

  if (this._level <= 0 && 0 < level) {
    this.outputs[0][this.inputs[1][0] | 0] = level;
  }

  this._level = level;
};

SCUnitRepository.registerSCUnitClass("T2A", SCUnitT2A);

module.exports = SCUnitT2A;
},{"../SCUnit":11,"../SCUnitRepository":12,"../util/fill":213}],186:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitT2K = function (_SCUnit) {
  _inherits(SCUnitT2K, _SCUnit);

  function SCUnitT2K() {
    _classCallCheck(this, SCUnitT2K);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitT2K).apply(this, arguments));
  }

  _createClass(SCUnitT2K, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["a"];
      this.outputs[0][0] = this.inputs[0][0];
    }
  }]);

  return SCUnitT2K;
}(SCUnit);

dspProcess["a"] = function () {
  var inIn = this.inputs[0];

  var out = 0;

  for (var i = 0, imax = inIn.length; i < imax; i++) {
    out = Math.max(out, inIn[i]);
  }

  this.outputs[0][0] = out;
};

SCUnitRepository.registerSCUnitClass("T2K", SCUnitT2K);

module.exports = SCUnitT2K;
},{"../SCUnit":11,"../SCUnitRepository":12}],187:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _$r2k;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var dspProcess = {};
var $r2k = (_$r2k = {}, _defineProperty(_$r2k, C.RATE_SCALAR, "di"), _defineProperty(_$r2k, C.RATE_CONTROL, "dk"), _defineProperty(_$r2k, C.RATE_AUDIO, "da"), _defineProperty(_$r2k, C.RATE_DEMAND, "dd"), _$r2k);

var SCUnitTDuty = function (_SCUnit) {
  _inherits(SCUnitTDuty, _SCUnit);

  function SCUnitTDuty() {
    _classCallCheck(this, SCUnitTDuty);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTDuty).apply(this, arguments));
  }

  _createClass(SCUnitTDuty, [{
    key: "initialize",
    value: function initialize(rate) {

      this.dspProcess = dspProcess[$r2k[this.inputSpecs[1].rate]];

      this._sampleRate = rate.sampleRate;
      this._prevreset = 0;
      this._count = 0;

      if (this.inputSpecs[1].rate === C.RATE_DEMAND) {
        this._prevreset = demand.next(this, 1, 1) * this._sampleRate;
      }
      if (this.inputs[4][0]) {
        this._count = demand.next(this, 0, 1) * this._sampleRate;
      }

      this.outputs[0][0] = 0;
    }
  }]);

  return SCUnitTDuty;
}(SCUnit);

dspProcess["da"] = function (inNumSamples) {
  var out = this.outputs[0];
  var resetIn = this.inputs[1];
  var sampleRate = this._sampleRate;

  var count = this._count;
  var prevreset = this._prevreset;

  for (var i = 0; i < inNumSamples; i++) {
    var zreset = resetIn[i];

    if (0 < zreset && prevreset <= 0) {
      demand.reset(this, 0);
      demand.reset(this, 3);
      count = 0;
    }

    if (count <= 0) {
      count += demand.next(this, 0, i + 1) * sampleRate;
      if (Number.isNaN(count)) {
        this.doneAction(this.inputs[2][0]);
      }
      out[i] = demand.next(this, 3, i + 1) || 0;
    } else {
      out[i] = 0;
    }

    count -= 1;
    prevreset = zreset;
  }

  this._count = count;
  this._prevreset = prevreset;
};

dspProcess["dk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var zreset = this.inputs[1][0];
  var sampleRate = this._sampleRate;

  var count = this._count;

  if (0 < zreset && this._prevreset <= 0) {
    demand.reset(this, 0);
    demand.reset(this, 3);
    count = 0;
  }

  for (var i = 0; i < inNumSamples; i++) {
    if (count <= 0) {
      count += demand.next(this, 0, i + 1) * sampleRate;
      if (Number.isNaN(count)) {
        this.doneAction(this.inputs[2][0]);
      }
      out[i] = demand.next(this, 3, i + 1) || 0;
    } else {
      out[i] = 0;
    }
    count -= 1;
  }

  this._count = count;
  this._prevreset = zreset;
};

dspProcess["di"] = dspProcess["dk"];

dspProcess["dd"] = function (inNumSamples) {
  var out = this.outputs[0];
  var sampleRate = this._sampleRate;

  var count = this._count;
  var reset = this._prevreset;

  for (var i = 0; i < inNumSamples; i++) {
    if (reset <= 0) {
      demand.next(this, 0);
      demand.next(this, 3);
      count = 0;
      reset += demand.next(this, 1, i + 1) * sampleRate;
    } else {
      reset -= 1;
    }

    if (count <= 0) {
      count += demand.next(this, 0, i + 1) * sampleRate;
      if (Number.isNaN(count)) {
        this.doneAction(this.inputs[2][0]);
      }
      out[i] = demand.next(this, 3, i + 1) || 0;
    } else {
      out[i] = 0;
    }

    count -= 1;
  }

  this._count = count;
  this._prevreset = reset;
};

SCUnitRepository.registerSCUnitClass("TDuty", SCUnitTDuty);

module.exports = SCUnitTDuty;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_demand":209}],188:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitTExpRand = function (_SCUnit) {
  _inherits(SCUnitTExpRand, _SCUnit);

  function SCUnitTExpRand() {
    _classCallCheck(this, SCUnitTExpRand);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTExpRand).apply(this, arguments));
  }

  _createClass(SCUnitTExpRand, [{
    key: "initialize",
    value: function initialize() {
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_a"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      this._trig = this.inputs[2][0];
      var lo = this.inputs[0][0] || 0.01;
      var hi = this.inputs[1][0];
      var ratio = hi / lo;
      this.outputs[0][0] = this._value = Math.pow(ratio, Math.random()) * lo;
    }
  }]);

  return SCUnitTExpRand;
}(SCUnit);

dspProcess["next_a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[2];
  var value = this._value;
  var prev = this._trig;
  var next = void 0;
  for (var i = 0; i < inNumSamples; i++) {
    next = trigIn[i];
    if (next > 0 && prev <= 0) {
      var lo = this.inputs[0][0] || 0.01;
      var hi = this.inputs[1][0];
      var ratio = hi / lo;
      out[i] = value = Math.pow(ratio, Math.random()) * lo;
    } else {
      out[i] = value;
    }
    prev = next;
  }
  this._trig = next;
  this._value = value;
};
dspProcess["next_k"] = function () {
  var out = this.outputs[0];
  var trig = this.inputs[2][0];
  if (trig > 0 && this._trig <= 0) {
    var lo = this.inputs[0][0] || 0.01;
    var hi = this.inputs[1][0];
    var ratio = hi / lo;
    out[0] = this._value = Math.pow(ratio, Math.random()) * lo;
  } else {
    out[0] = this._value;
  }
  this._trig = trig;
};
SCUnitRepository.registerSCUnitClass("TExpRand", SCUnitTExpRand);
module.exports = SCUnitTExpRand;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],189:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitTIRand = function (_SCUnit) {
  _inherits(SCUnitTIRand, _SCUnit);

  function SCUnitTIRand() {
    _classCallCheck(this, SCUnitTIRand);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTIRand).apply(this, arguments));
  }

  _createClass(SCUnitTIRand, [{
    key: "initialize",
    value: function initialize() {
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_a"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      var lo = this.inputs[0][0] | 0;
      var hi = this.inputs[1][0] | 0;
      this.outputs[0][0] = this._value = Math.random() * (hi - lo) + lo | 0;
      this._trig = this.inputs[2][0];
    }
  }]);

  return SCUnitTIRand;
}(SCUnit);

dspProcess["next_a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[2];
  var value = this._value;
  var prev = this._trig;
  var next = void 0;
  for (var i = 0; i < inNumSamples; i++) {
    next = trigIn[i];
    if (next > 0 && prev <= 0) {
      var lo = this.inputs[0][0] | 0;
      var hi = this.inputs[1][0] | 0;
      out[i] = value = Math.random() * (hi - lo) + lo | 0;
    } else {
      out[i] = value;
    }
    prev = next;
  }
  this._trig = next;
  this._value = value;
};
dspProcess["next_k"] = function () {
  var out = this.outputs[0];
  var trig = this.inputs[2][0];
  if (trig > 0 && this._trig <= 0) {
    var lo = this.inputs[0][0] | 0;
    var hi = this.inputs[1][0] | 0;
    out[0] = this._value = Math.random() * (hi - lo) + lo | 0;
  } else {
    out[0] = this._value;
  }
  this._trig = trig;
};
SCUnitRepository.registerSCUnitClass("TIRand", SCUnitTIRand);
module.exports = SCUnitTIRand;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],190:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitTRand = function (_SCUnit) {
  _inherits(SCUnitTRand, _SCUnit);

  function SCUnitTRand() {
    _classCallCheck(this, SCUnitTRand);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTRand).apply(this, arguments));
  }

  _createClass(SCUnitTRand, [{
    key: "initialize",
    value: function initialize() {
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_a"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      this._trig = this.inputs[2][0];
      var lo = this.inputs[0][0];
      var hi = this.inputs[1][0];
      this.outputs[0][0] = this._value = Math.random() * (hi - lo) + lo;
    }
  }]);

  return SCUnitTRand;
}(SCUnit);

dspProcess["next_a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[2];
  var value = this._value;
  var prev = this._trig;
  var next = void 0;
  for (var i = 0; i < inNumSamples; i++) {
    next = trigIn[i];
    if (next > 0 && prev <= 0) {
      var lo = this.inputs[0][0];
      var hi = this.inputs[1][0];
      out[i] = value = Math.random() * (hi - lo) + lo;
    } else {
      out[i] = value;
    }
    prev = next;
  }
  this._trig = next;
  this._value = value;
};
dspProcess["next_k"] = function () {
  var out = this.outputs[0];
  var trig = this.inputs[2][0];
  if (trig > 0 && this._trig <= 0) {
    var lo = this.inputs[0][0];
    var hi = this.inputs[1][0];
    out[0] = this._value = Math.random() * (hi - lo) + lo;
  } else {
    out[0] = this._value;
  }
  this._trig = trig;
};
SCUnitRepository.registerSCUnitClass("TRand", SCUnitTRand);
module.exports = SCUnitTRand;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],191:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitTWindex = function (_SCUnit) {
  _inherits(SCUnitTWindex, _SCUnit);

  function SCUnitTWindex() {
    _classCallCheck(this, SCUnitTWindex);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTWindex).apply(this, arguments));
  }

  _createClass(SCUnitTWindex, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["a"];

      this._prevIndex = 0;
      this._trig = 1;

      this.dspProcess(1);
    }
  }]);

  return SCUnitTWindex;
}(SCUnit);

dspProcess["k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trig = this.inputs[0][0];
  var normalize = this.inputs[1][0];
  var maxindex = this.inputs.length;

  var index = maxindex;
  var sum = 0;
  var maxSum = 0;

  if (0 < trig && this._trig <= 0) {
    if (normalize === 1) {
      for (var k = 2; k < maxindex; k++) {
        maxSum += this.inputs[k][0];
      }
    } else {
      maxSum = 1;
    }
    var max = maxSum * Math.random();

    for (var _k = 2; _k < maxindex; _k++) {
      sum += this.inputs[_k][0];
      if (max <= sum) {
        index = _k - 2;
        break;
      }
    }

    this._prevIndex = index;
  } else {
    index = this._prevIndex;
  }

  for (var i = 0; i < inNumSamples; i++) {
    out[i] = index;
  }

  this._trig = trig;
};

dspProcess["ak"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var normalize = this.inputs[1][0];
  var maxindex = this.inputs.length;

  var index = maxindex;
  var sum = 0;
  var maxSum = 0;
  var curtrig = void 0;

  if (normalize === 1) {
    for (var k = 2; k < maxindex; k++) {
      maxSum += this.inputs[k][0];
    }
  } else {
    maxSum = 1;
  }

  for (var i = 0; i < inNumSamples; i++) {
    curtrig = trigIn[i];

    if (0 < curtrig && this._trig <= 0) {
      var max = maxSum * Math.random();

      for (var _k2 = 2; _k2 < maxindex; _k2++) {
        sum += this.inputs[_k2][0];
        if (max <= sum) {
          index = _k2 - 2;
          break;
        }
      }
      this._prevIndex = index;
    } else {
      index = this._prevIndex;
    }

    out[i] = index;
    this._trig = curtrig;
  }
};

SCUnitRepository.registerSCUnitClass("TWindex", SCUnitTWindex);

module.exports = SCUnitTWindex;
},{"../SCUnit":11,"../SCUnitRepository":12}],192:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitTimer = function (_SCUnit) {
  _inherits(SCUnitTimer, _SCUnit);

  function SCUnitTimer() {
    _classCallCheck(this, SCUnitTimer);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTimer).apply(this, arguments));
  }

  _createClass(SCUnitTimer, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleDur = rate.sampleDur;
      this._prevfrac = 0;
      this._previn = this.inputs[0][0];
      this._counter = 0;
      this.outputs[0][0] = this._level = 0;
    }
  }]);

  return SCUnitTimer;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var sampleDur = this._sampleDur;
  var previn = this._previn;
  var prevfrac = this._prevfrac;
  var level = this._level;
  var counter = this._counter;
  for (var i = 0; i < inNumSamples; i++) {
    var curin = inIn[i];
    counter += 1;
    if (previn <= 0 && curin > 0) {
      var frac = -previn / (curin - previn);
      level = sampleDur * (frac + counter - prevfrac);
      prevfrac = frac;
      counter = 0;
    }
    out[i] = level;
    previn = curin;
  }
  this._previn = previn;
  this._prevfrac = prevfrac;
  this._level = level;
  this._counter = counter;
};
SCUnitRepository.registerSCUnitClass("Timer", SCUnitTimer);
module.exports = SCUnitTimer;
},{"../SCUnit":11,"../SCUnitRepository":12}],193:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitToggleFF = function (_SCUnit) {
  _inherits(SCUnitToggleFF, _SCUnit);

  function SCUnitToggleFF() {
    _classCallCheck(this, SCUnitToggleFF);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitToggleFF).apply(this, arguments));
  }

  _createClass(SCUnitToggleFF, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this._prevtrig = 0;
      this._level = 0;
      this.outputs[0][0] = 0;
    }
  }]);

  return SCUnitToggleFF;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var prevtrig = this._prevtrig;
  var level = this._level;
  var curtrig = void 0;
  for (var i = 0; i < inNumSamples; i++) {
    curtrig = trigIn[i];
    if (prevtrig <= 0 && curtrig > 0) {
      level = 1 - level;
    }
    out[i] = level;
    prevtrig = curtrig;
  }
  this._prevtrig = prevtrig;
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("ToggleFF", SCUnitToggleFF);
module.exports = SCUnitToggleFF;
},{"../SCUnit":11,"../SCUnitRepository":12}],194:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitTrig = function (_SCUnit) {
  _inherits(SCUnitTrig, _SCUnit);

  function SCUnitTrig() {
    _classCallCheck(this, SCUnitTrig);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTrig).apply(this, arguments));
  }

  _createClass(SCUnitTrig, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.calcRate === C.RATE_AUDIO && this.inputSpecs[0].rate !== C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_k"];
      } else {
        this.dspProcess = dspProcess["next"];
      }
      this._sr = rate.sampleRate;
      this._counter = 0;
      this._trig = 0;
      this._level = 0;
      this.outputs[0][0] = 0;
    }
  }]);

  return SCUnitTrig;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var dur = this.inputs[1][0];
  var sr = this._sr;
  var trig = this._trig;
  var level = this._level;
  var counter = this._counter;
  var curTrig = void 0,
      zout = void 0;
  for (var i = 0; i < inNumSamples; i++) {
    curTrig = trigIn[i];
    if (counter > 0) {
      counter -= 1;
      zout = counter ? level : 0;
    } else {
      if (curTrig > 0 && trig <= 0) {
        counter = Math.max(1, dur * sr + 0.5 | 0);
        zout = level = curTrig;
      } else {
        zout = 0;
      }
    }
    out[i] = zout;
    trig = curTrig;
  }
  this._trig = trig;
  this._counter = counter;
  this._level = level;
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var dur = this.inputs[1][0];
  var sr = this._sr;
  var trig = this._trig;
  var level = this._level;
  var counter = this._counter;
  var curTrig = void 0,
      zout = void 0;
  curTrig = trigIn[0];
  for (var i = 0; i < inNumSamples; i++) {
    if (counter > 0) {
      counter -= 1;
      zout = counter ? level : 0;
    } else {
      if (curTrig > 0 && trig <= 0) {
        counter = Math.max(1, dur * sr + 0.5 | 0);
        zout = level = curTrig;
      } else {
        zout = 0;
      }
    }
    out[i] = zout;
    trig = curTrig;
  }
  this._trig = curTrig;
  this._counter = counter;
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("Trig", SCUnitTrig);
module.exports = SCUnitTrig;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],195:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitTrig1 = function (_SCUnit) {
  _inherits(SCUnitTrig1, _SCUnit);

  function SCUnitTrig1() {
    _classCallCheck(this, SCUnitTrig1);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTrig1).apply(this, arguments));
  }

  _createClass(SCUnitTrig1, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.calcRate === C.RATE_AUDIO && this.inputSpecs[0].rate !== C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_k"];
      } else {
        this.dspProcess = dspProcess["next"];
      }
      this._sr = rate.sampleRate;
      this._counter = 0;
      this._trig = 0;
      this.outputs[0][0] = 0;
    }
  }]);

  return SCUnitTrig1;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var dur = this.inputs[1][0];
  var sr = this._sr;
  var trig = this._trig;
  var counter = this._counter;
  var curTrig = void 0,
      zout = void 0;
  for (var i = 0; i < inNumSamples; i++) {
    curTrig = trigIn[i];
    if (counter > 0) {
      counter -= 1;
      zout = counter ? 1 : 0;
    } else {
      if (curTrig > 0 && trig <= 0) {
        counter = Math.max(1, dur * sr + 0.5 | 0);
        zout = 1;
      } else {
        zout = 0;
      }
    }
    out[i] = zout;
    trig = curTrig;
  }
  this._trig = trig;
  this._counter = counter;
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trigIn = this.inputs[0];
  var dur = this.inputs[1][0];
  var sr = this._sr;
  var trig = this._trig;
  var counter = this._counter;
  var curTrig = void 0,
      zout = void 0;
  curTrig = trigIn[0];
  for (var i = 0; i < inNumSamples; i++) {
    if (counter > 0) {
      counter -= 1;
      zout = counter ? 1 : 0;
    } else {
      if (curTrig > 0 && trig <= 0) {
        counter = Math.max(1, dur * sr + 0.5 | 0);
        zout = 1;
      } else {
        zout = 0;
      }
    }
    out[i] = zout;
    trig = curTrig;
  }
  this._trig = trig;
  this._counter = counter;
};
SCUnitRepository.registerSCUnitClass("Trig1", SCUnitTrig1);
module.exports = SCUnitTrig1;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],196:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitTrigControl = function (_SCUnit) {
  _inherits(SCUnitTrigControl, _SCUnit);

  function SCUnitTrigControl() {
    _classCallCheck(this, SCUnitTrigControl);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTrigControl).apply(this, arguments));
  }

  _createClass(SCUnitTrigControl, [{
    key: "initialize",
    value: function initialize() {
      if (this.outputs.length === 1) {
        this.dspProcess = dspProcess["1"];
      } else {
        this.dspProcess = dspProcess["k"];
      }
      this._controls = this.synth.params;
      this.dspProcess(1);
    }
  }]);

  return SCUnitTrigControl;
}(SCUnit);

dspProcess["1"] = function () {
  var controls = this._controls;
  var specialIndex = this.specialIndex;
  this.outputs[0][0] = controls[specialIndex];
  controls[specialIndex] = 0;
};
dspProcess["k"] = function () {
  var controls = this._controls;
  var outputs = this.outputs;
  var numberOfChannels = outputs.length;
  var specialIndex = this.specialIndex;
  for (var i = 0; i < numberOfChannels; i++) {
    outputs[i][0] = controls[specialIndex + i];
    controls[specialIndex + i] = 0;
  }
};
SCUnitRepository.registerSCUnitClass("TrigControl", SCUnitTrigControl);
module.exports = SCUnitTrigControl;
},{"../SCUnit":11,"../SCUnitRepository":12}],197:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitTrigImpulse = function (_SCUnit) {
  _inherits(SCUnitTrigImpulse, _SCUnit);

  function SCUnitTrigImpulse() {
    _classCallCheck(this, SCUnitTrigImpulse);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTrigImpulse).apply(this, arguments));
  }

  _createClass(SCUnitTrigImpulse, [{
    key: "initialize",
    value: function initialize(rate) {
      this._phase = this.inputs[2][0];
      if (this.inputSpecs[1].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_ka"];
        if (this.inputSpecs[2].rate !== C.RATE_SCALAR) {
          this._phase = 1;
        }
      } else {
        this.dspProcess = dspProcess["next_kk"];
        if (this.inputSpecs[2].rate !== C.RATE_SCALAR) {
          this._phase = 1;
        }
      }
      this._slopeFactor = rate.slopeFactor;
      this._phaseOffset = 0;
      this._cpstoinc = rate.sampleDur;
      if (this._phase === 0) {
        this._phase = 1;
      }
      this._prevTrig = this.inputs[0][0];
    }
  }]);

  return SCUnitTrigImpulse;
}(SCUnit);

dspProcess["next_ka"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trig = this.inputs[0];
  var freqIn = this.inputs[1];
  var cpstoinc = this._cpstoinc;
  var prevTrig = this._prevTrig;
  var phaseOffset = this.inputs[2][0];
  var prevPhaseOffset = this._phaseOffset;
  var phase_slope = (phaseOffset - prevPhaseOffset) * this._slopeFactor;
  var phase = this._phase;
  if (trig > 0 && prevTrig <= 0) {
    phase = phaseOffset;
    if (this.inputSpecs[2].rate !== C.SCALAR) {
      phase = 1;
    }
    if (phase === 0) {
      phase = 1;
    }
  }
  phase += prevPhaseOffset;
  for (var i = 0; i < inNumSamples; i++) {
    phase += phase_slope;
    if (phase >= 1) {
      phase -= 1;
      out[i] = 1;
    } else {
      out[i] = 0;
    }
    phase += freqIn[i] * cpstoinc;
  }
  this._phase = phase - phaseOffset;
  this._phaseOffset = phaseOffset;
  this._prevTrig = trig;
};
dspProcess["next_kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var trig = this.inputs[0][0];
  var freq = this.inputs[1][0] * this._cpstoinc;
  var prevTrig = this._prevTrig;
  var phaseOffset = this.inputs[2][0];
  var prevPhaseOffset = this._phaseOffset;
  var phase_slope = (phaseOffset - prevPhaseOffset) * this._slopeFactor;
  var phase = this._phase;
  if (trig > 0 && prevTrig <= 0) {
    phase = phaseOffset;
    if (this.inputSpecs[2].rate !== C.SCALAR) {
      phase = 1;
    }
    if (phase === 0) {
      phase = 1;
    }
  }
  phase += prevPhaseOffset;
  for (var i = 0; i < inNumSamples; i++) {
    phase += phase_slope;
    if (phase >= 1) {
      phase -= 1;
      out[i] = 1;
    } else {
      out[i] = 0;
    }
    phase += freq;
  }
  this._phase = phase - phaseOffset;
  this._phaseOffset = phaseOffset;
  this._prevTrig = trig;
};
SCUnitRepository.registerSCUnitClass("TrigImpulse", SCUnitTrigImpulse);
module.exports = SCUnitTrigImpulse;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],198:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitTwoPole = function (_SCUnit) {
  _inherits(SCUnitTwoPole, _SCUnit);

  function SCUnitTwoPole() {
    _classCallCheck(this, SCUnitTwoPole);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTwoPole).apply(this, arguments));
  }

  _createClass(SCUnitTwoPole, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._b1 = 0;
      this._b2 = 0;
      this._y1 = 0;
      this._y2 = 0;
      this._freq = NaN;
      this._reson = NaN;
      this.dspProcess(1);
    }
  }]);

  return SCUnitTwoPole;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var reson = Math.max(0, Math.min(this.inputs[2][0], 1));
  var b1 = this._b1;
  var b2 = this._b2;
  var y1 = this._y1;
  var y2 = this._y2;
  if (freq !== this._freq || reson !== this._reson) {
    var b1_next = 2 * reson * Math.cos(freq * this._radiansPerSample);
    var b2_next = -(reson * reson);
    var b1_slope = (b1_next - b1) * this._slopeFactor;
    var b2_slope = (b2_next - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var y0 = inIn[i] + (b1 + b1_slope * i) * y1 + (b2 + b2_slope * i) * y2;
      out[i] = y0;
      y2 = y1;
      y1 = y0;
    }
    this._freq = freq;
    this._reson = reson;
    this._b1 = b1_next;
    this._b2 = b2_next;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _y = inIn[_i] + b1 * y1 + b2 * y2;
      out[_i] = _y;
      y2 = y1;
      y1 = _y;
    }
  }
  this._y1 = y1;
  this._y2 = y2;
};
SCUnitRepository.registerSCUnitClass("TwoPole", SCUnitTwoPole);
module.exports = SCUnitTwoPole;
},{"../SCUnit":11,"../SCUnitRepository":12}],199:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitTwoZero = function (_SCUnit) {
  _inherits(SCUnitTwoZero, _SCUnit);

  function SCUnitTwoZero() {
    _classCallCheck(this, SCUnitTwoZero);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitTwoZero).apply(this, arguments));
  }

  _createClass(SCUnitTwoZero, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._radiansPerSample = rate.radiansPerSample;
      this._slopeFactor = rate.slopeFactor;
      this._b1 = 0;
      this._b2 = 0;
      this._x1 = 0;
      this._x2 = 0;
      this._freq = NaN;
      this._reson = NaN;
      this.dspProcess(1);
    }
  }]);

  return SCUnitTwoZero;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var freq = this.inputs[1][0];
  var reson = Math.max(0, Math.min(this.inputs[2][0], 1));
  var b1 = this._b1;
  var b2 = this._b2;
  var x1 = this._x1;
  var x2 = this._x2;
  if (freq !== this._freq || reson !== this._reson) {
    var b1_next = -2 * reson * Math.cos(freq * this._radiansPerSample);
    var b2_next = reson * reson;
    var b1_slope = (b1_next - b1) * this._slopeFactor;
    var b2_slope = (b2_next - b2) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      var x0 = inIn[i];
      out[i] = x0 + (b1 + b1_slope * i) * x1 + (b2 + b2_slope * i) * x2;
      x2 = x1;
      x1 = x0;
    }
    this._freq = freq;
    this._reson = reson;
    this._b1 = b1_next;
    this._b2 = b2_next;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      var _x = inIn[_i];
      out[_i] = _x + b1 * x1 + b2 * x2;
      x2 = x1;
      x1 = _x;
    }
  }
  this._x1 = x1;
  this._x2 = x2;
};
SCUnitRepository.registerSCUnitClass("TwoZero", SCUnitTwoZero);
module.exports = SCUnitTwoZero;
},{"../SCUnit":11,"../SCUnitRepository":12}],200:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var demand = require("./_demand");
var $i2n = "\nneg not isNil notNil bitNot abs asFloat asInt ceil floor frac sign squared cubed sqrt exp reciprocal\nmidicps cpsmidi midiratio ratiomidi dbamp ampdb octcps cpsoct log log2 log10 sin cos tan asin acos\natan sinh cosh tanh rand rand2 linrand bilinrand sum3rand distort softclip coin digitvalue silence\nthru rectWindow hanWindow welWindow triWindow ramp scurve\nnumunaryselectors".trim().split(/\s/);
var dspProcess = {};

var SCUnitUnaryOpUGen = function (_SCUnit) {
  _inherits(SCUnitUnaryOpUGen, _SCUnit);

  function SCUnitUnaryOpUGen() {
    _classCallCheck(this, SCUnitUnaryOpUGen);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitUnaryOpUGen).apply(this, arguments));
  }

  _createClass(SCUnitUnaryOpUGen, [{
    key: "initialize",
    value: function initialize() {
      var dspFunc = dspProcess[$i2n[this.specialIndex]];

      if (!dspFunc) {
        throw new Error("UnaryOpUGen[" + $i2n[this.specialIndex] + "] is not defined.");
      }

      if (this.calcRate === C.RATE_DEMAND) {
        this.dspProcess = dspFunc["d"];
      } else {
        this.dspProcess = dspFunc[$r2k(this)];

        this._a = this.inputs[0][0];

        this.outputs[0][0] = dspFunc(this._a);
      }
    }
  }]);

  return SCUnitUnaryOpUGen;
}(SCUnit);

function $r2k(unit) {
  if (unit.calcRate === C.RATE_AUDIO) {
    return "a";
  }
  return unit.calcRate === C.RATE_SCALAR ? "i" : "k";
}

dspProcess["neg"] = function (a) {
  return -a;
};
dspProcess["not"] = function (a) {
  return a === 0 ? 1 : 0;
};
// dspProcess["isNil"] = function (a) {
//   return 0;
// };
// dspProcess["notNil"] = function (a) {
//   return 0;
// };
dspProcess["abs"] = function (a) {
  return Math.abs(a);
};
// dspProcess["asFloat"] = function (a) {
//   return 0;
// };
// dspProcess["asInt"] = function (a) {
//   return 0;
// };
dspProcess["ceil"] = function (a) {
  return Math.ceil(a);
};
dspProcess["floor"] = function (a) {
  return Math.floor(a);
};
dspProcess["frac"] = function (a) {
  if (a < 0) {
    return 1 + (a - (a | 0));
  }
  return a - (a | 0);
};
dspProcess["sign"] = function (a) {
  return Math.sign(a);
};
dspProcess["squared"] = function (a) {
  return a * a;
};
dspProcess["cubed"] = function (a) {
  return a * a * a;
};
dspProcess["sqrt"] = function (a) {
  return Math.sqrt(Math.abs(a));
};
dspProcess["exp"] = function (a) {
  return Math.exp(a);
};
dspProcess["reciprocal"] = function (a) {
  return 1 / a;
};
dspProcess["midicps"] = function (a) {
  return 440 * Math.pow(2, (a - 69) * 1 / 12);
};
dspProcess["cpsmidi"] = function (a) {
  return Math.log(Math.abs(a) * 1 / 440) * Math.LOG2E * 12 + 69;
};
dspProcess["midiratio"] = function (a) {
  return Math.pow(2, a * 1 / 12);
};
dspProcess["ratiomidi"] = function (a) {
  return Math.log(Math.abs(a)) * Math.LOG2E * 12;
};
dspProcess["dbamp"] = function (a) {
  return Math.pow(10, a * 0.05);
};
dspProcess["ampdb"] = function (a) {
  return Math.log(Math.abs(a)) * Math.LOG10E * 20;
};
dspProcess["octcps"] = function (a) {
  return 440 * Math.pow(2, a - 4.75);
};
dspProcess["cpsoct"] = function (a) {
  return Math.log(Math.abs(a) * 1 / 440) * Math.LOG2E + 4.75;
};
dspProcess["log"] = function (a) {
  return Math.log(Math.abs(a));
};
dspProcess["log2"] = function (a) {
  return Math.log(Math.abs(a)) * Math.LOG2E;
};
dspProcess["log10"] = function (a) {
  return Math.log(Math.abs(a)) * Math.LOG10E;
};
dspProcess["sin"] = function (a) {
  return Math.sin(a);
};
dspProcess["cos"] = function (a) {
  return Math.cos(a);
};
dspProcess["tan"] = function (a) {
  return Math.tan(a);
};
dspProcess["asin"] = function (a) {
  return Math.asin(Math.max(-1, Math.min(a, 1)));
};
dspProcess["acos"] = function (a) {
  return Math.acos(Math.max(-1, Math.min(a, 1)));
};
dspProcess["atan"] = function (a) {
  return Math.atan(a);
};
dspProcess["sinh"] = function (a) {
  return Math.sinh(a);
};
dspProcess["cosh"] = function (a) {
  return Math.cosh(a);
};
dspProcess["tanh"] = function (a) {
  return Math.tanh(a);
};
dspProcess["rand"] = function (a) {
  return Math.random() * a;
};
dspProcess["rand2"] = function (a) {
  return (Math.random() * 2 - 1) * a;
};
dspProcess["linrand"] = function (a) {
  return Math.min(Math.random(), Math.random()) * a;
};
dspProcess["bilinrand"] = function (a) {
  return (Math.random() - Math.random()) * a;
};
dspProcess["sum3rand"] = function (a) {
  return (Math.random() + Math.random() + Math.random() - 1.5) * 0.666666667 * a;
};
dspProcess["distort"] = function (a) {
  return a / (1 + Math.abs(a));
};
dspProcess["softclip"] = function (a) {
  var absa = Math.abs(a);
  return absa <= 0.5 ? a : (absa - 0.25) / a;
};
dspProcess["coin"] = function (a) {
  return Math.random() < a ? 1 : 0;
};
// dspProcess["digitvalue"] = function (a) {
//   return 0;
// };
// dspProcess["silence"] = function (a) {
//   return 0;
// };
// dspProcess["thru"] = function (a) {
//   return 0;
// };
// dspProcess["rectWindow"] = function (a) {
//   return 0;
// };
// dspProcess["hanWindow"] = function (a) {
//   return 0;
// };
// dspProcess["welWindow"] = function (a) {
//   return 0;
// };
// dspProcess["triWindow"] = function (a) {
//   return 0;
// };
// dspProcess["ramp"] = function (a) {
//   return 0;
// };
// dspProcess["scurve"] = function (a) {
//   return 0;
// };

function unary_k(func) {
  return function () {
    this.outputs[0][0] = func(this.inputs[0][0]);
  };
}

function unary_a(func) {
  return function (inNumSamples) {
    var out = this.outputs[0];
    var aIn = this.inputs[0];

    for (var i = 0; i < inNumSamples; i++) {
      out[i] = func(aIn[i]);
    }
  };
}

function unary_d(func) {
  return function (inNumSamples) {
    if (inNumSamples) {
      var a = demand.next(this, 0, inNumSamples);

      this.outputs[0][0] = isNaN(a) ? NaN : func(a);
    } else {
      demand.reset(this, 0);
    }
  };
}

Object.keys(dspProcess).forEach(function (key) {
  var func = dspProcess[key];

  func["a"] = func["a"] || unary_a(func);
  func["k"] = func["k"] || unary_k(func);
  func["d"] = unary_d(func);
});

SCUnitRepository.registerSCUnitClass("UnaryOpUGen", SCUnitUnaryOpUGen);

module.exports = SCUnitUnaryOpUGen;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_demand":209}],201:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var fill = require("../util/fill");
var dspProcess = {};

var SCUnitVarLag = function (_SCUnit) {
  _inherits(SCUnitVarLag, _SCUnit);

  function SCUnitVarLag() {
    _classCallCheck(this, SCUnitVarLag);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitVarLag).apply(this, arguments));
  }

  _createClass(SCUnitVarLag, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.bufferLength === 1) {
        this.dspProcess = dspProcess["next_1"];
      } else {
        this.dspProcess = dspProcess["next"];
      }
      this._sampleRate = rate.sampleRate;
      var lagTime = this.inputs[1][0];
      var counter = Math.max(1, lagTime * rate.sampleRate | 0);
      this._level = this.inputs[2][0];
      this._counter = counter;
      this._in = this.inputs[0][0];
      this._slope = (this._in - this._level) / counter;
      this._lagTime = lagTime;
      this.outputs[0][0] = this._level;
    }
  }]);

  return SCUnitVarLag;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var lagTime = this.inputs[1][0];
  var _in = this.inputs[0][0];
  var slope = this._slope;
  var level = this._level;
  var counter = this._counter;
  if (_in !== this._in) {
    this._counter = counter = Math.max(1, lagTime * this._sampleRate | 0);
    this._slope = slope = (_in - this._in) / counter;
    this._in = _in;
    this._lagTime = lagTime;
  } else if (lagTime !== this._lagTime) {
    var scaleFactor = lagTime / this._lagTime;
    this._counter = counter = Math.max(1, this._counter * scaleFactor | 0);
    this._slope = slope = this._slope / scaleFactor || 0;
    this._lagTime = lagTime;
  }
  _in = this._in;
  if (counter > 0) {
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = level;
      if (counter > 0) {
        level += slope;
        counter -= 1;
      } else {
        level = _in;
      }
    }
  } else {
    fill(out, level);
  }
  this._level = level;
  this._slope = slope;
  this._counter = counter;
};
dspProcess["next_1"] = function () {
  var _in = this.inputs[0][0];
  var lagTime = this.inputs[1][0];
  var counter = this._counter;
  if (_in !== this._in) {
    this._counter = counter = Math.max(1, lagTime * this._sampleRate | 0);
    this._slope = (_in - this._level) / counter;
    this._in = _in;
    this._lagTime = lagTime;
  } else if (lagTime !== this._lagTime) {
    if (counter !== 0) {
      var scaleFactor = lagTime / this._lagTime;
      this._counter = counter = Math.max(1, this._counter * scaleFactor | 0);
      this._slope = this._slope / scaleFactor;
    }
    this._lagTime = lagTime;
  }
  this.outputs[0][0] = this._level;
  if (this._counter > 0) {
    this._level += this._slope;
    this._counter -= 1;
  } else {
    this._level = this._in;
  }
};
SCUnitRepository.registerSCUnitClass("VarLag", SCUnitVarLag);
module.exports = SCUnitVarLag;
},{"../SCUnit":11,"../SCUnitRepository":12,"../util/fill":213}],202:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitWhiteNoise = function (_SCUnit) {
  _inherits(SCUnitWhiteNoise, _SCUnit);

  function SCUnitWhiteNoise() {
    _classCallCheck(this, SCUnitWhiteNoise);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitWhiteNoise).apply(this, arguments));
  }

  _createClass(SCUnitWhiteNoise, [{
    key: "initialize",
    value: function initialize() {
      this.dspProcess = dspProcess["next"];
      this.dspProcess(1);
    }
  }]);

  return SCUnitWhiteNoise;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = Math.random() * 2 - 1;
  }
};
SCUnitRepository.registerSCUnitClass("WhiteNoise", SCUnitWhiteNoise);
module.exports = SCUnitWhiteNoise;
},{"../SCUnit":11,"../SCUnitRepository":12}],203:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var sc_wrap = require("../util/sc_wrap");
var dspProcess = {};

var SCUnitWrap = function (_SCUnit) {
  _inherits(SCUnitWrap, _SCUnit);

  function SCUnitWrap() {
    _classCallCheck(this, SCUnitWrap);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitWrap).apply(this, arguments));
  }

  _createClass(SCUnitWrap, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[1].rate === C.RATE_AUDIO && this.inputSpecs[2].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_aa"];
      } else {
        this.dspProcess = dspProcess["next_kk"];
      }
      this._slopeFactor = rate.slopeFactor;
      this._lo = this.inputs[1][0];
      this._hi = this.inputs[2][0];
      this.dspProcess(1);
    }
  }]);

  return SCUnitWrap;
}(SCUnit);

dspProcess["next_aa"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var loIn = this.inputs[1];
  var hiIn = this.inputs[2];
  for (var i = 0; i < inNumSamples; i++) {
    out[i] = sc_wrap(inIn[i], loIn[i], hiIn[i]);
  }
};
dspProcess["next_kk"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var next_lo = this.inputs[1][0];
  var next_hi = this.inputs[2][0];
  var lo = this._lo;
  var hi = this._hi;
  if (next_lo === lo && next_hi === hi) {
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = sc_wrap(inIn[i], lo, hi);
    }
  } else {
    var lo_slope = (next_lo - lo) * this._slopeFactor;
    var hi_slope = (next_hi - hi) * this._slopeFactor;
    for (var _i = 0; _i < inNumSamples; _i++) {
      out[_i] = sc_wrap(inIn[_i], lo + lo_slope * _i, hi + hi_slope * _i);
    }
    this._lo = next_lo;
    this._hi = next_hi;
  }
};
SCUnitRepository.registerSCUnitClass("Wrap", SCUnitWrap);
module.exports = SCUnitWrap;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"../util/sc_wrap":220}],204:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};
var sine = require("./_sine");
var gSine = sine.gSine;

var SCUnitXFade2 = function (_SCUnit) {
  _inherits(SCUnitXFade2, _SCUnit);

  function SCUnitXFade2() {
    _classCallCheck(this, SCUnitXFade2);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitXFade2).apply(this, arguments));
  }

  _createClass(SCUnitXFade2, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.inputSpecs[2].rate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["next_a"];
      } else {
        this.dspProcess = dspProcess["next_k"];
      }
      var ipos = void 0;
      this._slopeFactor = rate.slopeFactor;
      this._pos = this.inputs[2][0];
      this._level = this.inputs[3][0];
      ipos = 1024 * this._pos + 1024 + 0.5 | 0;
      ipos = Math.max(0, Math.min(ipos, 2048));
      this._leftAmp = this._level * gSine[2048 - ipos];
      this._rightAmp = this._level * gSine[ipos];
      this.dspProcess(1);
    }
  }]);

  return SCUnitXFade2;
}(SCUnit);

dspProcess["next_a"] = function (inNumSamples) {
  var out = this.outputs[0];
  var leftIn = this.inputs[0];
  var rightIn = this.inputs[1];
  var posIn = this.inputs[2];
  var nextLevel = this.inputs[3][0];
  var level = this._level;
  var ipos = void 0;
  if (level !== nextLevel) {
    var level_slope = (nextLevel - this._level) * this._slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      ipos = 1024 * posIn[i] + 1024 + 0.5 | 0;
      ipos = Math.max(0, Math.min(ipos, 2048));
      var amp = level + level_slope * i;
      var leftAmp = amp * gSine[2048 - ipos];
      var rightAmp = amp * gSine[ipos];
      out[i] = leftIn[i] * leftAmp + rightIn[i] * rightAmp;
    }
    this._level = nextLevel;
  } else {
    for (var _i = 0; _i < inNumSamples; _i++) {
      ipos = 1024 * posIn[_i] + 1024 + 0.5 | 0;
      ipos = Math.max(0, Math.min(ipos, 2048));
      var _amp = level;
      var _leftAmp = _amp * gSine[2048 - ipos];
      var _rightAmp = _amp * gSine[ipos];
      out[_i] = leftIn[_i] * _leftAmp + rightIn[_i] * _rightAmp;
    }
  }
};
dspProcess["next_k"] = function (inNumSamples) {
  var out = this.outputs[0];
  var leftIn = this.inputs[0];
  var rightIn = this.inputs[1];
  var nextPos = this.inputs[2][0];
  var nextLevel = this.inputs[3][0];
  var leftAmp = this._leftAmp;
  var rightAmp = this._rightAmp;
  var ipos = void 0;
  if (this._pos !== nextPos || this._level !== nextLevel) {
    ipos = 1024 * nextPos + 1024 + 0.5 | 0;
    ipos = Math.max(0, Math.min(ipos, 2048));
    var nextLeftAmp = nextLevel * gSine[2048 - ipos];
    var nextRightAmp = nextLevel * gSine[ipos];
    var slopeFactor = this._slopeFactor;
    var leftAmp_slope = (nextLeftAmp - leftAmp) * slopeFactor;
    var rightAmp_slope = (nextRightAmp - rightAmp) * slopeFactor;
    for (var i = 0; i < inNumSamples; i++) {
      out[i] = leftIn[i] * (leftAmp + leftAmp_slope * i) + rightIn[i] * (rightAmp + rightAmp_slope * i);
    }
    this._pos = nextPos;
    this._level = nextLevel;
    this._leftAmp = nextLeftAmp;
    this._rightAmp = nextRightAmp;
  } else {
    for (var _i2 = 0; _i2 < inNumSamples; _i2++) {
      out[_i2] = leftIn[_i2] * leftAmp + rightIn[_i2] * rightAmp;
    }
  }
};
SCUnitRepository.registerSCUnitClass("XFade2", SCUnitXFade2);
module.exports = SCUnitXFade2;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12,"./_sine":210}],205:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitXLine = function (_SCUnit) {
  _inherits(SCUnitXLine, _SCUnit);

  function SCUnitXLine() {
    _classCallCheck(this, SCUnitXLine);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitXLine).apply(this, arguments));
  }

  _createClass(SCUnitXLine, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      var start = this.inputs[0][0] || 0.001;
      var end = this.inputs[1][0] || 0.001;
      var dur = this.inputs[2][0];
      var counter = Math.round(dur * rate.sampleRate);
      if (counter === 0) {
        this._level = end;
        this._counter = 0;
        this._growth = 0;
      } else {
        this._counter = counter;
        this._growth = Math.pow(end / start, 1 / counter);
        this._level = start * this._growth;
      }
      this._endLevel = end;
      this._doneAction = this.inputs[3][0];
      this.outputs[0][0] = this._level;
    }
  }]);

  return SCUnitXLine;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var growth = this._growth;
  var level = this._level;
  var counter = this._counter;
  var remain = inNumSamples;
  var j = 0;
  do {
    if (counter === 0) {
      var endLevel = this._endLevel;
      for (var i = 0; i < remain; i++) {
        out[j++] = endLevel;
      }
      remain = 0;
    } else {
      var nsmps = Math.min(remain, counter);
      counter -= nsmps;
      remain -= nsmps;
      for (var _i = 0; _i < nsmps; _i++) {
        out[j++] = level;
        level *= growth;
      }
      if (counter === 0) {
        this.doneAction(this._doneAction);
      }
    }
  } while (remain);
  this._counter = counter;
  this._level = level;
};
SCUnitRepository.registerSCUnitClass("XLine", SCUnitXLine);
module.exports = SCUnitXLine;
},{"../SCUnit":11,"../SCUnitRepository":12}],206:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require("../Constants");
var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitXOut = function (_SCUnit) {
  _inherits(SCUnitXOut, _SCUnit);

  function SCUnitXOut() {
    _classCallCheck(this, SCUnitXOut);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitXOut).apply(this, arguments));
  }

  _createClass(SCUnitXOut, [{
    key: "initialize",
    value: function initialize(rate) {
      if (this.calcRate === C.RATE_AUDIO) {
        this.dspProcess = dspProcess["a"];
        this._buses = this.context.audioBuses;
      } else {
        this.dspProcess = dspProcess["k"];
        this._buses = this.context.controlBuses;
      }
      this._slopeFactor = rate.slopeFactor;
      this._xfade = this.inputs[1][0];
    }
  }]);

  return SCUnitXOut;
}(SCUnit);

dspProcess["a"] = function (inNumSamples) {
  var inputs = this.inputs;
  var buses = this._buses;
  var firstBusChannel = inputs[0][0] | 0;
  var xfade = this._xfade;
  var nextXFade = this.inputs[1][0];

  if (xfade !== nextXFade) {
    var xfadeSlope = (nextXFade - xfade) * this._slopeFactor;

    for (var ch = 0, chmax = inputs.length - 2; ch < chmax; ch++) {
      var out = buses[firstBusChannel + ch];
      var inIn = inputs[ch + 2];

      for (var i = 0; i < inNumSamples; i++) {
        out[i] += (xfade + xfadeSlope * i) * (inIn[i] - out[i]);
      }
    }

    this._xfade = nextXFade;
  } else if (xfade === 1) {
    for (var _ch = 0, _chmax = inputs.length - 2; _ch < _chmax; _ch++) {
      var _out = buses[firstBusChannel + _ch];
      var _inIn = inputs[_ch + 2];

      _out.set(_inIn);
    }
  } else if (xfade !== 0) {
    for (var _ch2 = 0, _chmax2 = inputs.length - 2; _ch2 < _chmax2; _ch2++) {
      var _out2 = buses[firstBusChannel + _ch2];
      var _inIn2 = inputs[_ch2 + 2];

      for (var _i = 0; _i < inNumSamples; _i++) {
        _out2[_i] += xfade * (_inIn2[_i] - _out2[_i]);
      }
    }
  }
};

dspProcess["k"] = function () {
  var inputs = this.inputs;
  var buses = this._buses;
  var firstBusChannel = inputs[0][0] | 0;
  var xfade = this.inputs[1][0];

  for (var ch = 0, chmax = inputs.length - 2; ch < chmax; ch++) {
    var out = buses[firstBusChannel + ch];
    var _in = inputs[ch + 2][0];

    out[0] += xfade * (_in - out[0]);
  }
};

SCUnitRepository.registerSCUnitClass("XOut", SCUnitXOut);

module.exports = SCUnitXOut;
},{"../Constants":3,"../SCUnit":11,"../SCUnitRepository":12}],207:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SCUnit = require("../SCUnit");
var SCUnitRepository = require("../SCUnitRepository");
var dspProcess = {};

var SCUnitZeroCrossing = function (_SCUnit) {
  _inherits(SCUnitZeroCrossing, _SCUnit);

  function SCUnitZeroCrossing() {
    _classCallCheck(this, SCUnitZeroCrossing);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SCUnitZeroCrossing).apply(this, arguments));
  }

  _createClass(SCUnitZeroCrossing, [{
    key: "initialize",
    value: function initialize(rate) {
      this.dspProcess = dspProcess["next"];
      this._sampleRate = rate.sampleRate;
      this._prevfrac = 0;
      this._previn = this.inputs[0][0];
      this._counter = 0;
      this.outputs[0][0] = this._level = 0;
    }
  }]);

  return SCUnitZeroCrossing;
}(SCUnit);

dspProcess["next"] = function (inNumSamples) {
  var out = this.outputs[0];
  var inIn = this.inputs[0];
  var sampleRate = this._sampleRate;
  var previn = this._previn;
  var prevfrac = this._prevfrac;
  var level = this._level;
  var counter = this._counter;
  for (var i = 0; i < inNumSamples; i++) {
    var curin = inIn[i];
    counter += 1;
    if (counter > 4 && previn <= 0 && curin > 0) {
      var frac = -previn / (curin - previn);
      level = sampleRate / (frac + counter - prevfrac);
      prevfrac = frac;
      counter = 0;
    }
    out[i] = level;
    previn = curin;
  }
  this._previn = previn;
  this._prevfrac = prevfrac;
  this._level = level;
  this._counter = counter;
};
SCUnitRepository.registerSCUnitClass("ZeroCrossing", SCUnitZeroCrossing);
module.exports = SCUnitZeroCrossing;
},{"../SCUnit":11,"../SCUnitRepository":12}],208:[function(require,module,exports){
"use strict";

var log001 = Math.log(0.001);

function feedback(delaytime, decaytime) {
  if (delaytime === 0 || decaytime === 0) {
    return 0;
  }
  if (decaytime > 0) {
    return +Math.exp(log001 * delaytime / +decaytime);
  } else {
    return -Math.exp(log001 * delaytime / -decaytime);
  }
}

module.exports = { feedback: feedback };
},{}],209:[function(require,module,exports){
"use strict";

var C = require("../Constants");

function isDemand(unit, index) {
  var fromUnit = unit.inputSpecs[index].unit;

  return fromUnit && fromUnit.calcRate === C.RATE_DEMAND;
}

function next(unit, index, inNumSamples) {
  var fromUnit = unit.inputSpecs[index].unit;

  if (fromUnit) {
    switch (fromUnit.calcRate) {
      case C.RATE_AUDIO:
        return unit.inputs[index][inNumSamples - 1];
      case C.RATE_DEMAND:
        fromUnit.dspProcess(inNumSamples);
      /* fall through */
    }
  }

  return unit.inputs[index][0];
}

function reset(unit, index) {
  var fromUnit = unit.inputSpecs[index].unit;

  if (fromUnit && fromUnit.calcRate === C.RATE_DEMAND) {
    fromUnit.dspProcess(0);
  }
}

module.exports = { isDemand: isDemand, next: next, reset: reset };
},{"../Constants":3}],210:[function(require,module,exports){
"use strict";

var kSineSize = 8192;
var kSineMask = kSineSize - 1;
var kBadValue = new Float32Array([1e20])[0];
var gSine = new Float32Array(kSineSize + 1);
var gInvSine = new Float32Array(kSineSize + 1);
var gSineWavetable = new Float32Array(kSineSize * 2);

function makeSine() {
  for (var i = 0; i < kSineSize; i++) {
    var d = Math.sin(i / kSineSize * 2 * Math.PI);

    gSine[i] = d;
    gInvSine[i] = 1 / d;
  }
  gSine[kSineSize] = gSine[0];
  gInvSine[0] = gInvSine[kSineSize >> 1] = gInvSine[kSineSize] = kBadValue;

  var sz1 = kSineSize;
  var sz2 = sz1 >> 1;

  for (var _i = 1; _i <= 8; _i++) {
    gInvSine[_i] = gInvSine[sz1 - _i] = gInvSine[sz2 - _i] = gInvSine[sz2 + _i] = kBadValue;
  }
}

function makeSineWaveTable() {
  var val1 = void 0,
      val2 = void 0;
  var j = 0;

  for (var i = 0; i < kSineSize - 1; i++) {
    val1 = gSine[i];
    val2 = gSine[i + 1];
    gSineWavetable[j++] = 2 * val1 - val2;
    gSineWavetable[j++] = val2 - val1;
  }

  val1 = gSine[kSineSize - 1];
  val2 = gSine[0];
  gSineWavetable[j++] = 2 * val1 - val2;
  gSineWavetable[j++] = val2 - val1;
}

makeSine();
makeSineWaveTable();

module.exports = { kSineSize: kSineSize, kSineMask: kSineMask, kBadValue: kBadValue, gSine: gSine, gInvSine: gInvSine, gSineWavetable: gSineWavetable };
},{}],211:[function(require,module,exports){
"use strict";

module.exports = {
  SCUnitA2K: require("./SCUnitA2K"),
  SCUnitAllpassC: require("./SCUnitAllpassC"),
  SCUnitAllpassL: require("./SCUnitAllpassL"),
  SCUnitAllpassN: require("./SCUnitAllpassN"),
  SCUnitAmpComp: require("./SCUnitAmpComp"),
  SCUnitAmpCompA: require("./SCUnitAmpCompA"),
  SCUnitAmplitude: require("./SCUnitAmplitude"),
  SCUnitAPF: require("./SCUnitAPF"),
  SCUnitBalance2: require("./SCUnitBalance2"),
  SCUnitBinaryOpUGen: require("./SCUnitBinaryOpUGen"),
  SCUnitBlip: require("./SCUnitBlip"),
  SCUnitBPF: require("./SCUnitBPF"),
  SCUnitBPZ2: require("./SCUnitBPZ2"),
  SCUnitBRF: require("./SCUnitBRF"),
  SCUnitBrownNoise: require("./SCUnitBrownNoise"),
  SCUnitBRZ2: require("./SCUnitBRZ2"),
  SCUnitClip: require("./SCUnitClip"),
  SCUnitClipNoise: require("./SCUnitClipNoise"),
  SCUnitCoinGate: require("./SCUnitCoinGate"),
  SCUnitCombC: require("./SCUnitCombC"),
  SCUnitCombL: require("./SCUnitCombL"),
  SCUnitCombN: require("./SCUnitCombN"),
  SCUnitCompander: require("./SCUnitCompander"),
  SCUnitControl: require("./SCUnitControl"),
  SCUnitControlDur: require("./SCUnitControlDur"),
  SCUnitControlRate: require("./SCUnitControlRate"),
  SCUnitCrackle: require("./SCUnitCrackle"),
  SCUnitDbrown: require("./SCUnitDbrown"),
  SCUnitDC: require("./SCUnitDC"),
  SCUnitDecay2: require("./SCUnitDecay2"),
  SCUnitDecay: require("./SCUnitDecay"),
  SCUnitDelay1: require("./SCUnitDelay1"),
  SCUnitDelay2: require("./SCUnitDelay2"),
  SCUnitDelayC: require("./SCUnitDelayC"),
  SCUnitDelayL: require("./SCUnitDelayL"),
  SCUnitDelayN: require("./SCUnitDelayN"),
  SCUnitDemand: require("./SCUnitDemand"),
  SCUnitDetectSilence: require("./SCUnitDetectSilence"),
  SCUnitDgeom: require("./SCUnitDgeom"),
  SCUnitDibrown: require("./SCUnitDibrown"),
  SCUnitDiwhite: require("./SCUnitDiwhite"),
  SCUnitDrand: require("./SCUnitDrand"),
  SCUnitDreset: require("./SCUnitDreset"),
  SCUnitDseq: require("./SCUnitDseq"),
  SCUnitDser: require("./SCUnitDser"),
  SCUnitDseries: require("./SCUnitDseries"),
  SCUnitDshuf: require("./SCUnitDshuf"),
  SCUnitDstutter: require("./SCUnitDstutter"),
  SCUnitDswitch1: require("./SCUnitDswitch1"),
  SCUnitDswitch: require("./SCUnitDswitch"),
  SCUnitDust2: require("./SCUnitDust2"),
  SCUnitDust: require("./SCUnitDust"),
  SCUnitDuty: require("./SCUnitDuty"),
  SCUnitDwhite: require("./SCUnitDwhite"),
  SCUnitDwrand: require("./SCUnitDwrand"),
  SCUnitDxrand: require("./SCUnitDxrand"),
  SCUnitEnvGen: require("./SCUnitEnvGen"),
  SCUnitExpRand: require("./SCUnitExpRand"),
  SCUnitFold: require("./SCUnitFold"),
  SCUnitFormlet: require("./SCUnitFormlet"),
  SCUnitFOS: require("./SCUnitFOS"),
  SCUnitFreeVerb2: require("./SCUnitFreeVerb2"),
  SCUnitFreeVerb: require("./SCUnitFreeVerb"),
  SCUnitFSinOsc: require("./SCUnitFSinOsc"),
  SCUnitGate: require("./SCUnitGate"),
  SCUnitGrayNoise: require("./SCUnitGrayNoise"),
  SCUnitHasher: require("./SCUnitHasher"),
  SCUnitHPF: require("./SCUnitHPF"),
  SCUnitHPZ1: require("./SCUnitHPZ1"),
  SCUnitHPZ2: require("./SCUnitHPZ2"),
  SCUnitImpulse: require("./SCUnitImpulse"),
  SCUnitIn: require("./SCUnitIn"),
  SCUnitInRange: require("./SCUnitInRange"),
  SCUnitInRect: require("./SCUnitInRect"),
  SCUnitIntegrator: require("./SCUnitIntegrator"),
  SCUnitIRand: require("./SCUnitIRand"),
  SCUnitK2A: require("./SCUnitK2A"),
  SCUnitKeyState: require("./SCUnitKeyState"),
  SCUnitKlang: require("./SCUnitKlang"),
  SCUnitKlank: require("./SCUnitKlank"),
  SCUnitLag2: require("./SCUnitLag2"),
  SCUnitLag2UD: require("./SCUnitLag2UD"),
  SCUnitLag3: require("./SCUnitLag3"),
  SCUnitLag3UD: require("./SCUnitLag3UD"),
  SCUnitLag: require("./SCUnitLag"),
  SCUnitLagControl: require("./SCUnitLagControl"),
  SCUnitLagUD: require("./SCUnitLagUD"),
  SCUnitLastValue: require("./SCUnitLastValue"),
  SCUnitLatch: require("./SCUnitLatch"),
  SCUnitLeakDC: require("./SCUnitLeakDC"),
  SCUnitLeastChange: require("./SCUnitLeastChange"),
  SCUnitLFClipNoise: require("./SCUnitLFClipNoise"),
  SCUnitLFCub: require("./SCUnitLFCub"),
  SCUnitLFDClipNoise: require("./SCUnitLFDClipNoise"),
  SCUnitLFDNoise0: require("./SCUnitLFDNoise0"),
  SCUnitLFDNoise1: require("./SCUnitLFDNoise1"),
  SCUnitLFDNoise3: require("./SCUnitLFDNoise3"),
  SCUnitLFNoise0: require("./SCUnitLFNoise0"),
  SCUnitLFNoise1: require("./SCUnitLFNoise1"),
  SCUnitLFNoise2: require("./SCUnitLFNoise2"),
  SCUnitLFPar: require("./SCUnitLFPar"),
  SCUnitLFPulse: require("./SCUnitLFPulse"),
  SCUnitLFSaw: require("./SCUnitLFSaw"),
  SCUnitLFTri: require("./SCUnitLFTri"),
  SCUnitLimiter: require("./SCUnitLimiter"),
  SCUnitLine: require("./SCUnitLine"),
  SCUnitLinen: require("./SCUnitLinen"),
  SCUnitLinExp: require("./SCUnitLinExp"),
  SCUnitLinLin: require("./SCUnitLinLin"),
  SCUnitLinPan2: require("./SCUnitLinPan2"),
  SCUnitLinRand: require("./SCUnitLinRand"),
  SCUnitLinXFade2: require("./SCUnitLinXFade2"),
  SCUnitLogistic: require("./SCUnitLogistic"),
  SCUnitLPF: require("./SCUnitLPF"),
  SCUnitLPZ1: require("./SCUnitLPZ1"),
  SCUnitLPZ2: require("./SCUnitLPZ2"),
  SCUnitMantissaMask: require("./SCUnitMantissaMask"),
  SCUnitMedian: require("./SCUnitMedian"),
  SCUnitMidEQ: require("./SCUnitMidEQ"),
  SCUnitModDif: require("./SCUnitModDif"),
  SCUnitMostChange: require("./SCUnitMostChange"),
  SCUnitMouseButton: require("./SCUnitMouseButton"),
  SCUnitMouseX: require("./SCUnitMouseX"),
  SCUnitMouseY: require("./SCUnitMouseY"),
  SCUnitMulAdd: require("./SCUnitMulAdd"),
  SCUnitNormalizer: require("./SCUnitNormalizer"),
  SCUnitNRand: require("./SCUnitNRand"),
  SCUnitNumAudioBuses: require("./SCUnitNumAudioBuses"),
  SCUnitNumControlBuses: require("./SCUnitNumControlBuses"),
  SCUnitNumInputBuses: require("./SCUnitNumInputBuses"),
  SCUnitNumOutputBuses: require("./SCUnitNumOutputBuses"),
  SCUnitOffsetOut: require("./SCUnitOffsetOut"),
  SCUnitOnePole: require("./SCUnitOnePole"),
  SCUnitOneZero: require("./SCUnitOneZero"),
  SCUnitOut: require("./SCUnitOut"),
  SCUnitPan2: require("./SCUnitPan2"),
  SCUnitPeak: require("./SCUnitPeak"),
  SCUnitPeakFollower: require("./SCUnitPeakFollower"),
  SCUnitPhasor: require("./SCUnitPhasor"),
  SCUnitPinkNoise: require("./SCUnitPinkNoise"),
  SCUnitPulse: require("./SCUnitPulse"),
  SCUnitPulseCount: require("./SCUnitPulseCount"),
  SCUnitPulseDivider: require("./SCUnitPulseDivider"),
  SCUnitRadiansPerSample: require("./SCUnitRadiansPerSample"),
  SCUnitRamp: require("./SCUnitRamp"),
  SCUnitRand: require("./SCUnitRand"),
  SCUnitReplaceOut: require("./SCUnitReplaceOut"),
  SCUnitResonz: require("./SCUnitResonz"),
  SCUnitRHPF: require("./SCUnitRHPF"),
  SCUnitRingz: require("./SCUnitRingz"),
  SCUnitRLPF: require("./SCUnitRLPF"),
  SCUnitRotate2: require("./SCUnitRotate2"),
  SCUnitRunningMax: require("./SCUnitRunningMax"),
  SCUnitRunningMin: require("./SCUnitRunningMin"),
  SCUnitSampleDur: require("./SCUnitSampleDur"),
  SCUnitSampleRate: require("./SCUnitSampleRate"),
  SCUnitSaw: require("./SCUnitSaw"),
  SCUnitSchmidt: require("./SCUnitSchmidt"),
  SCUnitSelect: require("./SCUnitSelect"),
  SCUnitSetResetFF: require("./SCUnitSetResetFF"),
  SCUnitSinOsc: require("./SCUnitSinOsc"),
  SCUnitSinOscFB: require("./SCUnitSinOscFB"),
  SCUnitSlew: require("./SCUnitSlew"),
  SCUnitSlope: require("./SCUnitSlope"),
  SCUnitSOS: require("./SCUnitSOS"),
  SCUnitStepper: require("./SCUnitStepper"),
  SCUnitSubsampleOffset: require("./SCUnitSubsampleOffset"),
  SCUnitSum3: require("./SCUnitSum3"),
  SCUnitSum4: require("./SCUnitSum4"),
  SCUnitSweep: require("./SCUnitSweep"),
  SCUnitSyncSaw: require("./SCUnitSyncSaw"),
  SCUnitT2A: require("./SCUnitT2A"),
  SCUnitT2K: require("./SCUnitT2K"),
  SCUnitTDuty: require("./SCUnitTDuty"),
  SCUnitTExpRand: require("./SCUnitTExpRand"),
  SCUnitTimer: require("./SCUnitTimer"),
  SCUnitTIRand: require("./SCUnitTIRand"),
  SCUnitToggleFF: require("./SCUnitToggleFF"),
  SCUnitTRand: require("./SCUnitTRand"),
  SCUnitTrig1: require("./SCUnitTrig1"),
  SCUnitTrig: require("./SCUnitTrig"),
  SCUnitTrigControl: require("./SCUnitTrigControl"),
  SCUnitTrigImpulse: require("./SCUnitTrigImpulse"),
  SCUnitTWindex: require("./SCUnitTWindex"),
  SCUnitTwoPole: require("./SCUnitTwoPole"),
  SCUnitTwoZero: require("./SCUnitTwoZero"),
  SCUnitUnaryOpUGen: require("./SCUnitUnaryOpUGen"),
  SCUnitVarLag: require("./SCUnitVarLag"),
  SCUnitWhiteNoise: require("./SCUnitWhiteNoise"),
  SCUnitWrap: require("./SCUnitWrap"),
  SCUnitXFade2: require("./SCUnitXFade2"),
  SCUnitXLine: require("./SCUnitXLine"),
  SCUnitXOut: require("./SCUnitXOut"),
  SCUnitZeroCrossing: require("./SCUnitZeroCrossing")
};
},{"./SCUnitA2K":14,"./SCUnitAPF":15,"./SCUnitAllpassC":16,"./SCUnitAllpassL":17,"./SCUnitAllpassN":18,"./SCUnitAmpComp":19,"./SCUnitAmpCompA":20,"./SCUnitAmplitude":21,"./SCUnitBPF":22,"./SCUnitBPZ2":23,"./SCUnitBRF":24,"./SCUnitBRZ2":25,"./SCUnitBalance2":26,"./SCUnitBinaryOpUGen":27,"./SCUnitBlip":28,"./SCUnitBrownNoise":29,"./SCUnitClip":30,"./SCUnitClipNoise":31,"./SCUnitCoinGate":32,"./SCUnitCombC":33,"./SCUnitCombL":34,"./SCUnitCombN":35,"./SCUnitCompander":36,"./SCUnitControl":37,"./SCUnitControlDur":38,"./SCUnitControlRate":39,"./SCUnitCrackle":40,"./SCUnitDC":41,"./SCUnitDbrown":42,"./SCUnitDecay":43,"./SCUnitDecay2":44,"./SCUnitDelay1":45,"./SCUnitDelay2":46,"./SCUnitDelayC":47,"./SCUnitDelayL":48,"./SCUnitDelayN":49,"./SCUnitDemand":50,"./SCUnitDetectSilence":51,"./SCUnitDgeom":52,"./SCUnitDibrown":53,"./SCUnitDiwhite":54,"./SCUnitDrand":55,"./SCUnitDreset":56,"./SCUnitDseq":57,"./SCUnitDser":58,"./SCUnitDseries":59,"./SCUnitDshuf":60,"./SCUnitDstutter":61,"./SCUnitDswitch":62,"./SCUnitDswitch1":63,"./SCUnitDust":64,"./SCUnitDust2":65,"./SCUnitDuty":66,"./SCUnitDwhite":67,"./SCUnitDwrand":68,"./SCUnitDxrand":69,"./SCUnitEnvGen":70,"./SCUnitExpRand":71,"./SCUnitFOS":72,"./SCUnitFSinOsc":73,"./SCUnitFold":74,"./SCUnitFormlet":75,"./SCUnitFreeVerb":76,"./SCUnitFreeVerb2":77,"./SCUnitGate":78,"./SCUnitGrayNoise":79,"./SCUnitHPF":80,"./SCUnitHPZ1":81,"./SCUnitHPZ2":82,"./SCUnitHasher":83,"./SCUnitIRand":84,"./SCUnitImpulse":85,"./SCUnitIn":86,"./SCUnitInRange":87,"./SCUnitInRect":88,"./SCUnitIntegrator":89,"./SCUnitK2A":90,"./SCUnitKeyState":91,"./SCUnitKlang":92,"./SCUnitKlank":93,"./SCUnitLFClipNoise":94,"./SCUnitLFCub":95,"./SCUnitLFDClipNoise":96,"./SCUnitLFDNoise0":97,"./SCUnitLFDNoise1":98,"./SCUnitLFDNoise3":99,"./SCUnitLFNoise0":100,"./SCUnitLFNoise1":101,"./SCUnitLFNoise2":102,"./SCUnitLFPar":103,"./SCUnitLFPulse":104,"./SCUnitLFSaw":105,"./SCUnitLFTri":106,"./SCUnitLPF":107,"./SCUnitLPZ1":108,"./SCUnitLPZ2":109,"./SCUnitLag":110,"./SCUnitLag2":111,"./SCUnitLag2UD":112,"./SCUnitLag3":113,"./SCUnitLag3UD":114,"./SCUnitLagControl":115,"./SCUnitLagUD":116,"./SCUnitLastValue":117,"./SCUnitLatch":118,"./SCUnitLeakDC":119,"./SCUnitLeastChange":120,"./SCUnitLimiter":121,"./SCUnitLinExp":122,"./SCUnitLinLin":123,"./SCUnitLinPan2":124,"./SCUnitLinRand":125,"./SCUnitLinXFade2":126,"./SCUnitLine":127,"./SCUnitLinen":128,"./SCUnitLogistic":129,"./SCUnitMantissaMask":130,"./SCUnitMedian":131,"./SCUnitMidEQ":132,"./SCUnitModDif":133,"./SCUnitMostChange":134,"./SCUnitMouseButton":135,"./SCUnitMouseX":136,"./SCUnitMouseY":137,"./SCUnitMulAdd":138,"./SCUnitNRand":139,"./SCUnitNormalizer":140,"./SCUnitNumAudioBuses":141,"./SCUnitNumControlBuses":142,"./SCUnitNumInputBuses":143,"./SCUnitNumOutputBuses":144,"./SCUnitOffsetOut":145,"./SCUnitOnePole":146,"./SCUnitOneZero":147,"./SCUnitOut":148,"./SCUnitPan2":149,"./SCUnitPeak":150,"./SCUnitPeakFollower":151,"./SCUnitPhasor":152,"./SCUnitPinkNoise":153,"./SCUnitPulse":154,"./SCUnitPulseCount":155,"./SCUnitPulseDivider":156,"./SCUnitRHPF":157,"./SCUnitRLPF":158,"./SCUnitRadiansPerSample":159,"./SCUnitRamp":160,"./SCUnitRand":161,"./SCUnitReplaceOut":162,"./SCUnitResonz":163,"./SCUnitRingz":164,"./SCUnitRotate2":165,"./SCUnitRunningMax":166,"./SCUnitRunningMin":167,"./SCUnitSOS":168,"./SCUnitSampleDur":169,"./SCUnitSampleRate":170,"./SCUnitSaw":171,"./SCUnitSchmidt":172,"./SCUnitSelect":173,"./SCUnitSetResetFF":174,"./SCUnitSinOsc":175,"./SCUnitSinOscFB":176,"./SCUnitSlew":177,"./SCUnitSlope":178,"./SCUnitStepper":179,"./SCUnitSubsampleOffset":180,"./SCUnitSum3":181,"./SCUnitSum4":182,"./SCUnitSweep":183,"./SCUnitSyncSaw":184,"./SCUnitT2A":185,"./SCUnitT2K":186,"./SCUnitTDuty":187,"./SCUnitTExpRand":188,"./SCUnitTIRand":189,"./SCUnitTRand":190,"./SCUnitTWindex":191,"./SCUnitTimer":192,"./SCUnitToggleFF":193,"./SCUnitTrig":194,"./SCUnitTrig1":195,"./SCUnitTrigControl":196,"./SCUnitTrigImpulse":197,"./SCUnitTwoPole":198,"./SCUnitTwoZero":199,"./SCUnitUnaryOpUGen":200,"./SCUnitVarLag":201,"./SCUnitWhiteNoise":202,"./SCUnitWrap":203,"./SCUnitXFade2":204,"./SCUnitXLine":205,"./SCUnitXOut":206,"./SCUnitZeroCrossing":207}],212:[function(require,module,exports){
"use strict";

function clamp(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(value, maxValue));
}

module.exports = clamp;
},{}],213:[function(require,module,exports){
"use strict";

function fill(list, value) {
  if (list.fill) {
    return list.fill(value);
  }

  for (var i = 0, imax = list.length; i < imax; i++) {
    list[i] = value;
  }

  return list;
}

module.exports = fill;
},{}],214:[function(require,module,exports){
"use strict";

function fillRange(list, value, start, end) {
  if (list.fill) {
    return list.fill(value, start, end);
  }

  for (var i = start; i < end; i++) {
    list[i] = value;
  }

  return list;
}

module.exports = fillRange;
},{}],215:[function(require,module,exports){
"use strict";

module.exports.clamp = require("./clamp");
module.exports.fill = require("./fill");
module.exports.fillRange = require("./fillRange");
module.exports.sc_cubicinterp = require("./sc_cubicinterp");
module.exports.sc_exprandrange = require("./sc_exprandrange");
module.exports.sc_fold = require("./sc_fold");
module.exports.sc_randrange = require("./sc_randrange");
module.exports.sc_wrap = require("./sc_wrap");
module.exports.toNumber = require("./toNumber");
module.exports.toPowerOfTwo = require("./toPowerOfTwo");
module.exports.toValidBlockSize = require("./toValidBlockSize");
module.exports.toValidNumberOfAudioBus = require("./toValidNumberOfAudioBus");
module.exports.toValidNumberOfChannels = require("./toValidNumberOfChannels");
module.exports.toValidNumberOfControlBus = require("./toValidNumberOfControlBus");
module.exports.toValidSampleRate = require("./toValidSampleRate");
},{"./clamp":212,"./fill":213,"./fillRange":214,"./sc_cubicinterp":216,"./sc_exprandrange":217,"./sc_fold":218,"./sc_randrange":219,"./sc_wrap":220,"./toNumber":221,"./toPowerOfTwo":222,"./toValidBlockSize":223,"./toValidNumberOfAudioBus":224,"./toValidNumberOfChannels":225,"./toValidNumberOfControlBus":226,"./toValidSampleRate":227}],216:[function(require,module,exports){
"use strict";

function cubicinterp(x, y0, y1, y2, y3) {
  var c0 = y1;
  var c1 = 0.5 * (y2 - y0);
  var c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
  var c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);

  return ((c3 * x + c2) * x + c1) * x + c0;
}

module.exports = cubicinterp;
},{}],217:[function(require,module,exports){
"use strict";

function sc_exprandrange(a, b) {
  if (a < b) {
    return a * Math.exp(Math.log(b / a) * Math.random());
  }
  return b * Math.exp(Math.log(a / b) * Math.random());
}

module.exports = sc_exprandrange;
},{}],218:[function(require,module,exports){
"use strict";

function fold(val, lo, hi) {
  if (hi === lo) {
    return lo;
  }

  if (val >= hi) {
    val = hi * 2 - val;
    if (val >= lo) {
      return val;
    }
  } else if (val < lo) {
    val = lo * 2 - val;
    if (val < hi) {
      return val;
    }
  } else {
    return val;
  }

  var range1 = hi - lo;
  var range2 = range1 * 2;

  var x = val - lo;

  x -= range2 * Math.floor(x / range2);

  if (x >= range1) {
    return range2 - x + lo;
  }

  return x + lo;
}

module.exports = fold;
},{}],219:[function(require,module,exports){
"use strict";

function sc_randrange(a, b) {
  if (a < b) {
    return Math.random() * (b - a) + a;
  }
  return Math.random() * (a - b) + b;
}

module.exports = sc_randrange;
},{}],220:[function(require,module,exports){
"use strict";

function wrap(val, lo, hi) {
  if (hi === lo) {
    return lo;
  }

  var range = hi - lo;

  if (val >= hi) {
    val -= range;
    if (val < hi) {
      return val;
    }
  } else if (val < lo) {
    val += range;
    if (val >= lo) {
      return val;
    }
  } else {
    return val;
  }

  return val - range * Math.floor((val - lo) / range);
}

module.exports = wrap;
},{}],221:[function(require,module,exports){
"use strict";

function toNumber(value) {
  return +value || 0;
}

module.exports = toNumber;
},{}],222:[function(require,module,exports){
"use strict";

function toPowerOfTwo(value, round) {
  round = round || Math.round;
  return 1 << round(Math.log(value) / Math.log(2));
}

module.exports = toPowerOfTwo;
},{}],223:[function(require,module,exports){
"use strict";

var clamp = require("./clamp");
var toPowerOfTwo = require("./toPowerOfTwo");
var MIN_BLOCK_SIZE = 8;
var MAX_BLOCK_SIZE = 1024;

function toValidBlockSize(value) {
  return clamp(toPowerOfTwo(value), MIN_BLOCK_SIZE, MAX_BLOCK_SIZE);
}

module.exports = toValidBlockSize;
},{"./clamp":212,"./toPowerOfTwo":222}],224:[function(require,module,exports){
"use strict";

var toNumber = require("./toNumber");
var clamp = require("./clamp");

var MIN_NUMBER_OF_AUDIO_BUS = 2;
var MAX_NUMBER_OF_AUDIO_BUS = 1024;

function toValidNumberOfAudioBus(value) {
  return clamp(toNumber(value), MIN_NUMBER_OF_AUDIO_BUS, MAX_NUMBER_OF_AUDIO_BUS) | 0;
}

module.exports = toValidNumberOfAudioBus;
},{"./clamp":212,"./toNumber":221}],225:[function(require,module,exports){
"use strict";

var toNumber = require("./toNumber");
var clamp = require("./clamp");

var MAX_NUMBER_OF_CHANNELS = 32;

function toValidNumberOfChannels(value) {
  return clamp(toNumber(value), 1, MAX_NUMBER_OF_CHANNELS) | 0;
}

module.exports = toValidNumberOfChannels;
},{"./clamp":212,"./toNumber":221}],226:[function(require,module,exports){
"use strict";

var toNumber = require("./toNumber");
var clamp = require("./clamp");

var MIN_NUMBER_OF_AUDIO_BUS = 2;
var MAX_NUMBER_OF_AUDIO_BUS = 1024;

function toValidNumberOfControlBus(value) {
  return clamp(toNumber(value), MIN_NUMBER_OF_AUDIO_BUS, MAX_NUMBER_OF_AUDIO_BUS) | 0;
}

module.exports = toValidNumberOfControlBus;
},{"./clamp":212,"./toNumber":221}],227:[function(require,module,exports){
"use strict";

var toNumber = require("./toNumber");
var clamp = require("./clamp");

var MIN_SAMPLERATE = 3000;
var MAX_SAMPLERATE = 192000;

function toValidSampleRate(value) {
  return clamp(toNumber(value), MIN_SAMPLERATE, MAX_SAMPLERATE) | 0;
}

module.exports = toValidSampleRate;
},{"./clamp":212,"./toNumber":221}],228:[function(require,module,exports){
'use strict';

/**
 * Randomize the order of the elements in a given array.
 * @param {Array} arr - The given array.
 * @param {Object} [options] - Optional configuration options.
 * @param {Boolean} [options.copy] - Sets if should return a shuffled copy of the given array. By default it's a falsy value.
 * @param {Function} [options.rng] - Specifies a custom random number generator.
 * @returns {Array}
 */
function shuffle(arr, options) {

  if (!Array.isArray(arr)) {
    throw new Error('shuffle expect an array as parameter.');
  }

  options = options || {};

  var collection = arr,
      len = arr.length,
      rng = options.rng || Math.random,
      random,
      temp;

  if (options.copy === true) {
    collection = arr.slice();
  }

  while (len) {
    random = Math.floor(rng() * len);
    len -= 1;
    temp = collection[len];
    collection[len] = collection[random];
    collection[random] = temp;
  }

  return collection;
};

/**
 * Pick one or more random elements from the given array.
 * @param {Array} arr - The given array.
 * @param {Object} [options] - Optional configuration options.
 * @param {Number} [options.picks] - Specifies how many random elements you want to pick. By default it picks 1.
 * @param {Function} [options.rng] - Specifies a custom random number generator.
 * @returns {Object}
 */
shuffle.pick = function(arr, options) {

  if (!Array.isArray(arr)) {
    throw new Error('shuffle.pick() expect an array as parameter.');
  }

  options = options || {};

  var rng = options.rng || Math.random,
      picks = options.picks || 1;

  if (typeof picks === 'number' && picks !== 1) {
    var len = arr.length,
        collection = arr.slice(),
        random = [],
        index;

    while (picks && len) {
      index = Math.floor(rng() * len);
      random.push(collection[index]);
      collection.splice(index, 1);
      len -= 1;
      picks -= 1;
    }

    return random;
  }

  return arr[Math.floor(rng() * arr.length)];
};

/**
 * Expose
 */
module.exports = shuffle;

},{}],229:[function(require,module,exports){
(function (global){
"use strict";

var scsynth = require("scsynth");
var _scsynth$Constants = scsynth.Constants;
var UI_MOUSE_X = _scsynth$Constants.UI_MOUSE_X;
var UI_MOUSE_Y = _scsynth$Constants.UI_MOUSE_Y;
var UI_MOUSE_BUTTON = _scsynth$Constants.UI_MOUSE_BUTTON;


var context = null;
var synth = null;
var buffers = null;
var rIndex = 0;
var wIndex = 0;
var synthdef = null;
var running = false;

global.onmessage = function (e) {
  recvMessage(e.data);
};

function loop() {
  if (!running) {
    return;
  }
  if (buffers[rIndex]) {
    var buffer = buffers[rIndex];
    var blockSize = context.blockSize;
    var bufferLength = buffer.length / 2;
    var imax = bufferLength / blockSize;

    for (var i = 0; i < imax; i++) {
      context.process();
      buffer.set(context.outputs[0], blockSize * i);
      buffer.set(context.outputs[1], blockSize * i + bufferLength);
    }

    global.postMessage(buffer, [buffer.buffer]);
    buffers[rIndex] = null;
    rIndex = (rIndex + 1) % buffers.length;
  }
  setTimeout(loop, 0);
}

function recvMessage(data) {
  if (data instanceof Float32Array) {
    buffers[wIndex] = data;
    wIndex = (wIndex + 1) % buffers.length;
    return;
  }
  if (data.type === "init" && context === null) {
    context = new scsynth.SCContext({ sampleRate: data.value.sampleRate });
    buffers = Array.from({ length: data.value.bufferSlots }, function () {
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
      var values = Array.prototype.slice.call(data.value, 0, synth.params.length);

      synth.params.set(values);
    }
    if (data.type === "mousestate") {
      context.uiValues[UI_MOUSE_X] = data.value.x;
      context.uiValues[UI_MOUSE_Y] = data.value.y;
      context.uiValues[UI_MOUSE_BUTTON] = data.value.button;
    }
  }
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"scsynth":13}]},{},[229]);
