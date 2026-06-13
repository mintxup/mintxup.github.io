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

// Loader, Progress Bar, and Assets Preload/Caching
let audioBlobUrl = '';
let boomBlobUrl = '';
let audioReady = false;
let boomReady = false;
let fontReady = false;
let pageReady = false;
let entered = false;

const assetsToLoad = [
    { url: 'startup.mp3', size: 53636, type: 'audio' },
    { url: 'boom.mp3', size: 32952, type: 'audio' },
    { url: 'san-francisco.woff', size: 1512432, type: 'font' }
];

const totalBytes = assetsToLoad.reduce((sum, asset) => sum + asset.size, 0);
let loadedBytes = {};

async function loadAssets() {
    const progressBar = document.getElementById('progress-bar');
    assetsToLoad.forEach(asset => { loadedBytes[asset.url] = 0; });

    function updateOverallProgress() {
        const currentLoaded = Object.values(loadedBytes).reduce((sum, val) => sum + val, 0);
        const percent = (currentLoaded / totalBytes) * 100;
        progressBar.style.width = Math.min(100, percent) + '%';
    }

    let cache = null;
    try {
        if ('caches' in window) {
            cache = await caches.open('mintxup-assets-v1');
        }
    } catch (e) {
        console.warn("Cache storage not accessible:", e);
    }

    async function fetchWithProgress(asset) {
        if (cache) {
            try {
                const cachedResponse = await cache.match(asset.url);
                if (cachedResponse) {
                    loadedBytes[asset.url] = asset.size;
                    updateOverallProgress();
                    return await cachedResponse.blob();
                }
            } catch (e) {
                console.warn(`Cache match failed for ${asset.url}:`, e);
            }
        }

        const response = await fetch(asset.url);
        if (!response.ok) throw new Error(`Failed to load ${asset.url}`);
        
        const responseToCache = response.clone();
        const reader = response.body.getReader();
        const contentLength = +response.headers.get('Content-Length') || asset.size;
        let chunks = [];
        let receivedLength = 0;
        
        while(true) {
            const {done, value} = await reader.read();
            if (done) break;
            chunks.push(value);
            receivedLength += value.length;
            loadedBytes[asset.url] = receivedLength;
            updateOverallProgress();
        }
        
        const blob = new Blob(chunks);
        
        if (cache) {
            try {
                await cache.put(asset.url, new Response(blob, {
                    headers: {
                        'Content-Type': responseToCache.headers.get('Content-Type'),
                        'Content-Length': blob.size
                    }
                }));
            } catch (e) {
                console.warn(`Cache write failed for ${asset.url}:`, e);
            }
        }
        
        return blob;
    }

    const loadPromises = assetsToLoad.map(async (asset) => {
        try {
            const blob = await fetchWithProgress(asset);
            if (asset.type === 'audio') {
                const blobUrl = URL.createObjectURL(blob);
                if (asset.url === 'startup.mp3') {
                    audioBlobUrl = blobUrl;
                    audioReady = true;
                } else if (asset.url === 'boom.mp3') {
                    boomBlobUrl = blobUrl;
                    boomReady = true;
                }
            } else if (asset.type === 'font') {
                const fontUrl = URL.createObjectURL(blob);
                const font = new FontFace('SanFrancisco', `url(${fontUrl})`);
                await font.load();
                document.fonts.add(font);
                fontReady = true;
            }
        } catch (err) {
            console.error(`Error preloading asset ${asset.url}:`, err);
            if (asset.url === 'startup.mp3') {
                audioBlobUrl = 'startup.mp3';
                audioReady = true;
            } else if (asset.url === 'boom.mp3') {
                boomBlobUrl = 'boom.mp3';
                boomReady = true;
            } else if (asset.type === 'font') {
                fontReady = true;
            }
            loadedBytes[asset.url] = asset.size;
            updateOverallProgress();
        }
        checkLoadingComplete();
    });

    await Promise.all(loadPromises);
}

window.addEventListener('load', () => {
    pageReady = true;
    checkLoadingComplete();
});

