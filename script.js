const MAPBOX_TOKEN = 'pk.eyJ1IjoicmFmaXVqamFtYW4iLCJhIjoiY21iMGRnMWl6MHA5aTJqc2NnZ24ybHkzZCJ9.ABDlOrNOjpgDUxKhmt_Ozw';

let inputCities = [];   // from us-locations.json (for dropdown)
let popularCities = []; // from largest-us-cities-by-population-2025.json (for filtering)

// Load both JSON files
Promise.all([
  fetch('us-locations.json').then(res => res.json()),
  fetch('largest-us-cities-by-population-2025.json').then(res => res.json())
])
.then(([locations, popular]) => {
  inputCities = locations;
  popularCities = popular;
});

// Suggest cities from us-locations.json
function suggestCities() {
  const input = document.getElementById('cityInput');
  const list = document.getElementById('citySuggestions');
  const search = input.value.toLowerCase();
  list.innerHTML = '';

  if (!search) return;

  const matches = inputCities.filter(city => city.name.toLowerCase().includes(search)).slice(0, 10);
  matches.forEach(city => {
    const div = document.createElement('div');
    div.textContent = `${city.name}, ${city.state}`;
    div.onclick = () => {
      input.value = `${city.name}, ${city.state}`;
      list.innerHTML = '';
    };
    list.appendChild(div);
  });
}
document.getElementById('cityInput').addEventListener('input', suggestCities);

// Mapbox Geocoding fallback
async function getCoordinatesFromMapbox(cityName) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(cityName)}.json?access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.features[0]?.center || null;
}

// Haversine distance formula
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = x => x * Math.PI / 180;
  const R = 3958.8; // miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Main function to find nearby cities
async function findNearbyCities() {
  const input = document.getElementById('cityInput').value.trim();
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = 'Finding nearby cities...';

  if (!input) {
    resultDiv.innerHTML = 'Please enter a city.';
    return;
  }

  // Extract city name and state
  const [cityName, stateName] = input.split(',').map(s => s.trim());

  // Try from us-locations.json
  const selectedCity = inputCities.find(c => 
    c.name.toLowerCase() === cityName.toLowerCase() && 
    (!stateName || c.state.toLowerCase() === stateName.toLowerCase())
  );

  let lat, lon;
  if (selectedCity && selectedCity.lat && selectedCity.lon) {
    lat = selectedCity.lat;
    lon = selectedCity.lon;
  } else {
    // fallback to Mapbox
    const coords = await getCoordinatesFromMapbox(input);
    if (!coords) {
      resultDiv.innerHTML = 'City not found.';
      return;
    }
    [lon, lat] = coords;
  }

  // Use largest-us-cities-by-population-2025.json for filtering nearby
  const nearby = popularCities
    .filter(c => !(c.city.toLowerCase() === cityName.toLowerCase() && c.state.toLowerCase() === stateName?.toLowerCase()))
    .map(c => ({
      ...c,
      distance: haversineDistance(lat, lon, c.lat, c.lng)
    }))
    .filter(c => c.distance <= 100) // within 100 miles
    .sort((a, b) => a.distance - b.distance);

  if (nearby.length === 0) {
    resultDiv.innerHTML = `No major popular cities found near ${input}.`;
    return;
  }

  resultDiv.innerHTML = `
    <strong>Popular cities near ${cityName}${stateName ? ', ' + stateName : ''}:</strong><br><br>
    ${nearby.map(c => `${c.city}, ${c.state} (${c.distance.toFixed(1)} mi)`).join('<br>')}
  `;
}
