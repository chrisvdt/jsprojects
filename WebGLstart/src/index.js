// npm i webgl-obj-loader
var mat4 = require('gl-matrix-mat4');
var OBJ = require('webgl-obj-loader');
import {vsSource, fsSource} from './shaders.js'

var cubeRotation = 0.0;

window.onload = function(){
  OBJ.downloadMeshes({
    'sphere': 'assets/head2.obj',
    'env'   : 'assets/env.obj'
  }, main);
}

var app = {};
    app.meshes = {};
    app.proginfo = {};
    app.texture = [];
//
// Start here
//
function main(meshes) {
  const canvas = document.querySelector("#glCanvas");
  const gl = canvas.getContext("webgl");

  // If we don't have a GL context, give up now

  if (!gl) {
    alert(
      "Unable to initialize WebGL. Your browser or machine may not support it."
    );
    return;
  }

  // Initialize a shader program; this is where all the lighting
  // for the vertices and so forth is established.
  const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

  // Collect all the info needed to use the shader program.
  // Look up which attributes our shader program is using
  // for aVertexPosition, aTextureCoord and also
  // look up uniform locations.
  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
      vertexNormal: gl.getAttribLocation(shaderProgram, "aVertexNormal"),
      textureCoord: gl.getAttribLocation(shaderProgram, "aTextureCoord"),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(
        shaderProgram,
        "uProjectionMatrix"
      ),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, "uModelViewMatrix"),
      normalMatrix: gl.getUniformLocation(shaderProgram, "uNormalMatrix"),
      uSampler: gl.getUniformLocation(shaderProgram, "uSampler"),
    },
  };

  app.progInfo = programInfo;
  // Here's where we call the routine that builds all the
  // objects we'll be drawing.
  //const buffers = initBuffers(gl);
  OBJ.initMeshBuffers(gl, meshes.sphere);
  OBJ.initMeshBuffers(gl, meshes.env);

  const text1 = loadTexture(gl, "assets/cubetexture.png");
  const text2 = loadTexture(gl, "assets/room.png");

  meshes.sphere.texture = text1;
  meshes.env.texture = text2;
  app.meshes = meshes;

  // Browsers copy pixels from the loaded image in top-to-bottom order ???
  // from the top-left corner; but WebGL wants the pixels in bottom-to-top
  // order ??? starting from the bottom-left corner. So in order to prevent
  // the resulting image texture from having the wrong orientation when
  // rendered, we need to make the following call, to cause the pixels to
  // be flipped into the bottom-to-top order that WebGL expects.
  // See jameshfisher.com/2020/10/22/why-is-my-webgl-texture-upside-down
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    // Create a perspective matrix, a special matrix that is
  const fieldOfView = (45 * Math.PI) / 180; // in radians
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const zNear = 0.1;
  const zFar = 1000.0;
  const projectionMatrix = mat4.create();

  // note: glmatrix.js always has the first argument
  // as the destination to receive the result.
  mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

  app.projectionMatrix = projectionMatrix;

  var then = 0;
  // Draw the scene repeatedly
  function render(now) {
    now *= 0.001; // convert to seconds
    const deltaTime = now - then;
    then = now;

    drawScene(gl, app, deltaTime);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

//
// Initialize a texture and load an image.
// When the image finished loading copy it into the texture.
//
function loadTexture(gl, url) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Because images have to be download over the internet
  // they might take a moment until they are ready.
  // Until then put a single pixel in the texture so we can
  // use it immediately. When the image has finished downloading
  // we'll update the texture with the contents of the image.
  const level = 0;
  const internalFormat = gl.RGBA;
  const width = 1;
  const height = 1;
  const border = 0;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  const pixel = new Uint8Array([0, 0, 255, 255]); // opaque blue
  gl.texImage2D(
    gl.TEXTURE_2D,
    level,
    internalFormat,
    width,
    height,
    border,
    srcFormat,
    srcType,
    pixel
  );

  const image = new Image();
  image.onload = function () {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      level,
      internalFormat,
      srcFormat,
      srcType,
      image
    );

    // WebGL1 has different requirements for power of 2 images
    // vs non power of 2 images so check if the image is a
    // power of 2 in both dimensions.
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
      // Yes, it's a power of 2. Generate mips.
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      // No, it's not a power of 2. Turn of mips and set
      // wrapping to clamp to edge
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
  };
  image.src = url;

  return texture;
}

function isPowerOf2(value) {
  return (value & (value - 1)) == 0;
}

