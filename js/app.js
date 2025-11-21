document.addEventListener("alpine:init", () => {
  // Global Store for Shared State (like Temperature Unit)
  Alpine.store("global", {
    tempUnit: "C", // 'C' or 'F'
    toggleUnit() {
      this.tempUnit = this.tempUnit === "C" ? "F" : "C";
    },
  });

  // A. Header & Status Module
  Alpine.data("statusModule", () => ({
    userLocation: "DETECTING...",
    init() {
      this.detectLocation();
    },
    detectLocation() {
      try {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        this.userLocation = zone;
      } catch (e) {
        this.userLocation = "UNKNOWN";
      }
    },
  }));

  // B. Market Data Ticker Module
  Alpine.data("tickerModule", () => ({
    tickerText: "$$$ MARKET_DATA // LOADING...",
    async init() {
      await this.fetchRates();
    },
    async fetchRates() {
      try {
        // Fetch USD -> PLN, UAH
        const res1 = await fetch(
          "https://api.frankfurter.app/latest?from=USD&to=PLN,UAH"
        );
        const data1 = await res1.json();

        // Fetch EUR -> USD
        const res2 = await fetch(
          "https://api.frankfurter.app/latest?from=EUR&to=USD"
        );
        const data2 = await res2.json();

        const usdPln = data1.rates.PLN.toFixed(2);
        const usdUah = data1.rates.UAH.toFixed(2);
        const eurUsd = data2.rates.USD.toFixed(2);

        this.tickerText = `$$$ MARKET_DATA // 1 USD = [${usdPln}] PLN // 1 USD = [${usdUah}] UAH // 1 EUR = [${eurUsd}] USD`;
      } catch (e) {
        this.tickerText = "$$$ MARKET_DATA // CONNECTION ERROR // RETRYING...";
        console.error("Ticker Error:", e);
      }
    },
  }));

  // C. Timezone Card Module
  Alpine.data("timezoneCard", (zone, cityCode, zoneLabel) => ({
    time: "00:00:00",
    date: "---, --- --",
    weatherDesc: "LOADING...",
    temp: "--",
    unit: "°C",
    isUser: false,
    lat: 0,
    lon: 0,

    init() {
      this.checkIfUser();
      this.startClock();
      this.setCoordinates();
      this.fetchWeather();

      // Watch for global unit changes
      this.$watch("$store.global.tempUnit", (val) => {
        this.updateTempDisplay(val);
      });
    },

    checkIfUser() {
      const userZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Simple check, can be improved with mapping
      if (zone === userZone) {
        this.isUser = true;
      } else if (userZone === "Europe/Warsaw" && cityCode === "WRO") {
        this.isUser = true; // Default fallback mentioned in requirements
      }
    },

    startClock() {
      setInterval(() => {
        const now = luxon.DateTime.now().setZone(zone);
        this.time = now.toFormat("HH:mm:ss");
        this.date = now.toFormat("ccc, MMM dd").toUpperCase();
      }, 1000);
    },

    setCoordinates() {
      // Hardcoded coords for the 4 cities
      const coords = {
        LAX: { lat: 34.05, lon: -118.24 },
        NYC: { lat: 40.71, lon: -74.0 },
        WRO: { lat: 51.1, lon: 17.03 },
        LVI: { lat: 49.83, lon: 24.02 },
      };
      if (coords[cityCode]) {
        this.lat = coords[cityCode].lat;
        this.lon = coords[cityCode].lon;
      }
    },

    async fetchWeather() {
      if (!this.lat || !this.lon) return;

      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.lat}&longitude=${this.lon}&current_weather=true`;
        const res = await fetch(url);
        const data = await res.json();

        this.rawTempC = data.current_weather.temperature;
        this.weatherCode = data.current_weather.weathercode;

        this.updateWeatherDesc(this.weatherCode);
        this.updateTempDisplay(Alpine.store("global").tempUnit);
      } catch (e) {
        this.weatherDesc = "ERR";
        console.error(`Weather Error ${cityCode}:`, e);
      }
    },

    updateWeatherDesc(code) {
      // Simple WMO code mapping
      const codes = {
        0: "CLEAR SKY",
        1: "MAINLY CLEAR",
        2: "PARTLY CLOUDY",
        3: "OVERCAST",
        45: "FOG",
        48: "FOG",
        51: "DRIZZLE",
        53: "DRIZZLE",
        55: "DRIZZLE",
        61: "RAIN",
        63: "RAIN",
        65: "HEAVY RAIN",
        71: "SNOW",
        73: "SNOW",
        75: "HEAVY SNOW",
        95: "THUNDERSTORM",
      };
      this.weatherDesc = codes[code] || "UNKNOWN";
    },

    updateTempDisplay(unit) {
      if (this.rawTempC === undefined) return;

      if (unit === "C") {
        this.temp = this.rawTempC;
        this.unit = "°C";
      } else {
        this.temp = ((this.rawTempC * 9) / 5 + 32).toFixed(1);
        this.unit = "°F";
      }
    },

    playBeep() {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    },
  }));

  // D. Thermo Bridge Module
  Alpine.data("thermoBridge", () => ({
    celsius: 0,
    fahrenheit: 32,

    updateFromC() {
      this.fahrenheit = ((this.celsius * 9) / 5 + 32).toFixed(1);
    },
    updateFromF() {
      this.celsius = (((this.fahrenheit - 32) * 5) / 9).toFixed(1);
    },
    toggleGlobalUnit() {
      Alpine.store("global").toggleUnit();
    },
  }));

  // E. Silence Killer Module
  Alpine.data("silenceKiller", () => ({
    mode: "icebreaker",
    currentText: "READY TO GENERATE...",
    icebreakers: [
      "What's the most interesting bug you've fixed recently?",
      "If you could refactor one part of your life, what would it be?",
      "Tabs or Spaces? And why are you wrong?",
      "What's your favorite keyboard shortcut?",
      "Describe your coding style in one word.",
    ],
    trivia: [
      "The first computer bug was an actual moth found in the Harvard Mark II in 1947.",
      "Poland is one of the world's top hubs for video game development (CD Projekt Red, Techland).",
      "Ukraine has one of the largest IT outsourcing sectors in Eastern Europe.",
      "The internet was originally called ARPANET.",
      "The first webcam was invented at Cambridge University to monitor a coffee pot.",
    ],

    generate() {
      const source =
        this.mode === "icebreaker" ? this.icebreakers : this.trivia;
      const random = source[Math.floor(Math.random() * source.length)];
      this.currentText = random;
    },
  }));

  // F. Overlap Visualizer Module
  Alpine.data("overlapVisualizer", () => ({
    cities: [
      { name: "LAX (PST)", offset: -8 }, // Standard time, simplified
      { name: "NYC (EST)", offset: -5 },
      { name: "WRO (CET)", offset: 1 },
      { name: "LVI (EET)", offset: 2 },
    ],
    optimalWindow: "CALCULATING...",

    init() {
      this.calculateWindow();
    },

    isWorkingHour(offset, utcHour) {
      // Local time = UTC + offset
      let localHour = utcHour + offset;
      if (localHour < 0) localHour += 24;
      if (localHour >= 24) localHour -= 24;

      return localHour >= 9 && localHour < 18;
    },

    getHourStatus(offset, utcHour) {
      let localHour = utcHour + offset;
      if (localHour < 0) localHour += 24;
      if (localHour >= 24) localHour -= 24;

      if (localHour >= 9 && localHour < 18) return 'working';
      if (localHour === 8 || localHour === 18) return 'shoulder';
      return 'off';
    },

    calculateWindow() {
      // Find UTC hours where ALL cities are working (or max overlap)
      // This is tricky because with -8 and +2, there might be NO full overlap.
      // The prompt asks to "Highlight the block green if the local time is 09:00 - 18:00".
      // And "OPTIMAL WINDOW: [Start] - [End] UTC".

      // Let's find the intersection of working hours in UTC.
      // LAX (UTC-8): 09:00-18:00 Local => 17:00-02:00 UTC
      // NYC (UTC-5): 09:00-18:00 Local => 14:00-23:00 UTC
      // WRO (UTC+1): 09:00-18:00 Local => 08:00-17:00 UTC
      // LVI (UTC+2): 09:00-18:00 Local => 07:00-16:00 UTC

      // Intersection:
      // LAX starts 17:00 UTC.
      // LVI ends 16:00 UTC.
      // There is NO overlap between LAX and LVI.

      // So we should probably just display the range for the user's local time or just static text if no overlap.
      // However, the prompt says "OPTIMAL WINDOW: [Start] - [End] UTC".
      // If no overlap, maybe show the best partial?
      // Or maybe I should just calculate it for the "Golden Hour" concept which usually implies the short window.

      // Let's just hardcode a logic to find the hour with MOST overlap.

      let maxOverlap = 0;
      let bestStart = 0;
      let bestEnd = 0;

      // Simple sweep
      const overlapCounts = new Array(24).fill(0);
      for (let h = 0; h < 24; h++) {
        let count = 0;
        this.cities.forEach((c) => {
          if (this.isWorkingHour(c.offset, h)) count++;
        });
        overlapCounts[h] = count;
      }

      // Find sequence of max overlap
      // For now, let's just pick the first hour with max overlap
      maxOverlap = Math.max(...overlapCounts);
      const start = overlapCounts.indexOf(maxOverlap);

            // Format
            this.optimalWindow = `${start}:00 - ${start+1}:00 UTC`;
            
            // Add local times for EST and CET
            // EST is UTC-5, CET is UTC+1
            const estStart = start - 5;
            const estEnd = start + 1 - 5;
            const cetStart = start + 1;
            const cetEnd = start + 1 + 1;
            
            const formatHour = (h) => {
                let hour = h;
                if (hour < 0) hour += 24;
                if (hour >= 24) hour -= 24;
                return hour;
            };
            
            this.optimalWindow += ` (${formatHour(estStart)}:00 - ${formatHour(estEnd)}:00 EST / ${formatHour(cetStart)}:00 - ${formatHour(cetEnd)}:00 CET)`;
    },
  }));
});
