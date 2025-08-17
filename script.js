const MAPBOX_TOKEN = 'pk.eyJ1IjoicmFmaXVqamFtYW4iLCJhIjoiY21iMGRnMWl6MHA5aTJqc2NnZ24ybHkzZCJ9.ABDlOrNOjpgDUxKhmt_Ozw';
let cities = [];

// Load the new dataset
fetch('largest-us-cities-by-population-2025.json')
  .then(response => response.json())
  .then(data => { cities = data; });

function suggestCities() {
  const input = document.getElementById('cityInput');
  const list = document.getElementById('citySuggestions');
  const search = input.value.toLowerCase();
  list.innerHTML = '';

  if (!search) return;

  // search against .city instead of .name
  const matches = cities.filter(city => city.city.toLowerCase().includes(search)).slice(0, 10);
  matches.forEach(city => {
    const div = document.createElement('div');
    div.textContent = `${city.city}, ${city.state}`;
    div.onclick = () => {
      input.value = city.city;
      list.innerHTML = '';
    };
    list.appendChild(div);
  });
}

document.getElementById('cityInput').addEventListener('input', suggestCities);

async function getCoordinatesFromMapbox(cityName) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(cityName)}.json?access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.features[0]?.center || null;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = x => x * Math.PI / 180;
  const R = 3958.8; // miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function findNearbyCities() {
  const input = document.getElementById('cityInput').value.trim();
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = 'Finding nearby cities...';

  if (!input) {
    resultDiv.innerHTML = 'Please enter a city.';
    return;
  }

  // find city from dataset
  const selectedCity = cities.find(city => city.city.toLowerCase() === input.toLowerCase());
  let lat, lon;

  if (selectedCity && selectedCity.lat && selectedCity.lng) {
    lat = selectedCity.lat;
    lon = selectedCity.lng;
  } else {
    // fallback to Mapbox
    const coords = await getCoordinatesFromMapbox(input);
    if (!coords) {
      resultDiv.innerHTML = 'City not found.';
      return;
    }
    [lon, lat] = coords;
  }

  const nearby = cities
    .filter(city => city.city.toLowerCase() !== input.toLowerCase() && city.lat && city.lng)
    .map(city => ({
      ...city,
      distance: haversineDistance(lat, lon, city.lat, city.lng)
    }))
    .filter(city => city.distance <= 100)
    .sort((a, b) => a.distance - b.distance);

  if (nearby.length === 0) {
    resultDiv.innerHTML = `No major cities found near ${input}.`;
    return;
  }

  resultDiv.innerHTML = `
    <strong>Cities near ${input}:</strong><br><br>
    ${nearby.map(c => `${c.city}, ${c.state} (${c.distance.toFixed(1)} mi)`).join('<br>')}
  `;
}
