/* ===========================================================
   hearthlyapps — persistent 3D world
   One Three.js scene, rendered on a single fixed full-viewport canvas that
   never scrolls with the page, hosts three things together so lighting and
   style stay consistent across all of them (the actual reason this replaced
   the earlier version's separate CSS phone + flat SVG icons + CSS gradient
   background — three different rendering systems can't share one light
   source or color grade):

   1. An animated nebula/aurora background (a shader on the inside of a
      giant sphere around the camera), reacting to mouse position and
      scroll.
   2. A 3D phone, built from primitives (not a sourced/scanned model, to
      keep this dependency-free and license-clean), with the real Sustain
      screenshots texture-mapped onto its screen. It's on screen for the
      entire page, not just one section: big and centered in the hero,
      full choreography during a .reel-track, then docked small in a
      corner, gently spinning, for the rest of the page.
   3. Five themed 3D objects (pen, plate, scale, capsule, leaf) built the
      same way, one per .reel-track step, flying in from off-frame, holding
      beside the phone in sync with its screen + the caption text, then
      flying on through as the next step begins.

   Reads each .reel-track's data-screens / data-objects (JSON arrays) and
   its .reel-caption [data-step] elements for the DOM half of the sync (the
   caption text itself stays real DOM/CSS, toggled here by class, same as
   the previous version).

   Everything is computed fresh from window.scrollY every animation frame,
   never accumulated relative to a previous frame — required for
   scrub-driven motion tied to arbitrary scroll direction/speed.
   =========================================================== */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}
function easeInCubic(x) {
  return x * x * x;
}
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x, y + r);
  s.lineTo(x, y + h - r);
  s.quadraticCurveTo(x, y + h, x + r, y + h);
  s.lineTo(x + w - r, y + h);
  s.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
  s.lineTo(x + w, y + r);
  s.quadraticCurveTo(x + w, y, x + w - r, y);
  s.lineTo(x + r, y);
  s.quadraticCurveTo(x, y, x, y + r);
  return s;
}

