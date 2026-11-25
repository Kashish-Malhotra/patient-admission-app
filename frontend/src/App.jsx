
import { useEffect, useMemo, useState } from "react";
import {
  Plus, Search, SlidersHorizontal, Pencil, Trash2,
  CheckCircle2, Users, BedDouble, Activity, X,
  ChevronDown, CalendarDays
} from "lucide-react";
import {
  getPatients,
  createPatient,
  updatePatient,
  deletePatient,
  dischargePatient as dischargePatientAPI
} from "./services/api";
import "./App.css";

const OPTIONS = {
  gender: ["Male", "Female", "Other"],
  ward: ["General", "ICU", "Emergency", "Private"],
  department: ["Cardiology", "Neurology", "Orthopedics", "General Medicine"],
  doctor: ["Dr. Sharma", "Dr. Mehta", "Dr. Kapoor", "Dr. Verma"],
};

const emptyForm = {
  name: "",
  age: "",
  gender: "",
  ward: "",
  department: "",
  doctor: "",
  admission_date: "",
  status: "Admitted",
};

function getTodayDate() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .split("T")[0];
}

function PatientModal({ patient, onClose, onSave }) {
  const [form, setForm] = useState(patient || emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();

    if (!/^[A-Za-z ]+$/.test(form.name.trim())) {
      setError("Name must contain letters only.");
      return;
    }

    if (
      form.age === "" ||
      !Number.isInteger(Number(form.age)) ||
      Number(form.age) < 0 ||
      Number(form.age) > 120
    ) {
      setError("Age must be between 0 and 120.");
      return;
    }

    if (
      Object.entries(OPTIONS).some(
        ([key, values]) => !values.includes(form[key])
      )
    ) {
      setError("Please select all required options.");
      return;
    }

    if (
      !form.admission_date ||
      form.admission_date > getTodayDate()
    ) {
      setError("Please enter a valid admission date.");
      return;
    }

    if (!["Admitted", "Discharged"].includes(form.status)) {
      setError("Please select a valid status.");
      return;
    }

    setError("");
    setSaving(true);

    try {
      await onSave({ ...form, age: Number(form.age) });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={e =>
        e.target === e.currentTarget && onClose()
      }
    >
      <div className="modal">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">
              {patient ? "PATIENT RECORD" : "NEW ADMISSION"}
            </span>
            <h2>{patient ? "Edit patient" : "Add a patient"}</h2>
          </div>

          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="field full">
              Patient name
              <input
                value={form.name}
                onChange={e => update("name", e.target.value)}
                placeholder="Enter full name"
                required
              />
            </label>

            <label className="field">
              Age
              <input
                type="number"
                min="0"
                max="120"
                value={form.age}
                onChange={e => update("age", e.target.value)}
                placeholder="Age"
                required
              />
            </label>

            <label className="field">
              Gender
              <select
                value={form.gender}
                onChange={e => update("gender", e.target.value)}
                required
              >
                <option value="">Select gender</option>
                {OPTIONS.gender.map(v => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>

            {["ward", "department", "doctor"].map(key => (
              <label className="field" key={key}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
                <select
                  value={form[key]}
                  onChange={e => update(key, e.target.value)}
                  required
                >
                  <option value="">Select {key}</option>
                  {OPTIONS[key].map(v => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            ))}

            <label className="field">
              Admission date
              <input
                type="date"
                max={getTodayDate()}
                value={form.admission_date}
                onChange={e =>
                  update("admission_date", e.target.value)
                }
                required
              />
            </label>

            <label className="field">
              Status
              <select
                value={form.status}
                onChange={e => update("status", e.target.value)}
              >
                <option>Admitted</option>
                <option>Discharged</option>
              </select>
            </label>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button
              type="button"
              className="button button-light"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="button button-primary"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : patient
                  ? "Save changes"
                  : "Add patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function App() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    ward: "",
    department: "",
    doctor: "",
  });

  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadPatients() {
    try {
      setError("");
      const data = await getPatients();
      setPatients(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPatients();
  }, []);

  const filteredPatients = useMemo(() => {
    return patients.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (!filters.ward || p.ward === filters.ward) &&
      (!filters.department || p.department === filters.department) &&
      (!filters.doctor || p.doctor === filters.doctor)
    );
  }, [patients, search, filters]);

  const admitted = patients.filter(
    p => p.status === "Admitted"
  ).length;

  const discharged = patients.length - admitted;

  async function savePatient(data) {
    const { id, ...payload } = data;

    if (id) {
      await updatePatient(id, payload);
    } else {
      await createPatient(payload);
    }

    await loadPatients();
    setModal(null);
  }

  async function handleDelete(id) {
    if (
      !window.confirm(
        "Are you sure you want to delete this patient record?"
      )
    ) {
      return;
    }

    try {
      setError("");
      await deletePatient(id);
      await loadPatients();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDischarge(id) {
    try {
      setError("");
      await dischargePatientAPI(id);
      await loadPatients();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Activity size={21} />
          </div>
          <span>
            care<span className="brand-light">desk</span>
          </span>
        </div>

        <div className="topbar-right">
          <span className="system-status">
            <span /> System operational
          </span>
          <div className="user-avatar">HS</div>
        </div>
      </header>

      <section className="page-content">
        <div className="page-heading">
          <div>
            <span className="eyebrow">HOSPITAL OPERATIONS</span>
            <h1>Patient admissions</h1>
            <p>Manage patient records and admission activity.</p>
          </div>

          <button
            className="button button-primary"
            onClick={() => setModal({})}
          >
            <Plus size={17} /> Add patient
          </button>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <Users size={19} />
            </div>
            <span className="stat-label">Total patients</span>
            <strong>{patients.length}</strong>
            <span className="stat-note">All patient records</span>
          </div>

          <div className="stat-card">
            <div className="stat-icon green">
              <BedDouble size={19} />
            </div>
            <span className="stat-label">Currently admitted</span>
            <strong>{admitted}</strong>
            <span className="stat-note">Active admissions</span>
          </div>

          <div className="stat-card">
            <div className="stat-icon grey">
              <CheckCircle2 size={19} />
            </div>
            <span className="stat-label">Discharged</span>
            <strong>{discharged}</strong>
            <span className="stat-note">Completed admissions</span>
          </div>
        </section>

        <section className="records-panel">
          <div className="records-heading">
            <div>
              <h2>Patient records</h2>
              <p>{filteredPatients.length} records found</p>
            </div>
            <span className="records-icon">
              <SlidersHorizontal size={18} />
            </span>
          </div>

          <div className="toolbar">
            <div className="search-box">
              <Search size={17} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search patient name..."
              />

              {search && (
                <button
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {["ward", "department", "doctor"].map(key => (
              <div className="filter-select" key={key}>
                <select
                  value={filters[key]}
                  onChange={e =>
                    setFilters(prev => ({
                      ...prev,
                      [key]: e.target.value,
                    }))
                  }
                >
                  <option value="">
                    All {key === "doctor" ? "doctors" : key + "s"}
                  </option>

                  {OPTIONS[key].map(v => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            ))}

            <button
              className="button button-light clear-button"
              onClick={() => {
                setSearch("");
                setFilters({
                  ward: "",
                  department: "",
                  doctor: "",
                });
              }}
            >
              Clear
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Age / Gender</th>
                  <th>Ward</th>
                  <th>Department</th>
                  <th>Doctor</th>
                  <th>Admission date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="empty-state">
                      Loading patient records...
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredPatients.map(p => (
                      <tr key={p.id}>
                        <td>
                          <strong className="patient-name">
                            {p.name}
                          </strong>
                          <span className="patient-id">
                            ID #{p.id}
                          </span>
                        </td>

                        <td>{p.age} / {p.gender}</td>
                        <td>{p.ward}</td>
                        <td>{p.department}</td>
                        <td>{p.doctor}</td>

                        <td>
                          <span className="date-cell">
                            <CalendarDays size={14} />
                            {p.admission_date}
                          </span>
                        </td>

                        <td>
                          <span className={`status ${p.status.toLowerCase()}`}>
                            <span />
                            {p.status}
                          </span>
                        </td>

                        <td>
                          <div className="row-actions">
                            {p.status === "Admitted" && (
                              <button
                                title="Mark discharged"
                                onClick={() => handleDischarge(p.id)}
                              >
                                <CheckCircle2 size={16} />
                              </button>
                            )}

                            <button
                              title="Edit patient"
                              onClick={() => setModal(p)}
                            >
                              <Pencil size={16} />
                            </button>

                            <button
                              title="Delete patient"
                              className="delete-action"
                              onClick={() => handleDelete(p.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredPatients.length === 0 && (
                      <tr>
                        <td colSpan="8" className="empty-state">
                          {error
                            ? "Could not load patient records."
                            : "No patient records found. Try changing your search or filters."}
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          <div className="table-footer">
            Showing {filteredPatients.length} of {patients.length} patients
          </div>
        </section>

        <footer className="page-footer">
          CareDesk <span>•</span> Patient admission management
        </footer>
      </section>

      {modal && (
        <PatientModal
          patient={modal.id ? modal : null}
          onClose={() => setModal(null)}
          onSave={savePatient}
        />
      )}
    </main>
  );
}

export default App;
