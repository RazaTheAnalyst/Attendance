import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  query,
  where,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable"; // Make sure to import autoTable

const AttendanceApp = () => {
  const [employeeId, setEmployeeId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [engineerName, setEngineerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [currentDateTime, setCurrentDateTime] = useState("");
  const [clockedIn, setClockedIn] = useState(false);
  const [todayAttendanceRecord, setTodayAttendanceRecord] = useState(null);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [showPasswordInput, setShowPasswordInput] = useState(false); // State for showing password input
  const [showReportOptions, setShowReportOptions] = useState(false); // State to show report options
  const correctPassword = "1234"; // Set your password here

  // Handle employee ID validation and fetch data
  const handleValidate = async () => {
    const trimmedId = employeeId.trim();

    if (!trimmedId) {
      toast.error("Please enter a valid employee ID.");
      return;
    }

    setLoading(true);
    try {
      const docRef = doc(db, "employees", trimmedId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setCompanyName(data.companyName || "");
        setEngineerName(data.engineerName || "");
        setIsValidated(true);
        toast.success("Employee ID validated successfully!");

        // Check if the employee has already clocked in or out today
        checkClockInStatus(trimmedId);
      } else {
        setIsValidated(false);
        setCompanyName("");
        setEngineerName("");
        toast.error("Employee ID not found!");
      }
    } catch (err) {
      setIsValidated(false);
      setCompanyName("");
      setEngineerName("");
      toast.error("Failed to validate employee ID.");
    } finally {
      setLoading(false);
    }
  };

  // Check if employee has already clocked in/out today
  const checkClockInStatus = async (employeeId) => {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)); // Midnight of today
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)); // End of today (11:59 PM)

    const q = query(
      collection(db, "attendance"),
      where("employeeId", "==", employeeId),
      where("timestamp", ">=", startOfDay),
      where("timestamp", "<=", endOfDay)
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      setTodayAttendanceRecord(querySnapshot.docs[0].data());
      if (querySnapshot.docs[0].data().status === "Clock In") {
        setClockedIn(true);
      } else {
        setClockedIn(false);
      }
    } else {
      setTodayAttendanceRecord(null);
      setClockedIn(false);
    }
  };

  // Get current geolocation
  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
        },
        (error) => {
          toast.error(
            "Unable to retrieve location. Please check your device's settings."
          );
        }
      );
    } else {
      toast.error("Geolocation is not supported by this browser.");
    }
  };

  // Get current date and time
  const updateDateTime = () => {
    const currentDate = new Date();
    const formattedDateTime = currentDate.toLocaleString();
    setCurrentDateTime(formattedDateTime);
  };

  useEffect(() => {
    getLocation();
    updateDateTime();
  }, []);

  // Record attendance (Clock In/Clock Out)
  const recordAttendance = async (status) => {
    if (
      !employeeId ||
      !companyName ||
      !engineerName ||
      latitude === null ||
      longitude === null
    ) {
      toast.error(
        "Please validate the employee ID and ensure location is available."
      );
      return;
    }

    // Check if the employee has already clocked in or out today
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)); // Midnight of today
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)); // End of today (11:59 PM)

    const q = query(
      collection(db, "attendance"),
      where("employeeId", "==", employeeId),
      where("timestamp", ">=", startOfDay),
      where("timestamp", "<=", endOfDay)
    );

    const querySnapshot = await getDocs(q);

    if (status === "Clock In") {
      if (!querySnapshot.empty) {
        toast.error("You can only clock in once in 24 hours.");
        return;
      }

      // If no record found for today, proceed with Clock In
      try {
        const attendanceRef = doc(
          db,
          "attendance",
          `${employeeId}_${Date.now()}`
        );
        await setDoc(attendanceRef, {
          employeeId,
          companyName,
          engineerName,
          status,
          latitude,
          longitude,
          timestamp: serverTimestamp(),
        });

        setClockedIn(true);
        toast.success("Clock In recorded successfully!");
      } catch (err) {
        toast.error("Failed to record Clock In!");
      }
    } else if (status === "Clock Out") {
      if (
        querySnapshot.empty ||
        querySnapshot.docs[0].data().status !== "Clock In"
      ) {
        toast.error("You need to clock in before clocking out.");
        return;
      }

      // Proceed with Clock Out
      try {
        const attendanceRef = doc(
          db,
          "attendance",
          `${employeeId}_${Date.now()}`
        );
        await setDoc(attendanceRef, {
          employeeId,
          companyName,
          engineerName,
          status,
          latitude,
          longitude,
          timestamp: serverTimestamp(),
        });

        setClockedIn(false);
        toast.success("Clock Out recorded successfully!");
      } catch (err) {
        toast.error("Failed to record Clock Out!");
      }
    }
  };

  // Handle password submit
  const handlePasswordSubmit = () => {
    if (password === correctPassword) {
      setPasswordVerified(true);
      toast.success("Password verified successfully!");
      setShowPasswordInput(false); // Hide the password input field once verified
      setShowReportOptions(true); // Show report options after password verification
    } else {
      toast.error("Incorrect password. Please try again.");
    }
  };

  // Download report as XLS
  const downloadXLS = () => {
    const attendanceData = [];

    // Add columns to the data (Employee ID, Company Name, Engineer Name, Date, Time, Status, Location)
    if (todayAttendanceRecord) {
      attendanceData.push({
        employeeId: todayAttendanceRecord.employeeId,
        companyName: todayAttendanceRecord.companyName,
        engineerName: todayAttendanceRecord.engineerName,
        date: todayAttendanceRecord.timestamp.toDate().toLocaleDateString(),
        time: todayAttendanceRecord.timestamp.toDate().toLocaleTimeString(),
        status: todayAttendanceRecord.status,
        latitude: todayAttendanceRecord.latitude,
        longitude: todayAttendanceRecord.longitude,
      });
    }

    // Create worksheet and book
    const ws = XLSX.utils.json_to_sheet(attendanceData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");

    // Write to file
    XLSX.writeFile(wb, "attendance_report.xlsx");
  };

  // Download report as PDF
  const downloadPDF = () => {
    const doc = new jsPDF();
    const attendanceData = [];

    // Add header and data for the table
    if (todayAttendanceRecord) {
      attendanceData.push([
        "Employee ID",
        "Company Name",
        "Engineer Name",
        "Date",
        "Time",
        "Status",
        "Latitude",
        "Longitude",
      ]);
      attendanceData.push([
        todayAttendanceRecord.employeeId,
        todayAttendanceRecord.companyName,
        todayAttendanceRecord.engineerName,
        todayAttendanceRecord.timestamp.toDate().toLocaleDateString(),
        todayAttendanceRecord.timestamp.toDate().toLocaleTimeString(),
        todayAttendanceRecord.status,
        todayAttendanceRecord.latitude,
        todayAttendanceRecord.longitude,
      ]);
    }

    // Use autoTable to generate the table
    doc.autoTable({
      head: attendanceData.slice(0, 1),
      body: attendanceData.slice(1),
    });

    // Save the PDF
    doc.save("attendance_report.pdf");
  };

  return (
    <div style={styles.container}>
      <ToastContainer position="top-center" autoClose={3000} />
      <div style={styles.card}>
        <h2 style={styles.header}>e& Attendance</h2>

        {/* Employee ID Input */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Employee ID</label>
          <input
            style={styles.input}
            placeholder="Enter Employee ID"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          />
        </div>

        {/* Validate Button */}
        <button
          style={styles.buttonValidate}
          onClick={handleValidate}
          disabled={loading}
        >
          {loading ? "Validating..." : "Validate"}
        </button>

        {/* Show Company and Engineer Name after Validation */}
        {isValidated && (
          <>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Company Name</label>
              <input
                style={styles.input}
                placeholder="Company Name"
                value={companyName}
                readOnly
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Engineer Name</label>
              <input
                style={styles.input}
                placeholder="Engineer Name"
                value={engineerName}
                readOnly
              />
            </div>
          </>
        )}

        {/* Show current location and date/time */}
        {latitude && longitude && (
          <div style={styles.locationText}>
            Location: {latitude.toFixed(3)}, {longitude.toFixed(3)}
          </div>
        )}
        <div style={styles.locationText}>Date & Time: {currentDateTime}</div>

        {/* Clock In / Clock Out */}
        <div style={styles.clockButtonsContainer}>
          {!clockedIn ? (
            <button
              style={styles.buttonClockIn}
              onClick={() => recordAttendance("Clock In")}
            >
              Clock In
            </button>
          ) : (
            <button
              style={styles.buttonClockOut}
              onClick={() => recordAttendance("Clock Out")}
            >
              Clock Out
            </button>
          )}
        </div>

        {/* Report Options */}
        {!showPasswordInput && (
          <div style={styles.reportButtonContainer}>
            <button
              style={styles.buttonReport}
              onClick={() => setShowPasswordInput(true)}
            >
              Download Report
            </button>
          </div>
        )}

        {/* Password Input for report access */}
        {showPasswordInput && !passwordVerified && (
          <div style={styles.inputGroup}>
            <input
              style={styles.input}
              type="password"
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              style={styles.buttonValidate}
              onClick={handlePasswordSubmit}
            >
              Submit Password
            </button>
          </div>
        )}

        {/* Show Report Options after password verification */}
        {passwordVerified && showReportOptions && (
          <div style={styles.reportButtonContainer}>
            <button style={styles.buttonReport} onClick={downloadXLS}>
              Download XLS
            </button>
            <button style={styles.buttonReport} onClick={downloadPDF}>
              Download PDF
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={styles.footer}>
          <p>Created by Ali Raza</p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: "#ecf0f1", // Lighter background for the whole page
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    fontFamily: "'Roboto', sans-serif", // Using Roboto font
    padding: "10px", // Added padding for smaller screens
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: "10px",
    padding: "20px",
    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
    width: "100%",
    maxWidth: "500px", // Adjusted width for mobile
    margin: "0 auto",
  },
  header: {
    color: "#2c3e50", // Dark text for header
    fontSize: "28px",
    fontWeight: "600",
    marginBottom: "20px",
    textAlign: "center",
  },
  inputGroup: {
    marginBottom: "15px",
    textAlign: "left",
  },
  label: {
    fontSize: "14px", // Adjusted font size for label
    color: "#333",
  },
  input: {
    width: "100%",
    padding: "8px", // Smaller padding
    fontSize: "14px", // Smaller font size
    borderRadius: "5px",
    border: "1px solid #ddd",
    backgroundColor: "#f9f9f9", // Lighter background for input
    color: "#333",
  },
  buttonValidate: {
    padding: "10px 18px",
    backgroundColor: "#3498db", // Blue button color
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    width: "100%",
  },
  buttonClockIn: {
    padding: "10px 18px",
    backgroundColor: "#28a745",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    marginTop: "10px",
    width: "100%",
  },
  buttonClockOut: {
    padding: "10px 18px",
    backgroundColor: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    marginTop: "10px",
    width: "100%",
  },
  reportButtonContainer: {
    marginTop: "20px",
  },
  buttonReport: {
    padding: "10px 18px",
    backgroundColor: "#9b59b6", // Purple color for Report button
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    width: "100%",
    marginBottom: "10px",
  },
  footer: {
    marginTop: "30px",
    color: "#aaa",
    fontSize: "14px",
    textAlign: "center",
  },
  locationText: {
    color: "#333",
    fontSize: "14px", // Adjusted font size for location text
    textAlign: "center",
  },
  clockButtonsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
};

// Media queries for mobile responsiveness
const mediaStyles = `
  @media (max-width: 600px) {
    .input {
      padding: 6px;
      font-size: 12px;
    }
    .buttonValidate,
    .buttonClockIn,
    .buttonClockOut,
    .buttonReport {
      padding: 8px;
      font-size: 14px;
    }
    .header {
      font-size: 22px;
    }
    .locationText {
      font-size: 12px;
    }
  }
`;

export default AttendanceApp;
