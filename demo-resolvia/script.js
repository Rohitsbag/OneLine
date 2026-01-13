// Shared Logic for OneLine Demo

// Initialize Lucide icons
lucide.createIcons();

// Theme Handling
function initTheme() {
    const isDark = localStorage.getItem('theme') !== 'light';
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Global Spotlight Effect
function initSpotlights() {
    document.querySelectorAll('.spotlight-card').forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
}

// Fade-in Intersection Observer
function initFadeIn() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '100px' });

    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}

// Three.js Background (AnoAI shader)
function initShaderBackground(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    const material = new THREE.ShaderMaterial({
        uniforms: {
            iTime: { value: 0 },
            iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        },
        vertexShader: `void main() { gl_Position = vec4(position, 1.0); }`,
        fragmentShader: `
            uniform float iTime;
            uniform vec2 iResolution;
            #define NUM_OCTAVES 2
            float rand(vec2 n) { return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }
            float noise(vec2 p) {
                vec2 ip = floor(p);
                vec2 u = fract(p);
                u = u*u*(3.0-2.0*u);
                float res = mix(mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x), mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y);
                return res * res;
            }
            float fbm(vec2 x) {
                float v = 0.0; float a = 0.3; vec2 shift = vec2(100);
                mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
                for (int i = 0; i < NUM_OCTAVES; ++i) { v += a * noise(x); x = rot * x * 2.0 + shift; a *= 0.4; }
                return v;
            }
            void main() {
                vec2 shake = vec2(sin(iTime * 1.2) * 0.005, cos(iTime * 2.1) * 0.005);
                vec2 p = ((gl_FragCoord.xy + shake * iResolution.xy) - iResolution.xy * 0.5) / iResolution.y * mat2(6.0, -4.0, 4.0, 6.0);
                vec2 v; vec4 o = vec4(0.0);
                float f = 2.0 + fbm(p + vec2(iTime * 5.0, 0.0)) * 0.5;
                for (float i = 0.0; i < 16.0; i++) {
                    v = p + cos(i * i + (iTime + p.x * 0.08) * 0.025 + i * vec2(13.0, 11.0)) * 3.5 + vec2(sin(iTime * 3.0 + i) * 0.003, cos(iTime * 3.5 - i) * 0.003);
                    float thinness = i / 16.0;
                    float tailNoise = fbm(v + vec2(iTime * 0.5, i)) * 0.3 * (1.0 - thinness);
                    vec4 auroraColors = vec4(0.1 + 0.3 * sin(i * 0.2 + iTime * 0.4), 0.3 + 0.5 * cos(i * 0.3 + iTime * 0.5), 0.7 + 0.3 * sin(i * 0.4 + iTime * 0.3), 1.0);
                    vec4 currentContribution = auroraColors * exp(sin(i * i + iTime * 0.8)) / length(max(v, vec2(v.x * f * 0.015, v.y * 1.5)));
                    o += currentContribution * (1.0 + tailNoise * 0.8) * thinness * 0.6;
                }
                o = 1.0 - exp(-o * 0.02);
                gl_FragColor = o * 1.5;
            }
        `
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    function animate() {
        if (!document.hidden) {
            material.uniforms.iTime.value += 0.002;
            renderer.render(scene, camera);
        }
        requestAnimationFrame(animate);
    }
    animate();

    window.addEventListener('resize', () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        renderer.setSize(width, height);
        material.uniforms.iResolution.value.set(width, height);
    });
}

// Run basic initializations
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initSpotlights();
    initFadeIn();
});
