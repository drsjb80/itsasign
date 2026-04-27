import { createCard, reportWidgetError } from './utils.js';

export const type = 'weather';

export function create(widget) {
  const el = createCard(widget.title || 'Weather');

  const currentRow = document.createElement('div');
  currentRow.className = 'weather-current-row';

  const icon = document.createElement('div');
  icon.className = 'weather-icon';
  icon.textContent = '…';

  const temp = document.createElement('div');
  temp.className = 'weather-temp';
  temp.textContent = '--°';

  currentRow.append(icon, temp);

  const meta = document.createElement('div');
  meta.className = 'weather-meta';
  meta.textContent = 'Loading weather...';

  const trend = document.createElement('div');
  trend.className = 'weather-trend';
  trend.textContent = 'Trend: --';

  const location = document.createElement('div');
  location.className = 'weather-location';
  location.textContent = '';

  const stats = document.createElement('div');
  stats.className = 'weather-stats';

  const pressure = document.createElement('div');
  pressure.className = 'weather-stat';
  pressure.innerHTML = '<span class="weather-stat-label">Pressure</span><span class="weather-stat-value">--</span>';

  const wind = document.createElement('div');
  wind.className = 'weather-stat';
  wind.innerHTML = '<span class="weather-stat-label">Wind</span><span class="weather-stat-value">--</span>';

  const windChill = document.createElement('div');
  windChill.className = 'weather-stat';
  windChill.innerHTML = '<span class="weather-stat-label">Wind chill</span><span class="weather-stat-value">--</span>';

  const forecast = document.createElement('div');
  forecast.className = 'weather-forecast';

  const forecastTitle = document.createElement('div');
  forecastTitle.className = 'weather-forecast-title';
  forecastTitle.textContent = '5-Day Forecast';

  const forecastList = document.createElement('div');
  forecastList.className = 'weather-forecast-list';

  const left = document.createElement('div');
  left.className = 'weather-left';
  left.append(currentRow, meta, trend, location);

  const body = document.createElement('div');
  body.className = 'weather-body';

  stats.append(pressure, wind, windChill);
  body.append(left, stats);
  forecast.append(forecastTitle, forecastList);
  el.append(body, forecast);

  const configuredLat = widget.latitude;
  const configuredLon = widget.longitude;
  const units = widget.units || 'fahrenheit';
  const useGeolocation = widget.useGeolocation === true;
  const geolocationTimeoutMs = Number(widget.geolocationTimeoutMs) || 7000;
  const forecastDays = clamp(Number(widget.forecastDays) || 5, 1, 7);
  const refreshMs = Number(widget.refreshMs) || 600000;
  const windSpeedUnit = normalizeWindSpeedUnit(widget.windSpeedUnit);
  const windSpeedUnitLabel = windSpeedUnitLabelText(windSpeedUnit);
  const temperatureUnit = units === 'celsius' ? 'celsius' : 'fahrenheit';
  const pressureUnit = (typeof widget.pressureUnit === 'string' && widget.pressureUnit.toLowerCase() === 'hpa') ? 'hpa' : 'inhg';
  const pressureUnitLabel = pressureUnit === 'hpa' ? 'hPa' : 'inHg';

  // Set initial placeholder now that pressureUnitLabel is available.
  pressure.querySelector('.weather-stat-value').textContent = `-- ${pressureUnitLabel}`;
  windChill.querySelector('.weather-stat-value').textContent = '--';

  let activeCoords = null;
  let previousTemperature = null;

  async function load(coords) {
    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', coords.latitude);
      url.searchParams.set('longitude', coords.longitude);
      url.searchParams.set('current', 'temperature_2m,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m');
      url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min');
      url.searchParams.set('forecast_days', String(forecastDays));
      url.searchParams.set('temperature_unit', temperatureUnit);
      url.searchParams.set('wind_speed_unit', windSpeedUnit);
      url.searchParams.set('timezone', 'auto');

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Weather request failed: ${response.status}`);
      }

      const data = await response.json();
      const current = data.current || {};

      icon.innerHTML = weatherCodeToIcon(current.weather_code);
      temp.textContent = formatTemperature(current.temperature_2m);
      meta.textContent = weatherCodeToText(current.weather_code);

      const temperatureNow = toFiniteNumber(current.temperature_2m);
      const windSpeedNow = toFiniteNumber(current.wind_speed_10m);
      trend.textContent = formatTrend(previousTemperature, temperatureNow);
      if (temperatureNow != null) {
        previousTemperature = temperatureNow;
      }

      const rawPressure = current.surface_pressure;
      const convertedPressure = pressureUnit === 'hpa' ? rawPressure : hpaToInhg(rawPressure);
      const formattedPressure = pressureUnit === 'inhg' ? formatDecimal(convertedPressure, 2, '--') : formatRounded(convertedPressure, '--');
      pressure.querySelector('.weather-stat-value').textContent = `${formattedPressure} ${pressureUnitLabel}`;
      wind.querySelector('.weather-stat-value').textContent = `${formatRounded(current.wind_speed_10m, '--')} ${windSpeedUnitLabel} ${degreesToCompass(current.wind_direction_10m)}`.trim();

      const windChillValue = calculateWindChill({
        temperature: temperatureNow,
        windSpeed: windSpeedNow,
        temperatureUnit,
        windSpeedUnit
      });
      windChill.querySelector('.weather-stat-value').textContent = windChillValue == null ? 'N/A' : formatTemperature(windChillValue);

      renderForecast({
        forecastList,
        times: data.daily && data.daily.time,
        codes: data.daily && data.daily.weather_code,
        maxTemps: data.daily && data.daily.temperature_2m_max,
        minTemps: data.daily && data.daily.temperature_2m_min
      });
    } catch (error) {
      reportWidgetError({
        widgetType: type,
        message: 'Weather unavailable',
        error,
        target: meta
      });

      icon.textContent = '?';
      temp.textContent = '--°';
      trend.textContent = 'Trend: --';
      pressure.querySelector('.weather-stat-value').textContent = `-- ${pressureUnitLabel}`;
      wind.querySelector('.weather-stat-value').textContent = '--';
      windChill.querySelector('.weather-stat-value').textContent = '--';
      forecastList.innerHTML = '';
    }
  }

  async function init() {
    try {
      activeCoords = await resolveCoordinates({
        useGeolocation,
        geolocationTimeoutMs,
        configuredLat,
        configuredLon
      });

      location.textContent = formatCoordinateLabel(activeCoords);
      resolveLocationLabel(activeCoords).then(label => {
        location.textContent = label;
      });

      await load(activeCoords);
    } catch (error) {
      reportWidgetError({
        widgetType: type,
        message: 'Missing latitude/longitude and geolocation unavailable',
        error,
        target: meta
      });
      location.textContent = '';
      return;
    }

    setInterval(() => {
      if (activeCoords) {
        load(activeCoords);
      }
    }, refreshMs);
  }

  init();
  return el;
}

async function resolveCoordinates({ useGeolocation, geolocationTimeoutMs, configuredLat, configuredLon }) {
  if (useGeolocation && navigator.geolocation) {
    try {
      const position = await getCurrentPosition({ timeout: geolocationTimeoutMs });
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        source: 'geolocation'
      };
    } catch {
      // Fall through to configured coordinates when device geolocation is unavailable.
    }
  }

  if (configuredLat != null && configuredLon != null) {
    return {
      latitude: Number(configuredLat),
      longitude: Number(configuredLon),
      source: 'config'
    };
  }

  throw new Error('No coordinates available');
}

function getCurrentPosition({ timeout }) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout,
      maximumAge: 300000
    });
  });
}

async function resolveLocationLabel(coords) {
  try {
    const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
    url.searchParams.set('latitude', String(coords.latitude));
    url.searchParams.set('longitude', String(coords.longitude));
    url.searchParams.set('localityLanguage', 'en');

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Reverse geocode failed: ${response.status}`);
    }

    const data = await response.json();
    const city = firstNonEmpty(
      data.city,
      data.locality,
      data.principalSubdivision,
      data.localityInfo && data.localityInfo.administrative && data.localityInfo.administrative[0] && data.localityInfo.administrative[0].name
    );
    const countryCode = normalizeCountryCode(data.countryCode);
    const country = countryCode || firstNonEmpty(data.countryName);

    if (city && country) {
      return `${city}, ${country}`;
    }
    if (city) {
      return city;
    }
    if (country) {
      return country;
    }
  } catch {
    // Keep coordinate fallback when reverse geocoding is unavailable.
  }

  return formatCoordinateLabel(coords);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function normalizeCountryCode(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (trimmed.length !== 2) {
    return '';
  }

  return trimmed.toUpperCase();
}

