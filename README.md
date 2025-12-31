# 🕐 זמני היום - Jewish Prayer Times

A beautiful, mobile-first Progressive Web App (PWA) for displaying Jewish prayer times (Zmanim) based on your location.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Features

- 📍 **Auto-location detection** with city name display
- ⏰ **10 daily Zmanim** from Dawn to Nightfall
- 🕐 **Live countdown** to next prayer time
- 📅 **Hebrew & Gregorian dates**
- 🌍 **RTL Hebrew interface**
- 📱 **iPhone optimized** with safe-area support
- 🌙 **Dark mode** support
- 💾 **Offline capable** with service worker
- 🎨 **Elegant design** with rounded edges and smooth animations
- ⚡ **Fast & lightweight** - Pure vanilla JavaScript

## 🎯 Zmanim Displayed

1. **עלות השחר** - Dawn (Alot HaShachar)
2. **הנץ החמה** - Sunrise
3. **סוף זמן ק"ש** - Latest Shema
4. **סוף זמן תפילה** - Latest Shacharit
5. **חצות היום** - Midday (Chatzot)
6. **מנחה גדולה** - Earliest Mincha
7. **מנחה קטנה** - Mincha Ketana
8. **פלג המנחה** - Plag HaMincha
9. **שקיעה** - Sunset
10. **צאת הכוכבים** - Nightfall (Tzeit)

## 🚀 Getting Started

### Local Development

1. **Clone or download** this project
2. **Open with Live Server** (VS Code extension) or any local server
3. **Allow location permission** when prompted
4. The app will automatically load today's zmanim for your location

### Using Python's HTTP Server

```powershell
cd ZmaneyHaiom
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

### Using Node.js serve

```powershell
cd ZmaneyHaiom
npx serve
```

## 📱 Installing on iPhone

To use this as a native-like app on your iPhone:

1. **Deploy to HTTPS** (required for geolocation) using:
   - GitHub Pages
   - Netlify
   - Vercel
   - Cloudflare Pages

2. **Open in Safari** on iPhone
3. **Tap Share button** (square with arrow)
4. **Scroll down** and tap "Add to Home Screen"
5. **Name it** "זמני היום" and tap "Add"
6. The app icon will appear on your home screen!

## 🌐 Deployment Options

### GitHub Pages (Free)

1. Push code to GitHub repository
2. Go to Settings → Pages
3. Select branch and `/` (root) folder
4. Your site will be at: `https://username.github.io/repository-name`

### Netlify (Free)

1. Drag and drop the `ZmaneyHaiom` folder to [Netlify](https://app.netlify.com/drop)
2. Your site will be live instantly!
3. Optional: Set custom domain

### Vercel (Free)

```bash
npm i -g vercel
vercel
```

## 🛠️ Technology Stack

- **HTML5** - Semantic structure
- **CSS3** - Modern design with CSS Grid and Flexbox
- **Vanilla JavaScript (ES6+)** - No frameworks needed
- **Hebcal API** - Accurate zmanim calculations
- **OpenStreetMap Nominatim** - Reverse geocoding
- **Service Worker** - Offline functionality
- **Web App Manifest** - PWA capabilities

## 📂 Project Structure

```
ZmaneyHaiom/
├── index.html          # Main HTML page
├── manifest.json       # PWA configuration
├── sw.js              # Service Worker
├── css/
│   └── styles.css     # All styling (~1300 lines)
├── js/
│   ├── app.js         # Main application logic
│   ├── api.js         # Hebcal API integration
│   └── location.js    # Geolocation service
└── icons/
    ├── icon-192.svg   # App icon (192x192)
    └── icon-512.svg   # App icon (512x512)
```

## 🎨 Design Features

- **Elegant rounded corners** throughout the app
- **Gold & deep blue** color scheme
- **Smooth animations** and transitions
- **Card-based** layout for times
- **Glass-morphism** effects
- **Responsive grid** (1-3 columns based on screen size)
- **Gradient backgrounds** and shadows
- **Hover effects** with scale transforms

## 🔒 Privacy

- No data collection or tracking
- Location data stored only locally
- No external analytics
- Open source and transparent

## 📊 Browser Support

- ✅ Safari (iOS 13+)
- ✅ Chrome (Mobile & Desktop)
- ✅ Firefox
- ✅ Edge
- ✅ Opera

## 🙏 Credits

- **Zmanim data** powered by [Hebcal](https://www.hebcal.com)
- **Geocoding** by [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org)
- **Design inspiration** from modern mobile apps

## 📄 License

MIT License - Feel free to use and modify for your needs.

## 🤝 Contributing

Suggestions and improvements are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## ⚠️ Disclaimer

Times are for reference only. Always consult with a rabbi for halachic matters.

---

**Built with ❤️ for the Jewish community**

זמני היום - Zmaney HaYom © 2025
