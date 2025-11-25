let spriteSheet;
let yiyiFrames = []; // frames for the `一一一` sequence if present
let frameIndex = 0;
let lastUpdate = 0;
const ANIMATION_FPS = 12; // frames per second for the animation
let spriteMode = 'none'; // 'yiyi' | 'sheet' | 'none'
let sheetFrameCount = 13; // default if sprite sheet is used
let sheetFrames = []; // extracted frames from sprite sheet, processed with transparency
let walkFrames = []; // walk frames (e.g., '0.png', '1.png', ...)
// Additional sprite 'a' variables (to be displayed left of center)
let aSpriteSheet;
let aFrameCount = 12;
let aFrames = [];
let aCurrentFrames = null;
// Movement variables
let charX = 0;
let charY = 0;
let vx = 0;
let speed = 3;
let facing = 1; // 1 right, -1 left
let isWalking = false;
let currentFrames = null; // reference to current idle frames (yiyi or sheet)

function preload() {
  // Simplified: load the requested sprite sheet from the `b` folder.
  // The file `b.png` is expected to be 703x84 and contain 13 frames across the width.
  const basePath = '20251125 a/b/';
  const spriteFile = basePath + 'b.png';
  sheetFrameCount = 13;
  loadImage(spriteFile,
    img => {
      spriteSheet = img;
      // process b sprite sheet (we still drop its 13th frame in the wrapper)
      processSpriteSheet(spriteSheet, sheetFrameCount);
      spriteMode = 'sheet';
      currentFrames = sheetFrames;
    },
    err => {
      console.error('Failed to load sprite sheet:', spriteFile, err);
      // keep trying other fallback files (if any in repo) — but for now, just log
    }
  );

  // If the spriteSheet file doesn't exist, try loading the individual frame files in the `b` folder using the 4-digit naming convention.
  // We'll attempt to load up to 13 frames named b0001.png, b0002.png, ... (fallback if b.png not present)
  // Prepare a placeholder array so we can store frames in correct numeric order
  const maxFramesTry = 13; // the sprite originally has 13 frames, but we'll skip the 13th
  sheetFrames = new Array(maxFramesTry).fill(null);
  for (let i = 1; i <= maxFramesTry; i++) {
    // Skip the 13th frame (user requested removing the 13th image)
    if (i === 13) continue;
    const idx = ('000' + i).slice(-4);
    const fname = basePath + 'b' + idx + '.png';
    const slot = i - 1;
    loadImage(fname,
      img => {
        // process and write into correct slot to preserve order
        const processed = removeBackgroundFromImage(img);
        sheetFrames[slot] = processed;
        // update currentFrames as compacted array (drop any nulls)
        const compact = sheetFrames.filter(f => f !== null);
        if (compact.length > 0) {
          spriteMode = 'sheet';
          currentFrames = compact;
        }
      },
      err => {
        // ignore load errors silently; missing files will leave slot as null
      }
    );
  }

  // --- Load the `a` sprite (12 frames), display to the left of center ---
  const baseAPath = '20251125 a/a/';
  const aSpriteFile = baseAPath + 'a.png';
  loadImage(aSpriteFile,
    imgA => {
      aSpriteSheet = imgA;
      aFrames = processSpriteSheetToArray(aSpriteSheet, aFrameCount, false);
      aCurrentFrames = aFrames;
      console.log('Loaded a sprite sheet with', aCurrentFrames.length, 'frames');
    },
    errA => {
      // fallback: attempt to load a0001..a0012 individually (skip any 13th)
      const maxATries = aFrameCount; // 12
      aFrames = new Array(maxATries).fill(null);
      for (let j = 1; j <= maxATries; j++) {
        const jIdx = ('000' + j).slice(-4);
        const aName = baseAPath + 'a' + jIdx + '.png';
        const slot = j - 1;
        loadImage(aName,
          img => {
            const processed = removeBackgroundFromImage(img);
            aFrames[slot] = processed;
            const compact = aFrames.filter(f => f !== null);
            if (compact.length > 0) {
              aCurrentFrames = compact;
              console.log('Loaded a frames (fallback):', aCurrentFrames.length);
            }
          },
          errA2 => { /* ignore missing frames */ }
        );
      }
    }
  );
}

