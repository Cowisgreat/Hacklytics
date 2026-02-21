# Axiom Backend-Frontend Integration Setup

This guide will help you set up and run both the backend and frontend together.

## Prerequisites

- Python 3.9+ (for backend)
- Node.js 18+ (for frontend)
- pip (Python package manager)
- npm or yarn

## Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd axiom-backend
   ```

2. **Create a virtual environment (recommended):**
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On Mac/Linux:
   source venv/bin/activate
   ```

3. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Create a `.env` file** (if it doesn't exist):
   ```bash
   # Copy the example or create manually
   # The backend will work in DEMO_MODE=true by default
   ```

   The `.env` file should contain:
   ```
   DEMO_MODE=true
   PORT=8000
   HOST=0.0.0.0
   ```

5. **Start the backend server:**
   ```bash
   python main.py
   # Or:
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

   The backend will be available at `http://localhost:8000`

## Frontend Setup

1. **Navigate to the project root:**
   ```bash
   cd ..
   ```

2. **Install Node dependencies:**
   ```bash
   npm install
   ```

3. **Start the frontend development server:**
   ```bash
   npm run dev
   ```

   The frontend will be available at `http://localhost:5173` (or the port Vite assigns)

## Running Both Together

### Option 1: Manual (Two Terminals)

1. **Terminal 1 - Backend:**
   ```bash
   cd axiom-backend
   python main.py
   ```

2. **Terminal 2 - Frontend:**
   ```bash
   npm run dev
   ```

### Option 2: Using Scripts (Windows PowerShell)

Create a `start.ps1` file in the root directory:

```powershell
# Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd axiom-backend; python main.py"

# Wait a moment for backend to start
Start-Sleep -Seconds 3

# Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev"
```

Then run:
```powershell
.\start.ps1
```

## API Endpoints

The backend provides the following endpoints:

- `GET /` - Root endpoint
- `GET /health` - Health check
- `POST /api/verify` - Full verification (synchronous)
- `POST /api/extract-claims` - Extract claims only
- `POST /api/demo/finance-false` - Demo: Finance hallucination
- `POST /api/demo/finance-true` - Demo: Finance verified
- `POST /api/demo/legal-false` - Demo: Legal hallucination
- `WS /ws/verify` - WebSocket streaming verification

## Frontend-Backend Integration

The frontend automatically:
- Checks backend health on load
- Uses WebSocket streaming for real-time verification updates
- Falls back to demo data if backend is unavailable
- Shows connection status in the UI

## Environment Variables

### Backend (.env)
- `DEMO_MODE=true` - Use pre-baked demo data (no API keys needed)
- `PORT=8000` - Backend port
- `HOST=0.0.0.0` - Backend host

### Frontend (vite.config.js or .env)
- `VITE_API_URL=http://localhost:8000` - Backend API URL (optional, defaults to localhost:8000)

## Troubleshooting

1. **Backend not connecting:**
   - Check if backend is running on port 8000
   - Check CORS settings in `main.py`
   - Verify `.env` file exists in `axiom-backend/`

2. **WebSocket errors:**
   - Ensure backend is running
   - Check firewall settings
   - Verify WebSocket endpoint is accessible

3. **Frontend shows "Using Demo Mode":**
   - Backend is not running or not accessible
   - Check browser console for errors
   - Verify `VITE_API_URL` if using custom port

## Testing the Integration

1. Start both backend and frontend
2. Open the frontend in your browser
3. Click "SEE DEMO" on the landing page
4. Select a scenario (Finance/Legal)
5. Click "RUN DEMO" and "VERIFY WITH AXIOM"
6. Watch the real-time verification stream from the backend

The UI will show:
- Backend connection status (green dot = connected)
- Real-time agent assessments via WebSocket
- Final settlement and verdict from backend

