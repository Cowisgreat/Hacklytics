/**
 * Axiom Backend API Client
 * Handles all communication with the FastAPI backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Verify an AI response using the backend
 * @param {string} prompt - The user's prompt
 * @param {string} response - The AI's response to verify
 * @param {string} domain - Domain context (finance, legal, etc.)
 * @returns {Promise<Object>} Verification session
 */
export async function verifyResponse(prompt, response, domain = 'finance') {
  const response_data = await fetch(`${API_BASE_URL}/api/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, response, domain }),
  });

  if (!response_data.ok) {
    throw new Error(`Verification failed: ${response_data.statusText}`);
  }

  return await response_data.json();
}

/**
 * Extract claims from an AI response without full verification
 * @param {string} prompt - The user's prompt
 * @param {string} response - The AI's response
 * @param {string} domain - Domain context
 * @returns {Promise<Object>} Extracted claims
 */
export async function extractClaims(prompt, response, domain = 'finance') {
  const response_data = await fetch(`${API_BASE_URL}/api/extract-claims`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, response, domain }),
  });

  if (!response_data.ok) {
    throw new Error(`Claim extraction failed: ${response_data.statusText}`);
  }

  return await response_data.json();
}

/**
 * Get a verification session by ID
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Verification session
 */
export async function getSession(sessionId) {
  const response_data = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`);

  if (!response_data.ok) {
    throw new Error(`Failed to get session: ${response_data.statusText}`);
  }

  return await response_data.json();
}

/**
 * List all verification sessions
 * @returns {Promise<Object>} List of sessions
 */
export async function listSessions() {
  const response_data = await fetch(`${API_BASE_URL}/api/sessions`);

  if (!response_data.ok) {
    throw new Error(`Failed to list sessions: ${response_data.statusText}`);
  }

  return await response_data.json();
}

/**
 * Get demo scenario data from backend
 * @param {string} scenarioId - Scenario ID (finance-false, finance-true, legal-false)
 * @returns {Promise<Object>} Demo verification result
 */
export async function getDemoScenario(scenarioId) {
  const endpoint = `/api/demo/${scenarioId}`;
  const response_data = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response_data.ok) {
    throw new Error(`Failed to get demo: ${response_data.statusText}`);
  }

  return await response_data.json();
}

/**
 * Create a WebSocket connection for streaming verification
 * @param {Object} params - { prompt, response, domain }
 * @param {Function} onEvent - Callback for each event
 * @returns {WebSocket} WebSocket connection
 */
export function createVerificationStream(params, onEvent) {
  // Use WebSocket URL based on API base URL
  const wsUrl = API_BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws/verify';
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    ws.send(JSON.stringify({
      prompt: params.prompt,
      response: params.response,
      domain: params.domain || 'finance',
    }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onEvent(data);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    onEvent({
      type: 'error',
      data: { message: 'WebSocket connection error' },
    });
  };

  ws.onclose = () => {
    console.log('WebSocket closed');
  };

  return ws;
}

/**
 * Check backend health
 * @returns {Promise<Object>} Health status
 */
export async function checkHealth() {
  try {
    const response_data = await fetch(`${API_BASE_URL}/health`);
    return await response_data.json();
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