function initScene() {
  const canvas = document.getElementById("scene-canvas");
  if (!canvas) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (err) {
    console.warn("hearthlyapps: WebGL unavailable, 3D scene skipped.", err);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0, 9);

  // Returns how much world-space width/height is actually visible at a given
  // z depth, given the camera's *current* aspect ratio — this is what makes
  // layout positions scale correctly across any window/screen size, instead
  // of using fixed world-unit offsets that only happened to fit the one
  // viewport shape they were tuned against (the previous approach: a phone
  // step position of x=1.3 plus an object offset of +1.7 both being fixed
  // numbers is exactly why an object flew off-frame, then later clipped
  // through the phone, on viewport shapes those numbers weren't checked
  // against). Recomputed live from camera.aspect, which onResize() keeps in
  // sync with the actual window dimensions.
  function frustumHalfExtents(depthZ) {
    const dist = Math.max(0.5, camera.position.z - depthZ);
    const halfH = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const halfW = halfH * camera.aspect;
    return { halfW, halfH };
  }

  // ---------- Lights: teal + magenta accent lights against a soft white
  // key light — this is the one lighting rig every mesh in the scene
  // (phone and all five objects) shares, which is the whole point of
  // moving everything into one 3D world instead of separate DOM layers. */
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
  keyLight.position.set(4, 6, 8);
  scene.add(keyLight);
  const tealLight = new THREE.PointLight(0x2fb89f, 4, 30);
  tealLight.position.set(-5, 2, 4);
  scene.add(tealLight);
  const pinkLight = new THREE.PointLight(0xff5fa8, 3, 30);
  pinkLight.position.set(5, -2, 3);
  scene.add(pinkLight);

  // ---------- Background: nebula shader on the inside of a giant sphere ----------
  const bgUniforms = {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uScroll: { value: 0 },
  };
  const bgMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: bgUniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec2 uMouse;
      uniform float uScroll;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 5; i++) {
          v += amp * vnoise(p);
          p *= 2.0;
          amp *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = vUv * 3.0;
        uv += vec2(uScroll * 0.6, uTime * 0.015);
        uv += uMouse * 0.12;

        float n1 = fbm(uv + uTime * 0.04);
        float n2 = fbm(uv * 1.7 - uTime * 0.03 + 4.2);
        float n3 = fbm(uv * 0.9 + uTime * 0.02 + 9.1);

        vec3 colorA = vec3(0.035, 0.02, 0.09);
        vec3 colorB = vec3(0.145, 0.588, 0.51);
        vec3 colorC = vec3(0.85, 0.25, 0.55);
        vec3 colorD = vec3(0.16, 0.10, 0.42);

        vec3 col = mix(colorA, colorD, n1);
        col = mix(col, colorB, smoothstep(0.35, 0.8, n2) * 0.75);
        col = mix(col, colorC, smoothstep(0.55, 0.92, n3) * 0.55);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const bgMesh = new THREE.Mesh(new THREE.SphereGeometry(60, 48, 48), bgMat);
  scene.add(bgMesh);

  // ---------- Textures ----------
  const textureLoader = new THREE.TextureLoader();
  const textureCache = new Map();
  function getTexture(url) {
    if (!textureCache.has(url)) {
      const tex = textureLoader.load(url);
      if ("colorSpace" in tex) tex.colorSpace = THREE.SRGBColorSpace;
      textureCache.set(url, tex);
    }
    return textureCache.get(url);
  }

  // ---------- Phone ----------
  const phoneGroup = new THREE.Group();
  const phoneW = 1.8;
  const phoneH = 3.7;
  const phoneDepth = 0.22;
  const bodyGeo = new THREE.ExtrudeGeometry(roundedRectShape(phoneW, phoneH, 0.34), {
    depth: phoneDepth,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 3,
    curveSegments: 12,
  });
  bodyGeo.center();
  const phoneBody = new THREE.Mesh(
    bodyGeo,
    new THREE.MeshStandardMaterial({ color: 0x18181c, metalness: 0.75, roughness: 0.32 })
  );
  phoneGroup.add(phoneBody);

  // Screen: a rounded-rect shape (not a plain rectangle) so the screenshot's
  // corners match the phone's own rounded corners instead of showing square
  // corners peeking out past the curved bezel.
  const screenW = phoneW - 0.14;
  const screenH = phoneH - 0.14;
  const screenGeo = new THREE.ShapeGeometry(roundedRectShape(screenW, screenH, 0.26), 24);
  // ShapeGeometry's own UV generator does not reliably produce a full 0..1
  // range for a shape like this (it left most UVs outside [0,1], which
  // clamped the texture into a smeared sliver near one corner with the rest
  // of the screen reading as flat white — the "deformed" screenshot bug).
  // Rebuilt the UVs explicitly from vertex position instead, normalized
  // against the exact known screenW/screenH bounds (the shape is centered
  // on the origin, so this is a simple offset-and-divide), which guarantees
  // a correct, full-coverage 0..1 mapping regardless of the geometry's
  // internal UV logic.
  const posAttr = screenGeo.attributes.position;
  const screenUVs = new Float32Array(posAttr.count * 2);
  for (let i = 0; i < posAttr.count; i++) {
    screenUVs[i * 2] = (posAttr.getX(i) + screenW / 2) / screenW;
    screenUVs[i * 2 + 1] = (posAttr.getY(i) + screenH / 2) / screenH;
  }
  screenGeo.setAttribute("uv", new THREE.BufferAttribute(screenUVs, 2));
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const screenMesh = new THREE.Mesh(screenGeo, screenMat);
  // bevelEnabled extrusions push the front face out beyond `depth` by
  // roughly `bevelThickness` (bodyGeo.center() then centers that larger
  // range) — with bevelThickness 0.02 the true front face lands around
  // z = phoneDepth/2 + 0.02, not phoneDepth/2. Placed with enough clearance
  // past the bevel so the screen sits cleanly in front of the body instead
  // of being clipped inside it (which is why screenshots were invisible
  // even after the texture/tint bug above was fixed).
  screenMesh.position.z = phoneDepth / 2 + 0.05;
  screenMesh.userData.currentUrl = null;
  phoneGroup.add(screenMesh);

  // Rear camera island: without this the phone read as a featureless black
  // slab from any angle that showed its back or edge. A raised rounded
  // plate plus three lens cylinders, positioned top-left on the back face
  // (mirroring real iPhone camera placement), gives it a recognizable
  // silhouette during the sway/tilt motion below.
  const bumpMat = new THREE.MeshStandardMaterial({ color: 0x121214, metalness: 0.8, roughness: 0.3 });
  const bumpGeo = new THREE.ExtrudeGeometry(roundedRectShape(0.62, 0.62, 0.14), {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 2,
    curveSegments: 10,
  });
  bumpGeo.center();
  const cameraBump = new THREE.Mesh(bumpGeo, bumpMat);
  cameraBump.position.set(-phoneW / 2 + 0.44, phoneH / 2 - 0.52, -(phoneDepth / 2 + 0.045));
  phoneGroup.add(cameraBump);

  const lensMat = new THREE.MeshStandardMaterial({ color: 0x040406, metalness: 0.9, roughness: 0.15 });
  [
    [-0.15, 0.15],
    [0.15, 0.15],
    [0, -0.17],
  ].forEach(([lx, ly]) => {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 24), lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(lx, ly, -0.045);
    cameraBump.add(lens);
  });

  // Side buttons (power on the right edge, volume + mute switch on the
  // left) — small protruding boxes, matching real phone hardware, so the
  // silhouette still reads as "a phone" even when the screen face is
  // turned partway away during the sway motion.
  const buttonMat = new THREE.MeshStandardMaterial({ color: 0x0e0e10, metalness: 0.75, roughness: 0.3 });
  function sideButton(x, y, w, h, d) {
    const btn = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buttonMat);
    btn.position.set(x, y, 0);
    phoneGroup.add(btn);
    return btn;
  }
  sideButton(phoneW / 2 + 0.02, 0.85, 0.05, 0.42, 0.09); // power button, right edge
  sideButton(-(phoneW / 2 + 0.02), 1.15, 0.05, 0.16, 0.07); // mute switch, left edge
  sideButton(-(phoneW / 2 + 0.02), 0.72, 0.05, 0.36, 0.09); // volume up, left edge
  sideButton(-(phoneW / 2 + 0.02), 0.24, 0.05, 0.36, 0.09); // volume down, left edge

  phoneGroup.position.set(0, -0.3, 0);
  phoneGroup.scale.setScalar(1.05);
  scene.add(phoneGroup);

  // ---------- Object factories (all core Three.js geometry, no external
  // models/textures — keeps every object lit identically to the phone). */
  const OBJECT_FACTORIES = {
    // Key name kept as "pen" for backward compatibility with the HTML
    // data-objects attribute. Previously an injection pen with a long
    // tapered needle — extremely elongated on one axis (about 7x taller
    // than wide), which meant a random rotation could show it end-on as
    // just a thin circle. Rebuilt as a pill bottle: still clearly reads as
    // "medication," but its proportions are close to 1:1 (about as tall as
    // it is wide including the cap), so no rotation makes it collapse down
    // to an unrecognizable sliver.
    pen: {
      baseScale: 0.6,
      make() {
        const g = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd97a2e, metalness: 0.1, roughness: 0.35 });
        const labelMat = new THREE.MeshStandardMaterial({ color: 0xfafaf8, metalness: 0.05, roughness: 0.5 });
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0x2fb89f, metalness: 0.2, roughness: 0.4 });
        const capMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f0, metalness: 0.1, roughness: 0.4 });

        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.52, 1.0, 28), bodyMat);
        body.position.y = -0.15;
        g.add(body);

        const label = new THREE.Mesh(new THREE.CylinderGeometry(0.505, 0.505, 0.46, 28), labelMat);
        label.position.y = -0.12;
        g.add(label);

        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.508, 0.508, 0.09, 28), stripeMat);
        stripe.position.y = 0.02;
        g.add(stripe);

        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.34, 28), capMat);
        cap.position.y = 0.52;
        g.add(cap);

        // A few raised grip ribs around the cap, a common child-proof-cap
        // detail that also helps sell the scale/material at a glance.
        for (let i = 0; i < 3; i++) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.565, 0.012, 8, 24), capMat);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = 0.4 + i * 0.11;
          g.add(ring);
        }

        return g;
      },
    },
    plate: {
      baseScale: 0.62,
      make() {
        const g = new THREE.Group();
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(0.9, 0.08, 16, 48),
          new THREE.MeshStandardMaterial({ color: 0x2fb89f, metalness: 0.3, roughness: 0.4 })
        );
        rim.rotation.x = Math.PI / 2;
        g.add(rim);
        const plate = new THREE.Mesh(
          new THREE.CylinderGeometry(0.82, 0.82, 0.06, 48),
          new THREE.MeshStandardMaterial({ color: 0xe9f5f2, metalness: 0.1, roughness: 0.5 })
        );
        g.add(plate);

        // A small salad on the plate — an empty plate read as an unfinished
        // asset rather than a deliberate "protein tracking" prop. Built from
        // flattened, irregularly-scaled spheres (a cheap way to fake a
        // leafy/lettuce silhouette without a dedicated leaf mesh) plus a
        // couple of cherry-tomato spheres for color contrast, scattered
        // across the plate's flat top face (+Y, where CylinderGeometry's
        // top disc faces).
        const leafMatA = new THREE.MeshStandardMaterial({ color: 0x4caf6b, metalness: 0.1, roughness: 0.65 });
        const leafMatB = new THREE.MeshStandardMaterial({ color: 0x3a8f52, metalness: 0.1, roughness: 0.65 });
        const leafSpots = [
          [-0.28, 0.16], [0.08, 0.28], [0.33, 0.08], [-0.05, -0.22],
          [0.22, -0.28], [-0.38, -0.08], [0.4, 0.24], [-0.1, 0.02],
        ];
        leafSpots.forEach(([lx, lz], i) => {
          const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.15 + (i % 3) * 0.02, 8, 8), i % 2 === 0 ? leafMatA : leafMatB);
          leaf.scale.set(1.3, 0.42, 1.15);
          leaf.position.set(lx, 0.065, lz);
          leaf.rotation.y = i * 0.9;
          g.add(leaf);
        });
        const tomatoMat = new THREE.MeshStandardMaterial({ color: 0xd94a35, metalness: 0.2, roughness: 0.3 });
        [
          [-0.12, 0.05],
          [0.18, -0.08],
        ].forEach(([tx, tz]) => {
          const tomato = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), tomatoMat);
          tomato.position.set(tx, 0.09, tz);
          g.add(tomato);
        });

        // Fork: previously three separate free-floating thin cylinders plus
        // a handle cylinder, which read as a disconnected scribble rather
        // than a fork at this object's small on-screen scale. Rebuilt as one
        // continuous flat outline (three tines cut as notches, tapering
        // into a single handle), extruded thin — a solid, legible
        // silhouette instead of loose rods.
        const forkShape = new THREE.Shape();
        const tw = 0.16; // tine width
        const gp = 0.1; // gap between tines
        const tipY = 1.0;
        const tineBaseY = 0.6;
        forkShape.moveTo(-1.5 * tw - gp, tineBaseY);
        forkShape.lineTo(-1.5 * tw - gp, tipY);
        forkShape.lineTo(-0.5 * tw - gp, tipY);
        forkShape.lineTo(-0.5 * tw - gp, tineBaseY + 0.15);
        forkShape.lineTo(-0.5 * tw, tineBaseY + 0.15);
        forkShape.lineTo(-0.5 * tw, tipY);
        forkShape.lineTo(0.5 * tw, tipY);
        forkShape.lineTo(0.5 * tw, tineBaseY + 0.15);
        forkShape.lineTo(0.5 * tw + gp, tineBaseY + 0.15);
        forkShape.lineTo(0.5 * tw + gp, tipY);
        forkShape.lineTo(1.5 * tw + gp, tipY);
        forkShape.lineTo(1.5 * tw + gp, tineBaseY);
        forkShape.quadraticCurveTo(1.5 * tw + gp, tineBaseY - 0.25, 0.11, tineBaseY - 0.45);
        forkShape.lineTo(0.11, tineBaseY - 1.35);
        forkShape.lineTo(-0.11, tineBaseY - 1.35);
        forkShape.lineTo(-0.11, tineBaseY - 0.45);
        forkShape.quadraticCurveTo(-1.5 * tw - gp, tineBaseY - 0.25, -1.5 * tw - gp, tineBaseY);
        const forkGeo = new THREE.ExtrudeGeometry(forkShape, {
          depth: 0.05,
          bevelEnabled: true,
          bevelThickness: 0.012,
          bevelSize: 0.012,
          bevelSegments: 2,
          curveSegments: 8,
        });
        forkGeo.center();
        const fork = new THREE.Mesh(
          forkGeo,
          new THREE.MeshStandardMaterial({ color: 0xdedee2, metalness: 0.8, roughness: 0.2 })
        );
        // Laid flat beside the plate (rotated onto the XZ plane, same as the
        // plate/rim) and tilted slightly for a resting-on-the-table look,
        // rather than standing upright.
        fork.rotation.x = -Math.PI / 2;
        fork.rotation.z = -0.25;
        fork.position.set(-1.25, 0.03, 0.15);
        g.add(fork);

        return g;
      },
    },
    // Key name kept as "scale" for backward compatibility with the HTML
    // data-objects attributes (["pen","plate","scale","capsule","leaf"]) —
    // the model itself is now a dumbbell. Two earlier versions built around
    // a literal bathroom scale (an analog dial+needle, then a flat platform
    // with a digital LCD readout) still weren't reading clearly at a
    // glance. A dumbbell is one of the most universally recognizable
    // silhouettes at any scale or angle, and still lands squarely in
    // "weight" territory for this feature.
    scale: {
      baseScale: 0.62,
      make() {
        const g = new THREE.Group();
        const barMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.75, roughness: 0.3 });
        const gripMat = new THREE.MeshStandardMaterial({ color: 0xc9cace, metalness: 0.6, roughness: 0.3 });
        const plateMat = new THREE.MeshStandardMaterial({ color: 0x2fb89f, metalness: 0.35, roughness: 0.4 });
        const plateMatDark = new THREE.MeshStandardMaterial({ color: 0x1a7364, metalness: 0.35, roughness: 0.4 });
        const collarMat = new THREE.MeshStandardMaterial({ color: 0xc9cace, metalness: 0.7, roughness: 0.25 });

        // Handle bar and a slightly-thicker knurled-grip band in the middle
        // — CylinderGeometry's default axis is Y, so rotating 90° about Z
        // lays it along X, the dumbbell's long axis.
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.5, 20), barMat);
        bar.rotation.z = Math.PI / 2;
        g.add(bar);
        const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.5, 20), gripMat);
        grip.rotation.z = Math.PI / 2;
        g.add(grip);

        // Weight plates: a small stack at each end, decreasing radius
        // outward — the classic dumbbell-plate silhouette, alternating
        // colors so the individual plates actually read as a stack rather
        // than one solid lump.
        const plateRadii = [0.55, 0.44, 0.34];
        const plateOffsets = [0.75, 0.85, 0.95];
        const plateThickness = 0.09;
        [-1, 1].forEach((side) => {
          plateRadii.forEach((r, i) => {
            const plate = new THREE.Mesh(
              new THREE.CylinderGeometry(r, r, plateThickness, 28),
              i % 2 === 0 ? plateMat : plateMatDark
            );
            plate.rotation.z = Math.PI / 2;
            plate.position.x = side * plateOffsets[i];
            g.add(plate);
          });
          const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 16), collarMat);
          collar.rotation.z = Math.PI / 2;
          collar.position.x = side * 1.02;
          g.add(collar);
        });

        return g;
      },
    },
    capsule: {
      baseScale: 0.6,
      make() {
        const g = new THREE.Group();
        const left = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.42, 0.5, 8, 16),
          new THREE.MeshStandardMaterial({ color: 0x2fb89f, metalness: 0.3, roughness: 0.35 })
        );
        left.rotation.z = Math.PI / 2;
        left.position.x = -0.5;
        g.add(left);
        const right = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.42, 0.5, 8, 16),
          new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.4 })
        );
        right.rotation.z = Math.PI / 2;
        right.position.x = 0.5;
        g.add(right);
        const dotMat = new THREE.MeshStandardMaterial({ color: 0x1a7364 });
        for (let i = 0; i < 3; i++) {
          const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), dotMat);
          dot.position.set(0.15 * (i - 1), 0.1 * (i % 2 === 0 ? 1 : -1), 0);
          g.add(dot);
        }
        return g;
      },
    },
    // Key name kept as "leaf" for backward compatibility with the HTML
    // data-objects attribute. First rebuilt as a single lathed profile
    // closed to a point at the top — which, at this object's small
    // on-screen scale and with the idle spin, read as an ambiguous smooth
    // blob/sack rather than a trophy (a closed dome instead of a
    // distinctly flared open cup). Rebuilt again from clearly separated
    // primitives (flat base, thin stem, flared bowl, rim, two handles),
    // the same approach that made the dumbbell read clearly at a glance:
    // distinct, unambiguous segments hold up from any angle, unlike one
    // smooth continuous surface.
    leaf: {
      baseScale: 0.62,
      make() {
        const g = new THREE.Group();
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xd8b24a, metalness: 0.85, roughness: 0.22 });
        const goldLight = new THREE.MeshStandardMaterial({ color: 0xf1d27e, metalness: 0.8, roughness: 0.18 });

        // Everything below is built bottom-up in local Y (0 = ground), then
        // shifted down by CENTER_OFFSET so the whole group is centered on
        // its own origin like the other object factories.
        const CENTER_OFFSET = 0.77;

        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.14, 32), goldMat);
        base.position.y = 0.07 - CENTER_OFFSET;
        g.add(base);

        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.55, 20), goldMat);
        stem.position.y = 0.14 + 0.55 / 2 - CENTER_OFFSET;
        g.add(stem);

        // Bowl: a wide truncated cone, narrow where it meets the stem and
        // flared out to an open-reading mouth at the top — the flare is
        // what makes this read as a cup rather than a vase.
        const bowlBottomY = 0.14 + 0.55;
        const bowlHeight = 0.85;
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.24, bowlHeight, 32), goldLight);
        bowl.position.y = bowlBottomY + bowlHeight / 2 - CENTER_OFFSET;
        g.add(bowl);

        // Rim ring right at the bowl's open top edge, for a distinct lip
        // highlight instead of a flat cap reading as solid metal.
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 14, 32), goldLight);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = bowlBottomY + bowlHeight - CENTER_OFFSET;
        g.add(rim);

        // Two D-shaped handles on either side of the bowl. Previously a
        // 234°-arc torus rotated so its face pointed sideways (rotation.y)
        // — from the front, a torus rotated that way still reads mostly as
        // a closed ring floating beside the cup rather than an attached
        // handle, closer to a dangling earring. A handle actually needs to
        // read as attached at two points with an outward bulge in between,
        // visible face-on from the front like a real mug/trophy handle:
        // exactly a semicircle (arc = PI) lying flat in the XY plane (no
        // rotation.y at all — that's what let it read face-on as a ring
        // instead of a handle), rotated by rotation.z so its two flat ends
        // land vertically stacked and its belly bulges outward, then
        // positioned so those two ends sit right at (slightly inside) the
        // bowl's own surface at that height instead of floating apart from
        // it.
        const handleFraction = 0.42;
        const handleY = bowlBottomY + bowlHeight * handleFraction - CENTER_OFFSET;
        const bowlRadiusAtHandle = 0.24 + handleFraction * (0.62 - 0.24);
        const handleR = 0.22;
        [-1, 1].forEach((side) => {
          const handle = new THREE.Mesh(new THREE.TorusGeometry(handleR, 0.05, 12, 24, Math.PI), goldMat);
          handle.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI / 2;
          handle.position.set(side * (bowlRadiusAtHandle - 0.05), handleY, 0);
          g.add(handle);
        });

        return g;
      },
    },
  };

  // ---------- Reel tracking ----------
  function parseReels() {
    return Array.from(document.querySelectorAll(".reel-track")).map((el) => {
      let screens = [];
      let objectTypes = [];
      try {
        screens = JSON.parse(el.dataset.screens || "[]");
        objectTypes = JSON.parse(el.dataset.objects || "[]");
      } catch (err) {
        console.warn("hearthlyapps: couldn't parse reel data attributes", err);
      }
      const captionEl = el.querySelector(".reel-caption");
      const captionSteps = captionEl ? Array.from(captionEl.querySelectorAll("[data-step]")) : [];
      const objectMeshes = objectTypes.map((type) => {
        const factory = OBJECT_FACTORIES[type];
        const group = factory ? factory.make() : new THREE.Group();
        group.visible = false;
        scene.add(group);
        return { group, type, baseScale: factory ? factory.baseScale : 0.5 };
      });
      return { el, screens, objectMeshes, captionSteps, top: 0, height: 0 };
    });
  }

  const reels = parseReels();
  // Measuring .hero itself would measure the wrong box: .hero has
  // min-height: 100vh so its own bottom edge sits at the bottom of the
  // viewport regardless of how much actual text it holds, which is why an
  // earlier version of this measurement clamped to nearly the same
  // "bottom of frame" spot on every page instead of tracking each page's
  // real content height. The button row is the last real content before
  // the phone on every current hero, so its live bottom edge is what
  // actually needs clearing.
  const heroContentEl = document.querySelector(".hero .btn-row") || document.querySelector(".hero");

  function measureReels() {
    reels.forEach((r) => {
      const rect = r.el.getBoundingClientRect();
      r.top = rect.top + window.scrollY;
      r.height = rect.height;
    });
  }
  measureReels();

  // Document-space (scroll-independent) position of the hero content's
  // bottom edge, measured once (and re-measured on resize, same as the
  // reels above) rather than read live every frame. Reading
  // getBoundingClientRect().bottom fresh each frame seemed reasonable at
  // first, but that value shrinks as the user scrolls down through the
  // hero (the content itself scrolls up and off-screen, same as any normal
  // page content) — the phone's target position was quietly chasing that
  // shrinking number the whole way, which is exactly why it visibly rose
  // toward the top of the screen while scrolling through the hero, then
  // snapped back down the instant the reel's active range took over with
  // its own fixed step-0 target. The phone's hero resting spot should stay
  // put for the whole hero phase, not track the hero text scrolling away
  // underneath it — so this is captured once, in document coordinates
  // (immune to the current scroll position), the same way each reel's own
  // top/height already work.
  let heroContentBottomDocY = 0;
  function measureHero() {
    if (!heroContentEl) return;
    const rect = heroContentEl.getBoundingClientRect();
    heroContentBottomDocY = rect.bottom + window.scrollY;
  }
  measureHero();

  function getActiveReel() {
    const y = window.scrollY;
    const vh = window.innerHeight;
    for (const r of reels) {
      const start = r.top;
      const end = r.top + r.height - vh;
      if (end <= start) continue;
      if (y >= start && y <= end) {
        return { r, progress: THREE.MathUtils.clamp((y - start) / (end - start), 0, 1) };
      }
    }
    return null;
  }

  // ---------- Mouse parallax ----------
  const mouse = new THREE.Vector2(0, 0);
  const targetMouse = new THREE.Vector2(0, 0);
  window.addEventListener(
    "mousemove",
    (e) => {
      targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    },
    { passive: true }
  );

  // ---------- Per-frame update ----------
  let idleAngle = 0;

  // Per-step phone positions, cycled by step index (idx % length) — this is
  // the "move the phone around the screen" behavior: instead of parking at
  // one fixed center spot for an entire reel, each step gets its own corner/
  // offset, alternating sides so it doesn't feel like it's drifting the same
  // direction every time. Each caption in the HTML has a matching `pos-*`
  // class (see style.css) placed at the *opposite* corner from where the
  // phone sits that step, so the two never overlap — the class order on
  // each reel's `[data-step]` elements must stay in sync with this array's
  // order (br, tl, bl, tr, top-center), cycling the same way for reels with
  // more steps than entries here (the homepage's 3-step reel only ever
  // reaches index 2).
  //
  // Values here are *fractions* (roughly -1..1) of the actually-visible
  // frustum extent, not fixed world units — resolved to real coordinates
  // each frame in updatePhoneAndObjects via frustumHalfExtents(), so the
  // layout holds its proportions on any window size or aspect ratio instead
  // of the fixed-number version that clipped on narrower viewports.
  // yf magnitudes increased from an earlier version (0.34/-0.22/0.36/-0.26/
  // -0.34) — making the phone bigger (ACTIVE_SCALE) ate into usableHalfH,
  // which pulled every step's vertical position closer to center than
  // intended and let the phone visually collide with its own caption pane
  // (fixed via CSS top/bottom percentages, a separate coordinate system
  // that doesn't automatically compensate for that shrink). Pushing these
  // fractions closer to their ±1 ceiling reclaims the separation.
  const STEP_LAYOUTS = [
    { xf: -0.62, yf: 0.4 }, // phone: upper-left  -> caption: pos-br
    { xf: 0.62, yf: -0.5 }, // phone: lower-right -> caption: pos-tl
    { xf: 0.56, yf: 0.6 }, // phone: upper-right -> caption: pos-bl
    { xf: -0.56, yf: -0.52 }, // phone: lower-left  -> caption: pos-tr
    { xf: 0, yf: -1.0 }, // phone: lower-center -> caption: pos-c (top)
  ];

  // Named per-state scale factors (each still multiplied by sceneScale at
  // use — see below — so the narrow-viewport shrink-together behavior
  // keeps working at any of these base sizes). Bumped up from the
  // originals (1 / 0.78 / 0.4) for a slightly larger phone throughout.
  const ACTIVE_SCALE = 1.15;
  const HERO_SCALE = 0.88;
  const DOCKED_SCALE = 0.46;

  // Per-step multiplier on ACTIVE_SCALE, cycled the same way as
  // STEP_LAYOUTS (idx % length). Only the last step (pos-c, top-center
  // caption) is shrunk slightly — that's the one layout where the caption
  // sits directly above the phone rather than to a side, so it has the
  // least built-in vertical clearance; a slightly smaller phone there
  // buys back headroom without touching every other step.
  // Step 4 (maintenance/pos-c) was shrunk more than the rest (0.86) back
  // when its caption pane and the phone were both competing for the lower
  // half of a narrow mobile screen. Now that the mobile media query keeps
  // pos-c's caption at the top (its original, non-colliding half — see
  // style.css) that extra shrink is mostly just wasted space on a real
  // phone; only a small amount (0.94) is kept for a little breathing room.
  const STEP_SCALE = [1, 1, 1, 1, 0.94];

  // Objects whose recognizable side only faces one way (trophy, pill
  // bottle, plate/salad) get a small bounded wobble instead of the
  // unbounded idleAngle * 0.4 tumble every other object still uses — see
  // the rotation.x assignment further down for the actual reasoning.
  const BOUNDED_TUMBLE_TYPES = new Set(["leaf", "pen", "plate"]);

  // A fixed forward tilt added on top of each bounded-tumble object's small
  // wobble. The plate/salad in particular was resting almost perfectly
  // flat (its rotation only wobbling +-0.12 rad around 0), which faces its
  // top mostly away from a camera sitting roughly level with the scene —
  // showing mostly the rim rather than the food on it. Tilting its base
  // rotation forward angles that top surface toward the viewer instead.
  const BASE_TILT_X = { plate: 0.42 };

  function updatePhoneAndObjects() {
    const active = getActiveReel();
    const y = window.scrollY;
    const firstReelTop = reels.length ? reels[0].top : Infinity;

    // Visible extent at the phone/object depth (z ~ 0), from the *current*
    // camera aspect — recomputed every frame so a browser resize (or just
    // loading the page at a different window size) is reflected immediately
    // rather than baked in once at load.
    const { halfW, halfH } = frustumHalfExtents(0);

    // On a narrow/mobile-shaped viewport there just isn't enough width for
    // a full-size phone plus a separate full-size floating object side by
    // side without one clipping the frame or the other — clamping alone
    // just trades one failure for the other (an object shoved back until
    // it overlaps the phone). The more robust fix is to shrink the phone
    // AND every object together as the viewport narrows, so their relative
    // proportions (and the gaps between them) stay consistent instead of
    // cramming full-size elements into too little room. REFERENCE_HALF_W is
    // the half-width the layout numbers below were tuned against (a
    // reasonably wide desktop view); sceneScale only kicks in once the
    // actual frustum is narrower than that.
    const REFERENCE_HALF_W = 3.3;
    // Floor raised from 0.5 to 0.68 — a real narrow phone (iPhone-shaped
    // viewport) was hitting this floor and shrinking the phone (and its
    // baked-in screenshot texture) enough to make the in-phone UI genuinely
    // hard to read, which is the opposite of the point of showing a
    // screenshot at all. The usableHalfW/usableHalfH math below already
    // reserves clearance based on this same value, so raising the floor
    // can't reopen the original off-frame clipping bug — it just makes the
    // reserved phone silhouette itself bigger.
    const sceneScale = THREE.MathUtils.clamp(halfW / REFERENCE_HALF_W, 0.68, 1);

    // Half-size at the ACTIVE-state scale specifically (the biggest of the
    // three states, and the one objects need clearance from) — hero and
    // docked compute their own half-sizes separately below, from their own
    // scale constants, rather than reusing this one.
    const phoneHalfW = (phoneW / 2) * sceneScale * ACTIVE_SCALE;
    const phoneHalfH = (phoneH / 2) * sceneScale * ACTIVE_SCALE;
    // Room left for the phone's *center* to move within, after reserving
    // space for its own half-width/height plus a breathing-room margin —
    // this is what actually prevents the phone itself from clipping off the
    // side of the frame at any viewport shape.
    const usableHalfW = Math.max(0.4, halfW - phoneHalfW - 0.3);
    const usableHalfH = Math.max(0.4, halfH - phoneHalfH - 0.35);

    let targetPos;
    let targetScale;
    let activeScreenUrl = null;
    let activeReelEntry = null;
    let activeLayout = null;
    let idx = 0;
    let segP = 0;
    let phoneOpacity = 1;
    // Set during the hero-approach blend below when it's time for the
    // reel's very first caption to start fading in early, ahead of the
    // phone actually reaching step 0's position — see the clearing loop
    // further down for how this is preserved instead of being wiped along
    // with every other inactive caption.
    let earlyCaptionEl = null;

    // On mobile, style.css's own max-width:640px media query is what
    // decides whether each caption sits at the top or bottom of the screen
    // (always the opposite half from wherever the phone sits that step —
    // see the comment above that media query). A long caption (several
    // wrapped lines on a narrow phone) can still grow tall enough to reach
    // past the halfway point and graze the edge of the phone sitting in the
    // other half, even though the two are nominally on opposite sides —
    // exactly what happened on the side-effects step, whose caption is 4
    // heading lines plus a 5-line paragraph. Nudging the phone a bit further
    // toward its own extreme (away from center) on mobile only buys back
    // clearance for exactly this case, without touching the desktop layout
    // at all (isMobileLayout is false there).
    const isMobileLayout = window.innerWidth < 640;
    const MOBILE_YF_BOOST = 1.25;
    function layoutY(yf) {
      const boosted = isMobileLayout ? THREE.MathUtils.clamp(yf * MOBILE_YF_BOOST, -1, 1) : yf;
      return boosted * usableHalfH;
    }

    if (active) {
      const { r, progress } = active;
      const steps = r.screens.length || 1;
      const segLen = 1 / steps;
      idx = Math.min(steps - 1, Math.floor(progress / segLen));
      segP = (progress - idx * segLen) / segLen;
      activeScreenUrl = r.screens[idx];
      activeReelEntry = r;
      const layout = STEP_LAYOUTS[idx % STEP_LAYOUTS.length];
      // Resolved to real world coordinates here (once per frame while
      // active) rather than storing fractions on activeLayout, so the
      // object-hold-position code below can keep using activeLayout.x/y
      // directly, unchanged.
      activeLayout = { x: layout.xf * usableHalfW, y: layoutY(layout.yf) };
      targetPos = new THREE.Vector3(activeLayout.x, 0.15 + activeLayout.y, 0);
      targetScale = ACTIVE_SCALE * sceneScale * STEP_SCALE[idx % STEP_SCALE.length];
      r.captionSteps.forEach((c, i) => c.classList.toggle("is-active", i === idx));
    } else if (y < firstReelTop) {
      // The hero heading/eyebrow/lede/button-row is anchored near the top of
      // the viewport (style.css's .hero justify-content: flex-start). A
      // fixed vertical offset here only clears that text block on whichever
      // page's hero copy it happened to be tuned against — the Sustain
      // page's longer three-line lede plus button row pushed further down
      // than the homepage's shorter one, so a single fixed number
      // (previously -1.35) left the phone's resting spot overlapping the
      // tail end of that text on the taller hero. Measuring the hero
      // element's actual live bottom edge and converting it to a world Y at
      // this depth means the phone always rests just below whatever hero
      // content is actually on screen, on any page, at any viewport size.
      const phoneHalfH_hero = (phoneH / 2) * sceneScale * HERO_SCALE;
      const heroGap = 0.4;
      let heroRestY = -Math.min(1.35, usableHalfH * HERO_SCALE);
      if (heroContentEl) {
        // heroContentBottomDocY is captured once (measureHero(), re-run on
        // resize only) rather than re-read live here — see its definition
        // above for why using a live getBoundingClientRect() every frame
        // was the actual bug.
        const ndcY = 1 - (heroContentBottomDocY / window.innerHeight) * 2;
        const worldYAtHeroBottom = ndcY * halfH;
        heroRestY = worldYAtHeroBottom - phoneHalfH_hero - heroGap;
      }
      // Still clamped to the visible frustum so an unusually tall hero (or
      // a very short viewport) can't push the phone off the bottom edge.
      // This previously used usableHalfH, which is sized against the much
      // bigger ACTIVE-state phone (phoneHalfH from ACTIVE_SCALE, ~30%
      // larger than the hero-scale phone) — that floor was tighter than
      // the distance actually needed to clear a real hero's button row, so
      // it was silently overriding the computed heroRestY back upward,
      // right back into overlap, on every page. The real constraint is just
      // "don't push the phone's center past the bottom of the visible
      // frustum" (using the hero-scale half-height, not the active one).
      heroRestY = Math.max(heroRestY, -(halfH - phoneHalfH_hero * 0.3));

      // Freezing heroRestY (above) fixed the phone chasing the hero text
      // upward while scrolling — but on its own that left the phone
      // perfectly still for the entire hero scroll, then handing off to
      // step 0's target in a single lerp exactly at the reel boundary,
      // which reads as "stuck, then a sudden jump" no matter how fast that
      // handoff lerp runs, since it only ever starts once you've already
      // crossed the line. Blending toward step 0's own target position and
      // scale over the last stretch of hero scroll (approachT) makes that
      // motion actually scroll-driven and anticipatory instead of a single
      // post-boundary snap — by the time you reach the reel, the phone is
      // already exactly at step 0's target, so the hand-off itself is
      // seamless.
      const approachDist = window.innerHeight * 0.9;
      const distToReel = firstReelTop - y;
      const approachT = THREE.MathUtils.clamp(1 - distToReel / approachDist, 0, 1);
      const approachEase = approachT * approachT * (3 - 2 * approachT); // smoothstep

      if (approachEase > 0 && reels[0]) {
        const step0Layout = STEP_LAYOUTS[0];
        const step0X = step0Layout.xf * usableHalfW;
        const step0Y = 0.15 + layoutY(step0Layout.yf);
        const step0Scale = ACTIVE_SCALE * sceneScale * STEP_SCALE[0];
        targetPos = new THREE.Vector3(
          THREE.MathUtils.lerp(0, step0X, approachEase),
          THREE.MathUtils.lerp(heroRestY, step0Y, approachEase),
          0
        );
        targetScale = THREE.MathUtils.lerp(HERO_SCALE * sceneScale, step0Scale, approachEase);
      } else {
        targetPos = new THREE.Vector3(0, heroRestY, 0);
        targetScale = HERO_SCALE * sceneScale;
      }
      // The first caption used to only appear once you'd fully crossed
      // into the reel's active scroll range, well after the phone had
      // already visibly started (and by now, per approachEase above,
      // mostly finished) moving into its step 0 spot — reading as the text
      // showing up late. Fading it in over the same approach window
      // instead means the headline arrives alongside the phone's motion
      // rather than after it.
      if (approachEase > 0.1 && reels[0] && reels[0].captionSteps[0]) {
        earlyCaptionEl = reels[0].captionSteps[0];
      }
      activeScreenUrl = reels[0] ? reels[0].screens[0] : null;
    } else {
      const lastReel = reels[reels.length - 1];
      const dockedHalfW = (phoneW / 2) * sceneScale * DOCKED_SCALE;
      // The docked corner spot (2.7, 1.5) was a fixed guess too — clamped to
      // whatever's actually visible at this depth so it can't sit half
      // off-frame on a narrow window. This is now just the *rest* position
      // right after the reel ends, not a permanent parking spot — see
      // exitT below.
      const restX = Math.min(2.7, halfW - dockedHalfW - 0.2);
      // How far scrolled *past* the reel's own active range (not just past
      // firstReelTop, which is where this whole branch starts) — drives a
      // continued exit off the right edge instead of sitting docked in the
      // corner forever. reelEnd matches getActiveReel()'s own "end" for
      // this reel, so overshoot is exactly the extra pixels scrolled once
      // the reel itself has fully finished. Normalized over 3/4 of a
      // viewport height so it clears the frame at a natural scroll pace,
      // not immediately or interminably.
      const reelEnd = lastReel ? lastReel.top + lastReel.height - window.innerHeight : y;
      const overshoot = Math.max(0, y - reelEnd);
      const exitT = Math.min(1, overshoot / (window.innerHeight * 0.75));
      const exitX = halfW + dockedHalfW + 1.5; // well clear of the right edge
      const dockX = THREE.MathUtils.lerp(restX, exitX, exitT);
      targetPos = new THREE.Vector3(dockX, 1.5, -2.4);
      targetScale = DOCKED_SCALE * sceneScale;
      activeScreenUrl = lastReel ? lastReel.screens[lastReel.screens.length - 1] : null;
      // Fades out as it exits, on top of physically leaving the frame, so
      // there's no risk of a hard pop back into view if the user scrolls
      // back up partway and stalls right at the frame edge.
      phoneOpacity = 1 - exitT;
    }

    // Whenever a reel isn't the active one right now (including when
    // *nothing* is active, i.e. hero or past-the-reel/docked states),
    // explicitly clear is-active from every one of its caption steps. The
    // toggle above only ever runs for the currently-active reel, so without
    // this, a step's is-active class (including the one hardcoded onto step
    // 0 in the HTML so something shows before JS ever runs) simply stayed
    // set once applied, leaving its glass pane visible and frozen at
    // whatever screen position it last computed, on top of the hero text or
    // whatever section the page had since scrolled to. This is what caused
    // panes to appear stuck overlapping unrelated sections after scrolling
    // away from the reel.
    reels.forEach((r) => {
      if (r === activeReelEntry) return;
      r.captionSteps.forEach((c) => {
        // Preserve the one caption the hero-approach blend just asked to
        // start fading in early (see earlyCaptionEl above) instead of
        // immediately wiping it back off along with every other inactive
        // step.
        c.classList.toggle("is-active", c === earlyCaptionEl);
      });
    });

    // Position lerp sped up from 0.06 — at the slower rate the phone
    // visibly lagged behind its target position while scrolling into a new
    // step, which is what let it linger overlapping the incoming caption
    // pane mid-transition instead of already being clear of it.
    // Bumped again (0.1 -> 0.2) — the phone sits at a fixed hero resting
    // spot for the entire hero scroll (intentional, per the earlier fix to
    // stop it chasing the scrolling hero text), so the only motion into the
    // step-0 layout happens in this lerp, all at once, right at the
    // hero/reel boundary. At 0.1 that one-time move visibly dragged,
    // reading as "stuck, then a slow crawl" rather than a snappy hand-off.
    phoneGroup.position.lerp(targetPos, 0.2);
    const nextScale = phoneGroup.scale.x + (targetScale - phoneGroup.scale.x) * 0.14;
    phoneGroup.scale.setScalar(nextScale);

    // Fades the whole phone (body, screen, camera bump, side buttons) as it
    // exits off the right edge past the docked state (phoneOpacity < 1 only
    // happens there — everywhere else it's set to 1 above, so this is a
    // no-op cost-wise elsewhere). transform.opacity itself is unaffected by
    // scroll; this only ever changes toward the end of the page.
    phoneGroup.traverse((child) => {
      if (child.material) {
        child.material.transparent = true;
        child.material.opacity = phoneOpacity;
      }
    });

    // A full 360° spin (the previous behavior: rotation.y = idleAngle +
    // progress * 2*PI) necessarily turns the screen away from the viewer
    // for roughly half of every revolution, which looked broken since the
    // screen is the entire point of the shot. Replaced with a bounded
    // side-to-side sway plus a gentle forward tilt ("laying flat-ish, but
    // tilted toward the viewer") — like a product being turned in someone's
    // hand for a photo, never all the way around to the back. The two sway
    // terms (slow ambient idle + a reel-progress-synced swing) are summed;
    // their amplitudes were toned down from an earlier version (0.55/0.5,
    // ~49° combined) that tilted far enough to make the screen genuinely
    // hard to read at the peak of the swing — this combined range
    // (about ±0.5 rad, ~29°) keeps it a comfortable, mostly-frontal view.
    const idleSway = Math.sin(idleAngle * 0.35) * 0.28;
    const reelSway = active ? Math.sin(active.progress * Math.PI * 2) * 0.26 : 0;
    phoneGroup.rotation.y = idleSway + reelSway;
    phoneGroup.rotation.x = -0.1 + Math.sin(idleAngle * 0.5) * 0.05;
    phoneGroup.rotation.z = Math.sin(idleAngle * 0.28) * 0.03;

    // Tilt the active caption's glass pane along with the phone. The pane's
    // position itself stays plain CSS (the [data-step].pos-* corner rules
    // in style.css) — only its transform gets a rotation here, damped well
    // below the phone's actual rotation (tiltFactor) so the pane still
    // reads as "attached to the phone" without tilting far enough to make
    // the text genuinely hard to read.
    if (activeReelEntry) {
      const activeCaptionEl = activeReelEntry.captionSteps[idx];
      const pane = activeCaptionEl ? activeCaptionEl.querySelector(".caption-pane") : null;
      if (pane) {
        const tiltFactor = 0.55;
        const rotYdeg = THREE.MathUtils.radToDeg(phoneGroup.rotation.y) * tiltFactor;
        const rotXdeg = THREE.MathUtils.radToDeg(phoneGroup.rotation.x) * tiltFactor;
        pane.style.transform = `perspective(1400px) rotateY(${rotYdeg.toFixed(2)}deg) rotateX(${rotXdeg.toFixed(2)}deg)`;
      }
    }

    if (activeScreenUrl && screenMesh.userData.currentUrl !== activeScreenUrl) {
      screenMat.map = getTexture(activeScreenUrl);
      // MeshBasicMaterial multiplies its texture by `color` rather than
      // replacing it — the constructor's near-black 0x111111 (a placeholder
      // for before any texture has loaded) was silently crushing every
      // screenshot down to almost-invisible once a map was applied. Reset
      // to white the first time a real texture is set so the screenshot
      // renders at its true colors instead of tinted near-black.
      screenMat.color.set(0xffffff);
      screenMat.needsUpdate = true;
      screenMesh.userData.currentUrl = activeScreenUrl;
    }

    reels.forEach((r) => {
      r.objectMeshes.forEach((om) => {
        if (r !== activeReelEntry) om.group.visible = false;
      });
    });

    if (activeReelEntry) {
      activeReelEntry.objectMeshes.forEach((om, i) => {
        if (i !== idx) {
          om.group.visible = false;
          return;
        }
        // Hold position is relative to the phone's own *actual rendered*
        // position (phoneGroup.position, already updated by the lerp above
        // this frame) rather than activeLayout, the step's target position.
        // The phone's position lerps toward each new step's target instead
        // of snapping instantly, so right at a step boundary (say, hero
        // into step 0, or step 0's upper-left into step 1's lower-right —
        // both large jumps) the phone visually lags several frames behind
        // that target. Using activeLayout meant the incoming object's whole
        // flight path (gap, holdX/Y, even farX's side) was calculated as if
        // the phone were already sitting at its new spot, while it was
        // actually still passing through the middle of the frame — exactly
        // where the object's path also happened to cross, clipping straight
        // through the phone body. Reading the phone's live position instead
        // means the object recalculates clearance from wherever the phone
        // actually is, every frame, so it can never get out ahead of it.
        const base = { x: phoneGroup.position.x, y: phoneGroup.position.y };
        // dir must point *toward center* from wherever the phone sits for
        // this step, not just alternate by index — a step where the phone
        // sits on the right was pushing the object even further right, off
        // the edge of the frame on anything narrower than a very wide
        // viewport. Falls back to alternating by index only for the rare
        // near-centered phone position (the pos-c step), where there's no
        // "toward center" side.
        //
        // Deliberately reads activeLayout.x (the step's fixed target x),
        // not the live base.x used just above for the actual hold-position
        // math. base.x changes continuously while the phone is still
        // lerping toward that target, and on a step where the target x is
        // near zero (pos-c), base.x drifts down through the +-0.05 dead
        // zone as it settles — flipping dir's fallback branch mid-flight
        // and making the object visibly teleport from one side of the
        // phone to the other about a second after it had already landed.
        // activeLayout.x is constant for the whole step, so dir is decided
        // once and never flips underneath an already-settled object.
        const dir = activeLayout && activeLayout.x > 0.05 ? -1 : activeLayout && activeLayout.x < -0.05 ? 1 : i % 2 === 0 ? -1 : 1;
        // Gap must clear *both* half-widths (phone's and the object's), not
        // just be an arbitrary fixed number — 1.6 was less than
        // phoneHalfW (0.9) + the widest object's own half-width (the
        // plate/fork's torus is nearly 1 unit across), so the object was
        // rendering partway inside the phone's own geometry. 1.05 is a
        // conservative stand-in for "widest object" (the plate/scale),
        // applied to every type uniformly rather than per-type, since the
        // gap only needs to be big enough for the worst case. Scaled by
        // sceneScale to match the object's own actual rendered size (see
        // the scale multiply near the end of this block) — without this it
        // stays reserving full-size clearance even once the object itself
        // has shrunk, which was defeating the point of shrinking it.
        const objHalfW = 1.05 * sceneScale;
        const gap = phoneHalfW + objHalfW + 0.3;
        const idealHoldX = base.x + dir * gap;
        const maxObjX = Math.max(0.2, halfW - objHalfW - 0.15);
        let holdX;
        let holdY;
        // Extra shrink applied only in the stacked fallback below — the
        // vertical frustum height is fixed by the camera's vertical FOV and
        // doesn't grow on a narrower *width*, so a tall-but-not-quite-mobile
        // aspect ratio (e.g. a tall desktop window) can reach this fallback
        // while sceneScale is still close to 1, leaving too little vertical
        // room and clamping the object back into the phone anyway. Since
        // this fallback is already a compromise layout, shrinking it a bit
        // further buys back the room needed to actually clear the phone.
        let stackShrink = 1;
        if (Math.abs(idealHoldX) <= maxObjX) {
          // Normal case: enough horizontal room to sit beside the phone
          // without either clipping off-frame or overlapping it.
          holdX = idealHoldX;
          holdY = base.y + [0, 0.45, -0.35][i % 3];
        } else {
          // Not enough width at this viewport size to hold beside the phone
          // at all (clamping alone would just force an overlap instead of
          // an off-frame clip — a real narrow-phone-browser case, not just
          // a hypothetical one). Stack above/below instead, where there's
          // usually more spare room, rather than beside.
          holdX = base.x;
          stackShrink = 0.7;
          const objHalfH = 1.05 * sceneScale * stackShrink;
          const vDir = i % 2 === 0 ? -1 : 1;
          const idealHoldY = base.y + vDir * (phoneHalfH + objHalfH + 0.3);
          const maxObjY = Math.max(0.2, halfH - objHalfH - 0.15);
          holdY = THREE.MathUtils.clamp(idealHoldY, -maxObjY, maxObjY);
        }
        const farX = dir * 9;
        let x;
        let yy;
        let scale;
        let rot;
        let opacity;

        if (segP < 0.24) {
          const t = easeOutCubic(segP / 0.24);
          x = farX + (holdX - farX) * t;
          yy = holdY;
          scale = om.baseScale * (0.4 + 0.6 * t);
          rot = dir * -0.9 * (1 - t);
          opacity = t;
        } else if (segP < 0.72) {
          const t = (segP - 0.24) / 0.48;
          x = holdX;
          yy = holdY + Math.sin(t * Math.PI * 2) * 0.15;
          scale = om.baseScale;
          rot = Math.sin(t * Math.PI * 2) * 0.15;
          opacity = 1;
        } else {
          const t = easeInCubic((segP - 0.72) / 0.28);
          x = holdX + (farX - holdX) * t;
          yy = holdY;
          scale = om.baseScale * (1 - 0.2 * t);
          rot = dir * 1.1 * t;
          opacity = 1 - t;
        }

        om.group.visible = opacity > 0.02;
        om.group.position.set(x, yy, 0.4);
        // sceneScale (and stackShrink, in the stacked fallback) shrink the
        // object to match the smaller gap reserved for it above — without
        // this the *position* math would assume a smaller object than what
        // actually renders, reopening the same overlap problem.
        om.group.scale.setScalar(scale * sceneScale * stackShrink);
        om.group.rotation.y = rot + idleAngle * 1.5;
        // The shared idleAngle * 0.4 tumble on X is unbounded (it just
        // keeps growing), which is harmless for a shape that reads fine
        // from any angle, but breaks objects whose recognizable side only
        // faces one way: the trophy tips over onto its rim (reading as a
        // stack of coins), the pill bottle's cap ends up facing the
        // camera, and the plate flips upside down to show its flat
        // underside instead of the salad on top. Those three keep spinning
        // mainly around their own long/vertical (Y) axis with only a small
        // bounded wobble on X, instead of a continuous tumble that
        // eventually rotates them into a bad-looking angle.
        om.group.rotation.x = BOUNDED_TUMBLE_TYPES.has(om.type)
          ? (BASE_TILT_X[om.type] || 0) + Math.sin(idleAngle * 0.5) * 0.12
          : idleAngle * 0.4;
        om.group.traverse((child) => {
          if (child.material) {
            child.material.transparent = true;
            child.material.opacity = opacity;
          }
        });
      });
    }
  }

  function updateCamera() {
    mouse.lerp(targetMouse, 0.045);
    camera.position.x = mouse.x * 0.6;
    camera.position.y = mouse.y * 0.4;
    camera.lookAt(0, 0, 0);
    bgUniforms.uMouse.value.set(mouse.x, mouse.y);
  }

  function updateScrollUniform() {
    const max = document.body.scrollHeight - window.innerHeight;
    bgUniforms.uScroll.value = max > 0 ? window.scrollY / max : 0;
  }

  const clock = new THREE.Clock();
  function animate() {
    const dt = Math.min(clock.getDelta(), 0.05);
    idleAngle += dt * 0.25;
    bgUniforms.uTime.value += dt;
    updateCamera();
    updateScrollUniform();
    updatePhoneAndObjects();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    measureReels();
    measureHero();
  }
  window.addEventListener("resize", onResize, { passive: true });

  animate();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initScene);
} else {
  initScene();
}
