package models

type Patient struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	Age           int    `json:"age"`
	Gender        string `json:"gender"`
	Ward          string `json:"ward"`
	Department    string `json:"department"`
	Doctor        string `json:"doctor"`
	AdmissionDate string `json:"admission_date"`
	Status        string `json:"status"`
}
