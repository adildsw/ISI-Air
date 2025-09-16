// npy-rw.js
// READ AND WRITE .NPY (NUMPY) FILES
// Lingdong Huang 2019

// npy specs: https://numpy.org/devdocs/reference/generated/numpy.lib.format.html
// reference: https://gist.github.com/nvictus/88b3b5bfe587d32ac1ab519fd0009607

const is_node = (typeof process !== 'undefined')
var npy = {};

if (is_node){
  var fs = require('fs');
}

const descrToConstructor = {
  "|u1":Uint8Array,
  "|i1":Int8Array,
  "<u2":Uint16Array,
  "<i2":Int16Array,
  "<u4":Uint32Array,
  "<i4":Int32Array,
  "<f4":Float32Array,
  "<f8":Float64Array,
}
const constructorNameToDescr = Object.fromEntries(Object.entries(descrToConstructor).map(x=>[x[1].name,x[0]]));
constructorNameToDescr["Uint8ClampedArray"]="|u1"

const constructorNameToNumBytes = {
  "Uint8Array":1,
  "Int8Array":1,
  "Uint16Array":2,
  "Int16Array":2,
  "Uint32Array":4,
  "Int32Array":4,
  "Float32Array":4,
  "Float64Array":8,
}

const printbuffer = function(buf){ // for debugging *small* buffers
  console.log(Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2)).join(" "))
}

npy.frombuffer = function(buf) {
  // adapted from: https://gist.github.com/nvictus/88b3b5bfe587d32ac1ab519fd0009607
  function asciiDecode(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
  }

  function readUint16LE(buffer) {
    var view = new DataView(buffer);
    var val = view.getUint8(0);
    val |= view.getUint8(1) << 8;
    return val;
  }

  // Check the magic number
  var magic = asciiDecode(buf.slice(0, 6));
  if (magic.slice(1, 6) != 'NUMPY') {
    throw new Error('unknown file type');
  }
  var version = new Uint8Array(buf.slice(6, 8))
  var headerLength = readUint16LE(buf.slice(8, 10))

  var headerStr = asciiDecode(buf.slice(10, 10 + headerLength))
  var offsetBytes = 10 + headerLength;

  // a less hacky hack
  var info = JSON.parse(headerStr.toLowerCase().replace('(', '[').replace(/\,*\)\,*/g, ']').replace(/'/g,"\""));
  // Intepret the bytes according to the specified dtype
  var Typ = descrToConstructor[info.descr];
  if (!Typ){
    throw new Error('dtype not supported')
  }
  var data = new Typ(buf, offsetBytes);

  return {
    shape: info.shape,
    fortran_order: info.fortran_order,
    data: data
  };
}

npy.tobuffer = function(ndarray){
  var data = ndarray.data;
  var shape = ndarray.shape;
  var Typ = data.constructor
  var dtype_bytes = constructorNameToNumBytes[Typ.name];

  var headerStr = `{'descr': '${constructorNameToDescr[data.constructor.name]}', 'fortran_order': ${['False','True'][Number(ndarray.fortran_order)]}, 'shape': (${shape.join(", ")},), } `
  
  // 64-byte alignment requirement
  var p = 0; while ((headerStr.length+10+p) % 64 != 0){p += 1;}

  var headlen = headerStr.length+p;
  var metalen = headlen+10;

  // entire buffer contianing meta info and the data
  var buf = new ArrayBuffer(metalen+data.length*dtype_bytes);

  var view = new DataView(buf);

  //magic
  view.setUint8(0,147); // \x93
  view.setUint8(1,78); // N
  view.setUint8(2,85); // U
  view.setUint8(3,77); // M
  view.setUint8(4,80); // P
  view.setUint8(5,89); // Y

  //version
  view.setUint8(6,1);
  view.setUint8(7,0);

  //HEADER_LEN (little endian)
  var n = ((headlen << 8) & 0xFF00) | ((headlen >> 8) & 0xFF)
  view.setUint16(8,n);

  for (var i = 0; i < headlen; i++){
    if (i < headerStr.length){
      view.setUint8(10+i, headerStr.charCodeAt(i));
    }else if (i == headlen-1){
      view.setUint8(10+i, 0x0a); //newline terminated
    }else{
      view.setUint8(10+i, 0x20); //space pad
    }
  }
  // pretend the entire buffer is the same type as the TypedArray
  // and modify the underlying data
  new Typ(buf).set(data,metalen/dtype_bytes);

  return buf;

}

if (is_node){
  npy.load = function(path){
    var buf = (new Uint8Array(fs.readFileSync(path))).buffer;
    return npy.frombuffer(buf);
  }
  npy.save = function(path,ndarray){
    var buf = Buffer.from(npy.tobuffer(ndarray));
    fs.writeFileSync(path,buf);
  }
}

if (is_node){
  module.exports = npy
}