function checkLoadingComplete() {
    if (audioReady && boomReady && pageReady && fontReady) {
        setTimeout(() => {
            const progressBarContainer = document.getElementById('progress-bar-container');
            progressBarContainer.style.display = 'none';
            
            const clickToEnter = document.getElementById('click-to-enter');
            const rawLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
            const isRu = rawLang.startsWith('ru') || rawLang.startsWith('be') || rawLang.startsWith('uk');
            clickToEnter.textContent = isRu 
                ? (isTouchDevice ? 'Коснитесь, чтобы войти' : 'Нажмите, чтобы войти')
                : (isTouchDevice ? 'Tap to enter' : 'Click to enter');
            clickToEnter.classList.remove('hidden');
            
            const loader = document.getElementById('loader-overlay');
            loader.addEventListener('click', enterSite);
            loader.addEventListener('touchstart', enterSite, { passive: false });
        }, 500);
    }
}
// Localization logic for hints
const hintsTranslations = {
    ru: [
        "Подсказки:",
        "Отброс частиц можно зарядить, если зажать.",
        "Сила отброса увеличивается по мере времени удерживания.",
        "Вы можете напечатать свой заголовок, просто нажмите и пишите!",
        "Ни в коем случае не нажимайте на TOP SECRET!!1!",
        "Будьте аккуратны с силой заряда, слишком сильный заряд опасен!"
    ],
    en: [
        "Tips:",
        "Particle knockback can be charged by holding down.",
        "The knockback force increases the longer you hold.",
        "You can type your own title, just tap and type!",
        "Do NOT tap on TOP SECRET!!1!",
        "Be careful with the charge strength, too strong of a charge is dangerous!"
    ],
    es: [
        "Consejos:",
        "El rechazo de partículas se puede cargar manteniendo presionado.",
        "La fuerza de rechazo aumenta cuanto más tiempo mantienes presionado.",
        "Puedes escribir tu propio título, ¡solo toca y escribe!",
        "¡Bajo ninguna circunstancia presiones TOP SECRET!!1!",
        "¡Ten cuidado con la fuerza de carga, una carga demasiado fuerte es peligrosa!"
    ],
    zh: [
        "提示：",
        "长按可以为粒子击退蓄力。",
        "按住的时间越长，击退力就越大。",
        "您可以输入自己的标题，只需点击并开始输入即可！",
        "千万不要点击 TOP SECRET！！1！",
        "请小心控制电荷强度，过强的电荷非常危险！"
    ]
};

let currentLang = 'en';

function applyTranslations() {
    const rawLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    if (rawLang.startsWith('ru') || rawLang.startsWith('be') || rawLang.startsWith('uk')) {
        currentLang = 'ru';
    } else {
        currentLang = 'en';
    }

    // Update Theme Toggle aria-label
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.setAttribute('aria-label', currentLang === 'ru' ? 'Сменить тему' : 'Toggle Theme');
    }

    // Update Top Secret Button text
    const topSecretBtn = document.getElementById('top-secret');
    if (topSecretBtn) {
        topSecretBtn.textContent = currentLang === 'ru' ? 'Секретно' : 'Top Secret';
    }

    // Update links
    if (typeof originalLinksText !== 'undefined' && originalLinksText.length >= 3) {
        originalLinksText[0] = currentLang === 'ru' ? 'Телеграм' : 'Telegram';
        originalLinksText[1] = currentLang === 'ru' ? 'Ютуб' : 'Youtube';
        originalLinksText[2] = currentLang === 'ru' ? 'Блог' : 'Blog';
    }

    // Update loader text
    const clickToEnter = document.getElementById('click-to-enter');
    if (clickToEnter) {
        if (currentLang === 'ru') {
            clickToEnter.textContent = isTouchDevice ? 'Коснитесь, чтобы войти' : 'Нажмите, чтобы войти';
        } else {
            clickToEnter.textContent = isTouchDevice ? 'Tap to enter' : 'Click to enter';
        }
    }
}

function drawHintsContent() {
    const container = document.getElementById('hints-container');
    if (!container) return;
    
    let completed = {};
    try {
        completed = JSON.parse(localStorage.getItem('mintxup_completed_hints')) || {};
    } catch(e) {}
    
    const hints = hintsTranslations[currentLang] || hintsTranslations['en'];
    const hintIndexToId = {
        1: 'charge',
        2: 'charge',
        3: 'type',
        4: 'secret',
        5: 'danger'
    };

    let activeHints = [];
    for (let i = 1; i < hints.length; i++) {
        const hintId = hintIndexToId[i];
        if (!completed[hintId]) {
            activeHints.push({ text: hints[i], id: hintId });
        }
    }

    if (activeHints.length > 0) {
        let htmlContent = `<strong>${hints[0]}</strong>`;
        activeHints.forEach(ah => {
            htmlContent += `<p class="hint-item" data-hint-id="${ah.id}">- ${ah.text}</p>`;
        });
        container.innerHTML = htmlContent;
    } else {
        container.innerHTML = '';
        container.style.opacity = '0';
    }
}

function initHints() {
    drawHintsContent();
}


function completeHint(hintId) {
    let completed = {};
    try {
        completed = JSON.parse(localStorage.getItem('mintxup_completed_hints')) || {};
    } catch(e) {}
    
    if (completed[hintId]) return;
    
    completed[hintId] = true;
    localStorage.setItem('mintxup_completed_hints', JSON.stringify(completed));
    
    const items = document.querySelectorAll(`.hint-item[data-hint-id="${hintId}"]`);
    if (items.length > 0) {
        items.forEach(item => {
            item.classList.add('completed');
            setTimeout(() => {
                item.style.maxHeight = item.scrollHeight + 'px';
                void item.offsetHeight; // force reflow
                item.classList.add('removing');
                
                setTimeout(() => {
                    item.remove();
                    checkAllHintsCompleted();
                }, 400);
            }, 3500);
        });
    }
}

