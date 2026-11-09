# 🎮 GRAB & DODGE
### Catch the Good. Dodge the Bad.

**GRAB & DODGE** is an interactive, browser-based arcade game that combines Machine Learning-powered hand tracking with real-time gameplay.

Players control a bucket using hand gestures detected through their webcam or switch to mouse control. Catch falling objects to earn points, avoid bombs, and achieve the highest possible score within 60 seconds!

---

## 🌐 Live Demo

**Play the Game:** [GRAB & DODGE – Live Demo](PASTE_YOUR_DEPLOYED_VERCEL_LINK_HERE)

---

## ✨ Features

- **AI-Powered Hand Tracking:** Control the bucket using real-time hand gesture detection through your webcam.
- **Mouse Control:** An alternative control mode for players who prefer using their mouse.
- **Dynamic Gameplay:** Falling objects appear at different horizontal positions, requiring continuous movement and coordination.
- **Multiple Object Types:** Catch balls, diamonds, and stars while avoiding bombs.
- **Progressive Difficulty:** Object falling speed increases as the game progresses.
- **60-Second Challenge:** Score as many points as possible before the timer runs out.
- **Live Score Tracking:** View your score and game progress in real time.
- **Performance Summary:** View your final score and the breakdown of objects caught after each round.

---

## 🎯 Game Rules & Scoring

| Object | Action | Points |
|:---:|---|---:|
| 🔵 Ball | Catch | +5 |
| 💎 Diamond | Catch | +8 |
| ⭐ Star | Catch | +15 |
| 💣 Bomb | Avoid | -10 |

### How to Play

1. Open the game and choose your preferred control method.
2. Enable webcam access if using Hand Tracking.
3. Move your hand or mouse horizontally to control the bucket.
4. Catch balls, diamonds, and stars to earn points.
5. Avoid bombs to prevent losing points.
6. Survive the 60-second round and aim for the highest score!

**Difficulty Progression:** The falling speed increases gradually during the game, making the final moments more challenging.

---

## 🧠 Machine Learning Implementation

The project uses **Google MediaPipe Hands** for real-time hand landmark detection.

### How It Works

1. The webcam captures live video input.
2. MediaPipe Hands processes the video frames.
3. The hand-tracking model detects hand landmarks.
4. Wrist and index finger base landmarks are used to estimate the horizontal hand position.
5. The detected position is converted into horizontal bucket movement.
6. The game continuously updates the bucket position based on detected hand movement.

### Key Implementation Details

- Real-time hand landmark detection.
- Single-hand tracking.
- Horizontal coordinate extraction.
- Mirrored webcam movement.
- Custom animation loop using `requestAnimationFrame()`.
- Manual webcam stream management using `getUserMedia()`.

**Note:** The project uses MediaPipe's pre-trained hand-tracking model rather than training a custom ML model.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| HTML5 | Game structure |
| CSS3 | Styling and user interface |
| JavaScript | Game logic and interactions |
| Google MediaPipe Hands | ML-based hand landmark detection |
| WebRTC Media Capture API | Webcam access |
| HTML5 Canvas | Game rendering and visual overlays |
| Git & GitHub | Version control and source code hosting |
| Vercel | Web deployment |

---

## 📂 Project Structure

```text
GRAB-AND-DODGE/
│
├── index.html          # Main game interface
├── style.css           # Styling and UI design
├── game.js             # Game mechanics, scoring and rendering
├── handtracking.js     # MediaPipe hand tracking implementation
└── README.md           # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites

- A modern web browser (Google Chrome recommended).
- A working webcam for Hand Tracking mode.
- Internet connection to load MediaPipe resources from the CDN.

### Run Locally

1. Clone or download this repository.
2. Open the project folder in VS Code.
3. Install the Live Server extension.
4. Right-click `index.html`.
5. Select **Open with Live Server**.
6. Grant camera permission when prompted.

Alternatively, use Python's HTTP server:

```bash
python -m http.server 8000
```

Open the local address provided by the server in your browser.

**Important:** Camera access requires localhost or a secure HTTPS connection.

---

## 🌐 Deployment

The project is a static website and can be deployed using platforms such as Vercel.

### Deploy Using Vercel

1. Push the project files to a GitHub repository.
2. Import the repository into Vercel.
3. Select **Other** as the framework preset.
4. Leave the build command empty.
5. Set the output directory to `.`.
6. Click **Deploy**.

Vercel will generate a public HTTPS link that can be shared with other players.

---

## 📚 References & Resources

- [Google MediaPipe](https://developers.google.com/mediapipe) – Machine Learning framework used for hand tracking.
- [MediaPipe Hands Documentation](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/hands.md) – Hand landmark detection.
- [MediaPipe JavaScript Guide](https://github.com/google-ai-edge/mediapipe/blob/master/docs/getting_started/javascript.md) – JavaScript integration.
- [MDN Web APIs](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) – Webcam access and media stream documentation.
- [Vercel](https://vercel.com/) – Deployment platform.

---

## 🔮 Future Improvements

Potential enhancements for future versions:

- Global leaderboard and player rankings.
- Multiplayer mode.
- Additional falling objects and power-ups.
- More challenging game modes.
- Improved gesture-based interactions.

---

## 👩‍💻 Author

**Rajanya Ganguli**

B.Tech – Computer Science and Engineering  
IIIT Agartala

---

### ⭐ Enjoy the Game!

**GRAB & DODGE — Catch the Good. Dodge the Bad.**
