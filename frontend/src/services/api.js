
const API_BASE_URL =  import.meta.env.VITE_API_BASE_URL || "http://localhost:8082/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || "Request failed");
  }

  return data;
}

export async function getPatients(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });

  return request(`/patients?${params.toString()}`);
}

export async function createPatient(patient) {
  return request("/patients", {
    method: "POST",
    body: JSON.stringify(patient),
  });
}

export async function updatePatient(id, patient) {
  return request(`/patients/${id}`, {
    method: "PUT",
    body: JSON.stringify(patient),
  });
}

export async function deletePatient(id) {
  return request(`/patients/${id}`, {
    method: "DELETE",
  });
}

export async function dischargePatient(id) {
  return request(`/patients/${id}/discharge`, {
    method: "PATCH",
  });
}
