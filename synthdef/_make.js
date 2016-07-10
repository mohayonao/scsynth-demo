"use strict";

const path = require("path");
const fs = require("fs");
const decoder = require("synthdef-decoder");
const list = [];

function format(synthdef) {
  return `{
  "name": "${ synthdef.name }",
  "consts": [ ${ synthdef.consts.join(", ") } ],
  "paramValues": ${ JSON.stringify(synthdef.paramValues) },
  "paramIndices": ${ JSON.stringify(synthdef.paramIndices) },
  "specs": [
${ formatSpec(synthdef.specs) }
  ]
}`;
}

function formatSpec(specs) {
  return specs.map(([ name, rate, specialIndex, inputs, outputs ]) => {
    return `[ "${ name }", ${ rate }, ${ specialIndex }, ${ JSON.stringify(inputs) }, ${ JSON.stringify(outputs) } ]`;
  }).join(",\n").replace(/^/mg, "    ");
}

fs.readdirSync(__dirname).filter(filename => /\.scsyndef$/.test(filename)).forEach((filename) => {
  const name = filename.replace(/\.scsyndef$/, "");
  const data = fs.readFileSync(path.join(__dirname, name + ".scsyndef"));
  const buffer = new Uint8Array(data).buffer;
  const json = decoder.decode(buffer)[0];
  const text = format(json);

  list.push(name);

  fs.writeFileSync(path.join(__dirname, name + ".json"), text);
});

fs.writeFileSync(path.join(__dirname, "list.json"), JSON.stringify(list));
