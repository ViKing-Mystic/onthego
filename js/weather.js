/**
 * OntheGO - Stage 3: Weather & Coastal Disruption Monitor
 * Real Open-Meteo REST integration, distinguishing current conditions from 5-day forecasts,
 * assessing specific coastal and water activity risks (Kayaking, Coastal Ride, Beach Swimming, Lighthouse, SUP),
 * enforcing safety disclaimers, and providing complete offline cache resilience.
 */

window.OntheGoWeather = {
  DESTINATIONS: {
    kochi: { name: "Kochi / Fort Kochi", lat: 9.9656, lng: 76.2421 },
    alleppey: { name: "Alleppey / Marari", lat: 9.4981, lng: 76.3388 },
    kumbalangi: { name: "Kumbalangi Village", lat: 9.8732, lng: 76.2863 }
  },

  init() {
    this.ensureWeatherState();
    this.fetchTripForecasts();
  },

  ensureWeatherState() {
    if (!OntheGoApp.state) return;
    if (!OntheGoApp.state.weatherCache) {
      OntheGoApp.state.weatherCache = {};
    }
  },

  /**
   * Fetches real forecasts from Open-Meteo REST API with timeout and offline cache fallback.
   */
  async fetchDestinationForecast(key) {
    const dest = this.DESTINATIONS[key];
    if (!dest) return null;

    this.ensureWeatherState();
    const cache = OntheGoApp.state.weatherCache || {};

    // Check if online
    if (navigator.onLine) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${dest.lat}&longitude=${dest.lng}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=Asia%2FKolkata`;

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const forecastObj = {
            locationKey: key,
            locationName: dest.name,
            lat: dest.lat,
            lng: dest.lng,
            retrievedAt: new Date().toISOString(),
            isLive: true,
            current: {
              temperature: Math.round(data.current?.temperature_2m || 29),
              humidity: data.current?.relative_humidity_2m || 75,
              precipitationMm: data.current?.precipitation || 0,
              weatherCode: data.current?.weather_code || 1,
              weatherDesc: this.interpretWmoCode(data.current?.weather_code || 1),
              windSpeedKmH: Math.round(data.current?.wind_speed_10m || 12)
            },
            daily: (data.daily?.time || []).map((date, idx) => ({
              date,
              weatherCode: data.daily.weather_code[idx],
              weatherDesc: this.interpretWmoCode(data.daily.weather_code[idx]),
              maxTemp: Math.round(data.daily.temperature_2m_max[idx]),
              minTemp: Math.round(data.daily.temperature_2m_min[idx]),
              precipitationSumMm: data.daily.precipitation_sum[idx] || 0,
              rainProbability: data.daily.precipitation_probability_max[idx] || 20,
              maxWindSpeedKmH: Math.round(data.daily.wind_speed_10m_max[idx] || 15)
            }))
          };

          // Update cache
          OntheGoApp.state.weatherCache[key] = forecastObj;
          OntheGoApp.saveState();
          return forecastObj;
        }
      } catch (err) {
        console.warn(`Weather fetch failed for ${key}, falling back to cache:`, err);
      }
    }

    // Return cached forecast if available
    if (cache[key]) {
      const cached = { ...cache[key], isLive: false };
      return cached;
    }

    // Default historical baseline for mid-October Kerala post-monsoon
    return {
      locationKey: key,
      locationName: dest.name,
      lat: dest.lat,
      lng: dest.lng,
      retrievedAt: "Historical baseline (Oct 2026)",
      isLive: false,
      isBaseline: true,
      current: {
        temperature: 29,
        humidity: 78,
        precipitationMm: 0,
        weatherCode: 2,
        weatherDesc: "Partly cloudy with humid coastal breeze",
        windSpeedKmH: 14
      },
      daily: [
        { date: "2026-10-16", weatherDesc: "Passing coastal shower, warm afternoon", maxTemp: 31, minTemp: 25, rainProbability: 35, maxWindSpeedKmH: 16 },
        { date: "2026-10-17", weatherDesc: "Clear morning, pleasant coastal breeze", maxTemp: 32, minTemp: 24, rainProbability: 25, maxWindSpeedKmH: 18 },
        { date: "2026-10-18", weatherDesc: "Calm backwaters, sunny afternoon", maxTemp: 31, minTemp: 25, rainProbability: 20, maxWindSpeedKmH: 12 },
        { date: "2026-10-19", weatherDesc: "Warm, scattered clouds over backwaters", maxTemp: 32, minTemp: 24, rainProbability: 30, maxWindSpeedKmH: 14 },
        { date: "2026-10-20", weatherDesc: "Clear morning, humid midday", maxTemp: 31, minTemp: 25, rainProbability: 25, maxWindSpeedKmH: 15 }
      ]
    };
  },

  async fetchTripForecasts() {
    await Promise.all([
      this.fetchDestinationForecast("kochi"),
      this.fetchDestinationForecast("alleppey"),
      this.fetchDestinationForecast("kumbalangi")
    ]);
    this.evaluateCoastalRisks();
    this.renderWeatherWidget();
  },

  interpretWmoCode(code) {
    if (code === 0) return "Clear sunny skies";
    if (code === 1 || code === 2) return "Partly cloudy with coastal breeze";
    if (code === 3) return "Overcast";
    if (code >= 51 && code <= 55) return "Light drizzle";
    if (code >= 61 && code <= 65) return "Rain showers";
    if (code >= 80 && code <= 82) return "Heavy tropical showers";
    if (code >= 95) return "Thunderstorms & squalls";
    return "Tropical coastal weather";
  },

  // ==========================================
  // COASTAL & WATER ACTIVITY RISK EVALUATION
  // ==========================================

  /**
   * Assesses weather disruptions for specific coastal and water activities.
   * Produces grounded advisories reminding travellers to verify with operators and authorities.
   */
  evaluateCoastalRisks() {
    const risks = [];
    const cache = OntheGoApp.state?.weatherCache || {};
    const alleppey = cache["alleppey"]?.current || { windSpeedKmH: 14, precipitationMm: 0 };
    const kochi = cache["kochi"]?.current || { windSpeedKmH: 12, precipitationMm: 0 };

    // 1. Day 3: Opulence Morning Kayaking
    const kayakHighWind = alleppey.windSpeedKmH > 22;
    const kayakRain = alleppey.precipitationMm > 1.5;
    risks.push({
      activityId: "act-3-1",
      activityTitle: "Opulence Morning Kayaking",
      activityType: "kayaking",
      riskLevel: (kayakHighWind || kayakRain) ? "moderate" : "low",
      advisoryTitle: (kayakHighWind || kayakRain) ? "⚠️ Backwater Wind / Rain Advisory" : "🟢 Water Conditions Favourable",
      advisoryDetails: (kayakHighWind || kayakRain)
        ? `Wind: ${alleppey.windSpeedKmH} km/h, Rain: ${alleppey.precipitationMm} mm/h. Sudden squalls can create choppy canal chop.`
        : `Wind: ${alleppey.windSpeedKmH} km/h. Suitable for flat-water morning paddling.`,
      operatorContact: "8921172358 (Opulence)",
      recommendation: "Operator Opulence has the final authority on water safety. Contact 8921172358 early morning before departing."
    });

    // 2. Day 2 & 4: Coastal Highway Ride (Chellanam–Mararikulam)
    const coastalSurge = kochi.windSpeedKmH > 25 || kochi.precipitationMm > 3.0;
    risks.push({
      activityId: "act-2-6",
      activityTitle: "Chellanam–Andhakaranazhi Coastal Ride",
      activityType: "coastal_ride",
      riskLevel: coastalSurge ? "high" : "low",
      advisoryTitle: coastalSurge ? "🚨 High Coastal Surge Warning" : "🟢 Coastal Road Clear",
      advisoryDetails: coastalSurge
        ? "Heavy rain or onshore sea surge may cause sand deposit and waterlogging on the seawall stretch."
        : "Standard daylight road conditions. Keep headlight on for visibility.",
      operatorContact: "Kerala Police / Highway Patrol: 112",
      recommendation: "Never ride through sea surge water on coastal roads. If water washes over the road, take the inland NH66 alternative."
    });

    // 3. Day 3: Marari Beach Swimming
    risks.push({
      activityId: "act-3-3",
      activityTitle: "Marari Beach Swimming & Sunset",
      activityType: "beach",
      riskLevel: "moderate", // Arabian sea always warrants caution
      advisoryTitle: "⚠️ Shore Currents Advisory",
      advisoryDetails: "The Arabian Sea along Mararikulam features strong undertow and shifting sandbars even in sunny weather.",
      operatorContact: "Beach Lifeguard Post / 112",
      recommendation: "Favourable weather does NOT guarantee swimming safety. Swim strictly within designated lifeguard zones; never enter the water if red danger flags are hoisted."
    });

    // 4. Day 2: Alleppey Lighthouse
    const lightWind = alleppey.windSpeedKmH > 28;
    risks.push({
      activityId: "act-2-8",
      activityTitle: "Alleppey Lighthouse Visit",
      activityType: "lighthouse",
      riskLevel: lightWind ? "moderate" : "low",
      advisoryTitle: lightWind ? "⚠️ High Wind Advisory on Balcony" : "🟢 Visiting Feasible",
      advisoryDetails: lightWind
        ? `Gusty winds (${alleppey.windSpeedKmH} km/h) at the 28-meter observation gallery.`
        : "Calm conditions. Strict ticket counter closure at 5:00 PM.",
      operatorContact: "+91 477 2253308",
      recommendation: "Hold onto handrails on the spiral stair climb. Observation gallery may be closed by port authorities during squalls."
    });

    // 5. Day 4: Stand-Up Paddling (Kumbalangi)
    risks.push({
      activityId: "act-4-8",
      activityTitle: "Stand-Up Paddling (Kumbalangi)",
      activityType: "standup_paddling",
      riskLevel: "low",
      advisoryTitle: "🟢 Calm Tidal Estuary",
      advisoryDetails: "Protected backwater tourism zone with minimal current during slack tide.",
      operatorContact: "Zostel Kumbalangi / Tourism Desk",
      recommendation: "Life jacket is mandatory. Complete all paddling sessions before twilight (6:15 PM)."
    });

    this.coastalRisks = risks;
    return risks;
  },

  getRiskForActivity(actId) {
    if (!this.coastalRisks) this.evaluateCoastalRisks();
    return (this.coastalRisks || []).find(r => r.activityId === actId);
  },

  renderWeatherWidget() {
    const container = document.getElementById("dashWeatherWidget");
    if (!container) return;

    const cache = OntheGoApp.state?.weatherCache || {};
    const kochi = cache["kochi"];
    const alleppey = cache["alleppey"];
    const activeData = kochi || alleppey;

    if (!activeData) {
      container.innerHTML = `
        <div class="weather-strip" style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 0.76rem;">
          ⛅ Loading coastal Kerala forecasts...
        </div>
      `;
      return;
    }

    const cur = activeData.current;
    const isLive = activeData.isLive;

    container.innerHTML = `
      <div class="weather-strip" style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 10px 14px; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.4rem;">🌤️</span>
            <div>
              <div style="font-weight: 800; font-size: 0.88rem; color: var(--text-main);">${activeData.locationName}</div>
              <div style="font-size: 0.7rem; color: var(--text-dim);">
                ${isLive ? '🟢 Live Open-Meteo Forecast' : '⚪ Offline / Cached Forecast'} • ${cur.weatherDesc}
              </div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.25rem; font-weight: 800; color: var(--ocean-teal);">${cur.temperature}°C</div>
            <div style="font-size: 0.68rem; color: var(--text-muted);">Wind: ${cur.windSpeedKmH} km/h • Humidity: ${cur.humidity}%</div>
          </div>
        </div>

        <!-- 5-Day Strip -->
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; border-top: 1px dashed var(--border-color); padding-top: 8px; margin-top: 6px; font-size: 0.7rem; text-align: center;">
          ${(activeData.daily || []).slice(0, 5).map(d => `
            <div style="background: var(--bg-card-subtle); padding: 4px; border-radius: var(--radius-xs);">
              <div style="font-weight: 700; color: var(--text-main);">${new Date(d.date).toLocaleDateString([], { weekday: 'short' })}</div>
              <div style="font-weight: 800; color: var(--ocean-teal);">${d.maxTemp}°</div>
              <div style="color: var(--text-dim); font-size: 0.65rem;">🌧️ ${d.rainProbability}%</div>
            </div>
          `).join("")}
        </div>

        <div style="font-size: 0.66rem; color: var(--text-muted); margin-top: 6px; line-height: 1.3;">
          ⚠️ <b>Safety Note:</b> Favourable weather does not guarantee sea/backwater safety. Strictly obey local lifeguard flags and operator advice.
        </div>
      </div>
    `;
  }
};
