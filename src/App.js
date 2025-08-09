import React, { useState, useEffect } from 'react';
import './App.css';

import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';

import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';

import SignUp from './screen/signIn/SignUpScreen';
import SignIn from './screen/signIn/SignInScreen';
import Home from './screen/HomeScreen';
import CreateClass from './screen/classroom/CreateClassScreen';
import ClassList from './screen/classroom/ClassListScreen';
import StudentList from './screen/classroom/studentList';
import Attendance from './screen/classroom/a';



// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Đang tải...</p>
      </div>
    );
  }

  // If user is not logged in or email not verified, redirect to signup
  if (!user || !user.emailVerified) {
    return <Navigate to="/signup" replace />;
  }

  return children;
};

// Public Route Component (for signup page)
const PublicRoute = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Đang tải...</p>
      </div>
    );
  }

  // If user is logged in and email verified, redirect to home
  if (user && user.emailVerified) {
    return <Navigate to="/classList" replace />;
  }

  return children;
};

function App() {
  const [user, setUser] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Thêm state để quản lý menu mobile
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Function toggle menu
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Function đóng menu khi click vào link
  const closeMenu = () => {
    setIsMenuOpen(false);
  };

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
      throw error;
    }
  };

  // Logout function
  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log('User logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Load attendance records when user logs in
  useEffect(() => {
    if (user && user.emailVerified) {
      fetchAttendance();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Đang tải...</p>
      </div>
    );
  }

  

  return (
    <Router>
      {/* Navigation - only show when user is logged in */}
      {user && user.emailVerified && (
        <nav className="app-nav">
          <div className="nav-brand">
            <h3>Lngo attendance</h3>
          </div>
          
          {/* Hamburger menu button */}
          <div className={`nav-toggle ${isMenuOpen ? 'active' : ''}`} onClick={toggleMenu}>
            <span></span>
            <span></span>
            <span></span>
          </div>
          
          <div className={`nav-links ${isMenuOpen ? 'active' : ''}`}>
            <Link to="/attendance" onClick={closeMenu}>Attendance</Link>
            <Link to="/classList" onClick={closeMenu}>ClassList</Link>
            {/* <div className="nav-user"> */}
              {/* <span>Xin chào, {user.displayName || user.email}</span> */}
              <button onClick={handleLogout} className="logout-btn">
                Đăng xuất
              </button>
            {/* </div> */}
          </div>
          
          
        </nav>
      )}

      <main className="app-main">
        <Routes>
          {/* Public routes */}
          <Route 
            path="/signin" 
            element={
              <PublicRoute>
                <SignIn />
              </PublicRoute>
            } 
          />

          {/* Public routes */}
          <Route 
            path="/signup" 
            element={
              <PublicRoute>
                <SignUp />
              </PublicRoute>
            } 
          />

          {/* Protected routes */}
          <Route 
            path="/home" 
            element={
              <ProtectedRoute>
                <Home 
                  user={user}
                  attendanceRecords={attendanceRecords}
                  markAttendance={markAttendance}
                  fetchAttendance={fetchAttendance}
                />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/createClass" 
            element={
              <ProtectedRoute>
                <CreateClass user={user} />
              </ProtectedRoute>
            } 
          />
           <Route 
            path="/classList" 
            element={
              <ProtectedRoute>
                <ClassList user={user} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/classList/:classId/students" 
            element={
              <ProtectedRoute>
                <StudentList user={user} />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/attendance" 
            element={
              <ProtectedRoute>
                <Attendance user={user} />
              </ProtectedRoute>
            } 
          />

          

          {/* Default route */}
          <Route 
            path="/" 
            element={
              user && user.emailVerified ? 
                <Navigate to="/classList" replace /> : 
                <Navigate to="/signin" replace />
            } 
          />

          {/* Catch all route */}
          <Route 
            path="*" 
            element={
              user && user.emailVerified ? 
                <Navigate to="/classList" replace /> : 
                <Navigate to="/signin" replace />
            } 
          />

         
        </Routes>
      </main>
    </Router>
  );
}

export default App;