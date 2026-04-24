import { createCard } from './utils.js';

export const type = 'weather';

export function create(widget) {
  const el = createCard(widget.title || 'Weather');
  const temp = document.createElement('div');
  temp.className = 'weather-temp';
  temp.textContent = '--°';
  const meta = document.createElement('div');
  meta.className = 'weather-meta';
  meta.textContent = 'Loading weather...';
  el.append(temp, meta);

  const lat = widget.latitude;
  const lon = widget.longitude;
  const units = widget.units || 'fahrenheit';

  if (lat == null || lon == null) {
    meta.textContent = 'Missing latitude/longitude in config';
    return el;
  }

  async function load() {
    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', lat);
      url.searchParams.set('longitude', lon);
      url.searchParams.set('current', 'temperature_2m,weather_code');
      url.searchParams.set('temperature_unit', units === 'celsius' ? 'celsius' : 'fahrenheit');
      url.searchParams.set('timezone', 'auto');
      const response = await fetch(url);
      const data = await response.json();
      temp.textContent = `${Math.round(data.current.temperature_2m)}°`;
      meta.textContent = weatherCodeToText(data.current.weather_code);
    } catch (error) {
      meta.textContent = 'Weather unavailable';
    }
  }

  load();
  setInterval(load, widget.refreshMs || 600000);
  return el;
}

function weatherCodeToText(code) {
  const map = {
    0: 'Clear',
    1: 'Mostly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    51: 'Light drizzle',
    61: 'Light rain',
    63: 'Rain',
    71: 'Snow',
    80: 'Showers',
    95: 'Thunderstorm'
  };
  return map[code] || `Code ${code}`;
}
