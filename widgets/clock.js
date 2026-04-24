import { createCard } from './utils.js';

export const type = 'clock';

export function create(widget) {
  const size = widget.size || 200;
  const el = createCard(widget.title || null);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.style.backgroundColor = widget.backgroundColor || '#333';
  canvas.style.display = 'block';
  canvas.style.margin = '0 auto';

  el.appendChild(canvas);
  startClock(canvas);
  return el;
}

function startClock(canvas) {
  const ctx = canvas.getContext("2d");
  const staticCanvas = document.createElement("canvas");
  staticCanvas.width = canvas.width;
  staticCanvas.height = canvas.height;
  const staticCtx = staticCanvas.getContext("2d");

  let radius = canvas.height / 2;
  ctx.translate(radius, radius);
  staticCtx.translate(radius, radius);
  radius = radius * 0.90;

  drawStaticClock();
  drawClock();
  setInterval(drawClock, 1000);

  function drawStaticClock() {
    drawFace(staticCtx, radius);
    drawTicks(staticCtx, radius);
    drawNumbers(staticCtx, radius);
  }

  function drawClock() {
    ctx.clearRect(-canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
    ctx.drawImage(staticCanvas, -canvas.width / 2, -canvas.height / 2);
    drawTime(ctx, radius);
  }

  function drawFace(ctx, radius) {
    const grad = ctx.createRadialGradient(0, 0, radius * 0.95, 0, 0, radius * 1.05);
    grad.addColorStop(0, '#333');
    grad.addColorStop(0.5, 'white');
    grad.addColorStop(1, '#333');

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.fillStyle = 'white';
    ctx.fill();

    ctx.strokeStyle = grad;
    ctx.lineWidth = radius * 0.1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.1, 0, 2 * Math.PI);
    ctx.fillStyle = '#333';
    ctx.fill();
  }

  function drawNumbers(ctx, radius) {
    ctx.font = radius * 0.15 + "px arial";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    for (let num = 1; num < 13; num++) {
      let ang = num * Math.PI / 6;
      ctx.rotate(ang);
      ctx.translate(0, -radius * 0.85);
      ctx.rotate(-ang);
      ctx.fillText(num.toString(), 0, 0);
      ctx.rotate(ang);
      ctx.translate(0, radius * 0.85);
      ctx.rotate(-ang);
    }
  }

  function drawTicks(ctx, radius) {
    for (let mark = 0; mark < 60; mark++) {
      const ang = mark * Math.PI / 30;
      const outer = radius * 0.76;
      const inner = radius * 0.72;

      ctx.save();
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.lineWidth = mark % 5 === 0 ? radius * 0.02 : radius * 0.01;
      ctx.strokeStyle = mark % 5 === 0 ? "#2a2a2a" : "#666";
      ctx.moveTo(0, -outer);
      ctx.lineTo(0, -inner);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawTime(ctx, radius) {
    const now = new Date();
    let hour = now.getHours();
    let minute = now.getMinutes();
    let second = now.getSeconds();

    // Keep all hands inside the numeral ring (drawn at radius * 0.85).
    const hourLength = radius * 0.45;
    const minuteLength = radius * 0.70;
    const secondLength = radius * 0.78;

    hour = hour % 12;
    hour = (hour * Math.PI / 6) + (minute * Math.PI / (6 * 60)) + (second * Math.PI / (360 * 60));
    drawHand(ctx, hour, hourLength, radius * 0.07, "#222");

    minute = (minute * Math.PI / 30) + (second * Math.PI / (30 * 60));
    drawHand(ctx, minute, minuteLength, radius * 0.07, "#222");

    second = (second * Math.PI / 30);
    drawHand(ctx, second, secondLength, radius * 0.02, "#d62828");
  }

  function drawHand(ctx, pos, length, width, color) {
    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = radius * 0.04;
    ctx.shadowOffsetX = radius * 0.01;
    ctx.shadowOffsetY = radius * 0.01;
    ctx.moveTo(0, 0);
    ctx.rotate(pos);
    ctx.lineTo(0, -length);
    ctx.stroke();
    ctx.restore();
  }
}
