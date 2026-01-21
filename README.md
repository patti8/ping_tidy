# PingTidy ✨

<div align="center">
  <img src="public/pingtidy.png" alt="PingTidy Logo" width="120" height="120" />
  <br/>
  <h3>The Agentic AI Habit Tracker</h3>
  <p>Clean, Smart, and Proactive.</p>
</div>

---

**PingTidy** is a modern habit tracker that doesn't just store your tasks—it actively helping you complete them. Powered by Google Gemini AI, it features smart prioritization ("Eat The Frog"), automatic emoji tagging, and a beautiful, responsive UI.

## ✨ Features

- **🤖 Agentic AI**:
  - **Smart Tagging**: Automatically suggests emojis and categories for your tasks.
  - **Eat The Frog**: AI analyzes your list to identify the most critical task of the day.
- **📅 Visual Progress**:
  - **GitHub-style Heatmap**: Visualize your consistency with a beautiful color-coded calendar.
  - **Daily Rings**: Satisfying progress rings for daily completion.
- **⚡ Super Fast**: Built with React & Vite for instant interactions.
- **☁️ Cloud Sync**: Real-time synchronization across devices using Firebase Firestore.
- **🌗 Dark Mode**: Beautiful dark theme for night owls.
- **📱 Responsive**: Works perfectly on desktop and mobile.

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, TypeScript
- **Styling**: TailwindCSS v4, Framer Motion
- **Backend/DB**: Firebase (Auth, Firestore)
- **AI**: Google Gemini 1.5 Flash via AI Studio

## 🚀 Getting Started

### Prerequisites

1. **Node.js**: v18 or higher.
2. **Firebase Project**: Create a project at [console.firebase.google.com](https://console.firebase.google.com).
   - Enable **Authentication** (Google Provider).
   - Enable **Firestore Database**.
3. **Gemini API Key**: Get a free key at [aistudio.google.com](https://aistudio.google.com/).

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/pingtidy.git
   cd pingtidy
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Duplicate `.env.example` to `.env` and fill in your keys:
   ```bash
   cp .env.example .env
   ```
   
   Update the variables in `.env`:
   ```env
   VITE_FIREBASE_API_KEY=...
   VITE_GEMINI_API_KEY=...
   # ... fill the rest from your Firebase Console
   ```

4. **Run Locally**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` to view it in the browser.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to submit pull requests, report issues, and suggest improvements.

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---
<div align="center">
  Built with ❤️ by the PingTidy Team
</div>