// Utility: slice a sprite sheet into frameCount frames and return array
function processSpriteSheetToArray(sheet, frameCount, drop13th = false) {
  const fullW = sheet.width;
  const sH = sheet.height;
  const frames = [];
  // Compute per-frame width, handle remainders by adding leftover to the last frame
  const baseW = Math.floor(fullW / frameCount);
  for (let i = 0; i < frameCount; i++) {
    let sw = baseW;
    let sx = i * baseW;
    if (i === frameCount - 1) {
      // include remaining pixels on the last frame to avoid visual glitches
      sw = fullW - sx;
    }
    const img = sheet.get(sx, 0, sw, sH);
    const processed = removeBackgroundFromImage(img);
    frames.push(processed);
  }
  if (drop13th && frames.length >= 13) {
    frames.splice(12, 1); // remove index 12 (13th frame)
    console.log('Dropped 13th frame from sprite sheet to comply with request');
  }
  return frames;
}

// Backwards-compatible wrapper: process sheet into global sheetFrames and drop the 13th for 'b'
function processSpriteSheet(sheet, frameCount) {
  sheetFrames = processSpriteSheetToArray(sheet, frameCount, true);
}

// Remove background by sampling the corner color and making similar pixels transparent
function removeBackgroundFromImage(srcImg, tolerance = 60) {
  // create a new image to hold output
  const w = srcImg.width;
  const h = srcImg.height;
  srcImg.loadPixels();
  const out = createImage(w, h);
  out.loadPixels();

  // sample the top-left pixel and average corners for robust background pick
  // If top-left is transparent, fallback to top-right/others
  let sampleColors = [];
  try {
    // read four corners
    sampleColors.push({ r: srcImg.pixels[0], g: srcImg.pixels[1], b: srcImg.pixels[2], a: srcImg.pixels[3] });
    let idxTR = 4 * (w - 1);
    sampleColors.push({ r: srcImg.pixels[idxTR], g: srcImg.pixels[idxTR + 1], b: srcImg.pixels[idxTR + 2], a: srcImg.pixels[idxTR + 3] });
    let idxBL = 4 * ((h - 1) * w);
    sampleColors.push({ r: srcImg.pixels[idxBL], g: srcImg.pixels[idxBL + 1], b: srcImg.pixels[idxBL + 2], a: srcImg.pixels[idxBL + 3] });
    let idxBR = 4 * ((h - 1) * w + (w - 1));
    sampleColors.push({ r: srcImg.pixels[idxBR], g: srcImg.pixels[idxBR + 1], b: srcImg.pixels[idxBR + 2], a: srcImg.pixels[idxBR + 3] });
  } catch (e) {
    // fallback to a white background
    sampleColors = [{ r: 255, g: 255, b: 255, a: 255 }];
  }

  // average the sample colors to get a background color
  let avg = sampleColors.reduce((acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b, a: acc.a + c.a }), { r: 0, g: 0, b: 0, a: 0 });
  avg.r = Math.round(avg.r / sampleColors.length);
  avg.g = Math.round(avg.g / sampleColors.length);
  avg.b = Math.round(avg.b / sampleColors.length);
  avg.a = Math.round(avg.a / sampleColors.length);

  function colorDistance(r1, g1, b1, r2, g2, b2) {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = 4 * (x + y * w);
      const r = srcImg.pixels[i];
      const g = srcImg.pixels[i + 1];
      const b = srcImg.pixels[i + 2];
      const a = srcImg.pixels[i + 3];

      // if original is already transparent, keep transparency
      if (a === 0) {
        out.pixels[i] = r;
        out.pixels[i + 1] = g;
        out.pixels[i + 2] = b;
        out.pixels[i + 3] = 0;
        continue;
      }

      const dist = colorDistance(r, g, b, avg.r, avg.g, avg.b);
      if (dist <= tolerance) {
        // make transparent
        out.pixels[i] = r;
        out.pixels[i + 1] = g;
        out.pixels[i + 2] = b;
        out.pixels[i + 3] = 0;
      } else {
        out.pixels[i] = r;
        out.pixels[i + 1] = g;
        out.pixels[i + 2] = b;
        out.pixels[i + 3] = a;
      }
    }
  }

  out.updatePixels();
  return out;
}

