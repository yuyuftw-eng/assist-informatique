let map = null;
let userMarker = null;
let travelFee = 0;
let travelLocationText = "";

// Coordonnées GPS exactes du 85 Rue des Écoles, 07380 Lalevade-d'Ardèche
const BASE_COORDS = [44.65453860, 4.31786140]; // [Latitude, Longitude]

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

    // 3. Initialisation de la carte Leaflet (Point de départ masqué / Général)
    const mapElement = document.getElementById('map');

    if (mapElement && typeof L !== 'undefined') {
        map = L.map('map').setView(BASE_COORDS, 12);

        // Fond de carte OpenStreetMap standard
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Marqueur avec libellé neutre (adresse exacte masquée au public)
        L.marker(BASE_COORDS).addTo(map)
            .bindPopup('<b>ASSIST INFORMATIQUE 07</b><br>Intervention à domicile & en entreprise<br><i>Basé à Lalevade-d\'Ardèche (07380)</i>').openPopup();

        // Zone 1 (15 km - Déplacement Offert)
        L.circle(BASE_COORDS, {
            color: '#10b981', fillColor: '#10b981', fillOpacity: 0.15, weight: 2, radius: 15000
        }).addTo(map);

        // Zone 2 (30 km - Forfait 15€)
        L.circle(BASE_COORDS, {
            color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.1, weight: 2, radius: 30000
        }).addTo(map);
    }

    // 4. Animation 3D Three.js
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
                size: 0.04, color: 0x0066cc, transparent: true, opacity: 0.35
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

// CALCULATEUR DE DISTANCE ROUTIÈRE + RECENTRAGE CARTE
function calculateSimDistanceAndMap() {
    const inputElement = document.getElementById('sim-city-input');
    const zoneInfo = document.getElementById('sim-zone-info');
    if (!inputElement || !zoneInfo) return;

    const input = inputElement.value.trim();
    if (!input) return;

    // 1. Géocodage de l'adresse saisie (API Adresse Data Gouv)
    fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(input)}&limit=1`)
        .then(res => res.json())
        .then(data => {
            if (data.features && data.features.length > 0) {
                const coords = data.features[0].geometry.coordinates; // [lon, lat]
                const userLat = coords[1];
                const userLon = coords[0];
                const cityName = data.features[0].properties.city || data.features[0].properties.label;

                // 2. Calcul de la distance routière via OSRM depuis le point exact
                fetch(`https://router.project-osrm.org/route/v1/driving/${BASE_COORDS[1]},${BASE_COORDS[0]};${userLon},${userLat}?overview=false`)
                    .then(res => res.json())
                    .then(routeData => {
                        let roadDist = 0;
                        if (routeData.routes && routeData.routes.length > 0) {
                            roadDist = routeData.routes[0].distance / 1000;
                        } else {
                            roadDist = calculateHaversineDistance(BASE_COORDS[0], BASE_COORDS[1], userLat, userLon) * 1.32;
                        }

                        applyDistanceResult(userLat, userLon, cityName, roadDist, zoneInfo);
                    })
                    .catch(() => {
                        const fallbackDist = calculateHaversineDistance(BASE_COORDS[0], BASE_COORDS[1], userLat, userLon) * 1.32;
                        applyDistanceResult(userLat, userLon, cityName, fallbackDist, zoneInfo);
                    });

            } else {
                alert("Commune ou adresse introuvable. Veuillez préciser le nom ou le code postal.");
            }
        });
}

function applyDistanceResult(userLat, userLon, cityName, dist, zoneInfo) {
    if (map) {
        map.setView([userLat, userLon], 11);
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.marker([userLat, userLon]).addTo(map)
            .bindPopup(`<b>${cityName}</b><br>Distance routière : ~${dist.toFixed(1)} km`).openPopup();
    }

    if (dist <= 15) {
        travelFee = 0;
        travelLocationText = `${cityName} (~${dist.toFixed(1)} km par la route) : Déplacement OFFERT`;
        zoneInfo.style.color = '#10b981';
    } else if (dist <= 30) {
        travelFee = 15;
        travelLocationText = `${cityName} (~${dist.toFixed(1)} km par la route) : Forfait 15 €`;
        zoneInfo.style.color = '#0066cc';
    } else {
        travelFee = 0;
        travelLocationText = `${cityName} (~${dist.toFixed(1)} km par la route) : Secteur étendu (Sur devis)`;
        zoneInfo.style.color = '#f59e0b';
    }

    zoneInfo.innerText = "📍 " + travelLocationText;
    updateSimPrice();
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