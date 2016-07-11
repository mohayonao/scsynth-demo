"use strict";

const path = require("path");
const fs = require("fs");
const decoder = require("synthdef-decoder");
const formatter = require("synthdef-json-formatter");
const list = [];

fs.readdirSync(__dirname).filter(filename => /\.scsyndef$/.test(filename)).forEach((filename) => {
  const name = filename.replace(/\.scsyndef$/, "");
  const data = fs.readFileSync(path.join(__dirname, name + ".scsyndef"));
  const buffer = new Uint8Array(data).buffer;
  const json = decoder.decode(buffer)[0];

  global.console.log(name)
  list.push(name);

  fs.writeFileSync(path.join(__dirname, name + ".json"), formatter.format(json));
});

fs.writeFileSync(path.join(__dirname, "list.json"), JSON.stringify(list));