function checkAllHintsCompleted() {
    const container = document.getElementById('hints-container');
    if (!container) return;
    const items = container.querySelectorAll('.hint-item');
    if (items.length === 0) {
        container.style.animation = 'none';
        container.style.opacity = '0';
        container.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
            container.innerHTML = '';
        }, 500);
    }
}

let audioCtx = null;
let chargeNoiseSource = null;
let chargeFilterNode = null;
let chargeGainNode = null;
let noiseBuffer = null;

function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function getNoiseBuffer() {
    if (noiseBuffer) return noiseBuffer;
    if (!audioCtx) return null;
    const bufferSize = audioCtx.sampleRate * 2; // 2 seconds
    noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
}

function startChargeSound() {
    try {
        initAudioContext();
        if (!audioCtx) return;
        stopChargeSound();

        const buffer = getNoiseBuffer();
        if (!buffer) return;
        
        chargeNoiseSource = audioCtx.createBufferSource();
        chargeNoiseSource.buffer = buffer;
        chargeNoiseSource.loop = true;

        chargeFilterNode = audioCtx.createBiquadFilter();
        chargeFilterNode.type = 'lowpass';
        chargeFilterNode.Q.value = 3.0; // resonance boost for sci-fi turbine sweep
        chargeFilterNode.frequency.value = 60; // start low

        chargeGainNode = audioCtx.createGain();
        chargeGainNode.gain.setValueAtTime(0, audioCtx.currentTime);

        chargeNoiseSource.connect(chargeFilterNode);
        chargeFilterNode.connect(chargeGainNode);
        chargeGainNode.connect(audioCtx.destination);

        chargeNoiseSource.start();
        chargeGainNode.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.15);
    } catch (e) {
        console.warn("Web Audio start failed:", e);
    }
}

function updateChargeSound(radius) {
    if (!audioCtx || !chargeFilterNode || !chargeGainNode) return;
    try {
        // Continuous growth: start at 50Hz, add 18Hz per unit of radius. Clamp at 1200Hz
        const freq = Math.min(2400, 50 + radius * 18); 
        chargeFilterNode.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.08);
        
        // Volume grows slowly with radius, max 0.14
        const targetGain = Math.min(0.14, 0.02 + radius * 0.004); 
        chargeGainNode.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.08);
    } catch(e) {}
}

function stopChargeSound(radius = 0) {
    try {
        if (chargeGainNode && audioCtx) {
            const tempGain = chargeGainNode;
            const tempSource = chargeNoiseSource;
            const tempFilter = chargeFilterNode;

            // Release duration = (radius / 13.2) / 2. Max 4 seconds. Min 0.15s
            const releaseDuration = Math.max(0.15, Math.min(4.0, radius / 26.4));
            const endTime = audioCtx.currentTime + releaseDuration;
            
            tempGain.gain.setValueAtTime(tempGain.gain.value, audioCtx.currentTime);
            tempGain.gain.exponentialRampToValueAtTime(0.001, endTime);
            
            if (tempFilter) {
                tempFilter.frequency.setValueAtTime(tempFilter.frequency.value, audioCtx.currentTime);
                tempFilter.frequency.exponentialRampToValueAtTime(40, endTime);
            }
            
            setTimeout(() => {
                try {
                    tempSource.stop();
                    tempSource.disconnect();
                    tempGain.disconnect();
                    if (tempFilter) tempFilter.disconnect();
                } catch(e) {}
            }, Math.round(releaseDuration * 1000 + 50));
        }
    } catch(e) {}
    
    chargeNoiseSource = null;
    chargeFilterNode = null;
    chargeGainNode = null;
}

function triggerIntroWave(text, x, y, radius) {
    const waveX = x !== undefined ? x : width / 2;
    const waveY = y !== undefined ? y : height / 2;
    const waveRadius = radius !== undefined ? radius : 10;

    shockwaves.push({
        x: waveX,
        y: waveY,
        radius: waveRadius,
        opacity: 1,
        text: text === "hold_release" ? "" : text
    });

    const chargeMultiplier = 1 + (waveRadius * 0.03);
    const baseForce = 10 * chargeMultiplier;
    
    particles.forEach(p => {
        const dx = p.x - waveX;
        const dy = p.y - waveY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const force = baseForce + ((1500 * chargeMultiplier) / (dist + 50)); 
        
        if (dist > 0) {
            const angleSpread = dist < 35 ? (Math.random() - 0.5) * 1.2 : (Math.random() - 0.5) * 0.25;
            const finalAngle = Math.atan2(dy, dx) + angleSpread;
            p.vx += Math.cos(finalAngle) * force;
            p.vy += Math.sin(finalAngle) * force;
        }
    });
}

