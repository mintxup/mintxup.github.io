const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

// Device detection
const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
const dpr = Math.min(window.devicePixelRatio || 1, 2);

let width, height;
function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// Global Theme State
let isLightTheme = false;

// Loader, Progress Bar, and Sound Preload
let audioBlobUrl = '';
let audioReady = false;
let pageReady = false;
let entered = false;

async function loadSound() {
    const progressBar = document.getElementById('progress-bar');
    try {
        const response = await fetch('startup.mp3');
        if (!response.ok) throw new Error("Failed to load startup.mp3");
        
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

let fontReady = false;
async function loadFont() {
    try {
        const font = new FontFace('SanFrancisco', 'url(san-francisco.otf)');
        await font.load();
        document.fonts.add(font);
        fontReady = true;
    } catch (err) {
        console.warn("Font preload failed:", err);
        fontReady = true;
    }
    checkLoadingComplete();
}

function checkLoadingComplete() {
    if (audioReady && pageReady && fontReady) {
        setTimeout(() => {
            const progressBarContainer = document.getElementById('progress-bar-container');
            progressBarContainer.style.display = 'none';
            
            const clickToEnter = document.getElementById('click-to-enter');
            clickToEnter.textContent = isTouchDevice ? 'Tap to enter' : 'Click to enter';
            clickToEnter.classList.remove('hidden');
            
            const loader = document.getElementById('loader-overlay');
            loader.addEventListener('click', enterSite);
            loader.addEventListener('touchstart', enterSite, { passive: false });
        }, 500);
    }
}

function enterSite(e) {
    if (e) e.preventDefault();
    if (entered) return;
    entered = true;

    const loader = document.getElementById('loader-overlay');
    loader.style.opacity = '0';
    setTimeout(() => {
        loader.style.display = 'none';
    }, 500);

    const soundPath = audioBlobUrl || 'startup.mp3';
    const audio = new Audio(soundPath);
    audio.play().catch(err => console.warn("Audio play blocked by browser:", err));

    document.querySelector('.content').classList.add('visible');
    typeWriter();
}

loadSound();
loadFont();

// Touch indicator setup
const touchIndicator = document.getElementById('touch-indicator');
if (isTouchDevice) {
    touchIndicator.classList.add('enabled');
}

// Mobile: make nick input readonly to prevent virtual keyboard
const nickInput = document.getElementById('nick');
if (isTouchDevice) {
    nickInput.setAttribute('readonly', true);
    nickInput.style.pointerEvents = 'none';
}
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
    // Only allow editing on desktop
    if (isTouchDevice) return;
    
    nickInput.addEventListener('input', () => {
        adjustInputWidth();
        clearTimeout(typingTimer);
        clearInterval(deletingInterval);
        
        typingTimer = setTimeout(() => {
            startReverting();
        }, 2000);
    });
}

// Tap feedback utility for touch devices
function addTapFeedback(element) {
    element.addEventListener('touchstart', () => {
        element.classList.add('tap-active');
    }, { passive: true });
    
    element.addEventListener('touchend', () => {
        setTimeout(() => element.classList.remove('tap-active'), 150);
    }, { passive: true });
    
    element.addEventListener('touchcancel', () => {
        element.classList.remove('tap-active');
    }, { passive: true });
}

// Add tap feedback to interactive elements
document.querySelectorAll('.link').forEach(link => addTapFeedback(link));

// Particle System
const particles = [];
const numParticles = isTouchDevice ? 150 : 250;
let shockwaves = [];
let powerCircleRadius = 0;

const domElements = [nickInput, ...document.querySelectorAll('.link')];
const bumps = new Map();
domElements.forEach(el => bumps.set(el, { x: 0, y: 0, rot: 0, hovered: false }));

// Hover detection — only for mouse pointer
domElements.forEach(el => {
    el.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse') bumps.get(el).hovered = true;
    });
    el.addEventListener('pointerleave', () => {
        bumps.get(el).hovered = false;
    });
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
        this.l = 70 + Math.random() * 20; // Default brightness for dark theme
        this.radius = Math.random() * 1.0 + 0.5;
        this.orbitAngle = Math.random() * Math.PI * 2;
        this.orbitRadius = Math.random() * 25 + 5;
        this.orbitSpeed = (Math.random() * 0.05 + 0.02) * (Math.random() < 0.5 ? 1 : -1);
    }
    
    update(cursorX, cursorY, isActive, frameCollisions) {
        this.lastX = this.x;
        this.lastY = this.y;

        if (typeof isDestroyed !== 'undefined' && isDestroyed) {
            this.vy += 0.5; // gravity
            this.x += this.vx;
            this.y += this.vy;
            
            if (this.y > height - this.radius) {
                this.y = height - this.radius;
                this.vy *= -0.5;
                this.vx *= 0.95;
            }
            if (this.x < 0) { this.x = 0; this.vx *= -1; this.lastX = this.x; }
            if (this.x > width) { this.x = width; this.vx *= -1; this.lastX = this.x; }
            return;
        }

        if (isActive) {
            this.orbitAngle += this.orbitSpeed;
            const targetX = cursorX + Math.cos(this.orbitAngle) * this.orbitRadius;
            const targetY = cursorY + Math.sin(this.orbitAngle) * this.orbitRadius;

            const dx = targetX - this.x;
            const dy = targetY - this.y;
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
    
    draw(ctx, isActive) {
        ctx.beginPath();
        ctx.lineWidth = this.radius * 2;
        ctx.lineCap = "round";
        ctx.moveTo(this.lastX, this.lastY);
        ctx.lineTo(this.x, this.y);
        
        if (isActive) {
            ctx.strokeStyle = isLightTheme ? `rgba(0, 0, 0, 0.8)` : `rgba(255, 255, 255, 0.8)`;
        } else {
            // Adapt particle colors for light theme (darker colors for readability on white background)
            const l = isLightTheme ? (this.l - 40) : this.l;
            ctx.strokeStyle = `hsla(${this.h}, ${this.s}%, ${l}%, ${isLightTheme ? 0.35 : 0.25})`;
        }
        ctx.stroke();
    }
}

for (let i = 0; i < numParticles; i++) {
    particles.push(new Particle());
}

// Unified cursor/touch position
let cursor = { x: width / 2, y: height / 2 };
let isActive = false; // true when mouse is held down or finger is touching
let activeTouchId = null;

// Prevent default touch behavior to stop scrolling/zooming
document.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });

