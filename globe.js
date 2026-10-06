(() => {
  'use strict';

  const canvas = document.getElementById('bhrGlobe');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let width = 640;
  let height = 430;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let rotation = -0.55;
  let tilt = -0.12;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let raf = 0;
  let lastTime = performance.now();

  const points = [];
  const pointCount = 1100;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < pointCount; i += 1) {
    const y = 1 - (i / (pointCount - 1)) * 2;
    const rr = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    points.push({ x: Math.cos(theta) * rr, y, z: Math.sin(theta) * rr });
  }

  const nodes = [
    { lat: 38.9, lon: -77.0 },
    { lat: 40.7, lon: -74.0 },
    { lat: 25.8, lon: -80.2 },
    { lat: 34.0, lon: -118.2 },
    { lat: 41.9, lon: -87.6 },
    { lat: 29.7, lon: -95.3 },
    { lat: 47.6, lon: -122.3 },
    { lat: 51.5, lon: -0.1 },
    { lat: 35.7, lon: 139.7 },
    { lat: -33.9, lon: 151.2 }
  ];
  const routes = [[0,1],[0,2],[0,3],[1,4],[2,5],[3,6],[0,7],[7,8],[2,9]];

  function latLon(lat, lon) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;
    return {
      x: -(Math.sin(phi) * Math.cos(theta)),
      y: Math.cos(phi),
      z: Math.sin(phi) * Math.sin(theta)
    };
  }

  function rotate(point) {
    const cr = Math.cos(rotation), sr = Math.sin(rotation);
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const x1 = point.x * cr - point.z * sr;
    const z1 = point.x * sr + point.z * cr;
    const y2 = point.y * ct - z1 * st;
    const z2 = point.y * st + z1 * ct;
    return { x: x1, y: y2, z: z2 };
  }

  function geometry() {
    const radius = Math.min(width, height) * (width < 500 ? 0.40 : 0.42);
    return { cx: width / 2, cy: height / 2 + (width < 500 ? 2 : 6), radius };
  }

  function project(point, scale = 1) {
    const p = rotate(point);
    const { cx, cy, radius } = geometry();
    return {
      x: cx + p.x * radius * scale,
      y: cy - p.y * radius * scale,
      z: p.z
    };
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(260, rect.width || 640);
    height = Math.max(260, rect.height || 430);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now(), true);
  }

  function drawGlow() {
    const { cx, cy, radius } = geometry();
    const glow = ctx.createRadialGradient(cx - radius * .24, cy - radius * .26, radius * .08, cx, cy, radius * 1.12);
    glow.addColorStop(0, 'rgba(92,226,255,.18)');
    glow.addColorStop(.42, 'rgba(39,145,184,.09)');
    glow.addColorStop(.72, 'rgba(11,48,67,.05)');
    glow.addColorStop(1, 'rgba(4,10,15,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(138,226,247,.24)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawPoints() {
    const { cx, cy, radius } = geometry();
    for (const raw of points) {
      const p = rotate(raw);
      if (p.z < -0.12) continue;
      const depth = Math.max(0, (p.z + 0.12) / 1.12);
      const size = 0.75 + depth * 1.15;
      ctx.fillStyle = `rgba(112,224,247,${0.10 + depth * 0.58})`;
      ctx.beginPath();
      ctx.arc(cx + p.x * radius, cy - p.y * radius, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawLatitudeLongitude() {
    ctx.lineWidth = 0.75;
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let started = false;
      for (let lon = -180; lon <= 180; lon += 4) {
        const p = project(latLon(lat, lon));
        if (p.z < 0) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = 'rgba(118,208,233,.055)';
      ctx.stroke();
    }
    for (let lon = -150; lon <= 180; lon += 30) {
      ctx.beginPath();
      let started = false;
      for (let lat = -88; lat <= 88; lat += 3) {
        const p = project(latLon(lat, lon));
        if (p.z < 0) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = 'rgba(118,208,233,.045)';
      ctx.stroke();
    }
  }

  function quadraticPoint(a, c, b, t) {
    const u = 1 - t;
    return {
      x: u*u*a.x + 2*u*t*c.x + t*t*b.x,
      y: u*u*a.y + 2*u*t*c.y + t*t*b.y
    };
  }

  function drawRoutes(now) {
    routes.forEach(([ia, ib], idx) => {
      const a = project(latLon(nodes[ia].lat, nodes[ia].lon), 1.01);
      const b = project(latLon(nodes[ib].lat, nodes[ib].lon), 1.01);
      if (a.z < 0.02 || b.z < 0.02) return;

      const dx = b.x - a.x, dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2 - Math.min(54, distance * .28);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(mx, my, b.x, b.y);
      ctx.strokeStyle = 'rgba(120,226,249,.20)';
      ctx.lineWidth = 1.05;
      ctx.stroke();

      const t = ((now * 0.00010) + idx * 0.113) % 1;
      const pulse = quadraticPoint(a, {x:mx,y:my}, b, t);
      ctx.fillStyle = 'rgba(225,249,255,.92)';
      ctx.shadowColor = 'rgba(98,222,249,.85)';
      ctx.shadowBlur = 9;
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, 2.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }

  function drawNodes() {
    nodes.forEach((n) => {
      const p = project(latLon(n.lat, n.lon), 1.01);
      if (p.z < 0.03) return;
      ctx.fillStyle = 'rgba(133,235,255,.88)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(133,235,255,.20)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7.2, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  function draw(now = performance.now(), staticFrame = false) {
    ctx.clearRect(0, 0, width, height);
    drawGlow();
    drawLatitudeLongitude();
    drawPoints();
    drawRoutes(now);
    drawNodes();

    if (!staticFrame && !dragging && !reduced.matches) {
      const dt = Math.min(32, now - lastTime);
      rotation += dt * 0.000085;
    }
    lastTime = now;

    if (!staticFrame) raf = requestAnimationFrame(draw);
  }

  function start() {
    cancelAnimationFrame(raf);
    lastTime = performance.now();
    raf = requestAnimationFrame(draw);
  }

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    rotation += dx * 0.0065;
    tilt = Math.max(-1.05, Math.min(1.05, tilt - dy * 0.005));
    lastX = event.clientX;
    lastY = event.clientY;
    draw(performance.now(), true);
  });
  const stop = () => { dragging = false; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('pointerleave', (event) => {
    if (event.buttons === 0) dragging = false;
  });
  canvas.addEventListener('dblclick', () => {
    rotation = -0.55;
    tilt = -0.12;
    draw(performance.now(), true);
  });

  reduced.addEventListener?.('change', () => draw(performance.now(), true));
  window.addEventListener('resize', resize, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);

  resize();
  start();
})();
