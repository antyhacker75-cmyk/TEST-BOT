const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const Canvas = require('canvas');
const moment = require('moment-timezone');

module.exports = {
  config: {
    name: "weather",
    aliases: ["weatherinfo", "wthr", "forecast"],
    version: "3.2.0",
    author: "Renz",
    description: "Get current weather with hourly forecast and detailed metrics",
    usage: "{pn} [city]\nExample: {pn} Manila",
    category: "utility",
    cooldowns: 5
  },

  onStart: async function ({ api, event, args, message }) {
    const city = args.join(" ");
    if (!city) {
      return message.reply(
        `🌤️ 𝗪𝗘𝗔𝗧𝗛𝗘𝗥 𝗙𝗢𝗥𝗘𝗖𝗔𝗦𝗧\n\n` +
        `𝗨𝘀𝗮𝗴𝗲: ${this.config.usage}\n\n` +
        `𝗘𝘅𝗮𝗺𝗽𝗹𝗲:\n` +
        `$weather Tokyo\n` +
        `$weather New York\n` +
        `$weather London`
      );
    }

    // ============================================
    // API KEY - Using provided key
    // ============================================

    const apiKey = '9f3e0755aad7a79aa032812c3b73f098';

    try {
      // ============================================
      // GET CURRENT WEATHER
      // ============================================

      const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
      const weatherRes = await axios.get(weatherUrl, { timeout: 10000 });
      const weatherData = weatherRes.data;

      // ============================================
      // GET 5-DAY FORECAST
      // ============================================

      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&cnt=40`;
      const forecastRes = await axios.get(forecastUrl, { timeout: 10000 });
      const forecastData = forecastRes.data;

      // ============================================
      // GET UV INDEX (Optional - might fail)
      // ============================================

      let uvIndex = "N/A";
      try {
        const lat = weatherData.coord.lat;
        const lon = weatherData.coord.lon;
        const uvUrl = `https://api.openweathermap.org/data/2.5/uvi?appid=${apiKey}&lat=${lat}&lon=${lon}`;
        const uvRes = await axios.get(uvUrl, { timeout: 5000 });
        uvIndex = uvRes.data.value;
      } catch (uvErr) {
        console.log("UV index not available for this location");
      }

      // ============================================
      // GENERATE WEATHER IMAGE
      // ============================================

      const imageBuffer = await generateWeatherImage(weatherData, forecastData, uvIndex);

      // ============================================
      // FORMAT WEATHER INFO
      // ============================================

      const toBDTime = (unix) =>
        moment.unix(unix).tz("Asia/Dhaka").format("hh:mm A");

      const updateTime = moment.unix(weatherData.dt).tz("Asia/Dhaka").format("MMM DD, YYYY - hh:mm A");
      const currentTime = moment().tz("Asia/Dhaka").format("MMM DD, YYYY - hh:mm A");
      const sunriseTime = toBDTime(weatherData.sys.sunrise);
      const sunsetTime = toBDTime(weatherData.sys.sunset);

      // Get next 8 hourly forecasts
      const hourlyForecasts = forecastData.list.slice(0, 8).map(item => ({
        time: moment.unix(item.dt).tz("Asia/Dhaka").format("h A"),
        temp: Math.round(item.main.temp),
        rain: item.rain ? item.rain['3h'] || 0 : 0,
        pop: Math.round((item.pop || 0) * 100)
      }));

      const weatherText =
        `☁️ 𝗪𝗘𝗔𝗧𝗛𝗘𝗥 𝗜𝗡 ${weatherData.name.toUpperCase()}, ${weatherData.sys.country}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🌡️ 𝗧𝗲𝗺𝗽𝗲𝗿𝗮𝘁𝘂𝗿𝗲: ${Math.round(weatherData.main.temp)}°C (Feels like ${Math.round(weatherData.main.feels_like)}°C)\n` +
        `🌤️ 𝗖𝗼𝗻𝗱𝗶𝘁𝗶𝗼𝗻: ${weatherData.weather[0].description.toUpperCase()}\n` +
        `💧 𝗛𝘂𝗺𝗶𝗱𝗶𝘁𝘆: ${weatherData.main.humidity}%\n` +
        `🌬️ 𝗪𝗶𝗻𝗱: ${weatherData.wind.speed} m/s (${(weatherData.wind.speed * 3.6).toFixed(1)} km/h)\n` +
        `👁️ 𝗩𝗶𝘀𝗶𝗯𝗶𝗹𝗶𝘁𝘆: ${(weatherData.visibility / 1000).toFixed(1)} km\n` +
        `📊 𝗣𝗿𝗲𝘀𝘀𝘂𝗿𝗲: ${weatherData.main.pressure} hPa\n` +
        `☀️ 𝗨𝗩 𝗜𝗻𝗱𝗲𝘅: ${uvIndex} UV\n` +
        `💧 𝗗𝗲𝘄 𝗣𝗼𝗶𝗻𝘁: ${Math.round(weatherData.main.temp - (100 - weatherData.main.humidity) / 5)}°C\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🌅 𝗦𝘂𝗻𝗿𝗶𝘀𝗲: ${sunriseTime}\n` +
        `🌇 𝗦𝘂𝗻𝘀𝗲𝘁: ${sunsetTime}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📅 𝗛𝗼𝘂𝗿𝗹𝘆 𝗙𝗼𝗿𝗲𝗰𝗮𝘀𝘁:\n` +
        hourlyForecasts.map(h => 
          `  ${h.time} → ${h.temp}°C ${h.pop > 0 ? `💧${h.pop}%` : ''} ${h.rain > 0 ? `🌧️${h.rain.toFixed(1)}mm` : ''}`
        ).join('\n') +
        `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🕒 𝗨𝗽𝗱𝗮𝘁𝗲𝗱: ${updateTime}\n` +
        `⏰ 𝗖𝘂𝗿𝗿𝗲𝗻𝘁: ${currentTime} (BD Time)`;

      // Send the image with weather info
      await message.reply({
        body: weatherText,
        attachment: imageBuffer
      });

    } catch (err) {
      console.error('Weather Error:', err);
      
      // Handle specific errors
      if (err.response) {
        const status = err.response.status;
        const data = err.response.data;
        
        if (status === 401) {
          return message.reply(
            `❌ 𝗜𝗡𝗩𝗔𝗟𝗜𝗗 𝗔𝗣𝗜 𝗞𝗘𝗬\n\n` +
            `The OpenWeather API key is invalid or expired.\n\n` +
            `Please check your API key and try again.\n\n` +
            `Get a free key: https://openweathermap.org/api`
          );
        } else if (status === 404) {
          return message.reply(`❌ City "${city}" not found. Please check the city name.`);
        } else if (status === 429) {
          return message.reply(`❌ Rate limit exceeded. Please try again later.`);
        } else {
          return message.reply(`❌ Error: ${data?.message || 'Unknown error occurred.'}`);
        }
      } else if (err.code === 'ECONNABORTED') {
        return message.reply(`❌ Request timed out. Please try again.`);
      } else if (err.code === 'ENOTFOUND') {
        return message.reply(`❌ Unable to connect to OpenWeather. Please check your internet connection.`);
      } else {
        return message.reply(`❌ Error fetching weather data. Please try again later.`);
      }
    }
  }
};

