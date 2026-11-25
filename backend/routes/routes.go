package routes

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"patient-admission-app/handlers"
)

func Register(mux *http.ServeMux, h *handlers.PatientHandler) {
	mux.HandleFunc("/api/patients", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			h.List(w, r)
		case http.MethodPost:
			h.Create(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/api/patients/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/patients/"), "/")
		parts := strings.Split(path, "/")

		if len(parts) == 2 && parts[1] == "discharge" {
			id, err := parseID(parts[0])
			if err != nil {
				http.Error(w, `{"error":"Invalid patient ID"}`, http.StatusBadRequest)
				return
			}

			if r.Method != http.MethodPatch {
				w.WriteHeader(http.StatusMethodNotAllowed)
				return
			}

			h.Discharge(w, r, id)
			return
		}

		id, err := parseID(path)
		if err != nil {
			http.Error(w, `{"error":"Invalid patient ID"}`, http.StatusBadRequest)
			return
		}

		switch r.Method {
		case http.MethodPut:
			h.Update(w, r, id)
		case http.MethodDelete:
			h.Delete(w, r, id)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})
}

func parseID(value string) (int64, error) {
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("invalid ID")
	}
	return id, nil
}
