const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

let width, height;
function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Loader, Progress Bar, and Sound Preload
let audioBlobUrl = '';
let audioReady = false;
let pageReady = false;
let entered = false;

async function loadSound() {
    const progressBar = document.getElementById('progress-bar');
    try {
        const response = await fetch('startup.opus');
        if (!response.ok) throw new Error("Failed to load startup.opus");
        
        const reader = response.body.getReader();
        const contentLength = +response.headers.get('Content-Length') || 49538;
        
        let receivedLength = 0;
        let chunks = [];
        
        while(true) {
            const {done, value} = await reader.read();
            if (done) break;
            chunks.push(value);
            receivedLength += value.length;
            
            const percent = (receivedLength / contentLength) * 100;
            progressBar.style.width = Math.min(100, percent) + '%';
        }
        
        const blob = new Blob(chunks);
        audioBlobUrl = URL.createObjectURL(blob);
        audioReady = true;
        checkLoadingComplete();
    } catch (err) {
        console.warn("Sound preload failed, using fallback:", err);
        // Fallback progress bar filling
        let progress = 0;
        const interval = setInterval(() => {
            progress += 5;
            progressBar.style.width = Math.min(100, progress) + '%';
            if (progress >= 100) {
                clearInterval(interval);
                audioReady = true;
                checkLoadingComplete();
            }
        }, 50);
    }
}

window.addEventListener('load', () => {
    pageReady = true;
    checkLoadingComplete();
});

function checkLoadingComplete() {
    if (audioReady && pageReady) {
        setTimeout(() => {
            const progressBarContainer = document.getElementById('progress-bar-container');
            progressBarContainer.style.display = 'none';
            
            const clickToEnter = document.getElementById('click-to-enter');
            clickToEnter.classList.remove('hidden');
            
            document.getElementById('loader-overlay').addEventListener('click', enterSite);
        }, 500); // 0.5s delay after full load
    }
}

function enterSite() {
    if (entered) return;
    entered = true;

    const loader = document.getElementById('loader-overlay');
    loader.style.opacity = '0';
    setTimeout(() => {
        loader.style.display = 'none';
    }, 500);

    // Play startup sound
    const soundPath = audioBlobUrl || 'startup.opus';
    const audio = new Audio(soundPath);
    audio.play().catch(err => console.warn("Audio play blocked by browser:", err));

    // Show main container
    document.querySelector('.content').classList.add('visible');

    // Run simultaneous typewriter typing
    typeWriter();
}

// Start preloading sound immediately
loadSound();

// Input Logic
const nickInput = document.getElementById('nick');
const originalNick = "mintxup";
let typingTimer;
let deletingInterval;

function adjustInputWidth() {
    nickInput.style.width = Math.max(1, nickInput.value.length) + "ch";
}

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
        adjustInputWidth();
    }, 60);
}

function setupInputListeners() {
    nickInput.addEventListener('input', () => {
        adjustInputWidth();
        clearTimeout(typingTimer);
        clearInterval(deletingInterval);
        
        typingTimer = setTimeout(() => {
            startReverting();
        }, 2000);
    });
}

// Particle System
const particles = [];
const numParticles = 250;
let shockwaves = [];
let powerCircleRadius = 0;

const domElements = [nickInput, ...document.querySelectorAll('.link')];
const bumps = new Map();
domElements.forEach(el => bumps.set(el, { x: 0, y: 0, rot: 0, hovered: false }));

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
        this.s = 90 + Math.random() * 10;
        this.l = 70 + Math.random() * 20;
        this.radius = Math.random() * 1.0 + 0.5; // Slightly larger points
    }
    
    update(mouseX, mouseY, isMouseDown, frameCollisions) {
        this.lastX = this.x;
        this.lastY = this.y;

        if (isMouseDown) {
            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            const adjustedForce = 0.15 + Math.pow(dist / 300, 1.5);
            
            if (dist > 0) {
                this.vx += (dx / dist) * adjustedForce;
                this.vy += (dy / dist) * adjustedForce;
            }
            
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            const maxSpeed = 15;
            if (speed > maxSpeed) {
                this.vx = (this.vx / speed) * maxSpeed;
                this.vy = (this.vy / speed) * maxSpeed;
            }

            if (dist < 100) {
                this.vx *= 0.92;
                this.vy *= 0.92;
            } else {
                this.vx *= 0.95;
                this.vy *= 0.95;
            }

        } else {
            this.vx += (Math.random() - 0.5) * 0.2;
            this.vy += (Math.random() - 0.5) * 0.2;
            
            this.vx *= 0.97;
            this.vy *= 0.97;
            
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (speed < 1.5 && speed > 0) {
                this.vx = (this.vx / speed) * 1.5;
                this.vy = (this.vy / speed) * 1.5;
            }
        }
        
        this.x += this.vx;
        this.y += this.vy;
        
        if (this.x < 0) { this.x = 0; this.vx *= -1; this.lastX = this.x; }
        if (this.x > width) { this.x = width; this.vx *= -1; this.lastX = this.x; }
        if (this.y < 0) { this.y = 0; this.vy *= -1; this.lastY = this.y; }
        if (this.y > height) { this.y = height; this.vy *= -1; this.lastY = this.y; }

        if (isTypewriterFinished) {
            domElements.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (this.x >= rect.left && this.x <= rect.right && this.y >= rect.top && this.y <= rect.bottom) {
                    const col = frameCollisions.get(el);
                    if (col && col.count < 3) {
                        col.x += this.vx * 0.1;
                        col.y += this.vy * 0.1;
                        col.rot += (this.vx - this.vy) * 0.03;
                        col.count++;
                    }
                }
            });
        }
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
    // Only allow mouse physics if user has entered the site
    if (entered) {
        isMouseDown = true;
    }
});