function enterSite(e) {
    if (e) e.preventDefault();
    if (entered) return;
    entered = true;
    initHints();

    // Haptic feedback tap at enter
    if (navigator.vibrate) {
        navigator.vibrate(40);
    }

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

    // Trigger onboarding intro waves 2 seconds after entering
    const introDone = localStorage.getItem('mintxup_intro_done');
    if (!introDone) {
        localStorage.setItem('mintxup_intro_done', 'true');
        setTimeout(() => {
            // Shift both click/tap and hold to the left (e.g. center - 130px)
            const onboardingX = width / 2 - 130;
            const onboardingY = height / 2 + 70; // Slightly lower than center
            triggerIntroWave(isTouchDevice ? "tap" : "click", onboardingX, onboardingY);
        }, 2000);
        setTimeout(() => {
            if (entered && !isActive) {
                // Shift simulated charge to the left as well!
                const onboardingX = width / 2 - 130;
                const onboardingY = height / 2 + 70;
                simulatedCharge = {
                    x: onboardingX,
                    y: onboardingY,
                    radius: 0,
                    text: "hold"
                };
                startChargeSound();
            }
        }, 2800);
    }
}

loadAssets();

// Touch indicator setup
const touchIndicator = document.getElementById('touch-indicator');
if (isTouchDevice) {
    touchIndicator.classList.add('enabled');
}

// Mobile: allow nick input on all devices
const nickInput = document.getElementById('nick');
const nickSizer = document.getElementById('nick-sizer');
const nickCursor = document.getElementById('nick-cursor');
const originalNick = "mintxup";
let typingTimer;
let deletingInterval;

function adjustInputWidth() {
    if (nickSizer) {
        nickSizer.textContent = nickInput.value.replace(/ /g, '\u00a0') || '\u00a0';
    }
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
        
        completeHint('type');
        
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

// Blog link popup error
const blogLink = document.getElementById('blog-link');
if (blogLink) {
    blogLink.addEventListener('click', (e) => {
        e.preventDefault();
        showBlogError();
    });
}

function showBlogError() {
    if (document.getElementById('blog-popup')) return;

    const errorMessages = {
        ru: "404, мой кот съел эту страницу, извините....",
        en: "404, my cat ate this page, sorry....",
        es: "404, mi gato se comió esta página, lo siento....",
        zh: "404，我的猫把这个页面吃掉了，抱歉……"
    };

    const msg = errorMessages[currentLang] || errorMessages['en'];

    const popup = document.createElement('div');
    popup.id = 'blog-popup';
    popup.role = 'alert';
    popup.innerHTML = `
        <div class="blog-popup-content">
            <span class="blog-popup-icon">🐱</span>
            <p class="blog-popup-text">${msg}</p>
            <button class="blog-popup-close" aria-label="Close">&times;</button>
        </div>
    `;

    document.body.appendChild(popup);
    void popup.offsetHeight; // Force reflow
    popup.classList.add('visible');

    const closeBtn = popup.querySelector('.blog-popup-close');
    addTapFeedback(closeBtn);
    
    const dismissPopup = () => {
        popup.classList.remove('visible');
        popup.addEventListener('transitionend', () => {
            popup.remove();
        }, { once: true });
    };

    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dismissPopup();
    });

    const autoDismissTimeout = setTimeout(() => {
        dismissPopup();
    }, 5000);

    popup.addEventListener('click', () => {
        clearTimeout(autoDismissTimeout);
        dismissPopup();
    });
}

// Particle System
const particles = [];
const numParticles = isTouchDevice ? 150 : 250;
let shockwaves = [];
let powerCircleRadius = 0;
let simulatedCharge = null;
let lastVibeTime = 0;

const domElements = [nickInput, nickCursor, ...document.querySelectorAll('.link')].filter(Boolean);
const bumps = new Map();
domElements.forEach(el => bumps.set(el, { x: 0, y: 0, rot: 0, hovered: false }));

