import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import {
  TextField,
  Button,
  Typography,
  CircularProgress,
  Box,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";

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
  const [openAdminDialog, setOpenAdminDialog] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [inAdminPanel, setInAdminPanel] = useState(false);

  // Employee data for adding a new employee
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newEngineerName, setNewEngineerName] = useState("");

  // State for report generation
  const [reportDate, setReportDate] = useState("");
  const [reportEmployeeId, setReportEmployeeId] = useState("");

  // UI styling
  const styles = {
    header: {
      textAlign: "center",
      marginBottom: "20px",
      fontSize: "32px",
      fontWeight: "bold",
    },
    formContainer: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      marginBottom: "30px",
    },
    card: {
      padding: "20px",
      margin: "20px",
      boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
    },
    button: {
      marginTop: "20px",
    },
    footer: {
      textAlign: "center",
      marginTop: "40px",
      fontSize: "14px",
      color: "#666",
    },
  };

  // Update date and time
  const updateDateTime = () => {
    const currentDate = new Date();
    const formattedDateTime = format(currentDate, "yyyy-MM-dd HH:mm:ss");
    setCurrentDateTime(formattedDateTime);
  };

  useEffect(() => {
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000); // Update time every second
    return () => clearInterval(interval);
  }, []);

  // Automatically fetch Coordinates (latitude, longitude) on page load
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
        },
        (error) => {
          toast.error("Failed to get coordinates.");
        }
      );
    } else {
      toast.error("Geolocation is not supported by this browser.");
    }
  }, []);

  // Check clock-in status on page load or employee ID validation
  const checkClockInStatus = async (employeeId) => {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const q = query(
      collection(db, "attendance"),
      where("employeeId", "==", employeeId),
      where("timestamp", ">=", startOfDay),
      where("timestamp", "<=", endOfDay)
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const records = querySnapshot.docs.map((doc) => doc.data());

      // Check if the user has already clocked in and clocked out
      const hasClockedIn = records.some(
        (record) => record.status === "Clock In"
      );
      const hasClockedOut = records.some(
        (record) => record.status === "Clock Out"
      );

      if (hasClockedIn && hasClockedOut) {
        // User has already clocked in and out for the day
        setClockedIn(false);
        toast.info("You have already clocked in and out for the day.");
      } else if (hasClockedIn) {
        // User has clocked in but not clocked out
        setClockedIn(true);
      } else if (hasClockedOut) {
        // User has clocked out but not clocked in (unlikely, but handle it)
        setClockedIn(false);
      }
    } else {
      // No records found for today
      setClockedIn(false);
    }
  };

  // Handle employee ID validation
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
        checkClockInStatus(trimmedId); // Check clock-in status after validation
      } else {
        setIsValidated(false);
        setCompanyName("");
        setEngineerName("");
        toast.error("Employee ID not found!");
      }
    } catch (err) {
      console.error("Validation error:", err); // Log the error for debugging
      setIsValidated(false);
      setCompanyName("");
      setEngineerName("");
      toast.error("Failed to validate employee ID.");
    } finally {
      setLoading(false);
    }
  };

  // Handle clock in/out
  const handleClockInOut = async () => {
    if (!latitude || !longitude) {
      toast.error("Location coordinates are missing.");
      return;
    }

    const status = clockedIn ? "Clock Out" : "Clock In";

    // Fetch today's attendance records to check if the user has already clocked in/out
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const q = query(
      collection(db, "attendance"),
      where("employeeId", "==", employeeId),
      where("timestamp", ">=", startOfDay),
      where("timestamp", "<=", endOfDay)
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const records = querySnapshot.docs.map((doc) => doc.data());

      // Check if the user has already clocked in and clocked out
      const hasClockedIn = records.some(
        (record) => record.status === "Clock In"
      );
      const hasClockedOut = records.some(
        (record) => record.status === "Clock Out"
      );

      if (hasClockedIn && hasClockedOut) {
        // User has already clocked in and out for the day
        toast.error("You have already clocked in and out for the day.");
        return;
      }

      // Prevent clocking in again if already clocked in
      if (status === "Clock In" && hasClockedIn) {
        toast.error("You have already clocked in today!");
        return;
      }

      // Prevent clocking out again if already clocked out
      if (status === "Clock Out" && hasClockedOut) {
        toast.error("You have already clocked out today!");
        return;
      }
    }

    // Proceed with clock-in/out
    const attendanceData = {
      employeeId,
      companyName,
      engineerName,
      status,
      latitude,
      longitude,
      timestamp: new Date(),
    };

    try {
      await setDoc(
        doc(db, "attendance", `${employeeId}_${new Date().toISOString()}`),
        attendanceData
      );
      setClockedIn(!clockedIn); // Toggle clockedIn state
      toast.success(`${status} successfully recorded!`);
      checkClockInStatus(employeeId); // Refresh the attendance record
    } catch (error) {
      toast.error("Error recording attendance.");
    }
  };

  // Admin Login
  const handleAdminLogin = async () => {
    if (!adminEmail || !adminPassword) {
      toast.error("Please enter email and password.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      toast.success("Admin login successful!");
      setOpenAdminDialog(false); // Close admin login dialog
      setInAdminPanel(true); // Open the Admin Panel after successful login
    } catch (error) {
      console.error("Login error:", error); // Log the error for debugging
      switch (error.code) {
        case "auth/user-not-found":
          toast.error("User not found. Please check your email.");
          break;
        case "auth/wrong-password":
          toast.error("Incorrect password. Please try again.");
          break;
        case "auth/invalid-email":
          toast.error("Invalid email address.");
          break;
        default:
          toast.error("Login failed. Please try again.");
      }
    }
  };

  // Generate Full Attendance Report
  const generateReport = async () => {
    const attendanceRef = collection(db, "attendance");
    const querySnapshot = await getDocs(attendanceRef);

    const reportData = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        "Employee ID": data.employeeId,
        "Company Name": data.companyName,
        "Employee Name": data.engineerName,
        Date: format(data.timestamp.toDate(), "yyyy-MM-dd"),
        Time: format(data.timestamp.toDate(), "HH:mm:ss"),
        Latitude: data.latitude,
        Longitude: data.longitude,
        Status: data.status,
      };
    });

    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");

    const fileName = `attendance_report_${new Date().toISOString()}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Generate Date-Wise Report
  const generateDateWiseReport = async () => {
    if (!reportDate) {
      toast.error("Please select a date.");
      return;
    }

    const selectedDate = new Date(reportDate);
    const startOfDay = new Date(selectedDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(selectedDate.setHours(23, 59, 59, 999));

    const q = query(
      collection(db, "attendance"),
      where("timestamp", ">=", startOfDay),
      where("timestamp", "<=", endOfDay)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      toast.error("No records found for the selected date.");
      return;
    }

    const reportData = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        "Employee ID": data.employeeId,
        "Company Name": data.companyName,
        "Employee Name": data.engineerName,
        Date: format(data.timestamp.toDate(), "yyyy-MM-dd"),
        Time: format(data.timestamp.toDate(), "HH:mm:ss"),
        Latitude: data.latitude,
        Longitude: data.longitude,
        Status: data.status,
      };
    });

    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Date-Wise Report");

    const fileName = `date_wise_report_${reportDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Generate Employee-Wise Report
  const generateEmployeeWiseReport = async () => {
    if (!reportEmployeeId) {
      toast.error("Please enter an employee ID.");
      return;
    }

    const q = query(
      collection(db, "attendance"),
      where("employeeId", "==", reportEmployeeId)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      toast.error("No records found for the specified employee.");
      return;
    }

    const reportData = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        "Employee ID": data.employeeId,
        "Company Name": data.companyName,
        "Employee Name": data.engineerName,
        Date: format(data.timestamp.toDate(), "yyyy-MM-dd"),
        Time: format(data.timestamp.toDate(), "HH:mm:ss"),
        Latitude: data.latitude,
        Longitude: data.longitude,
        Status: data.status,
      };
    });

    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employee-Wise Report");

    const fileName = `employee_wise_report_${reportEmployeeId}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Add New Employee to Firestore
  const handleAddNewEmployee = async () => {
    if (!newEmployeeId || !newCompanyName || !newEngineerName) {
      toast.error("Please fill out all fields.");
      return;
    }

    try {
      const employeeRef = doc(db, "employees", newEmployeeId);
      await setDoc(employeeRef, {
        employeeId: newEmployeeId,
        companyName: newCompanyName,
        engineerName: newEngineerName,
      });

      toast.success("New employee added successfully!");
      setNewEmployeeId("");
      setNewCompanyName("");
      setNewEngineerName("");
    } catch (error) {
      toast.error("Error adding new employee.");
    }
  };

  // Reset the state when navigating back to Attendance
  const handleBackToAttendance = () => {
    setInAdminPanel(false);
    setEmployeeId("");
    setCompanyName("");
    setEngineerName("");
    setClockedIn(false);
    setLatitude(null);
    setLongitude(null);
    setTodayAttendanceRecord(null);
  };

  return (
    <Box
      sx={{ backgroundColor: "#f5f5f5", minHeight: "100vh", padding: "20px" }}
    >
      <ToastContainer />
      <Typography variant="h4" sx={styles.header}>
        E& Attendance System
      </Typography>

      {/* Attendance Panel */}
      {!inAdminPanel && (
        <Box sx={styles.formContainer}>
          <TextField
            label="Employee ID"
            variant="outlined"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            fullWidth
            disabled={loading}
            sx={{ marginBottom: "15px" }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleValidate}
            fullWidth
            disabled={loading}
            sx={styles.button}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "Validate Employee ID"
            )}
          </Button>

          {/* Admin Panel Access Button */}
          <Button
            variant="contained"
            color="secondary"
            fullWidth
            onClick={() => setOpenAdminDialog(true)}
            sx={styles.button}
          >
            Access Admin Panel
          </Button>
        </Box>
      )}

      {/* Information Window after validation */}
      {isValidated && !inAdminPanel && (
        <Card sx={styles.card}>
          <CardContent>
            <Typography variant="h6">Employee Information</Typography>
            <Typography>Employee ID: {employeeId}</Typography>
            <Typography>Company Name: {companyName}</Typography>
            <Typography>Employee Name: {engineerName}</Typography>{" "}
            {/* Updated label */}
            <Typography>Date & Time: {currentDateTime}</Typography>
            <Typography>Latitude: {latitude}</Typography>
            <Typography>Longitude: {longitude}</Typography>
            <Button
              variant="contained"
              color="primary"
              fullWidth
              onClick={handleClockInOut}
              sx={styles.button}
            >
              {clockedIn ? "Clock Out" : "Clock In"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Admin Panel */}
      {inAdminPanel && (
        <Card sx={styles.card}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Admin Panel
            </Typography>

            {/* Back Button */}
            <Button
              variant="outlined"
              onClick={handleBackToAttendance}
              sx={{ marginBottom: "20px" }}
            >
              Back to Attendance
            </Button>

            {/* Add New Employee Form */}
            <Typography variant="body1" gutterBottom>
              Add New Employee
            </Typography>
            <TextField
              label="Employee ID"
              variant="outlined"
              value={newEmployeeId}
              onChange={(e) => setNewEmployeeId(e.target.value)}
              fullWidth
              sx={{ marginBottom: "15px" }}
            />
            <TextField
              label="Company Name"
              variant="outlined"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              fullWidth
              sx={{ marginBottom: "15px" }}
            />
            <TextField
              label="Employee Name"
              variant="outlined"
              value={newEngineerName}
              onChange={(e) => setNewEngineerName(e.target.value)}
              fullWidth
              sx={{ marginBottom: "15px" }}
            />
            <Button
              variant="contained"
              color="primary"
              fullWidth
              onClick={handleAddNewEmployee}
              sx={styles.button}
            >
              Add New Employee
            </Button>

            {/* Date-Wise Report */}
            <Typography variant="body1" gutterBottom sx={{ marginTop: "20px" }}>
              Generate Date-Wise Report
            </Typography>
            <TextField
              label="Select Date"
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              sx={{ marginBottom: "15px" }}
            />
            <Button
              variant="contained"
              color="primary"
              fullWidth
              onClick={generateDateWiseReport}
              sx={styles.button}
            >
              Download Date-Wise Report
            </Button>

            {/* Employee-Wise Report */}
            <Typography variant="body1" gutterBottom sx={{ marginTop: "20px" }}>
              Generate Employee-Wise Report
            </Typography>
            <TextField
              label="Employee ID"
              variant="outlined"
              value={reportEmployeeId}
              onChange={(e) => setReportEmployeeId(e.target.value)}
              fullWidth
              sx={{ marginBottom: "15px" }}
            />
            <Button
              variant="contained"
              color="primary"
              fullWidth
              onClick={generateEmployeeWiseReport}
              sx={styles.button}
            >
              Download Employee-Wise Report
            </Button>

            {/* Full Attendance Report */}
            <Button
              variant="contained"
              color="primary"
              fullWidth
              onClick={generateReport}
              sx={styles.button}
            >
              Download Full Attendance Report
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Admin Login Dialog */}
      <Dialog open={openAdminDialog} onClose={() => setOpenAdminDialog(false)}>
        <DialogTitle>Admin Login</DialogTitle>
        <DialogContent>
          <TextField
            label="Email"
            variant="outlined"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            fullWidth
            sx={{ marginBottom: "15px" }}
          />
          <TextField
            label="Password"
            type="password"
            variant="outlined"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAdminDialog(false)} color="secondary">
            Cancel
          </Button>
          <Button onClick={handleAdminLogin} color="primary">
            Login
          </Button>
        </DialogActions>
      </Dialog>

      {/* Footer */}
      <Typography variant="body2" sx={styles.footer}>
        Designed and Developed by Ali Raza
      </Typography>
    </Box>
  );
};

export default AttendanceApp;
