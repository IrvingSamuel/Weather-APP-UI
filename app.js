const API_KEY = "32f492643f9782b082030cf2fabccb0e";
const BASE_URL = "https://api.openweathermap.org/data/2.5";
const ASSET_ICONS = {
  FAST_WIND: "assets/Moon cloud fast wind.png",
  MID_RAIN: "assets/Moon cloud mid rain.png",
  ANGLED_RAIN: "assets/Sun cloud angled rain.png",
  TORNADO: "assets/Tornado.png",
};

const state = {
  currentCity: "Sao Paulo",
  lastQueryType: "city",
  lastCoords: null,
};

const cityNameEl = document.getElementById("cityName");
const todayDateEl = document.getElementById("todayDate");
const currentIconEl = document.getElementById("currentIcon");
const currentTempEl = document.getElementById("currentTemp");
const currentDescEl = document.getElementById("currentDesc");
const hiLoEl = document.getElementById("hiLo");
const statusMessageEl = document.getElementById("statusMessage");

const uvIndexEl = document.getElementById("uvIndex");
const sunriseEl = document.getElementById("sunrise");
const windEl = document.getElementById("wind");
const rainfallEl = document.getElementById("rainfall");
const feelsLikeEl = document.getElementById("feelsLike");
const humidityEl = document.getElementById("humidity");
const visibilityEl = document.getElementById("visibility");
const pressureEl = document.getElementById("pressure");

const hourlyListEl = document.getElementById("hourlyList");
const weeklyListEl = document.getElementById("weeklyList");

const searchOverlayEl = document.getElementById("searchOverlay");
const openSearchBtnEl = document.getElementById("openSearchBtn");
const closeSearchBtnEl = document.getElementById("closeSearchBtn");
const refreshBtnEl = document.getElementById("refreshBtn");
const searchFormEl = document.getElementById("searchForm");
const cityInputEl = document.getElementById("cityInput");
const cityCardsEl = document.getElementById("cityCards");

const hourlyTabEl = document.getElementById("hourlyTab");
const weeklyTabEl = document.getElementById("weeklyTab");
const hourlyViewEl = document.getElementById("hourlyView");
const weeklyViewEl = document.getElementById("weeklyView");

function setStatus(message, isError = false) {
  statusMessageEl.textContent = message;
  statusMessageEl.style.color = isError ? "#ffd26f" : "";
}