// ─── POINTER EVENTS (mouse on desktop) ───
window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return; // handled by touch events
    cursor.x = e.clientX;
    cursor.y = e.clientY;
});

window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return; // handled by touch events
    
    if (typeof isDestroyed !== 'undefined' && isDestroyed) {
        if (e.target.closest('#explosion-btn')) return;
        document.body.classList.remove('shake-cursor');
        void document.body.offsetWidth; // trigger reflow
        document.body.classList.add('shake-cursor');
        return;
    }
    // Prevent charging when clicking buttons
    if (entered && e.target.closest('#theme-toggle') === null && e.target.closest('#top-secret') === null && e.target.closest('#explosion-btn') === null) {
        isActive = true;
    }
});

window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') return; // handled by touch events
    if (!entered || !isTypewriterFinished || !isActive) return;
    isActive = false;
    
    releaseShockwave(cursor.x, cursor.y);
});

// ─── TOUCH EVENTS (mobile) ───
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    
    if (typeof isDestroyed !== 'undefined' && isDestroyed) {
        document.body.classList.remove('shake-cursor');
        void document.body.offsetWidth;
        document.body.classList.add('shake-cursor');
        return;
    }
    if (!entered || !isTypewriterFinished) return;
    
    // Use the first touch only
    const t = e.changedTouches[0];
    activeTouchId = t.identifier;
    cursor.x = t.clientX;
    cursor.y = t.clientY;
    isActive = true;
    
    // Show touch indicator
    touchIndicator.style.left = cursor.x + 'px';
    touchIndicator.style.top = cursor.y + 'px';
    touchIndicator.classList.add('active');
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isActive) return;
    
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === activeTouchId) {
            cursor.x = t.clientX;
            cursor.y = t.clientY;
            
            touchIndicator.style.left = cursor.x + 'px';
            touchIndicator.style.top = cursor.y + 'px';
            break;
        }
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === activeTouchId) {
            if (!entered || !isTypewriterFinished || !isActive) {
                isActive = false;
                activeTouchId = null;
                touchIndicator.classList.remove('active', 'charging');
                return;
            }
            
            isActive = false;
            activeTouchId = null;
            touchIndicator.classList.remove('active', 'charging');
            
            releaseShockwave(cursor.x, cursor.y);
            break;
        }
    }
}, { passive: false });

canvas.addEventListener('touchcancel', () => {
    isActive = false;
    activeTouchId = null;
    powerCircleRadius = 0;
    touchIndicator.classList.remove('active', 'charging');
}, { passive: false });

