const canvasSketch = require("canvas-sketch");

const createRegl = require("regl");
const createPrimitive = require("primitive-icosphere");
const createCamera = require("perspective-camera");
const glslify = require("glslify");
const hexRgb = require("hex-rgb");

const hexToRGB = (hex) => {
  const rgba = hexRgb(hex, { format: "array" });
  return rgba.slice(0, 3).map((n) => n / 255);
};

const settings = {
  dimensions: [2048, 2048],
  pixelsPerInch: 300,
  exportPixelRatio: 2,
  animate: true,
  duration: 10,
  fps: 24,
  context: "webgl",
  attributes: {
    antialias: true,
  },
};

const sketch = ({ gl, canvasWidth, canvasHeight }) => {
  const color = "#ffff";
  const foregroundRGB = hexToRGB(color);
  const backgroundRGBA = [...foregroundRGB, 1.0];

  const regl = createRegl({ gl });

  const sphere = createPrimitive(1, { subdivisions: 5 });

  const camera = createCamera({
    fov: (45 * Math.PI) / 180,
  });

  camera.translate([0, 0, 6]);
  camera.lookAt([0, 0, 0]);
  camera.update();

  const drawMesh = regl({
    frag: glslify(`
      precision highp float;
      uniform vec3 color;
      uniform float time;
      uniform vec2 resolution;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 screenUV;

      #pragma glslify: dither = require('glsl-dither/4x4');

      void main () {
        // Spin light around a bit
        float angle = sin(time * 0.25) * 2.0 + 3.14 * 0.5;
        vec3 lightPosition = vec3(cos(angle), sin(time * 1.0), sin(angle));
        vec3 L = normalize(lightPosition);
        vec3 N = normalize(vNormal);

        // Get diffuse contribution
        float diffuse = max(0.0, dot(N, L));
        diffuse = smoothstep(0.0, 1.25, diffuse);
        diffuse = pow(diffuse, 0.25);
        diffuse *= max(0.0, 1.0 - distance(vPosition, lightPosition) / 2.0) * 1.0;
        diffuse += pow(vNormal.z, 0.95) * 0.05;
        diffuse = clamp(diffuse, 0.0, 1.0);

        float ditherSize = 300.0;
        diffuse = dither(gl_FragCoord.xy / resolution.xy * ditherSize, diffuse);
        
        gl_FragColor = vec4(color * diffuse, 1.0);
      }
    `),
    vert: glslify(`
      precision highp float;
      attribute vec3 position;
      uniform mat4 projectionMatrix;
      uniform mat4 modelViewMatrix;
      uniform float time;
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying vec2 screenUV;

      #pragma glslify: noise = require('glsl-noise/classic/4d');

      void main () {
        // Get initial normal
        vNormal = normalize(position);

        // Contribute noise
        vec3 pos = position;
        pos *= 1.6;

        // Update normal
        vNormal = normalize(pos);
        vPosition = pos;

        // Final position
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos.xyz, 1.0);
        screenUV = gl_Position.xy;
      }
    `),
    uniforms: {
      projectionMatrix: regl.prop("projectionMatrix"),
      modelViewMatrix: regl.prop("modelViewMatrix"),
      color: foregroundRGB,
      resolution: [canvasWidth, canvasHeight],
      time: regl.prop("time"),
    },
    attributes: {
      position: regl.buffer(sphere.positions),
      normal: regl.buffer(sphere.normals),
    },
    elements: regl.elements(sphere.cells),
  });

  return ({ viewportWidth, viewportHeight, time, playhead }) => {
    regl.poll();

    regl.clear({
      color: backgroundRGBA,
      depth: 1,
      stencil: 0,
    });

    camera.viewport = [0, 0, viewportWidth, viewportHeight];
    camera.update();

    drawMesh({
      projectionMatrix: camera.projection,
      modelViewMatrix: camera.view,
      time,
    });
  };
};

canvasSketch(sketch, settings);