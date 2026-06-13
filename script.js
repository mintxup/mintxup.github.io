const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

let width, height;
function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Input Logic
const nickInput = document.getElementById('nick');
const originalNick = "mintxup";
let typingTimer;
let deletingInterval;

nickInput.addEventListener('input', () => {
    clearTimeout(typingTimer);
    clearInterval(deletingInterval);
    
    typingTimer = setTimeout(() => {
        startReverting();
    }, 2000); // 2 seconds after typing stops
});

function startReverting() {
    clearInterval(deletingInterval);
    deletingInterval = setInterval(() => {
        let currentVal = nickInput.value;
        if (currentVal === originalNick) {
            clearInterval(deletingInterval);
            return;
        }
        
        let commonPrefixLen = 0;
        for (let i = 0; i < Math.min(currentVal.length, originalNick.length); i++) {
            if (currentVal[i] === originalNick[i]) {
                commonPrefixLen++;
            } else {
                break;
            }
        }
        
        if (currentVal.length > commonPrefixLen) {
            nickInput.value = currentVal.slice(0, -1);
        } else {
            nickInput.value = currentVal + originalNick[currentVal.length];
        }
    }, 150);
}

// Particle System
const particles = [];
const numParticles = 250;
let shockwaves = [];
let powerCircleRadius = 0;

// Collect DOM elements for collision
const domElements = [nickInput, ...document.querySelectorAll('.link')];
const bumps = new Map();
domElements.forEach(el => bumps.set(el, { x: 0, y: 0, rot: 0, hovered: false }));

// Handle hover state to not overwrite scale
domElements.forEach(el => {
    el.addEventListener('mouseenter', () => bumps.get(el).hovered = true);
    el.addEventListener('mouseleave', () => bumps.get(el).hovered = false);
});

class Particle {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.lastX = this.x;
        this.lastY = this.y;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.h = Math.random() * 360;
        this.s = 90 + Math.random() * 10; // 90-100%
        this.l = 70 + Math.random() * 20; // 70-90% (brighter)
        this.radius = Math.random() * 1.5 + 0.5; // smaller
    }
    
    update(mouseX, mouseY, isMouseDown) {
        this.lastX = this.x;
        this.lastY = this.y;

        if (isMouseDown) {
            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Exponential attraction based on distance
            // far = fast, near = slow
            const adjustedForce = 0.05 + Math.pow(dist / 300, 1.5);
            
            if (dist > 0) {
                this.vx += (dx / dist) * adjustedForce;
                this.vy += (dy / dist) * adjustedForce;
            }
            
            // Limit max speed so they don't overshoot infinitely, but let them go fast
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            const maxSpeed = 15;
            if (speed > maxSpeed) {
                this.vx = (this.vx / speed) * maxSpeed;
                this.vy = (this.vy / speed) * maxSpeed;
            }

            // Damping near the cursor to slow down
            if (dist < 100) {
                this.vx *= 0.85;
                this.vy *= 0.85;
            } else {
                this.vx *= 0.95;
                this.vy *= 0.95;
            }

        } else {
            this.vx += (Math.random() - 0.5) * 0.5;
            this.vy += (Math.random() - 0.5) * 0.5;
            
            this.vx *= 0.98;
            this.vy *= 0.98;
            
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (speed > 4) {
                this.vx = (this.vx / speed) * 4;
                this.vy = (this.vy / speed) * 4;
            }
        }
        
        this.x += this.vx;
        this.y += this.vy;
        
        // Wrapping around the screen or bouncing
        if (this.x < 0) { this.x = 0; this.vx *= -1; this.lastX = this.x; }
        if (this.x > width) { this.x = width; this.vx *= -1; this.lastX = this.x; }
        if (this.y < 0) { this.y = 0; this.vy *= -1; this.lastY = this.y; }
        if (this.y > height) { this.y = height; this.vy *= -1; this.lastY = this.y; }

        // DOM Collision
        domElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            // Check if particle is roughly inside the element bounds
            if (this.x >= rect.left && this.x <= rect.right && this.y >= rect.top && this.y <= rect.bottom) {
                const b = bumps.get(el);
                // Bump element slightly in direction of particle velocity
                b.x += this.vx * 0.5;
                b.y += this.vy * 0.5;
                b.rot += (this.vx - this.vy) * 0.1;
                
                // Bounce particle off
                this.vx *= -1;
                this.vy *= -1;
                this.x += this.vx;
                this.y += this.vy;
            }
        });
    }
    
    draw(ctx, isMouseDown) {
        ctx.beginPath();
        ctx.lineWidth = this.radius * 2;
        ctx.lineCap = "round";
        ctx.moveTo(this.lastX, this.lastY);
        ctx.lineTo(this.x, this.y);
        
        if (isMouseDown) {
            ctx.strokeStyle = `rgba(255, 255, 255, 0.8)`;
        } else {
            ctx.strokeStyle = `hsla(${this.h}, ${this.s}%, ${this.l}%, 0.25)`;
        }
        ctx.stroke();
    }
}

for (let i = 0; i < numParticles; i++) {
    particles.push(new Particle());
}

let mouse = { x: width / 2, y: height / 2 };
let isMouseDown = false;

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

window.addEventListener('mousedown', () => {
    isMouseDown = true;
});

window.addEventListener('mouseup', () => {
    isMouseDown = false;
    
    // Shockwave
    shockwaves.push({
        x: mouse.x,
        y: mouse.y,
        radius: 10,
        opacity: 1
    });

    // Explosion effect
    particles.forEach(p => {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const force = Math.max(10, 800 / (dist + 1)); 
        
        if (dist > 0) {
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
        } else {
            p.vx += (Math.random() - 0.5) * force;
            p.vy += (Math.random() - 0.5) * force;
        }
    });
});

function updateDOMBumps() {
    domElements.forEach(el => {
        const b = bumps.get(el);
        
        // Return to 0 slowly
        b.x *= 0.85;
        b.y *= 0.85;
        b.rot *= 0.85;
        
        // Limit max values to prevent crazy flying texts
        b.x = Math.max(-20, Math.min(20, b.x));
        b.y = Math.max(-20, Math.min(20, b.y));
        b.rot = Math.max(-10, Math.min(10, b.rot));

        // Apply transform. Preserve hover scale if hovered.
        const baseScale = b.hovered ? (el.classList.contains('link') ? 1.1 : 1.05) : 1;
        el.style.transform = `translate(${b.x}px, ${b.y}px) rotate(${b.rot}deg) scale(${baseScale})`;
    });
}

function animate() {
    // Fill semi-transparent black for trails
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'; // slightly darker fade to keep lines sharp
    ctx.fillRect(0, 0, width, height);
    
    // Draw power circle
    if (isMouseDown) {
        powerCircleRadius = Math.min(powerCircleRadius + 2, 30);
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, powerCircleRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + Math.sin(Date.now() / 100) * 0.2})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    } else {
        powerCircleRadius = 0;
    }

    // Draw shockwaves
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        let sw = shockwaves[i];
        sw.radius += 15;
        sw.opacity -= 0.02;
        
        if (sw.opacity <= 0) {
            shockwaves.splice(i, 1);
            continue;
        }
        
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${sw.opacity})`;
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    particles.forEach(p => {
        p.update(mouse.x, mouse.y, isMouseDown);
        p.draw(ctx, isMouseDown);
    });

    updateDOMBumps();
    
    requestAnimationFrame(animate);
}

animate();
