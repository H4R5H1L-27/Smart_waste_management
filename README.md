# Smart Waste Management System & Operations Infrastructure

An end-to-end intelligent municipal solid waste management, logistics optimization, and civic reporting platform engineered for Chennai, India. The system unites physical IoT telemetry, deep learning waste classification, Gemini multimodal AI vision, real-road vehicle routing (OSRM + Google OR-Tools), an interactive operations console, and the CivicLens citizen reporting portal.

---

## System Architecture: What is Built at Every Level

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             LEVEL 6: CIVICLENS PORTAL                            │
│  Mobile Citizen App • GPS Geolocation • Camera Photo Capture • Real-time Sync     │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────▼─────────────────────────────────────────┐
│                      LEVEL 5: CENTRAL OPERATIONS CONSOLE                         │
│  Interactive Leaflet Map • Sonar Radar Visualizer • Animated Truck • Viva Center  │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────▼─────────────────────────────────────────┐
│                     LEVEL 4: BACKEND MICROSERVICE & STORAGE                      │
│  FastAPI (Python 3.11) • SQLite Auto-Schema • Predictive Linear Regression • CORS│
└──────────────────┬─────────────────────┬────────────────────┬────────────────────┘
                   │                     │                    │
┌──────────────────▼────────┐ ┌──────────▼─────────┐ ┌────────▼────────────────────┐
│   LEVEL 1: IOT TELEMETRY  │ │   LEVEL 2: VISION  │ │     LEVEL 3: LOGISTICS      │
│ ESP32 + HC-SR04 Ultrasonic│ │ MobileNetV2 Edge   │ │ OpenStreetMap OSRM Graph    │
│ Arduino C++ • Wi-Fi Client│ │ Gemini 2.5 Flash   │ │ Google OR-Tools VRP Solver  │
│ Terminal Mock Sensor CLI  │ │ Multimodal AI API  │ │ Fuel & CO2 Savings Engine   │
└───────────────────────────┘ └────────────────────┘ └─────────────────────────────┘
```

---

### Level 1: Hardware & IoT Edge Telemetry
* **Target Hardware**: ESP32 DevKit V1 + HC-SR04 Ultrasonic Distance Sensor.
* **Firmware Implementation** (`firmware/bin_sensor/bin_sensor.ino`):
  * Written in Arduino C++ for ESP32.
  * Measures distance to waste surface: $\text{fill\%} = \frac{\text{depth}_{\max} - \text{distance}}{\text{depth}_{\max}} \times 100$.
  * Emits HTTP POST telemetry payload with auto-reconnection and exponential backoff to `/bins/{id}/update`.
  * Visual ASCII progress bar over hardware serial interface (115200 baud).
* **Terminal Mock Sensor** (`backend/mock_sensor.py`):
  * Command-line simulator for testing without physical hardware.
  * Supports fixed fills, step sweeps, and dynamic sine-wave oscillation:
    ```powershell
    python backend/mock_sensor.py --fill 84.5
    python backend/mock_sensor.py --oscillate
    ```

---

### Level 2: Computer Vision & Multimodal Generative AI
* **Edge Deep Learning Classifier** (`backend/models/classifier.py`):
  * MobileNetV2 backbone (2.26M parameters) fine-tuned on municipal waste datasets.
  * Classifies waste into **7 distinct categories**: `plastic`, `paper`, `cardboard`, `glass`, `metal`, `organic`, `trash`.
  * Real-time inference latency under 45 ms on CPU.
  * Supports live WebRTC webcam capture, drag-and-drop file upload, and pre-bundled validation chips (`ml/samples/`).
* **Gemini 2.5 Flash Multimodal Waste Analysis** (`/api/gemini/analyze-waste`):
  * Evaluates uploaded waste images using Google Gemini Vision.
  * Extracts:
    * Identified category and confidence score.
    * Severity assessment (`critical`, `high`, `medium`, `low`).
    * Detailed hazard and composition description.
    * Immediate recommended municipal action.
    * Actionable step-by-step resolution playbook.
  * Includes out-of-the-box fallback authentication so it runs without manual credential setup.

---

### Level 3: Geospatial Logistics & Route Optimization
* **Street Network Routing** (`backend/routing/`):
  * Uses OpenStreetMap / OSRM to generate real street driving paths across Chennai (Mount Road, Anna Salai, GST Road) with 800+ turn coordinates.
* **Google OR-Tools VRP Engine**:
  * Formulates dynamic Capacitated Vehicle Routing Problem (CVRP) starting and ending at Guindy Industrial Estate Depot `(13.0103, 80.2155)`.
  * Employs `PATH_CHEAPEST_ARC` initial heuristic and `GUIDED_LOCAL_SEARCH` metaheuristics.
* **Ecological & Operational Impact Calculations**:
  * Distance Saved (km and percentage).
  * Driving Time Saved (minutes).
  * Diesel Fuel Conserved (L).
  * Carbon Emissions Prevented ($kg\text{ CO}_2$).
* **Canvas Truck Simulation**:
  * Interactive animated collection truck (🚚) that traverses the computed optimal polyline at configurable speeds.

---

### Level 4: Backend Microservice & Persistence
* **Framework**: High-performance asynchronous FastAPI (Python 3.11).
* **Storage** (`backend/db.py`):
  * SQLite database (`waste.db`) with zero-configuration automatic schema generation and seeding on first run.
  * Tables: `bins`, `classifications`, `fill_history`, `reports`.
* **Predictive Forecasting**:
  * Linear regression time-to-full module analyzing historical fill samples to forecast hours remaining before critical overflow.
* **Background Simulation**:
  * Automatic drift worker modeling real-world asynchronous waste generation across Chennai neighborhoods.

---

### Level 5: Central Municipal Operations Console
* **Interactive Operations Map** (`frontend/`):
  * Leaflet.js map with color-coded status markers, dynamic popup telemetry, and depot visualization.
* **HTML5 Canvas Sonar Wave Visualizer**:
  * Real-time ultrasonic transducer animation reflecting acoustic arcs off dynamic obstacle depths.
* **Academic Viva Defense Center**:
  * Interactive 7×7 confusion matrix heatmap.
  * Per-class precision, recall, and F1-score breakdown (93.5% accuracy, 0.874 macro F1).
  * Academic references and literature citations (MobileNetV2, OR-Tools, TrashNet).
* **Incident Review & Dispatch Desk**:
  * Triage, verify, and resolve citizen reports with immediate status propagation.

---

### Level 6: CivicLens Citizen Reporting Portal
* **Citizen Incident App** (`CIVICLENSGG/` & `/civiclens`):
  * Mobile-responsive interface designed for public participation.
  * Instant GPS geolocation capture via browser Geolocation API.
  * In-app camera snapshot or gallery upload.
  * Immediate Gemini AI waste classification preview before submission.
  * Direct synchronization with municipal operational queue.

---

## Quick Start: Clone & Run Immediately

### Prerequisites
* Python 3.10+ or Python 3.11+
* Git

---

### Option 1: Windows (1-Click)

1. Clone the repository:
   ```cmd
   git clone https://github.com/H4R5H1L-27/Smart_waste_management.git
   cd Smart_waste_management
   ```
2. Run the application:
   ```cmd
   run.bat
   ```
   *(The script automatically creates the virtual environment, installs dependencies, initializes the database, and boots the server!)*

---

### Option 2: Linux / macOS (1-Click)

1. Clone the repository:
   ```bash
   git clone https://github.com/H4R5H1L-27/Smart_waste_management.git
   cd Smart_waste_management
   ```
2. Make script executable and run:
   ```bash
   chmod +x run.sh test.sh
   ./run.sh
   ```

---

### Option 3: Manual Terminal Setup

```bash
# 1. Clone repository
git clone https://github.com/H4R5H1L-27/Smart_waste_management.git
cd Smart_waste_management/backend

