(() => {
  'use strict';

  const canvas = document.getElementById('bhrGlobe');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let width = 720;
  let height = 460;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let rotation = -0.45;
  let tilt = -0.12;
  const baseTilt = -0.12;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let resumeAt = 0;
  let lastFrame = performance.now();

  const pointCount = 1800;
  const points = [];
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < pointCount; i += 1) {
    const y = 1 - (i / (pointCount - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    points.push({
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius
    });
  }

  const routeCoords = [
    [[37.7749, -122.4194], [40.7128, -74.0060]],
    [[40.7128, -74.0060], [51.5074, -0.1278]],
    [[51.5074, -0.1278], [1.3521, 103.8198]],
    [[35.6762, 139.6503], [37.7749, -122.4194]],
    [[-23.5505, -46.6333], [25.7617, -80.1918]],
    [[-33.8688, 151.2093], [1.3521, 103.8198]],
    [[-26.2041, 28.0473], [51.5074, -0.1278]],
    [[19.4326, -99.1332], [40.7128, -74.0060]],
    [[48.8566, 2.3522], [25.2048, 55.2708]],
    [[25.2048, 55.2708], [1.3521, 103.8198]],
    [[43.6532, -79.3832], [51.5074, -0.1278]],
    [[34.0522, -118.2437], [35.6762, 139.6503]],
    [[-34.6037, -58.3816], [-23.5505, -46.6333]],
    [[37.7749, -122.4194], [21.3069, -157.8583]]
  ];

  function latLonToVector(lat, lon) {
    const phi = lat * Math.PI / 180;
    const lam = lon * Math.PI / 180;
    const c = Math.cos(phi);
    return { x: c * Math.cos(lam), y: Math.sin(phi), z: c * Math.sin(lam) };
  }

  function slerp(a, b, t) {
    const dot = Math.max(-1, Math.min(1, a.x*b.x + a.y*b.y + a.z*b.z));
    const omega = Math.acos(dot);
    if (omega < 1e-5) return { x:a.x, y:a.y, z:a.z };
    const so = Math.sin(omega);
    const s1 = Math.sin((1-t)*omega)/so;
    const s2 = Math.sin(t*omega)/so;
    return { x:a.x*s1 + b.x*s2, y:a.y*s1 + b.y*s2, z:a.z*s1 + b.z*s2 };
  }

  const routes = routeCoords.map(([a,b]) => ({
    a: latLonToVector(a[0], a[1]),
    b: latLonToVector(b[0], b[1])
  }));

  function rotatePoint(p) {
    const cr = Math.cos(rotation), sr = Math.sin(rotation);
    const ct = Math.cos(tilt), st = Math.sin(tilt);

    const x1 = p.x * cr - p.z * sr;
    const z1 = p.x * sr + p.z * cr;
    const y2 = p.y * ct - z1 * st;
    const z2 = p.y * st + z1 * ct;

    return { x: x1, y: y2, z: z2 };
  }

  function layout() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now(), true);
  }

  function sphereGeometry() {
    const radius = Math.min(width * 0.40, height * 0.42);
    const cx = width * 0.5;
    const cy = height * 0.51;
    return { radius, cx, cy };
  }

  function drawPaperBackdrop(cx, cy, radius) {
    const glow = ctx.createRadialGradient(cx - radius*.28, cy - radius*.34, radius*.08, cx, cy, radius*1.15);
    glow.addColorStop(0, 'rgba(255,255,255,.98)');
    glow.addColorStop(.55, 'rgba(244,248,251,.96)');
    glow.addColorStop(1, 'rgba(227,235,242,.84)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI*2);
    ctx.fill();

    const rim = ctx.createLinearGradient(cx-radius, cy-radius, cx+radius, cy+radius);
    rim.addColorStop(0,'rgba(41,77,105,.18)');
    rim.addColorStop(.5,'rgba(41,77,105,.06)');
    rim.addColorStop(1,'rgba(41,77,105,.18)');
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI*2);
    ctx.stroke();
  }

  function drawGrid(cx, cy, radius) {
    ctx.lineWidth = .75;

    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let started = false;
      for (let lon = -180; lon <= 180; lon += 4) {
        const phi = lat*Math.PI/180, lam = lon*Math.PI/180;
        const c = Math.cos(phi);
        const q = rotatePoint({x:c*Math.cos(lam), y:Math.sin(phi), z:c*Math.sin(lam)});
        if (q.z < -.04) { started = false; continue; }
        const x = cx + q.x*radius, y = cy - q.y*radius;
        if (!started) { ctx.moveTo(x,y); started = true; } else ctx.lineTo(x,y);
      }
      ctx.strokeStyle = 'rgba(45,78,103,.105)';
      ctx.stroke();
    }

    for (let lon = -150; lon <= 180; lon += 30) {
      ctx.beginPath();
      let started = false;
      for (let lat = -88; lat <= 88; lat += 3) {
        const phi = lat*Math.PI/180, lam = lon*Math.PI/180;
        const c = Math.cos(phi);
        const q = rotatePoint({x:c*Math.cos(lam), y:Math.sin(phi), z:c*Math.sin(lam)});
        if (q.z < -.04) { started = false; continue; }
        const x = cx + q.x*radius, y = cy - q.y*radius;
        if (!started) { ctx.moveTo(x,y); started = true; } else ctx.lineTo(x,y);
      }
      ctx.strokeStyle = 'rgba(45,78,103,.075)';
      ctx.stroke();
    }
  }

  function drawPixels(cx, cy, radius) {
    for (const p of points) {
      const q = rotatePoint(p);
      if (q.z < -0.14) continue;
      const depth = (q.z + 1) / 2;
      const x = cx + q.x * radius;
      const y = cy - q.y * radius;
      const size = 0.7 + depth * 1.65;
      const alpha = 0.12 + depth * 0.62;
      ctx.fillStyle = `rgba(23,57,83,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI*2);
      ctx.fill();
    }
  }

  function routePoint(route, t) {
    const p = slerp(route.a, route.b, t);
    // Push route slightly above the surface to create an "arc over globe" feel.
    const lift = 1 + Math.sin(Math.PI*t) * 0.08;
    return { x:p.x*lift, y:p.y*lift, z:p.z*lift };
  }

  function drawRoutes(cx, cy, radius, time) {
    routes.forEach((route, routeIndex) => {
      ctx.beginPath();
      let started = false;

      for (let i = 0; i <= 72; i += 1) {
        const t = i/72;
        const q = rotatePoint(routePoint(route,t));
        if (q.z < -.08) { started = false; continue; }
        const x = cx + q.x*radius;
        const y = cy - q.y*radius;
        if (!started) { ctx.moveTo(x,y); started = true; } else ctx.lineTo(x,y);
      }

      ctx.strokeStyle = 'rgba(25,132,174,.42)';
      ctx.lineWidth = 1.1;
      ctx.stroke();

      [0, 1].forEach((endpointT) => {
        const qe = rotatePoint(routePoint(route, endpointT));
        if (qe.z > -.04) {
          const ex = cx + qe.x*radius;
          const ey = cy - qe.y*radius;
          ctx.fillStyle = 'rgba(17,120,158,.14)';
          ctx.beginPath();
          ctx.arc(ex,ey,5.2,0,Math.PI*2);
          ctx.fill();
          ctx.fillStyle = 'rgba(17,92,125,.82)';
          ctx.beginPath();
          ctx.arc(ex,ey,1.8,0,Math.PI*2);
          ctx.fill();
        }
      });

      const pulseT = ((time * 0.00008) + routeIndex * 0.137) % 1;
      const qp = rotatePoint(routePoint(route,pulseT));
      if (qp.z > -.05) {
        const x = cx + qp.x*radius;
        const y = cy - qp.y*radius;
        const halo = 4 + ((Math.sin(time*.004 + routeIndex)+1)*1.4);

        ctx.fillStyle = 'rgba(0,148,190,.14)';
        ctx.beginPath();
        ctx.arc(x,y,halo,0,Math.PI*2);
        ctx.fill();

        ctx.fillStyle = 'rgba(3,104,143,.95)';
        ctx.beginPath();
        ctx.arc(x,y,2.3,0,Math.PI*2);
        ctx.fill();
      }
    });
  }

  function draw(time, force = false) {
    if (!force && document.hidden) return;
    ctx.clearRect(0,0,width,height);
    const {radius,cx,cy} = sphereGeometry();
    drawPaperBackdrop(cx,cy,radius);
    drawGrid(cx,cy,radius);
    drawPixels(cx,cy,radius);
    drawRoutes(cx,cy,radius,time);
  }

  function tick(now) {
    const dt = Math.min(50, now - lastFrame);
    lastFrame = now;

    if (!dragging && now >= resumeAt && !reducedMotion.matches) {
      // East-west only. Tilt never auto-animates.
      rotation += dt * 0.000045;
    }

    draw(now);
    requestAnimationFrame(tick);
  }

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    resumeAt = Infinity;
    canvas.setPointerCapture?.(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    rotation += dx * 0.0065;
    tilt = Math.max(-0.75, Math.min(0.75, tilt + dy * 0.0048));
    lastX = event.clientX;
    lastY = event.clientY;
    draw(performance.now(), true);
  });

  function release() {
    if (!dragging) return;
    dragging = false;
    resumeAt = performance.now() + 1800;
  }

  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);

  canvas.addEventListener('dblclick', () => {
    tilt = baseTilt;
    rotation = -0.45;
    resumeAt = performance.now() + 1200;
    draw(performance.now(), true);
  });

  window.__bhrGlobeDebug = () => ({
    rotation,
    tilt,
    dragging,
    resumeAt,
    reducedMotion: reducedMotion.matches
  });

  const ro = new ResizeObserver(layout);
  ro.observe(canvas);
  reducedMotion.addEventListener?.('change', () => draw(performance.now(), true));

  layout();
  requestAnimationFrame(tick);
})();