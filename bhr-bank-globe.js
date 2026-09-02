(() => {
  'use strict';
  const canvas = document.getElementById('bhr-globe');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const stage = canvas.closest('[data-bhr-globe-stage]');
  const orbitChips = [...document.querySelectorAll('[data-orbit-chip]')];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let width = 600;
  let height = 600;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let rotation = -0.45;
  let tilt = -0.13;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let visible = true;
  let lastTime = performance.now();
  let velocityX = 0;
  let velocityY = 0;

  const nodes = [
    { label: 'OCC', lat: 30, lon: -82, color: '#64d8ff' },
    { label: 'FDIC', lat: 42, lon: -18, color: '#3ee7cf' },
    { label: 'CFPB', lat: 8, lon: 38, color: '#64d8ff' },
    { label: 'FFIEC', lat: -30, lon: 66, color: '#6d7cff' },
    { label: 'FTC', lat: -16, lon: -38, color: '#f4c96d' },
    { label: 'DOJ', lat: 43, lon: 94, color: '#f4c96d' },
    { label: 'COURTS', lat: -42, lon: 8, color: '#aeb8ff' },
  ];
  const routes = [[0,1],[0,2],[1,3],[2,4],[2,5],[0,6],[3,6]];

  const points = [];
  const count = 820;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = golden * i;
    points.push({ x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius });
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(300, rect.width);
    height = Math.max(300, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rotatePoint(point, extraRadius = 1) {
    const cr = Math.cos(rotation), sr = Math.sin(rotation);
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const x1 = point.x * cr - point.z * sr;
    const z1 = point.x * sr + point.z * cr;
    const y2 = point.y * ct - z1 * st;
    const z2 = point.y * st + z1 * ct;
    return { x: x1 * extraRadius, y: y2 * extraRadius, z: z2 * extraRadius };
  }

  function latLon(lat, lon) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;
    return { x: -(Math.sin(phi) * Math.cos(theta)), y: Math.cos(phi), z: Math.sin(phi) * Math.sin(theta) };
  }

  function project(point, radiusScale = 1) {
    const r = Math.min(width, height) * 0.36;
    return { x: width / 2 + point.x * r * radiusScale, y: height / 2 - point.y * r * radiusScale, z: point.z, r };
  }

  function drawSphere() {
    const cx = width / 2, cy = height / 2;
    const radius = Math.min(width, height) * 0.36;
    const glow = ctx.createRadialGradient(cx - radius * .25, cy - radius * .3, radius * .05, cx, cy, radius * 1.35);
    glow.addColorStop(0, 'rgba(100,216,255,.27)');
    glow.addColorStop(.52, 'rgba(0,90,190,.09)');
    glow.addColorStop(1, 'rgba(0,10,30,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, radius * 1.28, 0, Math.PI * 2); ctx.fill();

    const edge = ctx.createRadialGradient(cx, cy, radius * .5, cx, cy, radius);
    edge.addColorStop(0, 'rgba(0,24,56,.11)');
    edge.addColorStop(.76, 'rgba(0,78,156,.14)');
    edge.addColorStop(1, 'rgba(100,216,255,.42)');
    ctx.fillStyle = edge; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(100,216,255,.48)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
  }

  function drawGrid() {
    const radius = Math.min(width, height) * 0.36;
    const cx = width / 2, cy = height / 2;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.clip();
    ctx.lineWidth = .7; ctx.strokeStyle = 'rgba(75,181,255,.14)';
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath(); let started = false;
      for (let lon = -180; lon <= 180; lon += 4) {
        const p = rotatePoint(latLon(lat, lon)); if (p.z < -.05) { started = false; continue; }
        const s = project(p); if (!started) { ctx.moveTo(s.x, s.y); started = true; } else ctx.lineTo(s.x, s.y);
      } ctx.stroke();
    }
    for (let lon = -150; lon <= 180; lon += 30) {
      ctx.beginPath(); let started = false;
      for (let lat = -89; lat <= 89; lat += 3) {
        const p = rotatePoint(latLon(lat, lon)); if (p.z < -.05) { started = false; continue; }
        const s = project(p); if (!started) { ctx.moveTo(s.x, s.y); started = true; } else ctx.lineTo(s.x, s.y);
      } ctx.stroke();
    }
    ctx.restore();
  }

  function drawPoints() {
    for (const point of points) {
      const p = rotatePoint(point); if (p.z < -.18) continue;
      const s = project(p); const alpha = Math.max(.07, (p.z + .2) / 1.2) * .76; const size = .55 + Math.max(0, p.z) * 1.25;
      ctx.fillStyle = `rgba(100,216,255,${alpha})`; ctx.beginPath(); ctx.arc(s.x, s.y, size, 0, Math.PI * 2); ctx.fill();
    }
  }

  function sphericalMix(a, b, t) {
    let x = a.x * (1 - t) + b.x * t, y = a.y * (1 - t) + b.y * t, z = a.z * (1 - t) + b.z * t;
    const len = Math.hypot(x, y, z) || 1; x /= len; y /= len; z /= len;
    const lift = 1 + Math.sin(Math.PI * t) * .19;
    return { x: x * lift, y: y * lift, z: z * lift };
  }

  function drawRoutes(time) {
    routes.forEach(([from, to], routeIndex) => {
      const a = latLon(nodes[from].lat, nodes[from].lon), b = latLon(nodes[to].lat, nodes[to].lon); const samples = [];
      for (let i = 0; i <= 40; i += 1) { const p = rotatePoint(sphericalMix(a, b, i / 40)); if (p.z > -.12) samples.push(project(p)); }
      if (samples.length < 2) return;
      ctx.strokeStyle = routeIndex % 3 === 0 ? 'rgba(244,201,109,.58)' : 'rgba(100,216,255,.48)'; ctx.lineWidth = 1.1; ctx.beginPath();
      samples.forEach((s, i) => i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y)); ctx.stroke();
      const progress = ((time / 2400) + routeIndex * .15) % 1; const pulse = samples[Math.min(samples.length - 1, Math.floor(progress * samples.length))];
      if (pulse) { const gradient = ctx.createRadialGradient(pulse.x, pulse.y, 0, pulse.x, pulse.y, 9); gradient.addColorStop(0, '#fff'); gradient.addColorStop(.24, routeIndex % 3 === 0 ? '#f4c96d' : '#64d8ff'); gradient.addColorStop(1, 'rgba(100,216,255,0)'); ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(pulse.x, pulse.y, 9, 0, Math.PI * 2); ctx.fill(); }
    });
  }

  function drawNodes(time) {
    nodes.forEach((node, index) => {
      const p = rotatePoint(latLon(node.lat, node.lon)); if (p.z < -.15) return; const s = project(p); const pulse = 1 + Math.sin(time / 480 + index) * .16;
      ctx.shadowColor = node.color; ctx.shadowBlur = 18; ctx.fillStyle = node.color; ctx.beginPath(); ctx.arc(s.x, s.y, 4 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = node.color; ctx.globalAlpha = .42; ctx.beginPath(); ctx.arc(s.x, s.y, 9 * pulse, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    });
  }

  function positionOrbitChips(time) {
    const base = Math.min(width, height);
    orbitChips.forEach((chip, index) => {
      const ring = Number(chip.dataset.ring || 1); const initial = Number(chip.dataset.angle || 0);
      const speed = ring === 1 ? .000105 : -.000075;
      const angle = reduceMotion.matches ? initial : initial + time * speed;
      const rx = base * (ring === 1 ? .39 : .47); const ry = base * (ring === 1 ? .18 : .25);
      const x = Math.cos(angle) * rx; const y = Math.sin(angle) * ry; const depth = (Math.sin(angle) + 1) / 2;
      chip.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${(.86 + depth * .16).toFixed(3)})`;
      chip.style.opacity = String(.58 + depth * .42); chip.style.zIndex = String(4 + Math.round(depth * 4));
    });
  }

  function frame(time) {
    const delta = Math.min(40, time - lastTime); lastTime = time;
    if (visible) {
      if (!dragging && !reduceMotion.matches) {
        rotation += delta * .000105 + velocityX;
        tilt = Math.max(-.68, Math.min(.68, tilt + velocityY));
        velocityX *= .94; velocityY *= .92;
      }
      ctx.clearRect(0, 0, width, height); drawSphere(); drawGrid(); drawRoutes(time); drawPoints(); drawNodes(time); positionOrbitChips(time);
    }
    requestAnimationFrame(frame);
  }

  function startDrag(event) { dragging = true; lastX = event.clientX; lastY = event.clientY; velocityX = 0; velocityY = 0; canvas.setPointerCapture?.(event.pointerId); }
  function moveDrag(event) {
    if (!dragging || reduceMotion.matches) return; const dx = event.clientX - lastX, dy = event.clientY - lastY;
    const rx = dx * .006, ry = dy * .004; rotation += rx; tilt = Math.max(-.68, Math.min(.68, tilt + ry)); velocityX = rx * .08; velocityY = ry * .06; lastX = event.clientX; lastY = event.clientY;
  }
  function endDrag(event) { dragging = false; canvas.releasePointerCapture?.(event.pointerId); }

  canvas.addEventListener('pointerdown', startDrag); canvas.addEventListener('pointermove', moveDrag); canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('dblclick', () => { rotation = -.45; tilt = -.13; velocityX = 0; velocityY = 0; });
  window.addEventListener('resize', resize, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  if ('IntersectionObserver' in window && stage) new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: .02 }).observe(stage);
  document.addEventListener('visibilitychange', () => { if (document.hidden) visible = false; else if (stage) visible = stage.getBoundingClientRect().bottom > 0 && stage.getBoundingClientRect().top < innerHeight; });
  resize(); requestAnimationFrame(frame);
})();