// ─── SHOCKWAVE RELEASE (shared by mouse and touch) ───
function releaseShockwave(x, y) {
    shockwaves.push({
        x: x,
        y: y,
        radius: powerCircleRadius,
        opacity: 1
    });

    const chargeMultiplier = 1 + (powerCircleRadius * 0.03);
    const baseForce = 10 * chargeMultiplier;
    
    particles.forEach(p => {
        const dx = p.x - x;
        const dy = p.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const force = baseForce + ((1500 * chargeMultiplier) / (dist + 50)); 
        
        if (dist > 0) {
            const angleSpread = dist < 35 ? (Math.random() - 0.5) * 1.2 : (Math.random() - 0.5) * 0.25;
            const finalAngle = Math.atan2(dy, dx) + angleSpread;
            p.vx += Math.cos(finalAngle) * force;
            p.vy += Math.sin(finalAngle) * force;
        } else {
            const angle = Math.random() * Math.PI * 2;
            p.vx += Math.cos(angle) * force;
            p.vy += Math.sin(angle) * force;
        }
    });
    
    powerCircleRadius = 0;
}

// Theme Toggle Event Listener with Telegram Transition Effect
const themeToggle = document.getElementById('theme-toggle');
addTapFeedback(themeToggle);

// Top Secret Feature
const topSecretBtn = document.getElementById('top-secret');
addTapFeedback(topSecretBtn);
let isDestroyed = false;
const fallingChars = [];

const explosionMessages = {
    ru: { title: "Поздравляю! Вы всё взорвали!", btn: "вернуть всё обратно" },
    en: { title: "Congratulations! You blew everything up!", btn: "restore everything" },
    es: { title: "¡Felicidades! ¡Has volado todo!", btn: "restaurar todo" }
};

topSecretBtn.addEventListener('click', () => {
    if (!entered || !isTypewriterFinished || isDestroyed) return;
    isDestroyed = true;

    // Play explosion sound
    const explosionAudio = new Audio('boom.mp3');
    explosionAudio.play().catch(err => console.warn("Explosion audio play blocked:", err));

    // Force dark theme if currently light theme
    if (isLightTheme) {
        document.documentElement.classList.remove('light-theme');
        isLightTheme = false;
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) metaTheme.content = '#000000';
    }

    document.getElementById('red-flash').classList.add('active');

    const lang = navigator.language.slice(0, 2).toLowerCase();
    const msg = explosionMessages[lang] || explosionMessages['en'];
    
    document.getElementById('explosion-title').textContent = msg.title;
    const expBtn = document.getElementById('explosion-btn');
    expBtn.textContent = msg.btn;
    addTapFeedback(expBtn);
    expBtn.onclick = () => window.location.reload();
    
    document.getElementById('explosion-message').classList.add('visible');
    document.querySelector('.content').style.pointerEvents = 'none';

    // Explode nick input
    const nickRect = nickInput.getBoundingClientRect();
    const nickVal = nickInput.value;
    nickInput.style.opacity = '0';
    for (let i = 0; i < nickVal.length; i++) {
        createFallingChar(nickVal[i], nickRect.left + (i * (nickRect.width / Math.max(1, nickVal.length))), nickRect.top, true);
    }

    // Explode links
    links.forEach(link => {
        const linkRect = link.getBoundingClientRect();
        const linkText = link.textContent;
        link.style.opacity = '0';
        for (let i = 0; i < linkText.length; i++) {
            createFallingChar(linkText[i], linkRect.left + (i * (linkRect.width / Math.max(1, linkText.length))), linkRect.top, false);
        }
    });

    themeToggle.style.opacity = '0';
    topSecretBtn.style.opacity = '0';

    particles.forEach(p => {
        p.vx = (Math.random() - 0.5) * 15;
        p.vy = (Math.random() - 0.5) * 15 - 10;
    });
    
    // Reset touch state
    isActive = false;
    activeTouchId = null;
    powerCircleRadius = 0;
    touchIndicator.classList.remove('active', 'charging');
});

function createFallingChar(char, x, y, isInput) {
    if (char === ' ') return;
    const isMobileSize = window.innerWidth <= 600;
    const span = document.createElement('span');
    span.textContent = char;
    span.style.position = 'absolute';
    span.style.left = x + 'px';
    span.style.top = y + 'px';
    span.style.fontSize = isInput ? (isMobileSize ? '2.2rem' : '3rem') : (isMobileSize ? '1.3rem' : '1.5rem');
    span.style.fontWeight = isInput ? 'bold' : 'normal';
    span.style.color = isLightTheme ? '#000' : '#fff';
    span.style.zIndex = '100';
    span.style.fontFamily = "'SanFrancisco', -apple-system, BlinkMacSystemFont, sans-serif";
    span.style.pointerEvents = 'none';
    span.style.textShadow = isInput ? 'none' : (isLightTheme ? '0 0 8px rgba(0,0,0,0.3)' : '0 0 8px rgba(255,255,255,0.5)');
    document.body.appendChild(span);

    fallingChars.push({
        el: span,
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.5) * 15 - 10,
        rot: Math.random() * 360,
        vrot: (Math.random() - 0.5) * 20
    });
}

