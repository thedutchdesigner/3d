
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.154.0/build/three.module.js';
import { ARButton } from 'https://cdn.jsdelivr.net/npm/three@0.154.0/examples/jsm/webxr/ARButton.js';

const apiKey = '5b3ce3597851110001cf62481c238f30d3654010b5b928a885fc6c6c';

let camera, scene, renderer;
let userLat, userLon;
let anchorGroup;
let distanceLabel;
let poiIcons = [];
let waypointLabels = [];
let routePoints = [];

init();
watchUserLocation();

function watchUserLocation() {
  navigator.geolocation.watchPosition(async (pos) => {
    userLat = pos.coords.latitude;
    userLon = pos.coords.longitude;

    if (routePoints.length > 0) {
      updateDistanceLabel();
      return;
    }

    const poi = await getNearestPostOffice(userLat, userLon);
    const route = await getWalkingRoute(userLat, userLon, poi.lat, poi.lon);
    routePoints = route;
    addRouteToScene(route);
  }, err => alert("Failed to get location."));
}

async function getNearestPostOffice(lat, lon) {
  const query = `[out:json];
    node["amenity"="post_office"](around:2000,${lat},${lon});
    out center 1;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query
  });
  const data = await res.json();
  const el = data.elements[0];
  return {
    lat: el.lat || el.center.lat,
    lon: el.lon || el.center.lon
  };
}

async function getWalkingRoute(startLat, startLon, endLat, endLon) {
  const res = await fetch(`https://api.openrouteservice.org/v2/directions/foot-walking?api_key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      coordinates: [[startLon, startLat], [endLon, endLat]]
    })
  });
  const data = await res.json();
  return data.features[0].geometry.coordinates;
}

function latLonToPosition(lat, lon, refLat, refLon) {
  const R = 6371000;
  const dLat = (lat - refLat) * Math.PI / 180;
  const dLon = (lon - refLon) * Math.PI / 180;
  const x = R * dLon * Math.cos(refLat * Math.PI / 180);
  const z = R * dLat;
  return new THREE.Vector3(x, 1, -z);
}

function addRouteToScene(coords) {
  const points = coords.map(([lon, lat]) => latLonToPosition(lat, lon, userLat, userLon));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
  const line = new THREE.Line(geometry, material);
  anchorGroup.add(line);

  // Add waypoint icons and labels
  coords.forEach(([lon, lat], i) => {
    const position = latLonToPosition(lat, lon, userLat, userLon);

    // POI Icon
    const icon = createPOIIcon();
    icon.position.copy(position);
    poiIcons.push(icon);
    anchorGroup.add(icon);

    // Label
    const label = createWaypointLabel(`Step ${i + 1}`);
    label.position.copy(position.clone().add(new THREE.Vector3(0, 0.5, 0)));
    waypointLabels.push(label);
    anchorGroup.add(label);
  });

  updateDistanceLabel();
  document.getElementById('ui').innerText = "Route loaded. Move around to follow it.";
}

function createPOIIcon() {
  const geometry = new THREE.PlaneGeometry(0.5, 0.5);
  const texture = new THREE.TextureLoader().load('https://cdn-icons-png.flaticon.com/512/684/684908.png');
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  return new THREE.Mesh(geometry, material);
}

function createWaypointLabel(text) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 64;
  context.fillStyle = 'white';
  context.font = '24px sans-serif';
  context.fillText(text, 10, 40);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  return new THREE.Sprite(material);
}

function updateDistanceLabel() {
  if (!userLat || !userLon || routePoints.length === 0) return;

  let [targetLon, targetLat] = routePoints[routePoints.length - 1];
  const distance = getDistance(userLat, userLon, targetLat, targetLon);

  distanceLabel.innerText = `Distance: ${distance} meters`;
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

  anchorGroup = new THREE.Group();
  scene.add(anchorGroup);

  distanceLabel = document.createElement('div');
  distanceLabel.style.position = 'fixed';
  distanceLabel.style.bottom = '20px';
  distanceLabel.style.left = '50%';
  distanceLabel.style.transform = 'translateX(-50%)';
  distanceLabel.style.background = 'rgba(0,0,0,0.6)';
  distanceLabel.style.color = 'white';
  distanceLabel.style.padding = '8px 12px';
  distanceLabel.style.fontFamily = 'sans-serif';
  distanceLabel.style.borderRadius = '6px';
  distanceLabel.style.zIndex = '10';
  document.body.appendChild(distanceLabel);

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });
}