function formatCoordinateLabel(coords) {
  return `${Number(coords.latitude).toFixed(2)}, ${Number(coords.longitude).toFixed(2)}`;
}

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatTrend(previousTemperature, currentTemperature) {
  if (previousTemperature == null || currentTemperature == null) {
    return 'Trend: --';
  }

  const delta = currentTemperature - previousTemperature;
  if (Math.abs(delta) < 0.5) {
    return 'Trend: steady';
  }

  if (delta > 0) {
    return `Trend: rising ${formatSignedDecimal(delta, 1)}°`;
  }

  return `Trend: falling ${formatSignedDecimal(delta, 1)}°`;
}

function formatSignedDecimal(value, decimals) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return '--';
  }

  const fixed = num.toFixed(decimals);
  return num > 0 ? `+${fixed}` : fixed;
}

function calculateWindChill({ temperature, windSpeed, temperatureUnit, windSpeedUnit }) {
  if (temperature == null || windSpeed == null) {
    return null;
  }

  if (temperatureUnit === 'fahrenheit') {
    const speedMph = convertWindSpeed(windSpeed, windSpeedUnit, 'mph');
    if (temperature > 50 || speedMph <= 3) {
      return null;
    }

    return 35.74 + (0.6215 * temperature) - (35.75 * Math.pow(speedMph, 0.16)) + (0.4275 * temperature * Math.pow(speedMph, 0.16));
  }

  const speedKmh = convertWindSpeed(windSpeed, windSpeedUnit, 'kmh');
  if (temperature > 10 || speedKmh <= 4.8) {
    return null;
  }

  return 13.12 + (0.6215 * temperature) - (11.37 * Math.pow(speedKmh, 0.16)) + (0.3965 * temperature * Math.pow(speedKmh, 0.16));
}