window.addEventListener('mouseup', () => {
    if (!entered || !isTypewriterFinished) return;
    isMouseDown = false;
    
    shockwaves.push({
        x: mouse.x,
        y: mouse.y,
        radius: powerCircleRadius,
        opacity: 1
    });

    // Explosion force: baseForce = 10, charge = 0.03
    const chargeMultiplier = 1 + (powerCircleRadius * 0.03);
    const baseForce = 10 * chargeMultiplier;
    
    particles.forEach(p => {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const force = baseForce + ((1000 * chargeMultiplier) / (dist + 50)); 
        
        if (dist > 0) {
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
        } else {
            const angle = Math.random() * Math.PI * 2;
            p.vx += Math.cos(angle) * force;
            p.vy += Math.sin(angle) * force;
        }
    });
});

function updateDOMBumps() {
    domElements.forEach(el => {
        const b = bumps.get(el);
        
        b.x *= 0.90;
        b.y *= 0.90;
        b.rot *= 0.90;
        
        b.x = Math.max(-10, Math.min(10, b.x));
        b.y = Math.max(-10, Math.min(10, b.y));
        b.rot = Math.max(-5, Math.min(5, b.rot));

        const baseScale = b.hovered ? (el.classList.contains('link') ? 1.1 : 1.05) : 1;
        el.style.transform = `translate(${b.x}px, ${b.y}px) rotate(${b.rot}deg) scale(${baseScale})`;
    });
}

// Typewriter Initialization (Simultaneous typing)
let isTypewriterFinished = false;
const originalLinksText = [];
const links = document.querySelectorAll('.link');

links.forEach(link => {
    originalLinksText.push(link.textContent);
    link.textContent = '';
});
nickInput.value = '';
adjustInputWidth();

function typeWriter() {
    let isInputFinished = false;
    let linksFinishedCount = 0;
    
    function checkFinished() {
        if (isInputFinished && linksFinishedCount === links.length) {
            isTypewriterFinished = true;
            setupInputListeners();
        }
    }

    // Type input
    let inputIndex = 0;
    const inputTarget = "mintxup";
    function typeInput() {
        if (inputIndex < inputTarget.length) {
            nickInput.value += inputTarget[inputIndex];
            adjustInputWidth();
            inputIndex++;
            setTimeout(typeInput, 100);
        } else {
            isInputFinished = true;
            checkFinished();
        }
    }
    typeInput();

    // Type links simultaneously
    links.forEach((link, linkIdx) => {
        let targetText = originalLinksText[linkIdx];
        let charIdx = 0;
        
        function typeChar() {
            if (charIdx < targetText.length) {
                link.textContent += targetText[charIdx];
                charIdx++;
                setTimeout(typeChar, 75);
            } else {
                linksFinishedCount++;
                checkFinished();
            }
        }
        typeChar();
    });
}

function animate() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, 0, width, height);
    
    const frameCollisions = new Map();
    domElements.forEach(el => frameCollisions.set(el, { x: 0, y: 0, rot: 0, count: 0 }));

    // Draw power circle and radial gradient (scales brightness with charge)
    if (isMouseDown) {
        powerCircleRadius += 0.4;
        
        const chargeMultiplier = 1 + (powerCircleRadius * 0.03);
        const gradientOpacity = Math.min(0.45, (chargeMultiplier - 1) * 0.25);
        
        if (gradientOpacity > 0) {
            const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, powerCircleRadius * 2.5);
            grad.addColorStop(0, `rgba(255, 255, 255, ${gradientOpacity})`);
            grad.addColorStop(0.3, `rgba(255, 255, 255, ${gradientOpacity * 0.5})`);
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.beginPath();
            ctx.arc(mouse.x, mouse.y, powerCircleRadius * 2.5, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
        }
        
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, powerCircleRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + Math.sin(Date.now() / 80) * 0.15})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    } else {
        powerCircleRadius = 0;
    }

    // Draw shockwaves
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        let sw = shockwaves[i];
        sw.radius += 12;
        sw.opacity -= 0.015;
        
        if (sw.opacity <= 0) {
            shockwaves.splice(i, 1);
            continue;
        }
        
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${sw.opacity})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }

    particles.forEach(p => {
        p.update(mouse.x, mouse.y, isMouseDown, frameCollisions);
        p.draw(ctx, isMouseDown);
    });

    if (isTypewriterFinished) {
        domElements.forEach(el => {
            const col = frameCollisions.get(el);
            const b = bumps.get(el);
            if (col && col.count > 0) {
                b.x += col.x;
                b.y += col.y;
                b.rot += col.rot;
            }
        });
        updateDOMBumps();
    }
    
    requestAnimationFrame(animate);
}

animate();