//
// Draw the scene.
//
function drawScene(gl, app, deltaTime) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black, fully opaque
  gl.clearDepth(1.0); // Clear everything
  gl.enable(gl.DEPTH_TEST); // Enable depth testing
  gl.depthFunc(gl.LEQUAL); // Near things obscure far things

  // Clear the canvas before we start drawing on it.

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Set the drawing position to the "identity" point, which is
  // the center of the scene.
  let modelViewMatrix = mat4.create();
  let normalMatrix = mat4.create();
  let rotMatrix = mat4.create();
  // Now move the drawing position a bit to where we want to
  // start drawing the square.

  mat4.scale(modelViewMatrix, modelViewMatrix, [2.0, 2.0, 2.0]);

  mat4.translate(
    modelViewMatrix, // destination matrix
    modelViewMatrix, // matrix to translate
    [0.0, 0.0, -30.0]
  ); 

  mat4.rotate(
    rotMatrix, // destination matrix
    rotMatrix, // matrix to rotate
    cubeRotation * -0.1, // amount to rotate in radians
    [0, 1, 0]
  ); // axis to rotate around (Z)
  mat4.multiply(modelViewMatrix, modelViewMatrix, rotMatrix);
  app.modelViewMatrix = modelViewMatrix;

  mat4.multiply(normalMatrix, normalMatrix, rotMatrix);

  app.modelViewMatrix = modelViewMatrix;
  app.normalMatrix = normalMatrix;
  renderObject(gl, app.progInfo, app.meshes.env)

  rotMatrix = mat4.create();
  modelViewMatrix = mat4.create();
  normalMatrix = mat4.create();
  // amount to translate
  mat4.translate(
    modelViewMatrix, // destination matrix
    modelViewMatrix, // matrix to translate
    [0.0, 0.0, -10.0]
  ); // amount to translate


  mat4.rotate(
    rotMatrix, // destination matrix
    rotMatrix, // matrix to rotate
    cubeRotation * 0.3, // amount to rotate in radians
    [0, 0, 1]
  ); // axis to rotate around (Z)
  mat4.rotate(
    rotMatrix, // destination matrix
    rotMatrix, // matrix to rotate
    cubeRotation * 0.2, // amount to rotate in radians
    [1, 0, 0]
  ); // axis to rotate around (Z)
  mat4.rotate(
    rotMatrix, // destination matrix
    rotMatrix, // matrix to rotate
    cubeRotation * 0.1, // amount to rotate in radians
    [0, 1, 0]
  ); // axis to rotate around (X)
 
  mat4.multiply(modelViewMatrix, modelViewMatrix, rotMatrix);
  app.modelViewMatrix = modelViewMatrix;

  mat4.multiply(normalMatrix, normalMatrix, rotMatrix);
  app.normalMatrix = normalMatrix;
// (AN)??(BV) = 0
// transpose(N)*transpose(A)*B*V = 0 ==> transpose(A)*B = identity
// A = transpose(inverse(B))
 // mat4.invert(normalMatrix, modelViewMatrix);
 // mat4.transpose(normalMatrix, normalMatrix);

  // Tell WebGL how to pull out the positions from the position
  // buffer into the vertexPosition attribute

  renderObject(gl, app.progInfo, app.meshes.sphere)
  // Update the rotation for the next draw

  cubeRotation += deltaTime;
}

function renderObject(gl, programInfo, Object) {

  {
    const numComponents = 3;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, Object.vertexBuffer);
    gl.vertexAttribPointer(
      programInfo.attribLocations.vertexPosition,
      numComponents,
      type,
      normalize,
      stride,
      offset
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
  }

  // Tell WebGL how to pull out the texture coordinates from
  // the texture coordinate buffer into the textureCoord attribute.
  {
    const numComponents = 2;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, Object.textureBuffer);
    gl.vertexAttribPointer(
      programInfo.attribLocations.textureCoord,
      numComponents,
      type,
      normalize,
      stride,
      offset
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);
  }

  // Tell WebGL how to pull out the normals from
  // the normal buffer into the vertexNormal attribute.
  {
    const numComponents = 3;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, Object.normalBuffer);
    gl.vertexAttribPointer(
      programInfo.attribLocations.vertexNormal,
      numComponents,
      type,
      normalize,
      stride,
      offset
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);
  }

  // Tell WebGL which indices to use to index the vertices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, Object.indexBuffer);

  // Tell WebGL to use our program when drawing

  gl.useProgram(programInfo.program);

  // Set the shader uniforms

  gl.uniformMatrix4fv(
    programInfo.uniformLocations.projectionMatrix,
    false,
    app.projectionMatrix
  );
  gl.uniformMatrix4fv(
    programInfo.uniformLocations.modelViewMatrix,
    false,
    app.modelViewMatrix
  );
  gl.uniformMatrix4fv(
    programInfo.uniformLocations.normalMatrix,
    false,
    app.normalMatrix
  );
  // Specify the texture to map onto the faces.

  // Tell WebGL we want to affect texture unit 0
  gl.activeTexture(gl.TEXTURE0);
  // Bind the texture to texture unit 0
  gl.bindTexture(gl.TEXTURE_2D, Object.texture);
  // Tell the shader we bound the texture to texture unit 0
  gl.uniform1i(programInfo.uniformLocations.uSampler, 0);

  {
    const vertexCount = Object.indices.length;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
  }

}
//
// Initialize a shader program, so WebGL knows how to draw our data
//
function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  // Create the shader program

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  // If creating the shader program failed, alert

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert(
      "Unable to initialize the shader program: " +
        gl.getProgramInfoLog(shaderProgram)
    );
    return null;
  }

  return shaderProgram;
}

//
// creates a shader of the given type, uploads the source and
// compiles it.
//
function loadShader(gl, type, source) {
  const shader = gl.createShader(type);

  // Send the source to the shader object

  gl.shaderSource(shader, source);

  // Compile the shader program

  gl.compileShader(shader);

  // See if it compiled successfully

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(
      "An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader)
    );
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}