// Hover detection вЂ” only for mouse pointer
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
    
    update(cursorX, cursorY, isActive, frameCollisions, timeScale, f092, f095, f097) {
        this.lastX = this.x;
        this.lastY = this.y;

        if (typeof isDestroyed !== 'undefined' && isDestroyed) {
            this.vy += 0.5 * timeScale; // gravity
            this.x += this.vx * timeScale;
            this.y += this.vy * timeScale;
            
            if (this.y > height - this.radius) {
                this.y = height - this.radius;
                this.vy *= -0.5;
                this.vx *= f095;
            }
            if (this.x < 0) { this.x = 0; this.vx *= -1; this.lastX = this.x; }
            if (this.x > width) { this.x = width; this.vx *= -1; this.lastX = this.x; }
            return;
        }

        if (isActive) {
            this.orbitAngle += this.orbitSpeed * timeScale;
            const targetX = cursorX + Math.cos(this.orbitAngle) * this.orbitRadius;
            const targetY = cursorY + Math.sin(this.orbitAngle) * this.orbitRadius;

            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            const adjustedForce = 0.15 + Math.pow(dist / 300, 1.5);
            
            if (dist > 0) {
                this.vx += (dx / dist) * adjustedForce * timeScale;
                this.vy += (dy / dist) * adjustedForce * timeScale;
            }
            
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            const maxSpeed = 15 * timeScale;
            if (speed > maxSpeed) {
                this.vx = (this.vx / speed) * maxSpeed;
                this.vy = (this.vy / speed) * maxSpeed;
            }

            if (dist < 100) {
                this.vx *= f092;
                this.vy *= f092;
            } else {
                this.vx *= f095;
                this.vy *= f095;
            }

        } else {
            this.vx += (Math.random() - 0.5) * 0.2 * timeScale;
            this.vy += (Math.random() - 0.5) * 0.2 * timeScale;
            
            this.vx *= f097;
            this.vy *= f097;
            
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            const minSpeed = 1.5 * timeScale;
            if (speed < minSpeed && speed > 0) {
                this.vx = (this.vx / speed) * minSpeed;
                this.vy = (this.vy / speed) * minSpeed;
            }
        }
        
        this.x += this.vx * timeScale;
        this.y += this.vy * timeScale;
        
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
                        col.x += this.vx * 0.1 * timeScale;
                        col.y += this.vy * 0.1 * timeScale;
                        col.rot += (this.vx - this.vy) * 0.03 * timeScale;
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
let activePointerId = null;

// Prevent default touch behavior to stop scrolling/zooming but allow input interaction
document.addEventListener('touchmove', (e) => { 
    if (!e.target.closest('input')) {
        e.preventDefault(); 
    }
}, { passive: false });

window.addEventListener('pointerdown', (e) => {
    if (simulatedCharge) {
        const currentRadius = simulatedCharge.radius;
        simulatedCharge = null; // Cancel onboarding simulation on interaction
        stopChargeSound(currentRadius);
    }
    if (typeof isDestroyed !== 'undefined' && isDestroyed) {
        if (e.target.closest('#explosion-btn')) return;
        document.body.classList.remove('shake-cursor');
        void document.body.offsetWidth; // trigger reflow
        document.body.classList.add('shake-cursor');
        return;
    }
    
    // Don't capture pointer if clicking buttons/inputs
    if (e.target.closest('#theme-toggle') || e.target.closest('#top-secret') || e.target.closest('#explosion-btn') || e.target.closest('input')) {
        return;
    }
    
    if (entered && isTypewriterFinished && activePointerId === null) {
        activePointerId = e.pointerId;
        cursor.x = e.clientX;
        cursor.y = e.clientY;
        isActive = true;
        lastVibeTime = 0; // Reset vibration timer
        startChargeSound();
        
        if (e.pointerType === 'touch') {
            touchIndicator.style.left = cursor.x + 'px';
            touchIndicator.style.top = cursor.y + 'px';
            touchIndicator.classList.add('active');
        }
    }
});

window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') {
        cursor.x = e.clientX;
        cursor.y = e.clientY;
    } else if (e.pointerType === 'touch' && e.pointerId === activePointerId) {
        cursor.x = e.clientX;
        cursor.y = e.clientY;
        touchIndicator.style.left = cursor.x + 'px';
        touchIndicator.style.top = cursor.y + 'px';
    }
});

window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') {
        if (!entered || !isActive) {
            activePointerId = null;
            return;
        }
        isActive = false;
        activePointerId = null;
        stopChargeSound(powerCircleRadius);
        if (isTypewriterFinished) releaseShockwave(cursor.x, cursor.y);
    } else if (e.pointerType === 'touch' && e.pointerId === activePointerId) {
        if (!entered || !isActive) {
            isActive = false;
            activePointerId = null;
            touchIndicator.classList.remove('active', 'charging');
            return;
        }
        isActive = false;
        activePointerId = null;
        touchIndicator.classList.remove('active', 'charging');
        stopChargeSound(powerCircleRadius);
        if (isTypewriterFinished) releaseShockwave(cursor.x, cursor.y);
    }
});

window.addEventListener('pointercancel', (e) => {
    if (e.pointerId === activePointerId) {
        isActive = false;
        activePointerId = null;
        powerCircleRadius = 0;
        touchIndicator.classList.remove('active', 'charging');
        stopChargeSound(powerCircleRadius);
    }
});

