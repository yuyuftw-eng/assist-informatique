let map = null;
let userMarker = null;
let travelFee = 0;
let travelLocationText = "";

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialisation des icônes Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // 2. Gestion active dynamique du menu de navigation au scroll
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.main-nav .nav-link');

    window.addEventListener('scroll', () => {
        let currentSection = '';
        const scrollPosition = window.scrollY + 200;

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                currentSection = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-target') === currentSection) {
                link.classList.add('active');
            }
        });
    });

    // 3. Initialisation de la carte Leaflet (Lalevade-d'Ardèche) - Sans clé API
    const baseCoords = [44.6475, 4.3753]; // Coordonnées GPS de Lalevade-d'Ardèche
    const mapElement = document.getElementById('map');

    if (mapElement && typeof L !== 'undefined') {
        map = L.map('map').setView(baseCoords, 10);

        // Utilisation du fond de carte OpenStreetMap standard (100% gratuit, sans clé API)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        L.marker(baseCoords).addTo(map)
            .bindPopup('<b>ASSIST INFORMATIQUE</b><br>Base d\'intervention - Lalevade-d\'Ardèche').openPopup();

        // Zone 1 (15 km - Déplacement Offert)
        L.circle(baseCoords, {
            color: '#0052FF', fillColor: '#0052FF', fillOpacity: 0.18, weight: 2, radius: 15000
        }).addTo(map);

        // Zone 2 (30 km - Forfait 15€)
        L.circle(baseCoords, {
            color: '#00D2FF', fillColor: '#00D2FF', fillOpacity: 0.1, weight: 2, radius: 30000
        }).addTo(map);
    }

    // 4. Animation 3D Three.js (sur grands écrans > 768px)
    if (window.innerWidth > 768 && typeof THREE !== 'undefined') {
        const canvas = document.getElementById('webgl-bg');
        if (canvas) {
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });

            renderer.setSize(window.innerWidth, window.innerHeight);

            const posArray = new Float32Array(180 * 3);
            for (let i = 0; i < 180 * 3; i++) {
                posArray[i] = (Math.random() - 0.5) * 15;
            }

            const particlesGeometry = new THREE.BufferGeometry();
            particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
            const particlesMesh = new THREE.Points(particlesGeometry, new THREE.PointsMaterial({
                size: 0.04, color: 0x0052FF, transparent: true, opacity: 0.45
            }));

            scene.add(particlesMesh);
            camera.position.z = 3;

            function animate() {
                requestAnimationFrame(animate);
                particlesMesh.rotation.y += 0.0015;
                renderer.render(scene, camera);
            }
            animate();

            window.addEventListener('resize', () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            });
        }
    }
});

// CALCULATEUR DE DISTANCE + RECENTRAGE DE CARTE DEPUIS LALEVADE
function calculateSimDistanceAndMap() {
    const inputElement = document.getElementById('sim-city-input');
    const zoneInfo = document.getElementById('sim-zone-info');
    if (!inputElement || !zoneInfo) return;

    const input = inputElement.value.trim();
    if (!input) return;

    const baseCoords = [44.6475, 4.3753]; // Lalevade-d'Ardèche

    fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(input)}&limit=1`)
        .then(res => res.json())
        .then(data => {
            if (data.features && data.features.length > 0) {
                const coords = data.features[0].geometry.coordinates; // [lon, lat]
                const userLat = coords[1];
                const userLon = coords[0];
                const dist = calculateHaversineDistance(baseCoords[0], baseCoords[1], userLat, userLon);
                const cityName = data.features[0].properties.city;

                // Recentrer la carte Leaflet et placer un repère
                if (map) {
                    map.setView([userLat, userLon], 11);
                    if (userMarker) map.removeLayer(userMarker);
                    userMarker = L.marker([userLat, userLon]).addTo(map)
                        .bindPopup(`<b>${cityName}</b><br>Distance : ~${dist.toFixed(1)} km de Lalevade`).openPopup();
                }

                if (dist <= 15) {
                    travelFee = 0;
                    travelLocationText = `${cityName} (~${dist.toFixed(1)} km) : Déplacement OFFERT`;
                    zoneInfo.style.color = '#00A852';
                } else if (dist <= 30) {
                    travelFee = 15;
                    travelLocationText = `${cityName} (~${dist.toFixed(1)} km) : Forfait 15 €`;
                    zoneInfo.style.color = '#0052FF';
                } else {
                    travelFee = 0;
                    travelLocationText = `${cityName} (~${dist.toFixed(1)} km) : Secteur étendu (Sur devis)`;
                    zoneInfo.style.color = '#0052FF';
                }

                zoneInfo.innerText = "📍 " + travelLocationText;
                updateSimPrice();
            } else {
                alert("Commune introuvable. Veuillez vérifier l'orthographe.");
            }
        });
}

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// SIMULATEUR DE DEVIS
function updateSimPrice() {
    const checks = document.querySelectorAll('.sim-check');
    const clientTypeElement = document.querySelector('input[name="client-type"]:checked');
    const priceDisplay = document.getElementById('sim-price-display');
    const subtotalServicesElem = document.getElementById('subtotal-services');
    const subtotalTravelElem = document.getElementById('subtotal-travel');
    const taxBox = document.getElementById('tax-box');

    if (!priceDisplay || !clientTypeElement) return;

    const clientType = clientTypeElement.value;
    let servicesTotal = 0;

    checks.forEach(c => {
        if (c.checked) servicesTotal += parseInt(c.value);
    });

    const grandTotal = servicesTotal + travelFee;

    if (subtotalServicesElem) subtotalServicesElem.innerText = servicesTotal + " €";
    if (subtotalTravelElem) subtotalTravelElem.innerText = travelFee + " €";

    priceDisplay.innerText = grandTotal + " €";

    if (clientType === 'particulier') {
        const half = grandTotal / 2;
        taxBox.style.display = 'block';
        taxBox.innerHTML = `🌱 Soit <strong>${half} €</strong> après Crédit d'Impôt (50%)`;
    } else {
        taxBox.style.display = 'none';
    }
}

function sendSimToContact() {
    const contactSection = document.getElementById('contact');
    if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' });
    }
}