function convertWindSpeed(value, fromUnit, toUnit) {
  const speed = Number(value);
  if (!Number.isFinite(speed)) {
    return NaN;
  }

  const metersPerSecond = toMetersPerSecond(speed, fromUnit);
  if (!Number.isFinite(metersPerSecond)) {
    return NaN;
  }

  if (toUnit === 'ms') return metersPerSecond;
  if (toUnit === 'kmh') return metersPerSecond * 3.6;
  if (toUnit === 'mph') return metersPerSecond * 2.2369362921;
  if (toUnit === 'kn') return metersPerSecond * 1.9438444924;
  return NaN;
}

function toMetersPerSecond(value, unit) {
  if (unit === 'ms') return value;
  if (unit === 'kmh') return value / 3.6;
  if (unit === 'mph') return value / 2.2369362921;
  if (unit === 'kn') return value / 1.9438444924;
  return NaN;
}

function normalizeWindSpeedUnit(value) {
  const valid = new Set(['kmh', 'ms', 'mph', 'kn']);
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  return valid.has(normalized) ? normalized : 'mph';
}

function windSpeedUnitLabelText(unit) {
  const map = {
    kmh: 'km/h',
    ms: 'm/s',
    mph: 'mph',
    kn: 'kn'
  };
  return map[unit] || unit;
}

