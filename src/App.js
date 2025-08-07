import React, { useState, useEffect } from 'react';
import './App.css';

import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';

import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';

import Home from './screen/HomeScreen';
// import Menu from './screens/Menu';
// import About from './screens/About';

function App() {

   const [user, setUser] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch attendance records from Firestore
  const fetchAttendance = async () => {
    try {
      const q = query(collection(db, 'attendance'), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      const records = [];
      querySnapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() });
      });
      setAttendanceRecords(records);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  // Add attendance record
  const markAttendance = async () => {
    if (!user) return;

    try {
      await addDoc(collection(db, 'attendance'), {
        userId: user.uid,
        userEmail: user.email,
        timestamp: new Date(),
        status: 'present'
      });
      console.log('Attendance marked successfully');
      fetchAttendance(); // Refresh the list
    } catch (error) {
      console.error('Error marking attendance:', error);
    }
  };

  // Login function
  const handleLogin = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  // Logout function
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Load attendance records when user logs in
  useEffect(() => {
    if (user) {
      fetchAttendance();
    }
  }, [user]);

  if (loading) {
    return <div>Loading...</div>;
  }

  
  return (
    <Router>
      <nav>
        <Link to="/home">Home</Link> | 
        <Link to="/menu">Menu</Link> | 
        <Link to="/about">About</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/home" />} /> {/* Đặt mặc định về /home */}
        <Route path="/home" element={<Home />} />
        {/* <Route path="/menu" element={<Menu />} /> */}
        {/* <Route path="/about" element={<About />} /> */}
      </Routes>
    </Router>
  );
}

export default App;
