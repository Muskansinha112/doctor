import express from "express";
import Patient from "../models/Patient.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

// --- ROUTE 1: ADD PATIENT ---
// @route   POST api/patients/add
router.post("/add", async (req, res) => {
  try {
    const {
      name,
      email,
      age,
      sex,
      medical_history,
      code,
      grade,
      update_type,
      report_files, // <-- 1. Get the new field
    } = req.body;

    let patient = await Patient.findOne({ email });

    if (patient) {
      // Update existing patient
      patient.name = name;
      patient.age = age;
      patient.sex = sex;
      patient.medical_history = medical_history;
      patient.code = code;
      patient.grade = grade;
      patient.update_type = update_type;
      patient.report_files = report_files || []; // <-- 2. Update the field

      await patient.save();
      return res.status(200).json({ msg: "Patient updated", patient });
    }

    // Create new patient
    patient = new Patient({
      name,
      email,
      age,
      sex,
      medical_history,
      code,
      grade,
      update_type,
      report_files: report_files || [], // <-- 3. Save the field
    });

    await patient.save();
    res.status(201).json({ msg: "Patient added successfully", patient });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// --- ROUTE 2: GET ALL PATIENTS ---
// @route   GET api/patients
router.get("/", authMiddleware, async (req, res) => {
  try {
    const patients = await Patient.find().sort({ date_added: -1 });
    res.json(patients);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// --- ROUTE 3: GET ONE PATIENT ---
// @route   GET api/patients/:id
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(44).json({ msg: "Patient not found" });
    }
    res.json(patient);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Patient not found" });
    }
    res.status(500).send("Server Error");
  }
});

// @route   POST api/patients/:id/growth-measurements
// Save a manually entered child height and weight measurement.
router.post("/:id/growth-measurements", authMiddleware, async (req, res) => {
  try {
    const { measuredAt, ageInMonths, heightCm, weightKg } = req.body;
    const allowedAssessments = ["not-assessed", "low-growth", "expected-range", "high-bmi", "urgent-review"];
    const chartAssessment = req.body.chartAssessment || "not-assessed";
    const values = [ageInMonths, heightCm, weightKg].map(Number);

    if (
      values.some((value) => !Number.isFinite(value)) ||
      values[0] < 0 || values[0] > 228 ||
      values[1] < 30 || values[1] > 230 ||
      values[2] < 1 || values[2] > 250
    ) {
      return res.status(400).json({ msg: "Enter a valid age, height, and weight." });
    }
    if (!allowedAssessments.includes(chartAssessment)) {
      return res.status(400).json({ msg: "Choose a valid growth chart assessment." });
    }

    const date = measuredAt ? new Date(measuredAt) : new Date();
    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({ msg: "Enter a valid measurement date." });
    }

    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ msg: "Patient not found." });
    }

    const bmi = values[2] / Math.pow(values[1] / 100, 2);
    patient.growthMeasurements.push({
      measuredAt: date,
      ageInMonths: values[0],
      heightCm: values[1],
      weightKg: values[2],
      bmi: Number(bmi.toFixed(2)),
      chartAssessment,
    });
    await patient.save();
    res.status(201).json(patient);
  } catch (err) {
    console.error("Save growth measurement error:", err.message);
    res.status(500).json({ msg: "Could not save the measurement." });
  }
});

// --- ROUTE 4: SAVE STRUCTURE ---
// @route   PUT api/patients/:id/structure
router.put("/:id/structure", authMiddleware, async (req, res) => {
  try {
    const { molecular_structure } = req.body;

    let patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ msg: "Patient not found" });
    }

    patient.molecular_structure = molecular_structure;
    await patient.save();
    res.json(patient);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

export default router;
