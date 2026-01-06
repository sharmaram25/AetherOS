<div align="center">
    <img src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" width="100%" alt="AetherOS Banner" />
    <br/>
    <br/>

# AetherOS
### Weightless Computing for the Web

[![React](https://img.shields.io/badge/React-18-blue?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-Builds-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?logo=three.js&logoColor=white)](https://threejs.org/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-Animations-0055FF?logo=framer&logoColor=white)](https://www.framer.com/motion/)

<p align="center">
  <b>AetherOS</b> is a conceptual web operating system exploring the future of interfaces.<br/>
  It transforms the browser into a spatial computing environment with fluid physics, local intelligence, and a fully functional window manager.
</p>

</div>

---

## 🌌 The Experience

Most web apps are isolated silos. **AetherOS** brings them together into a cohesive workspace. It's not just a UI kit—it's a runtime environment that simulates a desktop experience entirely in the browser.

| **Desktop Environment** | **App Ecosystem** |
|:---:|:---:|
| <img src="public/assets/Desktop.png" width="400" alt="Desktop UI" /> | <img src="public/assets/applications.png" width="400" alt="App Launchpad" /> |

### 💎 Key Features

- **Spatial Window Manager**: Complete with focus handling, z-index layering, minimizing, and snapping.
- **Fluid Motion Engine**: Powered by **Framer Motion**, every interaction supports spring physics for a tactile feel.
- **3D Atmosphere**: A specialized renderer using **React Three Fiber** to generate dynamic, interactive wallpapers and widgets.
- **Local-First Architecture**: Files, settings, and state are persisted locally, respecting user privacy by default.
- **System Services**: Built-in background workers, notification centers, and system trays.

---

## 🧠 Architecture Deep Dive

AetherOS is engineered to demonstrate complex state management and performance patterns in React.

### 1. The Kernel (State Management)
The OS state is managed via **Zustand** stores that act as the single source of truth.
- `useWindowManager`: Handles the lifecycle of processes (open, close, focus, minimize).
- `useFileSystem`: A virtual file system structure abstraction.
- `useTheme`: Manages systematic design tokens (Glassmorphism, Dark/Light modes).

### 2. The Shell (Visual Layer)
The UI is composed of decoupled "OS Primitives":
- **Dock**: A reflexive launcher that responds to mouse proximity.
- **WindowFrame**: A Higher-Order Component (HOC) that wraps standard React components to give them OS capabilities (dragging, residing).
- **Overlays**: System-wide notifications and context menus managed via React Portals.

### 3. The Applications
Apps are treated as independent modules. The `appRegistry` maps app IDs to their lazily loaded components, ensuring the initial bundle size remains small.

#### 🛠️ Included Apps
| App | Description | Tech |
| :--- | :--- | :--- |
| **Cortex** | AI Assistant interface | `WebLLM` / Streaming APIs |
| **Scribe** | Rich text editor | `contentEditable` / specialized hooks |
| **Lens** | Media gallery & preview | `Canvas` / Image processing |
| **Terminal** | Command line simulator | Custom parser |
| **Settings** | System configuration | Deep state integration |

---

## 📸 Visual Tour

<details open>
<summary><b>File Manager</b> — <i>Browse virtual and local assets</i></summary>
<br/>
<img src="public/assets/File%20Manager.png" width="800" alt="File Manager" />
</details>

<br/>

<details>
<summary><b>System Settings</b> — <i>Personalization and Control</i></summary>
<br/>
<img src="public/assets/settings.png" width="800" alt="Settings Panel" />
</details>

<br/>

<details>
<summary><b>Camera & Media</b> — <i>Hardware integration</i></summary>
<br/>
<img src="public/assets/camera.png" width="800" alt="Camera App" />
</details>

---

## ⚡ Quick Start

Experience the OS locally in minutes.

**Prerequisites:** Node.js v18+

```bash
# 1. Clone the repository
git clone https://github.com/your-username/aetheros.git

# 2. Enter the directory
cd aetheros

# 3. Install dependencies
npm install

# 4. Boot the OS
npm run dev
```

> The system will boot at `http://localhost:3000`

---

## 🏗️ Building for Production

AetherOS compiles to a static single-page application (SPA).

```bash
npm run build
# Output located in /dist
```

You can deploy the `./dist` folder to **Vercel**, **Netlify**, or **GitHub Pages**.

---

## 👨‍💻 Creator

<div align="left">
  
**Ram Sharma**  
*B.Tech CSE Graduate ⋅ Creative Technologist*

> *"Working to solve problems one code at a time."*

I build digital experiences that blend performance with artistic intent. AetherOS is a showcase of what's possible when strict engineering meets creative freedom.

</div>

---

<p align="center">
  <i>Part of the Ongoing Work series. © 2024 Ram Sharma.</i>
</p>