// ─── SHOCKWAVE RELEASE (shared by mouse and touch) ───
function releaseShockwave(x, y) {
    // Haptic feedback on release
    if (navigator.vibrate) {
        const vibeDuration = Math.round(30 + powerCircleRadius * 2.5); // 30ms base, up to 100ms for full charge
        navigator.vibrate(vibeDuration);
    }

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

function triggerExplosion(isOvercharge = false) {
    if (!entered || !isTypewriterFinished || isDestroyed) return;
    isDestroyed = true;
    if (isOvercharge) {
        completeHint('danger');
    } else {
        completeHint('secret');
    }

    // Vibrate phone with explosion pattern: strong pulse, pause, medium pulse
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 150]);
    }

    // Play explosion sound
    const explosionAudio = new Audio(boomBlobUrl || 'boom.mp3');
    explosionAudio.play().catch(err => console.warn("Explosion audio play blocked:", err));

    // Force dark theme if currently light theme
    if (isLightTheme) {
        document.documentElement.classList.remove('light-theme');
        isLightTheme = false;
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) metaTheme.content = '#000000';
    }

    document.getElementById('red-flash').classList.add('active');

    // Language detection
    const rawLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    let lang = 'en';
    if (rawLang.startsWith('ru') || rawLang.startsWith('be') || rawLang.startsWith('uk')) {
        lang = 'ru';
    } else if (rawLang.startsWith('es')) {
        lang = 'es';
    } else if (rawLang.startsWith('zh')) {
        lang = 'zh';
    }
    
    // Define all explosion message strings
    const messages = {
        ru: {
            normalTitle: "Поздравляю! Вы всё взорвали!",
            normalBtn: "вернуть всё обратно",
            overchargeTitle: "Упс! Ваш заряд был настолько сильный, что он просто взорвался!",
            overchargeBtn: "всё восстановить"
        },
        en: {
            normalTitle: "Congratulations! You blew everything up!",
            normalBtn: "restore everything",
            overchargeTitle: "Oops! Your charge was so strong that it just blew up!",
            overchargeBtn: "restore everything"
        },
        es: {
            normalTitle: "¡Felicidades! ¡Has volado todo!",
            normalBtn: "restaurar todo",
            overchargeTitle: "¡Oops! ¡Tu carga era tan fuerte que simplemente explotó!",
            overchargeBtn: "restaurar todo"
        },
        zh: {
            normalTitle: "恭喜！您把一切都炸飞了！",
            normalBtn: "恢复一切",
            overchargeTitle: "哎呀！您的电荷太强了，它直接爆炸了！",
            overchargeBtn: "恢复一切"
        }
    };

    const selectedMsg = messages[lang] || messages['en'];
    const titleText = isOvercharge ? selectedMsg.overchargeTitle : selectedMsg.normalTitle;
    const btnText = isOvercharge ? selectedMsg.overchargeBtn : selectedMsg.normalBtn;

    document.getElementById('explosion-title').textContent = titleText;
    const expBtn = document.getElementById('explosion-btn');
    expBtn.textContent = btnText;
    addTapFeedback(expBtn);
    expBtn.onclick = () => window.location.reload();
    
    document.getElementById('explosion-message').classList.add('visible');
    document.querySelector('.content').style.pointerEvents = 'none';

    // Explode nick input
    const nickRect = nickInput.getBoundingClientRect();
    const nickVal = nickInput.value;
    nickInput.style.opacity = '0';
    const wrapper = nickInput.closest('.input-wrapper');
    if (wrapper) wrapper.classList.add('exploded');
    for (let i = 0; i < nickVal.length; i++) {
        createFallingChar(nickVal[i], nickRect.left + (i * (nickRect.width / Math.max(1, nickVal.length))), nickRect.top, true);
    }

    // Explode nick cursor
    if (nickCursor) {
        const cursorRect = nickCursor.getBoundingClientRect();
        nickCursor.style.opacity = '0';
        createFallingChar('|', cursorRect.left, cursorRect.top, true);
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
    themeToggle.style.pointerEvents = 'none';
    themeToggle.disabled = true;



    topSecretBtn.style.opacity = '0';
    topSecretBtn.style.pointerEvents = 'none';
    topSecretBtn.disabled = true;
    nickInput.disabled = true;
    nickInput.style.pointerEvents = 'none';
    nickInput.blur();

    particles.forEach(p => {
        p.vx = (Math.random() - 0.5) * 15;
        p.vy = (Math.random() - 0.5) * 15 - 10;
    });
    
    // Reset touch state
    const currentRadius = powerCircleRadius;
    isActive = false;
    activePointerId = null;
    powerCircleRadius = 0;
    if (touchIndicator) {
        touchIndicator.classList.remove('active', 'charging');
    }
    stopChargeSound(currentRadius);
}

