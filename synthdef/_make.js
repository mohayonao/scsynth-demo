"use strict";

const path = require("path");
const fs = require("fs");
const decoder = require("synthdef-decoder");
const flatten = require("lodash.flattendeep");
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

function spc(n) {
  return " ".repeat(n);
}

function formatSpec(specs) {
  Array.from({ length: Math.max(...specs.map(x => x[3].length)) }).forEach((_, i) => {
    const pad = [ 0, 1 ].map(j => Math.max(...flatten(specs.map(spec => spec[3][i] ? spec[3][i][j].toString().length : 0))));

    specs.forEach((spec) => {
      if (spec[3][i]) {
        spec[3][i] = "[ " + spec[3][i].map((x, j) => spc(pad[j] - x.toString().length) + x.toString()).join(", ") + " ]";
      }
    });
  });

  const maxNameLength = Math.max(...specs.map(x => x[0].length));
  const maxSpecialIndexLength = Math.max(...specs.map(x => x[2].toString().length));
  const maxOutputSpecParamLength = Math.max(...flatten(specs.map(x => x[4].map(y => y.toString().length))));

  specs.forEach((spec) => {
    spec[0] = '"' + spec[0] + '"' + spc(maxNameLength - spec[0].length);
    spec[2] = spc(maxSpecialIndexLength - spec[2].toString().length) + spec[2].toString();
    spec[3] = spec[3].join(", ");
    spec[4] = spec[4].map(x => spc(maxOutputSpecParamLength - x.toString().length) + x.toString()).join(", ");
  });

  const maxInputSpecLength = Math.max(...specs.map(x => x[3].length));
  const maxOutputSpecLength = Math.max(...specs.map(x => x[4].length));

  specs.forEach((spec) => {
    spec[3] = "[ " + spec[3] + spc(maxInputSpecLength - spec[3].length) + " ]";
    spec[4] = "[ " + spec[4] + spc(maxOutputSpecLength - spec[4].length) + " ]";
  });

  return specs.map(([ name, rate, specialIndex, inputs, outputs ]) => {
    return `[ ${ name }, ${ rate }, ${ specialIndex }, ${ inputs }, ${ outputs } ]`;
  }).join(",\n").replace(/^/mg, "    ");
}

fs.readdirSync(__dirname).filter(filename => /\.scsyndef$/.test(filename)).forEach((filename) => {
  const name = filename.replace(/\.scsyndef$/, "");
  const data = fs.readFileSync(path.join(__dirname, name + ".scsyndef"));
  const buffer = new Uint8Array(data).buffer;
  const json = decoder.decode(buffer)[0];

  global.console.log(name)

  const text = format(json);

  list.push(name);

  fs.writeFileSync(path.join(__dirname, name + ".json"), text);
});

fs.writeFileSync(path.join(__dirname, "list.json"), JSON.stringify(list));
