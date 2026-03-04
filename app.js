const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");

const addBallBtn = document.getElementById("addBallBtn");
const resetBtn = document.getElementById("resetBtn");
const ballCountLabel = document.getElementById("ballCount");
const rotationSpeedLabel = document.getElementById("rotationSpeedLabel");

const sim = {
  center: { x: canvas.width / 2, y: canvas.height / 2 },
  sides: 12,
  apothem: Math.min(canvas.width, canvas.height) * 0.32,
  angle: 0,
  omega: 0.55,
  gravity: 900,
  restitution: 0.86,
  wallFriction: 0.996,
  maxBalls: 60,
  balls: [],
};

rotationSpeedLabel.textContent = `${sim.omega.toFixed(2)} rad/s`;

const random = (min, max) => Math.random() * (max - min) + min;

const vec = {
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
  scale: (a, k) => ({ x: a.x * k, y: a.y * k }),
  dot: (a, b) => a.x * b.x + a.y * b.y,
  length: (a) => Math.hypot(a.x, a.y),
  normalize: (a) => {
    const len = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / len, y: a.y / len };
  },
};

function polygonVertices(angle) {
  const vertices = [];
  const radius = sim.apothem / Math.cos(Math.PI / sim.sides);

  for (let i = 0; i < sim.sides; i += 1) {
    const t = angle + (Math.PI * 2 * i) / sim.sides;
    vertices.push({
      x: sim.center.x + radius * Math.cos(t),
      y: sim.center.y + radius * Math.sin(t),
    });
  }

  return vertices;
}

function buildEdges(vertices) {
  const edges = [];

  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const edge = vec.sub(b, a);
    const normal = vec.normalize({ x: edge.y, y: -edge.x });
    const midpoint = vec.scale(vec.add(a, b), 0.5);

    edges.push({ a, b, edge, normal, midpoint });
  }

  return edges;
}

function wallVelocity(point) {
  const offset = vec.sub(point, sim.center);
  return {
    x: -sim.omega * offset.y,
    y: sim.omega * offset.x,
  };
}

function createBall() {
  if (sim.balls.length >= sim.maxBalls) return;

  const radius = random(12, 18);
  const hue = Math.floor(random(180, 340));
  const speed = random(60, 210);
  const direction = random(0, Math.PI * 2);
  const spawnRadius = sim.apothem * random(0.04, 0.38);
  const spawnTheta = random(0, Math.PI * 2);

  sim.balls.push({
    x: sim.center.x + spawnRadius * Math.cos(spawnTheta),
    y: sim.center.y + spawnRadius * Math.sin(spawnTheta),
    vx: speed * Math.cos(direction),
    vy: speed * Math.sin(direction),
    radius,
    color: `hsl(${hue}, 95%, 65%)`,
    mass: radius * radius,
  });

  ballCountLabel.textContent = String(sim.balls.length);
}

function resetBalls() {
  sim.balls = [];
  ballCountLabel.textContent = "0";
}

function resolveBallCollision(a, b) {
  const delta = vec.sub(b, a);
  const dist = vec.length(delta) || 0.0001;
  const overlap = a.radius + b.radius - dist;
  if (overlap <= 0) return;

  const n = vec.scale(delta, 1 / dist);
  const relVel = vec.sub({ x: b.vx, y: b.vy }, { x: a.vx, y: a.vy });
  const velAlongNormal = vec.dot(relVel, n);

  const totalMass = a.mass + b.mass;
  const correction = overlap * 0.52;
  a.x -= (correction * n.x * b.mass) / totalMass;
  a.y -= (correction * n.y * b.mass) / totalMass;
  b.x += (correction * n.x * a.mass) / totalMass;
  b.y += (correction * n.y * a.mass) / totalMass;

  if (velAlongNormal > 0) return;

  const restitution = 0.92;
  const impulseMag = (-(1 + restitution) * velAlongNormal) / (1 / a.mass + 1 / b.mass);
  const impulse = vec.scale(n, impulseMag);

  a.vx -= impulse.x / a.mass;
  a.vy -= impulse.y / a.mass;
  b.vx += impulse.x / b.mass;
  b.vy += impulse.y / b.mass;
}

function update(dt) {
  sim.angle += sim.omega * dt;

  const vertices = polygonVertices(sim.angle);
  const edges = buildEdges(vertices);

  for (const ball of sim.balls) {
    ball.vy += sim.gravity * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    for (const edge of edges) {
      const toBall = vec.sub({ x: ball.x, y: ball.y }, edge.a);
      const distance = vec.dot(toBall, edge.normal);
      if (distance < ball.radius) {
        const penetration = ball.radius - distance;
        ball.x += edge.normal.x * penetration;
        ball.y += edge.normal.y * penetration;

        const wallVel = wallVelocity(edge.midpoint);
        const relativeVel = {
          x: ball.vx - wallVel.x,
          y: ball.vy - wallVel.y,
        };
        const normalSpeed = vec.dot(relativeVel, edge.normal);

        if (normalSpeed < 0) {
          const tangent = { x: -edge.normal.y, y: edge.normal.x };
          const tangentSpeed = vec.dot(relativeVel, tangent) * sim.wallFriction;

          const bounced = {
            x: tangent.x * tangentSpeed - edge.normal.x * normalSpeed * sim.restitution,
            y: tangent.y * tangentSpeed - edge.normal.y * normalSpeed * sim.restitution,
          };

          ball.vx = bounced.x + wallVel.x;
          ball.vy = bounced.y + wallVel.y;
        }
      }
    }
  }

  for (let i = 0; i < sim.balls.length; i += 1) {
    for (let j = i + 1; j < sim.balls.length; j += 1) {
      resolveBallCollision(sim.balls[i], sim.balls[j]);
    }
  }

  return vertices;
}

function draw(vertices) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.65)";
  ctx.beginPath();
  vertices.forEach((vertex, idx) => {
    if (idx === 0) ctx.moveTo(vertex.x, vertex.y);
    else ctx.lineTo(vertex.x, vertex.y);
  });
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(147, 197, 253, 0.95)";
  ctx.lineWidth = 4;
  ctx.shadowColor = "rgba(96, 165, 250, 0.65)";
  ctx.shadowBlur = 16;
  ctx.stroke();
  ctx.restore();

  for (const ball of sim.balls) {
    const gradient = ctx.createRadialGradient(
      ball.x - ball.radius * 0.34,
      ball.y - ball.radius * 0.34,
      ball.radius * 0.2,
      ball.x,
      ball.y,
      ball.radius
    );
    gradient.addColorStop(0, "rgba(255,255,255,0.95)");
    gradient.addColorStop(0.3, ball.color);
    gradient.addColorStop(1, "rgba(15, 23, 42, 0.5)");

    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.fillStyle = "rgba(191, 219, 254, 0.95)";
  ctx.arc(sim.center.x, sim.center.y, 4, 0, Math.PI * 2);
  ctx.fill();
}

let previous = performance.now();
function tick(now) {
  const dt = Math.min((now - previous) / 1000, 1 / 30);
  previous = now;
  const vertices = update(dt);
  draw(vertices);
  requestAnimationFrame(tick);
}

addBallBtn.addEventListener("click", createBall);
resetBtn.addEventListener("click", resetBalls);

for (let i = 0; i < 6; i += 1) createBall();
requestAnimationFrame(tick);