function renderForecast({ forecastList, times, codes, maxTemps, minTemps }) {
  forecastList.innerHTML = '';

  if (!Array.isArray(times) || !times.length) {
    return;
  }

  for (let i = 0; i < times.length; i += 1) {
    const col = document.createElement('div');
    col.className = 'weather-forecast-col';

    const day = document.createElement('div');
    day.className = 'weather-forecast-day';
    day.textContent = dayLabel(times[i], i);

    const dayIcon = document.createElement('div');
    dayIcon.className = 'weather-forecast-icon';
    dayIcon.innerHTML = weatherCodeToIcon(codes && codes[i]);

    const range = document.createElement('div');
    range.className = 'weather-forecast-range';
    range.textContent = `${formatTemperature(maxTemps && maxTemps[i])}\n${formatTemperature(minTemps && minTemps[i])}`;

    col.append(day, dayIcon, range);
    forecastList.appendChild(col);
  }
}

function dayLabel(dateText, index) {
  if (index === 0) {
    return 'Today';
  }

  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) {
    return dateText;
  }

  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
}

function degreesToCompass(deg) {
  if (deg == null || Number.isNaN(Number(deg))) {
    return '';
  }

  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round((Number(deg) % 360) / 45) % 8;
  return directions[index];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hpaToInhg(hpa) {
  const num = Number(hpa);
  if (!Number.isFinite(num)) return hpa;
  return num * 0.02953;
}

function formatRounded(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return String(Math.round(num));
}

function formatDecimal(value, decimals, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return num.toFixed(decimals);
}

function formatTemperature(value) {
  const rounded = formatRounded(value, '--');
  return `${rounded}°`;
}

function weatherCodeToIcon(code) {
  // Helper to create inline SVG strings
  const svg = (content) => `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;

  if (code === 0) {
    // Clear - sun
    return svg('<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2"/><line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2"/><line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2"/><line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2"/>');
  }
  if (code === 1) {
    // Mostly clear - sun with small cloud
    return svg('<circle cx="9" cy="9" r="4" fill="currentColor"/><line x1="9" y1="2" x2="9" y2="3.5" stroke="currentColor" stroke-width="1.5"/><line x1="9" y1="14.5" x2="9" y2="16" stroke="currentColor" stroke-width="1.5"/><line x1="2.5" y1="9" x2="4" y2="9" stroke="currentColor" stroke-width="1.5"/><line x1="14" y1="9" x2="15.5" y2="9" stroke="currentColor" stroke-width="1.5"/><path d="M14 16c1.5 0 2.8.8 3.5 2 .3.6.5 1.3.5 2 0 2.2-1.8 4-4 4h-5c-2.2 0-4-1.8-4-4 0-.7.2-1.4.5-2 .7-1.2 2-2 3.5-2z" stroke="currentColor" stroke-width="1.5" fill="none"/>');
  }
  if (code === 2) {
    // Partly cloudy - sun with cloud
    return svg('<circle cx="8" cy="8" r="3.5" fill="currentColor"/><path d="M13 15c1.5 0 2.8.8 3.5 2 .3.6.5 1.3.5 2 0 2.2-1.8 4-4 4H8c-2.2 0-4-1.8-4-4 0-.7.2-1.4.5-2 .7-1.2 2-2 3.5-2z" stroke="currentColor" stroke-width="1.5" fill="none"/>');
  }
  if (code === 3) {
    // Overcast - cloud
    return svg('<path d="M18 10c1.1 0 2 .9 2 2 0 1-.7 1.9-1.7 2-.3 2-2 3.5-4.3 3.5H6c-2.2 0-4-1.8-4-4 0-2 1.6-3.7 3.6-3.9C6.3 8.5 7.3 8 8.5 8c1.1 0 2.2.4 3 1.1.8-.7 1.9-1.1 3-1.1z" stroke="currentColor" stroke-width="1.5" fill="none"/>');
  }
  if (code === 45 || code === 48) {
    // Fog - cloud with lines
    return svg('<path d="M18 10c1.1 0 2 .9 2 2 0 1-.7 1.9-1.7 2-.3 2-2 3.5-4.3 3.5H6c-2.2 0-4-1.8-4-4 0-2 1.6-3.7 3.6-3.9C6.3 8.5 7.3 8 8.5 8c1.1 0 2.2.4 3 1.1.8-.7 1.9-1.1 3-1.1z" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="3" y1="17" x2="9" y2="17" stroke="currentColor" stroke-width="1"/><line x1="11" y1="17" x2="21" y2="17" stroke="currentColor" stroke-width="1"/><line x1="3" y1="19" x2="12" y2="19" stroke="currentColor" stroke-width="1"/><line x1="14" y1="19" x2="21" y2="19" stroke="currentColor" stroke-width="1"/>');
  }
  if (code >= 51 && code <= 55) {
    // Drizzle - cloud with light drops
    return svg('<path d="M18 10c1.1 0 2 .9 2 2 0 1-.7 1.9-1.7 2-.3 2-2 3.5-4.3 3.5H6c-2.2 0-4-1.8-4-4 0-2 1.6-3.7 3.6-3.9C6.3 8.5 7.3 8 8.5 8c1.1 0 2.2.4 3 1.1.8-.7 1.9-1.1 3-1.1z" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="7" cy="18" r="0.8" fill="currentColor"/><circle cx="10" cy="18" r="0.8" fill="currentColor"/><circle cx="13" cy="18" r="0.8" fill="currentColor"/><circle cx="16" cy="18" r="0.8" fill="currentColor"/>');
  }
  if (code >= 56 && code <= 57) {
    // Freezing drizzle - cloud with snowflakes
    return svg('<path d="M18 10c1.1 0 2 .9 2 2 0 1-.7 1.9-1.7 2-.3 2-2 3.5-4.3 3.5H6c-2.2 0-4-1.8-4-4 0-2 1.6-3.7 3.6-3.9C6.3 8.5 7.3 8 8.5 8c1.1 0 2.2.4 3 1.1.8-.7 1.9-1.1 3-1.1z" stroke="currentColor" stroke-width="1.5" fill="none"/><g stroke="currentColor" stroke-width="1"><line x1="7" y1="17" x2="7" y2="20"/><line x1="5.5" y1="18.5" x2="8.5" y2="18.5"/><line x1="6" y1="17.5" x2="8" y2="19.5"/><line x1="8" y1="17.5" x2="6" y2="19.5"/></g>');
  }
  if (code >= 61 && code <= 65) {
    // Rain - cloud with rain drops
    return svg('<path d="M18 10c1.1 0 2 .9 2 2 0 1-.7 1.9-1.7 2-.3 2-2 3.5-4.3 3.5H6c-2.2 0-4-1.8-4-4 0-2 1.6-3.7 3.6-3.9C6.3 8.5 7.3 8 8.5 8c1.1 0 2.2.4 3 1.1.8-.7 1.9-1.1 3-1.1z" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="5" y1="17" x2="4" y2="20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="9" y1="17" x2="8" y2="20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="13" y1="17" x2="12" y2="20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="17" y1="17" x2="16" y2="20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>');
  }
  if (code >= 66 && code <= 67) {
    // Freezing rain - cloud with snow
    return svg('<path d="M18 10c1.1 0 2 .9 2 2 0 1-.7 1.9-1.7 2-.3 2-2 3.5-4.3 3.5H6c-2.2 0-4-1.8-4-4 0-2 1.6-3.7 3.6-3.9C6.3 8.5 7.3 8 8.5 8c1.1 0 2.2.4 3 1.1.8-.7 1.9-1.1 3-1.1z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M5.5 19l1-1.7m0 1.7l-1-1.7M4 20l1.5-1.5M6 20L4.5 18.5M7 17l1 3m0-3l-1 3" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>');
  }
  if (code >= 71 && code <= 77) {
    // Snow - snowflakes
    return svg('<path d="M18 10c1.1 0 2 .9 2 2 0 1-.7 1.9-1.7 2-.3 2-2 3.5-4.3 3.5H6c-2.2 0-4-1.8-4-4 0-2 1.6-3.7 3.6-3.9C6.3 8.5 7.3 8 8.5 8c1.1 0 2.2.4 3 1.1.8-.7 1.9-1.1 3-1.1z" stroke="currentColor" stroke-width="1.5" fill="none"/><g stroke="currentColor" stroke-width="1"><line x1="5" y1="17.5" x2="5" y2="21.5"/><line x1="3" y1="19.5" x2="7" y2="19.5"/><line x1="3.5" y1="17.5" x2="6.5" y2="21.5"/><line x1="6.5" y1="17.5" x2="3.5" y2="21.5"/></g><g stroke="currentColor" stroke-width="1"><line x1="12" y1="17.5" x2="12" y2="21.5"/><line x1="10" y1="19.5" x2="14" y2="19.5"/><line x1="10.5" y1="17.5" x2="13.5" y2="21.5"/><line x1="13.5" y1="17.5" x2="10.5" y2="21.5"/></g>');
  }
  if (code >= 80 && code <= 82) {
    // Showers - heavy rain
    return svg('<path d="M18 10c1.1 0 2 .9 2 2 0 1-.7 1.9-1.7 2-.3 2-2 3.5-4.3 3.5H6c-2.2 0-4-1.8-4-4 0-2 1.6-3.7 3.6-3.9C6.3 8.5 7.3 8 8.5 8c1.1 0 2.2.4 3 1.1.8-.7 1.9-1.1 3-1.1z" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="4" y1="17" x2="3" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="17" x2="7" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="17" x2="11" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="17" x2="15" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>');
  }
  if (code === 85 || code === 86) {
    // Snow showers - heavy snow
    return svg('<path d="M18 10c1.1 0 2 .9 2 2 0 1-.7 1.9-1.7 2-.3 2-2 3.5-4.3 3.5H6c-2.2 0-4-1.8-4-4 0-2 1.6-3.7 3.6-3.9C6.3 8.5 7.3 8 8.5 8c1.1 0 2.2.4 3 1.1.8-.7 1.9-1.1 3-1.1z" stroke="currentColor" stroke-width="1.5" fill="none"/><g stroke="currentColor" stroke-width="1.2"><line x1="5" y1="17" x2="5" y2="20.5"/><line x1="3" y1="18.75" x2="7" y2="18.75"/><line x1="3.5" y1="17" x2="6.5" y2="20.5"/><line x1="6.5" y1="17" x2="3.5" y2="20.5"/></g><g stroke="currentColor" stroke-width="1.2"><line x1="12" y1="17" x2="12" y2="20.5"/><line x1="10" y1="18.75" x2="14" y2="18.75"/><line x1="10.5" y1="17" x2="13.5" y2="20.5"/><line x1="13.5" y1="17" x2="10.5" y2="20.5"/></g>');
  }
  if (code >= 95 && code <= 99) {
    // Thunderstorm - cloud with lightning
    return svg('<path d="M18 10c1.1 0 2 .9 2 2 0 1-.7 1.9-1.7 2-.3 2-2 3.5-4.3 3.5H6c-2.2 0-4-1.8-4-4 0-2 1.6-3.7 3.6-3.9C6.3 8.5 7.3 8 8.5 8c1.1 0 2.2.4 3 1.1.8-.7 1.9-1.1 3-1.1z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M10 16l-1 2 1.5-.5 1.5 2.5-1-2 2 .5-1.5-2.5" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>');
  }
  
  // Default - question mark
  return svg('<text x="12" y="18" text-anchor="middle" font-size="16" font-weight="bold" fill="currentColor">?</text>');
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
    95: 'Thunderstorm',
    96: 'Storm/hail',
    99: 'Storm/hail'
  };
  return map[code] || `Code ${code}`;
}