topSecretBtn.addEventListener('click', () => {
    triggerExplosion(false);
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

let themeTransitioning = false;

// Canvas background smooth transition state
let canvasBgTransition = null; // { startTime, duration, fromR, fromG, fromB, toR, toG, toB }

themeToggle.addEventListener('click', (e) => {
    if (!entered || !isTypewriterFinished || themeTransitioning) return;
    themeTransitioning = true;

    // Animate icon spin
    const iconWrapper = themeToggle.querySelector('.icon-wrapper');
    iconWrapper.classList.add('spin-switch');
    iconWrapper.addEventListener('animationend', () => {
        iconWrapper.classList.remove('spin-switch');
    }, { once: true });

    const rect = themeToggle.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
    );

    // First, force reflow and disable transitions to prevent the 'blink' bug
    document.documentElement.classList.add('no-transition');
    void document.documentElement.offsetHeight; // Force reflow

    // Toggle theme INSTANTLY so the icon changes immediately
    document.documentElement.classList.toggle('light-theme');
    isLightTheme = !isLightTheme;
    
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        metaTheme.content = isLightTheme ? '#ffffff' : '#000000';
    }

    // Force an opaque clear on the canvas to prevent flicker
    ctx.fillStyle = isLightTheme ? '#ffffff' : '#000000';
    ctx.fillRect(0, 0, width, height);

    // Force reflow again to register the instant change without CSS transitions
    void document.documentElement.offsetHeight;
    document.documentElement.classList.remove('no-transition');

    // We use a CSS trick to create an expanding hole:
    // A fixed element with a massive border that shrinks to 0.
    // The border has mix-blend-mode: difference, which inverts the NEW theme
    // back to the OLD theme outside the hole!
    // The hole reveals the NEW theme underneath.
    const maxR = endRadius;
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: ${y - maxR}px;
        left: ${x - maxR}px;
        width: ${maxR * 2}px;
        height: ${maxR * 2}px;
        border-radius: 50%;
        box-sizing: border-box;
        border: ${maxR}px solid #fff;
        mix-blend-mode: difference;
        pointer-events: none;
        z-index: 99999;
    `;
    document.body.appendChild(overlay);

    // Keep the toggle button above the mask so it's never inverted
    // and correctly shows the new icon instantly
    const oldZIndex = themeToggle.style.zIndex;
    themeToggle.style.zIndex = '100000';

    const anim = overlay.animate(
        {
            borderWidth: [`${maxR}px`, '0px']
        },
        {
            duration: 600,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            fill: 'forwards'
        }
    );

    anim.onfinish = () => {
        overlay.remove();
        themeToggle.style.zIndex = oldZIndex;
        themeTransitioning = false;
    };
});

function updateDOMBumps(f090, shakeX = 0, shakeY = 0, shakeRot = 0) {
    domElements.forEach(el => {
        const b = bumps.get(el);
        
        b.x *= f090;
        b.y *= f090;
        b.rot *= f090;
        
        b.x = Math.max(-10, Math.min(10, b.x));
        b.y = Math.max(-10, Math.min(10, b.y));
        b.rot = Math.max(-5, Math.min(5, b.rot));

        const baseScale = b.hovered ? (el.classList.contains('link') ? 1.1 : 1.05) : 1;
        el.style.transform = `translate(${b.x + shakeX}px, ${b.y + shakeY}px) rotate(${b.rot + shakeRot}deg) scale(${baseScale})`;
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
applyTranslations();

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

let lastTime = 0;

function animate(currentTime) {
    if (!lastTime) lastTime = currentTime;
    const dt = Math.min(currentTime - lastTime, 50);
    lastTime = currentTime;
    
    // Scale animations based on 60fps (16.666ms per frame)
    const timeScale = dt / 16.666;
    const f092 = Math.pow(0.92, timeScale);
    const f095 = Math.pow(0.95, timeScale);
    const f097 = Math.pow(0.97, timeScale);
    const f090 = Math.pow(0.90, timeScale);

    // Dynamic energy shake logic for both desktop and mobile
    let shakeX = 0;
    let shakeY = 0;
    let shakeRot = 0;
    if (isActive) {
        const t = Math.min(1, powerCircleRadius / 130);
        const intensity = t * 10.0; // Escalates up to 10px before explosion
        shakeX = (Math.random() - 0.5) * intensity;
        shakeY = (Math.random() - 0.5) * intensity;
        shakeRot = (Math.random() - 0.5) * intensity * 0.6;
    }

    ctx.save();
    if (shakeX !== 0 || shakeY !== 0) {
        ctx.translate(shakeX, shakeY);
    }

    // Canvas background clearing
    const clearR = isLightTheme ? 255 : 0;
    const clearG = isLightTheme ? 255 : 0;
    const clearB = isLightTheme ? 255 : 0;
    ctx.fillStyle = `rgba(${Math.round(clearR)}, ${Math.round(clearG)}, ${Math.round(clearB)}, 0.25)`;
    ctx.fillRect(0, 0, width, height);
    
    const frameCollisions = new Map();
    domElements.forEach(el => frameCollisions.set(el, { x: 0, y: 0, rot: 0, count: 0 }));

    const strokeColor = isLightTheme ? '0, 0, 0' : '255, 255, 255';

    if (isActive) {
        powerCircleRadius += 0.22 * timeScale; // Slower growth rate
        
        if (powerCircleRadius > 20) {
            completeHint('charge');
        }

        if (powerCircleRadius >= 130) {
            triggerExplosion(true);
        } else {
            updateChargeSound(powerCircleRadius); // Pass radius directly for continuous sweep

            // Haptic feedback for charging on touch devices
            if (isTouchDevice && navigator.vibrate) {
                const now = Date.now();
                const t = Math.min(1, powerCircleRadius / 130);
                const vibeInterval = Math.max(40, 350 - t * 310); // Interval drops from 350ms to 40ms
                
                if (now - lastVibeTime >= vibeInterval) {
                    // Duration of vibration increases as charge builds (from 8ms to 50ms)
                    const vibeDuration = Math.round(8 + t * 42);
                    navigator.vibrate(vibeDuration);
                    lastVibeTime = now;
                }
            }
        }
        
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

    // Onboarding simulated charge
    if (simulatedCharge) {
        simulatedCharge.radius += 0.22 * timeScale; // Slower growth rate
        
        updateChargeSound(simulatedCharge.radius); // Pass radius directly for continuous sweep
        
        const chargeMultiplier = 1 + (simulatedCharge.radius * 0.03);
        const gradientOpacity = Math.min(0.45, (chargeMultiplier - 1) * 0.25);
        
        if (gradientOpacity > 0) {
            const grad = ctx.createRadialGradient(simulatedCharge.x, simulatedCharge.y, 0, simulatedCharge.x, simulatedCharge.y, simulatedCharge.radius * 2.5);
            grad.addColorStop(0, `rgba(${strokeColor}, ${gradientOpacity})`);
            grad.addColorStop(0.3, `rgba(${strokeColor}, ${gradientOpacity * 0.5})`);
            grad.addColorStop(1, `rgba(${strokeColor}, 0)`);
            
            ctx.beginPath();
            ctx.arc(simulatedCharge.x, simulatedCharge.y, simulatedCharge.radius * 2.5, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
        }
        
        ctx.beginPath();
        ctx.arc(simulatedCharge.x, simulatedCharge.y, simulatedCharge.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${strokeColor}, ${0.4 + Math.sin(Date.now() / 80) * 0.15})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        if (simulatedCharge.text) {
            ctx.save();
            ctx.font = `bold ${isTouchDevice ? '1.5rem' : '1.8rem'} 'SanFrancisco', -apple-system, sans-serif`;
            ctx.fillStyle = `rgba(${strokeColor}, 0.8)`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(simulatedCharge.text, simulatedCharge.x, simulatedCharge.y);
            ctx.restore();
        }
        
        if (simulatedCharge.radius >= 30) { // Slightly larger maximum radius
            triggerIntroWave("hold_release", simulatedCharge.x, simulatedCharge.y, simulatedCharge.radius);
            simulatedCharge = null;
            stopChargeSound();
        }
    }

    for (let i = shockwaves.length - 1; i >= 0; i--) {
        let sw = shockwaves[i];
        sw.radius += 12 * timeScale;
        sw.opacity -= 0.015 * timeScale;
        
        if (sw.opacity <= 0) {
            shockwaves.splice(i, 1);
            continue;
        }
        
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${strokeColor}, ${sw.opacity})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        
        if (sw.text) {
            ctx.save();
            ctx.font = `bold ${isTouchDevice ? '1.5rem' : '1.8rem'} 'SanFrancisco', -apple-system, sans-serif`;
            ctx.fillStyle = `rgba(${strokeColor}, ${sw.opacity})`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Rise (evaporate) upwards as opacity decreases
            const riseOffset = (1 - sw.opacity) * 60;
            ctx.fillText(sw.text, sw.x, sw.y - riseOffset);
            ctx.restore();
        }
    }

    particles.forEach(p => {
        if (simulatedCharge) {
            // Attract particles to the simulated charge center
            p.update(simulatedCharge.x, simulatedCharge.y, true, frameCollisions, timeScale, f092, f095, f097);
        } else {
            p.update(cursor.x, cursor.y, isActive, frameCollisions, timeScale, f092, f095, f097);
        }
        p.draw(ctx, isActive || !!simulatedCharge);
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
        updateDOMBumps(f090, shakeX, shakeY, shakeRot);
    }

    if (typeof isDestroyed !== 'undefined' && isDestroyed) {
        const f080 = Math.pow(0.8, timeScale);
        fallingChars.forEach(fc => {
            fc.vy += 0.8 * timeScale; // gravity
            fc.x += fc.vx * timeScale;
            fc.y += fc.vy * timeScale;
            fc.rot += fc.vrot * timeScale;

            if (fc.y > height - 40) {
                fc.y = height - 40;
                fc.vy *= -0.5;
                fc.vx *= f080;
                fc.vrot *= f080;
            }
            if (fc.x < 0 || fc.x > width) {
                fc.vx *= -1;
            }

            const startX = parseFloat(fc.el.style.left) || 0;
            const startY = parseFloat(fc.el.style.top) || 0;
            fc.el.style.transform = `translate(${fc.x - startX}px, ${fc.y - startY}px) rotate(${fc.rot}deg)`;
        });
    }
    
    ctx.restore();
    requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
