const BASE_URL = '/api';

async function handleResponse(response) {
  if (!response.ok) {
    let message = 'Request failed';
    try {
      const data = await response.clone().json();
      if (typeof data?.detail === 'string') {
        message = data.detail;
      }
    } catch {
      const text = await response.text();
      if (text) {
        message = text;
      }
    }
    throw new Error(message);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

export async function listCircuits() {
  const response = await fetch(`${BASE_URL}/circuits`);
  return handleResponse(response);
}

export async function getCircuit(id) {
  const response = await fetch(`${BASE_URL}/circuits/${id}`);
  return handleResponse(response);
}

export async function createCircuit(payload) {
  const response = await fetch(`${BASE_URL}/circuits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function updateCircuit(id, payload) {
  const response = await fetch(`${BASE_URL}/circuits/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function deleteCircuit(id) {
  const response = await fetch(`${BASE_URL}/circuits/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
}

export async function fetchHealth() {
  const response = await fetch(`${BASE_URL}/health`);
  return handleResponse(response);
}

export async function createCircuitRun(circuitId, payload) {
  const response = await fetch(`${BASE_URL}/circuits/${circuitId}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function getCircuitSession(circuitId) {
  const response = await fetch(`${BASE_URL}/circuits/${circuitId}/session`);
  if (response.status === 404) {
    return null;
  }
  return handleResponse(response);
}

export async function updateCircuitSession(circuitId, payload) {
  const response = await fetch(`${BASE_URL}/circuits/${circuitId}/session`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function deleteCircuitSession(circuitId) {
  const response = await fetch(`${BASE_URL}/circuits/${circuitId}/session`, {
    method: 'DELETE',
  });
  return handleResponse(response);
}

export async function finishCircuitSession(circuitId, payload) {
  const response = await fetch(`${BASE_URL}/circuits/${circuitId}/session/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function listCircuitRuns() {
  const response = await fetch(`${BASE_URL}/runs`);
  return handleResponse(response);
}
