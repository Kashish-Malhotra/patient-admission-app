package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"patient-admission-app/models"
)

type PatientHandler struct {
	DB *sql.DB
}

type patientRequest struct {
	Name          string `json:"name"`
	Age           *int   `json:"age"`
	Gender        string `json:"gender"`
	Ward          string `json:"ward"`
	Department    string `json:"department"`
	Doctor        string `json:"doctor"`
	AdmissionDate string `json:"admission_date"`
	Status        string `json:"status"`
}

var (
	namePattern = regexp.MustCompile(`^[A-Za-z ]+$`)

	allowed = map[string][]string{
		"gender":     {"Male", "Female", "Other"},
		"ward":       {"General", "ICU", "Emergency", "Private"},
		"department": {"Cardiology", "Neurology", "Orthopedics", "General Medicine"},
		"doctor":     {"Dr. Sharma", "Dr. Mehta", "Dr. Kapoor", "Dr. Verma"},
		"status":     {"Admitted", "Discharged"},
	}
)

func respondJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

func (h *PatientHandler) validate(p patientRequest) string {
	if !namePattern.MatchString(strings.TrimSpace(p.Name)) {
		return "Name is required and must contain letters only"
	}

	if p.Age == nil || *p.Age < 0 || *p.Age > 120 {
		return "Age must be between 0 and 120"
	}

	for field, value := range map[string]string{
		"gender":     p.Gender,
		"ward":       p.Ward,
		"department": p.Department,
		"doctor":     p.Doctor,
		"status":     p.Status,
	} {
		valid := false
		for _, option := range allowed[field] {
			if value == option {
				valid = true
				break
			}
		}
		if !valid {
			return fmt.Sprintf("Invalid or missing %s", field)
		}
	}

	admissionDate, err := time.Parse("2006-01-02", p.AdmissionDate)
	if err != nil {
		return "Admission date is required and must be valid"
	}

	if admissionDate.After(time.Now()) {
		return "Admission date cannot be in the future"
	}

	return ""
}

func (h *PatientHandler) List(w http.ResponseWriter, r *http.Request) {
	query := `
		SELECT id, name, age, gender, ward, department, doctor,
		TO_CHAR(admission_date, 'YYYY-MM-DD'), status
		FROM patients WHERE 1=1
	`
	args := []any{}

	for _, filter := range []struct {
		param  string
		column string
	}{
		{"ward", "ward"},
		{"department", "department"},
		{"doctor", "doctor"},
	} {
		if value := r.URL.Query().Get(filter.param); value != "" {
			args = append(args, value)
			query += fmt.Sprintf(" AND %s = $%d", filter.column, len(args))
		}
	}

	if search := strings.TrimSpace(r.URL.Query().Get("search")); search != "" {
		args = append(args, "%"+search+"%")
		query += fmt.Sprintf(" AND name ILIKE $%d", len(args))
	}

	query += " ORDER BY id DESC"

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch patients")
		return
	}
	defer rows.Close()

	patients := []models.Patient{}

	for rows.Next() {
		var p models.Patient
		if err := rows.Scan(
			&p.ID, &p.Name, &p.Age, &p.Gender, &p.Ward,
			&p.Department, &p.Doctor, &p.AdmissionDate, &p.Status,
		); err != nil {
			respondError(w, http.StatusInternalServerError, "Failed to read patient records")
			return
		}
		patients = append(patients, p)
	}

	if err := rows.Err(); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to read patient records")
		return
	}

	respondJSON(w, http.StatusOK, patients)
}

func (h *PatientHandler) Create(w http.ResponseWriter, r *http.Request) {
	var p patientRequest

	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid JSON request")
		return
	}

	if message := h.validate(p); message != "" {
		respondError(w, http.StatusBadRequest, message)
		return
	}

	var id int64
	err := h.DB.QueryRow(`
		INSERT INTO patients
		(name, age, gender, ward, department, doctor, admission_date, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		RETURNING id
	`,
		strings.TrimSpace(p.Name), *p.Age, p.Gender, p.Ward,
		p.Department, p.Doctor, p.AdmissionDate, p.Status,
	).Scan(&id)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create patient")
		return
	}

	respondJSON(w, http.StatusCreated, map[string]any{
		"id":      id,
		"message": "Patient added successfully",
	})
}

func (h *PatientHandler) Update(w http.ResponseWriter, r *http.Request, id int64) {
	var p patientRequest

	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid JSON request")
		return
	}

	if message := h.validate(p); message != "" {
		respondError(w, http.StatusBadRequest, message)
		return
	}

	result, err := h.DB.Exec(`
		UPDATE patients SET
		name=$1, age=$2, gender=$3, ward=$4, department=$5,
		doctor=$6, admission_date=$7, status=$8
		WHERE id=$9
	`,
		strings.TrimSpace(p.Name), *p.Age, p.Gender, p.Ward,
		p.Department, p.Doctor, p.AdmissionDate, p.Status, id,
	)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update patient")
		return
	}

	count, _ := result.RowsAffected()
	if count == 0 {
		respondError(w, http.StatusNotFound, "Patient not found")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Patient updated successfully"})
}

func (h *PatientHandler) Delete(w http.ResponseWriter, r *http.Request, id int64) {
	result, err := h.DB.Exec("DELETE FROM patients WHERE id=$1", id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete patient")
		return
	}

	count, _ := result.RowsAffected()
	if count == 0 {
		respondError(w, http.StatusNotFound, "Patient not found")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Patient deleted successfully"})
}

func (h *PatientHandler) Discharge(w http.ResponseWriter, r *http.Request, id int64) {
	result, err := h.DB.Exec(
		"UPDATE patients SET status='Discharged' WHERE id=$1 AND status='Admitted'",
		id,
	)

	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to discharge patient")
		return
	}

	count, _ := result.RowsAffected()
	if count == 0 {
		respondError(w, http.StatusNotFound, "Admitted patient not found")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Patient discharged successfully"})
}

func ParseID(path string) (int64, error) {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) != 3 {
		return 0, fmt.Errorf("invalid patient path")
	}

	id, err := strconv.ParseInt(parts[2], 10, 64)
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("invalid patient ID")
	}

	return id, nil
}