# 2. Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# 3. Install requirements
pip install -r requirements.txt

# 4. Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

### Option 4: Docker & Docker Compose

Run with a single command without installing Python locally:

```bash
docker compose up --build
```

---

## Application URL Access Points

| Component | URL | Description |
|---|---|---|
| **Central Operations Dashboard** | `http://127.0.0.1:8000/` | Main control console, map, routing, sonar & AI sorting |
| **CivicLens Citizen Portal** | `http://127.0.0.1:8000/civiclens` | Public mobile waste reporting interface |
| **Interactive API Documentation** | `http://127.0.0.1:8000/docs` | FastAPI Swagger UI for all REST endpoints |
| **System Health Check** | `http://127.0.0.1:8000/health` | Service uptime and component status |

---

## Deployment Guide

### 1. Production Container Deployment (Docker)
Build and run in detached production mode:
```bash
docker compose up -d --build
```
To view logs:
```bash
docker compose logs -f
```

---

### 2. Linux Production VM (Ubuntu / Debian with Systemd & Nginx)

#### Step A: System Setup & Service Creation
1. Clone the code into `/opt`:
   ```bash
   sudo git clone https://github.com/H4R5H1L-27/Smart_waste_management.git /opt/smart-waste
   cd /opt/smart-waste/backend
   sudo python3 -m venv venv
   sudo ./venv/bin/pip install -r requirements.txt
   ```

