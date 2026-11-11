import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import DoctorRecommendationService from "../services/DoctorRecommendationService";
import "./PatientDetailPage.css";

const recommendationService = new DoctorRecommendationService();

function PatientDetailPage() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [isServiceReady, setIsServiceReady] = useState(false);
  const [growthForm, setGrowthForm] = useState({
    ageInMonths: "",
    heightCm: "",
    weightKg: "",
    chartAssessment: "not-assessed",
    measuredAt: new Date().toISOString().slice(0, 10),
  });
  const [growthError, setGrowthError] = useState("");
  const [savingGrowth, setSavingGrowth] = useState(false);

  // Load the recommendation rules
  useEffect(() => {
    const loadServiceRules = async () => {
      try {
        const success = await recommendationService.loadRules(
          "/Riders_12_March_2025.json"
        );
        if (success) {
          setIsServiceReady(true);
        } else {
          setError("CRITICAL: Failed to load recommendation rules.");
        }
      } catch (err) {
        console.error("Rule Loading Error:", err);
        setError("CRITICAL: Failed to load recommendation rules.");
      }
    };
    loadServiceRules();
  }, []);

  // Fetch the patient data
  useEffect(() => {
    const fetchPatient = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("Authorization error. Please log in again.");
          setLoading(false);
          return;
        }
        const config = { headers: { "x-auth-token": token } };
        const res = await axios.get(
          `http://localhost:5001/api/patients/${id}`,
          config
        );
        setPatient(res.data);
        if (res.data.age !== undefined && res.data.age !== null) {
          setGrowthForm((form) => ({
            ...form,
            ageInMonths: String(Math.round(Number(res.data.age) * 12)),
          }));
        }
        setLoading(false);
      } catch (err) {
        console.error("Fetch Patient Error:", err);
        setError("Failed to fetch patient data.");
        setLoading(false);
      }
    };
    fetchPatient();
  }, [id]);

  const handleGrowthChange = (event) => {
    setGrowthForm({ ...growthForm, [event.target.name]: event.target.value });
  };

  const foodGuidance = {
    "not-assessed": {
      title: "Balanced meals while awaiting chart review",
      text: "Offer varied family foods: rice, roti, or millet with dal, beans, egg, milk, or curd; add seasonal vegetables and fruit. Keep clean drinking water available.",
    },
    "low-growth": {
      title: "Food support for low or faltering growth",
      text: "Offer an extra small meal or snack if the child is hungry, using affordable energy and protein foods such as khichdi with dal and a little oil, egg, curd, groundnut paste, or mashed beans. Continue breastfeeding where age appropriate. Arrange prompt review with an ASHA, ANM, or clinician to check growth and illness.",
    },
    "expected-range": {
      title: "Support steady growth",
      text: "Continue varied family meals: a staple such as rice, roti, or millet; dal, beans, egg, milk, or curd; and seasonal vegetables or fruit. Encourage active play and regular meals.",
    },
    "high-bmi": {
      title: "Support healthy growth without restrictive dieting",
      text: "Offer the same balanced family meals with vegetables, pulses, and fruit; choose water instead of sweet drinks and limit frequent packaged snacks. Encourage active play. Do not put a growing child on a restrictive or weight-loss diet; discuss the chart with a clinician.",
    },
    "urgent-review": {
      title: "Arrange a health worker review",
      text: "A concerning growth chart result needs prompt assessment by an ASHA, ANM, or clinician. Keep offering the child’s usual safe foods and fluids; do not start a restrictive diet or supplements without clinical advice.",
    },
  };

  const handleSaveGrowthMeasurement = async (event) => {
    event.preventDefault();
    setGrowthError("");
    setSavingGrowth(true);
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { "x-auth-token": token } };
      const res = await axios.post(
        `http://localhost:5001/api/patients/${id}/growth-measurements`,
        growthForm,
        config
      );
      setPatient(res.data);
      setGrowthForm((form) => ({ ...form, heightCm: "", weightKg: "" }));
    } catch (err) {
      setGrowthError(
        err.response?.data?.msg || "Could not save the measurement. Please try again."
      );
    } finally {
      setSavingGrowth(false);
    }
  };

  const handleCalculateAndSave = async () => {
    // ... (This function is unchanged)
    if (!patient || !isServiceReady) {
      setError("Service is not ready or no patient data.");
      return;
    }
    setIsCalculating(true);
    setError("");
    try {
      const calculatedStructure = recommendationService.getRecommendation(
        patient.grade,
        patient.code
      );

      if (
        calculatedStructure.includes("Error") ||
        calculatedStructure.includes("No specific recommendation")
      ) {
        setError(calculatedStructure);
        setIsCalculating(false);
        return;
      }

      const token = localStorage.getItem("token");
      if (!token) {
        setError("Your session has expired. Please log in again.");
        setIsCalculating(false);
        return;
      }

      const config = { headers: { "x-auth-token": token } };
      const res = await axios.put(
        `http://localhost:5001/api/patients/${id}/structure`,
        { molecular_structure: calculatedStructure },
        config
      );
      setPatient(res.data);
      setIsCalculating(false);
    } catch (err) {
      console.error("Save Structure Error:", err);
      const errorMsg =
        err.response && err.response.data
          ? err.response.data.msg
          : "Failed to save structure.";
      setError(errorMsg);
      setIsCalculating(false);
    }
  };

  // --- 👇 THIS IS THE UPDATED FUNCTION 👇 ---
  const renderReportFiles = (files) => {
    if (!files || files.length === 0) {
      return <p>No reports uploaded for this patient.</p>;
    }

    const isGoogleDriveLink = (url) => {
      return url.includes("drive.google.com");
    };

    return (
      <div className="reports-container">
        {files.map((file, index) => (
          <div key={index} className="report-item">
            <span className="report-name">{file.name}</span>

            {/* * If it's an image AND NOT a Google Drive link, show the image.
             * Otherwise, show a link.
             */}
            {file.type === "image" && !isGoogleDriveLink(file.url) ? (
              <img src={file.url} alt={file.name} className="report-image" />
            ) : (
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="report-link"
              >
                {file.type === "image" ? "View Image" : "View PDF"}
              </a>
            )}
          </div>
        ))}
      </div>
    );
  };

  // ... (rest of the component (loading, JSX) is unchanged) ...

  if (loading) {
    return (
      <div className="patient-detail-container">
        <div className="page-header">
          <h2>Loading Patient...</h2>
        </div>
      </div>
    );
  }

  if (error && !patient) {
    return (
      <div className="patient-detail-container">
        <div className="page-header">
          <h2>Error</h2>
        </div>
        <p className="page-error">{error}</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="patient-detail-container">
        <div className="page-header">
          <h2>Patient Not Found</h2>
        </div>
      </div>
    );
  }

  const renderObject = (obj) => {
    return <pre>{JSON.stringify(obj, null, 2)}</pre>;
  };

  return (
    <div className="patient-detail-container">
      <div className="detail-page-header">
        <Link to="/dashboard/patients" className="back-link">
          &larr; Back to Patients List
        </Link>
        <h2 className="patient-name-header">{patient.name}</h2>
      </div>

      {error && <p className="page-error">{error}</p>}

      <div className="detail-grid">
        <div className="detail-card">
          <h3>Personal Info</h3>
          <p>
            <strong>Email:</strong> {patient.email}
          </p>
          <p>
            <strong>Age:</strong> {patient.age}
          </p>
          <p>
            <strong>Sex:</strong> {patient.sex}
          </p>
        </div>

        <div className="detail-card">
          <h3>Calculation Data (Raw)</h3>
          <p>
            <strong>Grade:</strong> {patient.grade}
          </p>
          <p>
            <strong>Code:</strong>
          </p>
          {renderObject(patient.code)}
        </div>

        <div className="detail-card full-width">
          <h3>Child Growth Check</h3>
          <p className="growth-intro">
            Enter a child’s measurements to calculate and save BMI. Use a
            calibrated scale and measure height without shoes.
          </p>
          <form className="growth-form" onSubmit={handleSaveGrowthMeasurement}>
            <label>
              Age at measurement (months)
              <input
                type="number"
                name="ageInMonths"
                min="0"
                max="228"
                step="1"
                value={growthForm.ageInMonths}
                onChange={handleGrowthChange}
                required
              />
            </label>
            <label>
              Height (cm)
              <input
                type="number"
                name="heightCm"
                min="30"
                max="230"
                step="0.1"
                value={growthForm.heightCm}
                onChange={handleGrowthChange}
                required
              />
            </label>
            <label>
              Weight (kg)
              <input
                type="number"
                name="weightKg"
                min="1"
                max="250"
                step="0.1"
                value={growthForm.weightKg}
                onChange={handleGrowthChange}
                required
              />
            </label>
            <label>
              Measurement date
              <input
                type="date"
                name="measuredAt"
                value={growthForm.measuredAt}
                onChange={handleGrowthChange}
                required
              />
            </label>
            <label className="growth-assessment-field">
              Growth chart result
              <select
                name="chartAssessment"
                value={growthForm.chartAssessment}
                onChange={handleGrowthChange}
              >
                <option value="not-assessed">Not assessed yet</option>
                <option value="low-growth">Low or faltering growth</option>
                <option value="expected-range">Within expected range</option>
                <option value="high-bmi">High BMI / possible excess weight</option>
                <option value="urgent-review">Needs urgent health worker review</option>
              </select>
            </label>
            <button className="action-button-green" type="submit" disabled={savingGrowth}>
              {savingGrowth ? "Saving..." : "Save measurement"}
            </button>
          </form>
          {growthError && <p className="growth-error">{growthError}</p>}

          {patient.growthMeasurements?.length > 0 ? (
            <div className="growth-table-wrap">
              <table className="growth-table">
                <thead>
                  <tr><th>Date</th><th>Age</th><th>Height</th><th>Weight</th><th>BMI</th><th>Chart result</th></tr>
                </thead>
                <tbody>
                  {[...patient.growthMeasurements].reverse().map((measurement) => (
                    <tr key={measurement._id || `${measurement.measuredAt}-${measurement.bmi}`}>
                      <td>{new Date(measurement.measuredAt).toLocaleDateString()}</td>
                      <td>{Math.floor(measurement.ageInMonths / 12)}y {measurement.ageInMonths % 12}m</td>
                      <td>{measurement.heightCm} cm</td>
                      <td>{measurement.weightKg} kg</td>
                      <td>{Number(measurement.bmi).toFixed(1)}</td>
                      <td>{
                        {
                          "not-assessed": "Not assessed",
                          "low-growth": "Low or faltering growth",
                          "expected-range": "Within expected range",
                          "high-bmi": "Possible excess weight",
                          "urgent-review": "Needs health worker review",
                        }[measurement.chartAssessment || "not-assessed"]
                      }</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No height and weight measurements saved yet.</p>
          )}

          <div className="nutrition-guidance">
            <h4>{foodGuidance[growthForm.chartAssessment].title}</h4>
            <p>{foodGuidance[growthForm.chartAssessment].text}</p>
            {growthForm.chartAssessment !== "not-assessed" && (
              <p className="growth-note">
                This suggestion follows the selected chart result. Select a result only after a trained health worker has interpreted the appropriate chart.
              </p>
            )}
            <p className="growth-note">
              BMI is only a screening measure. For children, interpret it using
              age and sex specific growth charts and the child’s growth over
              time; this number alone does not diagnose malnutrition or decide
              a diet. Ask a trained health worker to review the chart before
              changing a child’s diet, especially for children under 5.
              {" "}
              <a
                href="https://www.who.int/tools/child-growth-standards/standards/body-mass-index-for-age-bmi-for-age"
                target="_blank"
                rel="noreferrer"
              >
                WHO BMI-for-age charts, birth to 5 years
              </a>
              {" · "}
              <a
                href="https://www.who.int/tools/growth-reference-data-for-5to19-years/indicators/bmi-for-age"
                target="_blank"
                rel="noreferrer"
              >
                WHO BMI-for-age charts, 5 to 19 years
              </a>
            </p>
          </div>
        </div>

        <div className="detail-card full-width">
          <h3>Medical History</h3>
          {renderObject(patient.medical_history)}
        </div>

        {/* --- THIS SECTION WILL NOW WORK --- */}
        <div className="detail-card full-width">
          <h3>Patient Reports</h3>
          {renderReportFiles(patient.report_files)}
        </div>

        <div className="detail-card full-width">
          <h3>Recommended Structure</h3>
          {patient.molecular_structure ? (
            <div className="structure-display">
              {patient.molecular_structure}
            </div>
          ) : (
            <div>
              <p>No structure calculated yet.</p>
              <button
                onClick={handleCalculateAndSave}
                disabled={isCalculating || !isServiceReady}
                className="action-button-green"
              >
                {isCalculating
                  ? "Calculating..."
                  : isServiceReady
                  ? "Calculate & Save"
                  : "Loading Rules..."}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PatientDetailPage;
