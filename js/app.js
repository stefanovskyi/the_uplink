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
        // Fetch USD base rates (includes PLN, UAH, EUR)
        // Using open.er-api.com as it supports UAH (Frankfurter does not)
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        const data = await res.json();

        if (data.result !== "success") throw new Error("API Error");

        const usdPln = data.rates.PLN.toFixed(2);
        const usdUah = data.rates.UAH.toFixed(2);
        
        // Calculate EUR -> USD using the USD -> EUR rate
        // 1 EUR = 1 / (USD -> EUR) USD
        const eurUsd = (1 / data.rates.EUR).toFixed(2);

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
    weatherIcon: "",
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
      // Brutalist SVG Icons (Thick strokes, monochrome)
      const icons = {
        sun: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg>`,
        cloud: `<svg viewBox="0 0 24 24"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>`,
        partlyCloudy: `<svg viewBox="0 0 24 24"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path><circle cx="18" cy="5" r="3"></circle></svg>`,
        fog: `<svg viewBox="0 0 24 24"><path d="M4 15h16M4 10h16M4 20h16M4 5h16"></path></svg>`,
        rain: `<svg viewBox="0 0 24 24"><path d="M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path></svg>`,
        snow: `<svg viewBox="0 0 24 24"><path d="M8 15l2 2m0-2l-2 2m8-2l2 2m0-2l-2 2m-6-8l2 2m0-2l-2 2m8-2l2 2m0-2l-2 2"></path><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path></svg>`,
        thunder: `<svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>`,
        unknown: `<svg viewBox="0 0 24 24"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`
      };

      // Simple WMO code mapping
      const codes = {
        0: { desc: "CLEAR SKY", icon: icons.sun },
        1: { desc: "MAINLY CLEAR", icon: icons.partlyCloudy },
        2: { desc: "PARTLY CLOUDY", icon: icons.partlyCloudy },
        3: { desc: "OVERCAST", icon: icons.cloud },
        45: { desc: "FOG", icon: icons.fog },
        48: { desc: "FOG", icon: icons.fog },
        51: { desc: "DRIZZLE", icon: icons.rain },
        53: { desc: "DRIZZLE", icon: icons.rain },
        55: { desc: "DRIZZLE", icon: icons.rain },
        61: { desc: "RAIN", icon: icons.rain },
        63: { desc: "RAIN", icon: icons.rain },
        65: { desc: "HEAVY RAIN", icon: icons.rain },
        71: { desc: "SNOW", icon: icons.snow },
        73: { desc: "SNOW", icon: icons.snow },
        75: { desc: "HEAVY SNOW", icon: icons.snow },
        95: { desc: "THUNDERSTORM", icon: icons.thunder },
      };
      const weather = codes[code] || { desc: "UNKNOWN", icon: icons.unknown };
      this.weatherDesc = weather.desc;
      this.weatherIcon = weather.icon;
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
    }
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
    currentUserHour: null,
    userTimeZone: 'UTC',
    userUtcOffset: 0,

    init() {
      this.detectUserTimezone();
      this.updateCurrentTime();
      setInterval(() => this.updateCurrentTime(), 60000); // Update every minute
      this.calculateWindow();
    },

    detectUserTimezone() {
        const now = luxon.DateTime.now();
        this.userTimeZone = now.toFormat('ZZZ'); // e.g. CET, EST
        this.userUtcOffset = now.offset / 60; // Offset in hours (e.g. 1 for CET)
    },

    updateCurrentTime() {
      this.currentUserHour = new Date().getHours();
    },

    // h is the hour on the X-axis (User's Local Time 0-23)
    getCityHour(userHour, cityUtcOffset) {
        // CityTime = UserTime - UserOffset + CityOffset
        let cityHour = userHour - this.userUtcOffset + cityUtcOffset;
        
        // Normalize to 0-23
        while (cityHour < 0) cityHour += 24;
        while (cityHour >= 24) cityHour -= 24;
        
        return Math.floor(cityHour);
    },

    getHourStatus(cityUtcOffset, axisHour) {
      // axisHour is the column index (0-23), representing User's Local Hour
      
      // Check if this column is the current hour for the user
      if (axisHour === this.currentUserHour) {
          // We need to check if the CITY is in working hours at this time
          const cityHour = this.getCityHour(axisHour, cityUtcOffset);
          if (cityHour >= 8 && cityHour <= 18) {
              return 'current';
          } else {
              return 'current-light';
          }
      }

      const cityHour = this.getCityHour(axisHour, cityUtcOffset);

      if (cityHour >= 9 && cityHour < 18) return 'working';
      if (cityHour === 8 || cityHour === 18) return 'shoulder';
      return 'off';
    },

    calculateWindow() {
      // We still want to find the optimal window in UTC, as per original requirement?
      // "Update the UTC row to show the user's current timezone."
      // The calculation logic for "Optimal Window" shouldn't necessarily change its output format (UTC),
      // but the visualization is now relative to User.
      
      // Let's keep the calculation in UTC for consistency with the text output.
      
      let maxOverlap = 0;
      let bestStartUtc = 0;

      const overlapCounts = new Array(24).fill(0);
      
      // Iterate through UTC hours 0-23
      for (let utcH = 0; utcH < 24; utcH++) {
        let count = 0;
        this.cities.forEach((c) => {
            // Check if this UTC hour is working for the city
            let cityH = utcH + c.offset;
            while (cityH < 0) cityH += 24;
            while (cityH >= 24) cityH -= 24;
            
            if (cityH >= 9 && cityH < 18) count++;
        });
        overlapCounts[utcH] = count;
      }

      maxOverlap = Math.max(...overlapCounts);
      bestStartUtc = overlapCounts.indexOf(maxOverlap);

      // Format
      this.optimalWindow = `${bestStartUtc}:00 - ${bestStartUtc+1}:00 UTC`;
      
      // Add local times for EST and CET
      const estStart = bestStartUtc - 5;
      const estEnd = bestStartUtc + 1 - 5;
      const cetStart = bestStartUtc + 1;
      const cetEnd = bestStartUtc + 1 + 1;
      
      const formatHour = (h) => {
          let hour = h;
          while (hour < 0) hour += 24;
          while (hour >= 24) hour -= 24;
          return hour;
      };
      
      this.optimalWindow += ` (${formatHour(estStart)}:00 - ${formatHour(estEnd)}:00 EST / ${formatHour(cetStart)}:00 - ${formatHour(cetEnd)}:00 CET)`;
    },
  }));
});
