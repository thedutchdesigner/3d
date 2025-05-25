
import * as THREE from 'https://cdn.skypack.dev/three@0.154.0';
import { ARButton } from 'https://cdn.skypack.dev/three@0.154.0/examples/jsm/webxr/ARButton.js';

const apiKey = '5b3ce3597851110001cf62481c238f30d3654010b5b928a885fc6c6c';

let camera, scene, renderer;
let userLat, userLon;
let anchorGroup;

init();
getUserLocation();

async function getUserLocation() {
  navigator.geolocation.getCurrentPosition(async (pos) => {
    userLat = pos.coords.latitude;
    userLon = pos.coords.longitude;
    const poi = await getNearestPostOffice(userLat, userLon);
    const route = await getWalkingRoute(userLat, userLon, poi.lat, poi.lon);
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
  if (!userLat || !userLon) return;

  const points = coords.map(([lon, lat]) => latLonToPosition(lat, lon, userLat, userLon));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
  const line = new THREE.Line(geometry, material);
  anchorGroup.add(line);

  document.getElementById('ui').innerText = "Route loaded. Move around to follow it.";
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

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });
}