themeToggle.addEventListener('click', (e) => {
    if (!entered || !isTypewriterFinished) return;

    const rect = themeToggle.getBoundingClientRect();
    const x = isTouchDevice ? (rect.left + rect.width / 2) : e.clientX;
    const y = isTouchDevice ? (rect.top + rect.height / 2) : e.clientY;
    const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
    );

    const toggleTheme = () => {
        document.documentElement.classList.add('no-transition');
        document.documentElement.classList.toggle('light-theme');
        isLightTheme = !isLightTheme;
        
        // Update meta theme-color for mobile browsers
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.content = isLightTheme ? '#ffffff' : '#000000';
        }
    };

    if (document.startViewTransition) {
        const transition = document.startViewTransition(toggleTheme);
        transition.ready.then(() => {
            document.documentElement.animate(
                {
                    clipPath: [
                        `circle(0px at ${x}px ${y}px)`,
                        `circle(${endRadius}px at ${x}px ${y}px)`
                    ]
                },
                {
                    duration: 500,
                    easing: 'ease-in-out',
                    pseudoElement: '::view-transition-new(root)'
                }
            );
        });
        transition.finished.then(() => {
            document.documentElement.classList.remove('no-transition');
        });
    } else {
        toggleTheme();
        document.documentElement.classList.remove('no-transition');
    }
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

// Typewriter Initialization
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
    ctx.fillStyle = isLightTheme ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, 0, width, height);
    
    const frameCollisions = new Map();
    domElements.forEach(el => frameCollisions.set(el, { x: 0, y: 0, rot: 0, count: 0 }));

    const strokeColor = isLightTheme ? '0, 0, 0' : '255, 255, 255';

    if (isActive) {
        powerCircleRadius += 0.4;
        
        // Update touch indicator charging state
        if (isTouchDevice && powerCircleRadius > 5) {
            touchIndicator.classList.add('charging');
        }
        
        const chargeMultiplier = 1 + (powerCircleRadius * 0.03);
        const gradientOpacity = Math.min(0.45, (chargeMultiplier - 1) * 0.25);
        
        if (gradientOpacity > 0) {
            const grad = ctx.createRadialGradient(cursor.x, cursor.y, 0, cursor.x, cursor.y, powerCircleRadius * 2.5);
            grad.addColorStop(0, `rgba(${strokeColor}, ${gradientOpacity})`);
            grad.addColorStop(0.3, `rgba(${strokeColor}, ${gradientOpacity * 0.5})`);
            grad.addColorStop(1, `rgba(${strokeColor}, 0)`);
            
            ctx.beginPath();
            ctx.arc(cursor.x, cursor.y, powerCircleRadius * 2.5, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
        }
        
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, powerCircleRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${strokeColor}, ${0.4 + Math.sin(Date.now() / 80) * 0.15})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    } else {
        powerCircleRadius = 0;
    }

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
        ctx.strokeStyle = `rgba(${strokeColor}, ${sw.opacity})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }

    particles.forEach(p => {
        p.update(cursor.x, cursor.y, isActive, frameCollisions);
        p.draw(ctx, isActive);
    });

    if (isTypewriterFinished && !isDestroyed) {
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

    if (typeof isDestroyed !== 'undefined' && isDestroyed) {
        fallingChars.forEach(fc => {
            fc.vy += 0.8; // gravity
            fc.x += fc.vx;
            fc.y += fc.vy;
            fc.rot += fc.vrot;

            if (fc.y > height - 40) {
                fc.y = height - 40;
                fc.vy *= -0.5;
                fc.vx *= 0.8;
                fc.vrot *= 0.8;
            }
            if (fc.x < 0 || fc.x > width) {
                fc.vx *= -1;
            }

            const startX = parseFloat(fc.el.style.left) || 0;
            const startY = parseFloat(fc.el.style.top) || 0;
            fc.el.style.transform = `translate(${fc.x - startX}px, ${fc.y - startY}px) rotate(${fc.rot}deg)`;
        });
    }
    
    requestAnimationFrame(animate);
}

animate();