function setup() {
  // create a full-window canvas
  createCanvas(windowWidth, windowHeight);
  // use a smooth frame rate for smooth animation; we'll control sprite frame timing manually
  frameRate(60);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  // background color #e9edc9
  background('#e9edc9');

  // If no frames for either main or 'a' are ready yet, show a simple loading message
  if (((!currentFrames || currentFrames.length === 0) && walkFrames.length === 0) && (!aCurrentFrames || aCurrentFrames.length === 0)) {
    push();
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(20);
    text('Loading...', width / 2, height / 2);
    pop();
    return;
  }

  // Update character position
  // Force character to be centered on the canvas
  charX = width / 2;
  charY = height / 2;

  // choose which frames to draw: walking frames if walking, else current idle frames
  let framesToUse = currentFrames;
  if (isWalking && walkFrames.length > 0) framesToUse = walkFrames;
  if (!framesToUse || framesToUse.length === 0) return;
  const frameCount = framesToUse.length;
  const now = millis();
  const frameInterval = 1000 / ANIMATION_FPS;
  frameIndex = floor((now / frameInterval) % frameCount);
  // Determine the main sprite (center) image and its target width so we can position the 'a' sprite
  const imgB = framesToUse[frameIndex];
  const centerTargetW = (imgB) ? (imgB.width * (constrain(height * 0.25, 40, imgB.height * 3) / imgB.height)) : 0;

  // Draw the 'a' sprite to the left of center if available
  if (aCurrentFrames && aCurrentFrames.length > 0) {
    const aFrameCountLen = aCurrentFrames.length;
    const aIndex = floor((now / frameInterval) % aFrameCountLen);
    const aImg = aCurrentFrames[aIndex];
    if (aImg) {
      const aSW = aImg.width;
      const aSH = aImg.height;
      let aTargetH = constrain(height * 0.25, 40, aSH * 3);
      let aScale = aTargetH / aSH;
      let aTargetW = aSW * aScale;
      // compute left position: place to the left of center character with 24px spacing
      const spacing = 24;
      // use calculated center target width so 'a' can sit to the left of center
      const centerTargetWCalc = centerTargetW;
      const leftX = charX - (centerTargetWCalc / 2) - spacing - (aTargetW / 2);
      const leftY = charY - aTargetH / 2;
      push();
      image(aImg, leftX, leftY, aTargetW, aTargetH);
      pop();
    }
  }

  const img = imgB; // reuse the previously computed main sprite frame
  // scale and draw centered at charX, charY
  const sW = img.width;
  const sH = img.height;
  let targetH = constrain(height * 0.25, 40, sH * 3);
  let scale = targetH / sH;
  let targetW = sW * scale;
  const dx = charX - targetW / 2;
  const dy = charY - targetH / 2;
  push();
  if (facing < 0) {
    translate(dx + targetW / 2, dy + targetH / 2);
    scale(-1, 1);
    image(img, -targetW / 2, -targetH / 2, targetW, targetH);
  } else {
    image(img, dx, dy, targetW, targetH);
  }
  pop();

  // Draw the 'a' sprite to the left of center if available
  if (aCurrentFrames && aCurrentFrames.length > 0) {
    const aFrameCountLen = aCurrentFrames.length;
    const aIndex = floor((now / frameInterval) % aFrameCountLen);
    const aImg = aCurrentFrames[aIndex];
    if (aImg) {
      const aSW = aImg.width;
      const aSH = aImg.height;
      let aTargetH = constrain(height * 0.25, 40, aSH * 3);
      let aScale = aTargetH / aSH;
      let aTargetW = aSW * aScale;
      // compute left position: place to the left of center character with 24px spacing
      const spacing = 24;
      const centerTargetW = (typeof targetW !== 'undefined') ? targetW : 0; // from current sprite if present
      const leftX = charX - (centerTargetW / 2) - spacing - (aTargetW / 2);
      const leftY = charY - aTargetH / 2;
      push();
      image(aImg, leftX, leftY, aTargetW, aTargetH);
      pop();
    }
  }

  // (sheetFrames handled above through currentFrames)
}

function keyPressed() {
  if (keyCode === LEFT_ARROW) {
    vx = -speed;
    facing = -1;
    isWalking = true;
  }
  if (keyCode === RIGHT_ARROW) {
    vx = speed;
    facing = 1;
    isWalking = true;
  }
}

function keyReleased() {
  if (keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW) {
    vx = 0;
    isWalking = false;
    // revert to idle frames (if available)
    if (yiyiFrames.length > 0) currentFrames = yiyiFrames;
    else if (sheetFrames.length > 0) currentFrames = sheetFrames;
  }
}

function updateCharacterPosition() {
  if (vx !== 0) {
    charX += vx;
    const halfW = 40;
    charX = constrain(charX, halfW, width - halfW);
  }
}

