# Sohib Games (Social & Arcade Multiplayer)

A zero-login, real-time multiplayer gaming platform powered by **Node.js**, **Express**, and **Socket.IO**, designed for **Render** deployment.

## Two Game Worlds
1. **🔥 قعدة الأصحاب (Social & Hangout)**
   - **محكمة الأحكام (Judgment Court)**: Dares & judgments with 3 intensity levels, custom dare submissions, and live crew voting.
   - **مقياس المشاعر والتوافق (Vibe & Feelings Meter)**: Test how well friends understand each other's feelings and calculate compatibility %.
   - **مين فينا؟ (Who's Most Likely To)**: Fast-paced anonymous crew voting with live result bars.
   - **الجاسوس في القعدة (The Spy)**: Secret role deduction game with hidden cards and live voting.

2. **🎮 أركيد وبازل (Arcade & Puzzle)**
   - **Astro Trail**: Real-time neon survival arena (1–4 players + bots).
   - **Cyber Sketch**: Synchronized drawing & guessing game.
   - **Neon Grid**: Turn-based Dots & Boxes (multiplayer or VS AI bot).
   - **Cosmic Quiz**: Fast-paced timed trivia with speed bonuses.

## Render Deployment & Anti-Sleep
1. Connect your GitHub repository (`SohibKhaled/Quiz_Game`) to **Render** as a **Web Service**.
2. Build Command: `npm install`
3. Start Command: `npm start`
4. Health Check Path: `/ping`
5. **Anti-Sleep**:
   - The server automatically self-pings `RENDER_EXTERNAL_URL/ping` every 10 minutes while awake.
   - For 24/7 zero-sleep even when no one is online, add a free monitor on [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com) pointing to `https://<your-app>.onrender.com/ping` every 10 minutes.