function formatDate(timestamp, timezoneOffsetSeconds = 0) {
  const date = new Date((timestamp + timezoneOffsetSeconds) * 1000);
  return date.toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function formatHour(timestamp, timezoneOffsetSeconds = 0) {
  const date = new Date((timestamp + timezoneOffsetSeconds) * 1000);
  return date.toLocaleTimeString("pt-BR", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getWeatherIcon(iconCode, conditionId) {
  if (conditionId >= 200 && conditionId < 300) {
    return ASSET_ICONS.TORNADO;
  }

  if (conditionId >= 300 && conditionId < 600) {
    return iconCode?.endsWith("n") ? ASSET_ICONS.MID_RAIN : ASSET_ICONS.ANGLED_RAIN;
  }

  if (conditionId >= 600 && conditionId < 700) {
    return ASSET_ICONS.MID_RAIN;
  }

  if (conditionId >= 700 && conditionId < 800) {
    return ASSET_ICONS.FAST_WIND;
  }

  if (conditionId === 800) {
    return iconCode?.endsWith("n") ? ASSET_ICONS.FAST_WIND : ASSET_ICONS.ANGLED_RAIN;
  }

  if (conditionId > 800) {
    return ASSET_ICONS.FAST_WIND;
  }

  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
}

function kmFromMeters(meters = 0) {
  return (meters / 1000).toFixed(1);
}

function msToKmh(ms = 0) {
  return (ms * 3.6).toFixed(1);
}

async function fetchWeatherByCity(city) {
  const [currentRes, forecastRes] = await Promise.all([
    fetch(`${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric&lang=pt_br`),
    fetch(`${BASE_URL}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric&lang=pt_br`),
  ]);

  if (!currentRes.ok || !forecastRes.ok) {
    throw new Error("Cidade nao encontrada ou indisponivel.");
  }

  const current = await currentRes.json();
  const forecast = await forecastRes.json();
  return { current, forecast };
}

async function fetchWeatherByCoords(lat, lon) {
  const [currentRes, forecastRes] = await Promise.all([
    fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=pt_br`),
    fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=pt_br`),
  ]);

  if (!currentRes.ok || !forecastRes.ok) {
    throw new Error("Nao foi possivel carregar clima da sua localizacao.");
  }

  const current = await currentRes.json();
  const forecast = await forecastRes.json();
  return { current, forecast };
}

async function fetchUVIndex(lat, lon) {
  const response = await fetch(
    `${BASE_URL}/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,daily,alerts&appid=${API_KEY}&units=metric&lang=pt_br`
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data?.current?.uvi ?? null;
}

function buildHourlyData(list = []) {
  return list.slice(0, 8).map((item, index) => ({
    time: index === 0 ? "Agora" : formatHour(item.dt, item.timezoneOffset || 0),
    temp: Math.round(item.main.temp),
    rainProbability: Math.round((item.pop || 0) * 100),
    icon: item.weather?.[0]?.icon || "01d",
    conditionId: item.weather?.[0]?.id || 800,
  }));
}

function buildWeeklyData(list = [], timezoneOffset = 0) {
  const byDay = new Map();

  for (const item of list) {
    const date = new Date((item.dt + timezoneOffset) * 1000);
    const dayKey = date.toISOString().slice(0, 10);

    if (!byDay.has(dayKey)) {
      byDay.set(dayKey, {
        dt: item.dt,
        min: item.main.temp_min,
        max: item.main.temp_max,
        desc: item.weather?.[0]?.description || "-",
      });
      continue;
    }

    const day = byDay.get(dayKey);
    day.min = Math.min(day.min, item.main.temp_min);
    day.max = Math.max(day.max, item.main.temp_max);
  }

  return Array.from(byDay.values())
    .slice(0, 5)
    .map((day) => ({
      name: new Date((day.dt + timezoneOffset) * 1000).toLocaleDateString("pt-BR", {
        timeZone: "UTC",
        weekday: "short",
      }),
      desc: day.desc,
      min: Math.round(day.min),
      max: Math.round(day.max),
    }));
}

function renderCurrent(current) {
  const weatherInfo = current.weather?.[0] || {};
  cityNameEl.textContent = `${current.name}, ${current.sys?.country || ""}`;
  todayDateEl.textContent = formatDate(current.dt, current.timezone || 0);

  currentTempEl.textContent = `${Math.round(current.main.temp)} C`;
  currentDescEl.textContent = weatherInfo.description || "Sem descricao";
  hiLoEl.textContent = `H: ${Math.round(current.main.temp_max)} C  L: ${Math.round(current.main.temp_min)} C`;

  currentIconEl.src = getWeatherIcon(weatherInfo.icon || "01d", weatherInfo.id || 800);
  currentIconEl.alt = weatherInfo.description || "Clima atual";

  sunriseEl.textContent = formatHour(current.sys.sunrise, current.timezone || 0);
  windEl.textContent = `${msToKmh(current.wind.speed)} km/h`;
  feelsLikeEl.textContent = `${Math.round(current.main.feels_like)} C`;
  humidityEl.textContent = `${current.main.humidity}%`;
  visibilityEl.textContent = `${kmFromMeters(current.visibility)} km`;
  pressureEl.textContent = `${current.main.pressure} hPa`;

  uvIndexEl.textContent = "--";
}

function renderForecast(forecast) {
  const timezoneOffset = forecast.city?.timezone || 0;
  const taggedList = (forecast.list || []).map((item) => ({
    ...item,
    timezoneOffset,
  }));

  const hourly = buildHourlyData(taggedList);
  const weekly = buildWeeklyData(forecast.list || [], timezoneOffset);

  const firstRain = forecast.list?.[0]?.rain?.["3h"] || 0;
  rainfallEl.textContent = `${firstRain.toFixed(1)} mm`;

  hourlyListEl.innerHTML = "";
  for (const hour of hourly) {
    const card = document.createElement("article");
    card.className = `hourly-item${hour.time === "Agora" ? " current" : ""}`;
    card.innerHTML = `
      <p class="hour-label">${hour.time}</p>
      <img src="${getWeatherIcon(hour.icon, hour.conditionId)}" alt="icone horario" width="36" height="36" />
      <p class="hour-rain">${hour.rainProbability}%</p>
      <p class="hour-temp">${hour.temp} C</p>
    `;
    hourlyListEl.appendChild(card);
  }

  weeklyListEl.innerHTML = "";
  for (const day of weekly) {
    const row = document.createElement("li");
    row.innerHTML = `
      <span class="day-name">${day.name}</span>
      <span class="day-desc">${day.desc}</span>
      <span class="day-temp">${day.max} C / ${day.min} C</span>
    `;
    weeklyListEl.appendChild(row);
  }
}

function renderUV(value) {
  if (value === null || Number.isNaN(Number(value))) {
    uvIndexEl.textContent = "--";
    return;
  }

  uvIndexEl.textContent = Number(value).toFixed(1);
}

async function refreshUVFromCurrent(current) {
  const lat = current?.coord?.lat;
  const lon = current?.coord?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") {
    renderUV(null);
    return;
  }

  const uv = await fetchUVIndex(lat, lon);
  renderUV(uv);
}

async function buildCityCards() {
  if (!cityCardsEl) {
    return;
  }

  const cities = ["Montreal", "Toronto", "Tokyo", "Recife"];
  cityCardsEl.innerHTML = "";

  for (const city of cities) {
    try {
      const data = await fetchWeatherByCity(city);
      const weatherInfo = data.current.weather?.[0] || {};
      const card = document.createElement("button");
      card.type = "button";
      card.className = "city-weather-card";
      card.innerHTML = `
        <div>
          <div class="city-card-temp">${Math.round(data.current.main.temp)} C</div>
          <div class="city-card-meta">H:${Math.round(data.current.main.temp_max)}  L:${Math.round(data.current.main.temp_min)}</div>
          <div class="city-card-name">${data.current.name}, ${data.current.sys.country}</div>
        </div>
        <div>
          <img src="${getWeatherIcon(weatherInfo.icon || "01d", weatherInfo.id || 800)}" alt="icone de ${weatherInfo.description || city}" />
          <div class="city-card-desc">${weatherInfo.description || "--"}</div>
        </div>
      `;

      card.addEventListener("click", async () => {
        await loadByCity(data.current.name);
        closeSearch();
      });

      cityCardsEl.appendChild(card);
    } catch {
      const fallback = document.createElement("button");
      fallback.type = "button";
      fallback.className = "city-weather-card";
      fallback.textContent = city;
      fallback.addEventListener("click", async () => {
        await loadByCity(city);
        closeSearch();
      });
      cityCardsEl.appendChild(fallback);
    }
  }
}

async function loadByCity(city) {
  setStatus("Buscando clima...");
  try {
    const data = await fetchWeatherByCity(city);
    renderCurrent(data.current);
    renderForecast(data.forecast);
    await refreshUVFromCurrent(data.current);

    state.currentCity = city;
    state.lastQueryType = "city";
    state.lastCoords = null;

    setStatus("Dados atualizados com sucesso.");
  } catch (error) {
    setStatus(error.message || "Erro ao buscar cidade.", true);
  }
}

async function loadByCoords(lat, lon) {
  setStatus("Detectando clima da sua localizacao...");
  try {
    const data = await fetchWeatherByCoords(lat, lon);
    renderCurrent(data.current);
    renderForecast(data.forecast);
    await refreshUVFromCurrent(data.current);

    state.lastQueryType = "coords";
    state.lastCoords = { lat, lon };
    state.currentCity = data.current.name;

    setStatus("Clima local carregado.");
  } catch (error) {
    setStatus(error.message || "Erro na localizacao.", true);
    await loadByCity(state.currentCity);
  }
}

function openSearch() {
  searchOverlayEl.classList.remove("hidden");
  searchOverlayEl.setAttribute("aria-hidden", "false");
  cityInputEl.focus();
}

function closeSearch() {
  searchOverlayEl.classList.add("hidden");
  searchOverlayEl.setAttribute("aria-hidden", "true");
}

function toggleForecast(tab) {
  const showHourly = tab === "hourly";

  hourlyTabEl.classList.toggle("active", showHourly);
  weeklyTabEl.classList.toggle("active", !showHourly);

  hourlyTabEl.setAttribute("aria-selected", String(showHourly));
  weeklyTabEl.setAttribute("aria-selected", String(!showHourly));

  hourlyViewEl.classList.toggle("show", showHourly);
  weeklyViewEl.classList.toggle("show", !showHourly);
}

openSearchBtnEl.addEventListener("click", openSearch);
closeSearchBtnEl.addEventListener("click", closeSearch);

searchFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const city = cityInputEl.value.trim();
  if (!city) {
    return;
  }

  await loadByCity(city);
  closeSearch();
  cityInputEl.value = "";
  await buildCityCards();
});

refreshBtnEl.addEventListener("click", async () => {
  if (state.lastQueryType === "coords" && state.lastCoords) {
    await loadByCoords(state.lastCoords.lat, state.lastCoords.lon);
    return;
  }

  await loadByCity(state.currentCity);
});

hourlyTabEl.addEventListener("click", () => toggleForecast("hourly"));
weeklyTabEl.addEventListener("click", () => toggleForecast("weekly"));

(async function initApp() {
  await buildCityCards();

  if (!navigator.geolocation) {
    await loadByCity(state.currentCity);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      await loadByCoords(position.coords.latitude, position.coords.longitude);
    },
    async () => {
      setStatus("Geolocalizacao negada. Usando cidade padrao.", true);
      await loadByCity(state.currentCity);
    },
    {
      timeout: 10000,
      maximumAge: 300000,
    }
  );
})();