2. Create systemd unit `/etc/systemd/system/smart-waste.service`:
   ```ini
   [Unit]
   Description=Smart Waste Management FastAPI Service
   After=network.target

   [Service]
   User=www-data
   Group=www-data
   WorkingDirectory=/opt/smart-waste/backend
   ExecStart=/opt/smart-waste/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 4
   Restart=always
   RestartSec=5
   Environment=PYTHONUNBUFFERED=1

   [Install]
   WantedBy=multi-user.target
   ```

3. Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now smart-waste
   ```

#### Step B: Nginx Reverse Proxy Configuration
Create `/etc/nginx/sites-available/smart-waste`:
```nginx
server {
    listen 80;
    server_name your-domain-or-ip.com;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Enable the site and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/smart-waste /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

### 3. Cloud Deployment (Render / Railway / Fly.io / AWS)
* **Build Command**: `pip install -r backend/requirements.txt`
* **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
* **Environment Variables**:
  * `HOST`: `0.0.0.0`
  * `PORT`: Set automatically by platform or `8000`
  * `GEMINI_API_KEY`: *(Optional)* Provide your custom Google Gemini API key.

---

## Configuration & Environment Variables

Create a `.env` file (or copy from `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | *Embedded Default Key* | Google Gemini API key for multimodal waste analysis |
| `HOST` | `0.0.0.0` | Network binding interface |
| `PORT` | `8000` | HTTP port |
| `WASTE_DB_PATH` | `backend/waste.db` | Path to persistent SQLite database |
| `WASTE_SKIP_SIMULATOR` | `0` | Set to `1` during isolated benchmarks or unit tests |

---

## Automated Verification & Test Suite

Run the comprehensive 23-test automated test suite:

```powershell
# Windows:
.\test.bat

# Linux / macOS:
./test.sh
```

### Verified Test Dimensions
* **API Endpoints**: CRUD operations on bins, telemetry updates, citizen reports, and sample images.
* **Gemini Analysis**: Multimodal analysis fallback handling and payload verification.
* **MobileNetV2 Classifier**: Preprocessing pipeline, tensor shape consistency, and 7-category inference sanity.
* **OR-Tools & OSRM Routing**: Graph connectivity, route optimality validation ($D_{\text{optimal}} \le D_{\text{naive}}$), and single/zero-bin edge cases.
* **Predictive Forecasting**: Linear regression slope estimation and overflow projection.
* **Handoff Workflows**: End-to-end citizen report verification, dispatching, and task completion cycles.

---

## Hardware Pinout Reference (ESP32 DevKit)

| Sensor Pin (HC-SR04) | ESP32 Pin | Function |
|---|---|---|
| `VCC` | `VIN` (5V) | Power supply |
| `GND` | `GND` | Ground reference |
| `TRIG` | `GPIO 5` | Ultrasonic trigger pulse output |
| `ECHO` | `GPIO 18` | Ultrasonic echo pulse input (use voltage divider for 3.3V) |

Complete wiring diagrams, circuit schematics, and flashing walkthrough are documented in [`docs/hardware_setup.md`](docs/hardware_setup.md).

---

## License & Academic Attribution
Developed as an advanced academic research and operations prototype for municipal urban sustainability. Core libraries utilized include FastAPI, TensorFlow / MobileNetV2, Google OR-Tools, OpenStreetMap OSRM, and Google Gemini.