// ============================================
// GENERATE WEATHER IMAGE
// ============================================

async function generateWeatherImage(weatherData, forecastData, uvIndex) {
  const W = 800;
  const H = 700;
  const canvas = Canvas.createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ============================================
  // BACKGROUND BASED ON WEATHER
  // ============================================

  const weatherMain = weatherData.weather[0].main.toLowerCase();
  const isDay = moment.unix(weatherData.dt).tz("Asia/Dhaka").hour() > 6 && moment.unix(weatherData.dt).tz("Asia/Dhaka").hour() < 18;

  let gradient;
  
  if (weatherMain.includes('rain') || weatherMain.includes('drizzle')) {
    gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#2c3e50');
    gradient.addColorStop(0.5, '#34495e');
    gradient.addColorStop(1, '#1a252f');
  } else if (weatherMain.includes('cloud')) {
    gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#bdc3c7');
    gradient.addColorStop(0.5, '#95a5a6');
    gradient.addColorStop(1, '#7f8c8d');
  } else if (weatherMain.includes('snow')) {
    gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#ecf0f1');
    gradient.addColorStop(0.5, '#bdc3c7');
    gradient.addColorStop(1, '#95a5a6');
  } else if (weatherMain.includes('thunder') || weatherMain.includes('storm')) {
    gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f3460');
  } else if (isDay && (weatherMain.includes('clear') || weatherMain.includes('sun'))) {
    gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#4a90d9');
    gradient.addColorStop(0.5, '#87CEEB');
    gradient.addColorStop(1, '#c9e8f7');
  } else {
    gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#0c0c1d');
    gradient.addColorStop(0.5, '#1a1a3e');
    gradient.addColorStop(1, '#2d2d5e');
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  // ============================================
  // STARS (Night time)
  // ============================================

  if (!isDay) {
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H * 0.6;
      const r = Math.random() * 2 + 0.5;
      const alpha = Math.random() * 0.8 + 0.2;
      
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    }
  }

  // ============================================
  // SUN OR MOON
  // ============================================

  if (isDay) {
    const sunX = W - 120;
    const sunY = 80;
    
    const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 80);
    glow.addColorStop(0, 'rgba(255, 200, 50, 0.8)');
    glow.addColorStop(0.5, 'rgba(255, 180, 50, 0.4)');
    glow.addColorStop(1, 'rgba(255, 150, 50, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 80, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowColor = 'rgba(255, 200, 50, 0.5)';
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 40, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    const moonX = W - 120;
    const moonY = 80;
    
    ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 35, 0, Math.PI * 2);
    ctx.fillStyle = '#e8e8e8';
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(moonX + 12, moonY - 5, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#c0c0c0';
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // ============================================
  // TEMPERATURE DISPLAY
  // ============================================

  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 10;
  
  const temp = Math.round(weatherData.main.temp);
  ctx.font = 'bold 100px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${temp}°`, 40, 30);

  // ============================================
  // WEATHER DESCRIPTION
  // ============================================

  ctx.font = '24px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(weatherData.weather[0].description.toUpperCase(), 40, 145);

  // ============================================
  // FEELS LIKE
  // ============================================

  ctx.font = '18px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`Feels like ${Math.round(weatherData.main.feels_like)}°C`, 40, 180);

  // ============================================
  // CITY & COUNTRY
  // ============================================

  ctx.font = '22px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(`${weatherData.name}, ${weatherData.sys.country}`, W - 40, 30);

  // ============================================
  // WEATHER DETAILS GRID
  // ============================================

  const details = [
    { icon: '🌬️', label: 'Wind', value: `${weatherData.wind.speed} m/s` },
    { icon: '💧', label: 'Humidity', value: `${weatherData.main.humidity}%` },
    { icon: '👁️', label: 'Visibility', value: `${(weatherData.visibility / 1000).toFixed(1)} km` },
    { icon: '📊', label: 'Pressure', value: `${weatherData.main.pressure} hPa` },
    { icon: '☀️', label: 'UV Index', value: `${uvIndex} UV` },
    { icon: '💧', label: 'Dew Point', value: `${Math.round(weatherData.main.temp - (100 - weatherData.main.humidity) / 5)}°C` }
  ];

  let xPos = 40;
  let yPos = 225;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.shadowBlur = 5;

  for (let i = 0; i < details.length; i++) {
    const detail = details[i];
    const col = i % 3;
    const row = Math.floor(i / 3);
    
    const x = 40 + (col * 240);
    const y = 225 + (row * 70);
    
    ctx.font = '16px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(detail.icon, x, y);
    
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(detail.label, x + 35, y);
    
    ctx.font = '16px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(detail.value, x + 35, y + 28);
  }

  // ============================================
  // SUNRISE / SUNSET
  // ============================================

  const sunriseTime = moment.unix(weatherData.sys.sunrise).tz("Asia/Dhaka").format("hh:mm A");
  const sunsetTime = moment.unix(weatherData.sys.sunset).tz("Asia/Dhaka").format("hh:mm A");

  ctx.shadowBlur = 0;
  const sunY = 440;
  ctx.font = '16px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`🌅 Sunrise: ${sunriseTime}`, 40, sunY);
  ctx.fillText(`🌇 Sunset: ${sunsetTime}`, 240, sunY);

  // ============================================
  // HOURLY FORECAST
  // ============================================

  const hourlyForecasts = forecastData.list.slice(0, 8).map(item => ({
    time: moment.unix(item.dt).tz("Asia/Dhaka").format("h A"),
    temp: Math.round(item.main.temp),
    rain: item.rain ? item.rain['3h'] || 0 : 0,
    pop: Math.round((item.pop || 0) * 100)
  }));

  ctx.font = '14px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('📅 Hourly Forecast', 40, 480);

  const forecastStartY = 510;
  const barWidth = 75;
  const spacing = 15;
  const totalWidth = (barWidth + spacing) * hourlyForecasts.length - spacing;

  for (let i = 0; i < hourlyForecasts.length; i++) {
    const f = hourlyForecasts[i];
    const x = 40 + (i * (barWidth + spacing));
    const y = forecastStartY;

    // Time
    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(f.time, x + barWidth / 2, y);

    // Temperature bar
    const barHeight = Math.min((f.temp / 50) * 100, 100);
    const barY = y + 25 + (100 - barHeight);
    
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(x, y + 25, barWidth, 100);
    
    const tempColor = f.temp > 30 ? '#ff6b6b' : f.temp > 20 ? '#ffd93d' : '#6bcbff';
    ctx.fillStyle = tempColor;
    ctx.fillRect(x + 5, barY, barWidth - 10, barHeight);
    ctx.shadowBlur = 0;

    // Temperature text
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${f.temp}°`, x + barWidth / 2, barY - 5);

    // Rain indicator
    if (f.rain > 0 || f.pop > 0) {
      ctx.font = '10px Arial';
      ctx.fillStyle = '#74b9ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const rainText = f.rain > 0 ? `🌧️${f.rain.toFixed(1)}mm` : `💧${f.pop}%`;
      ctx.fillText(rainText, x + barWidth / 2, barY + barHeight + 5);
    }
  }

  // ============================================
  // BOTTOM BAR WITH TIMESTAMP
  // ============================================

  ctx.shadowBlur = 0;
  const bottomBarY = H - 40;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, bottomBarY, W, 40);

  ctx.font = '13px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const updatedTime = moment.unix(weatherData.dt).tz("Asia/Dhaka").format("MMM DD, YYYY - hh:mm A");
  ctx.fillText(`🕒 ${updatedTime} (BD Time)`, W / 2, bottomBarY + 20);

  // ============================================
  // WATERMARK
  // ============================================

  ctx.font = '12px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('✦ RenzGPT Weather ✦', W - 20, H - 10);

  return canvas.toBuffer();
}
