import React, { useState, useEffect, JSX } from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { User } from 'firebase/auth';

import SignUp from './screen/signIn/SignUpScreen';
import SignIn from './screen/signIn/SignInScreen';
import Home from './screen/HomeScreen';
import CreateClass from './screen/classroom/CreateClassScreen';
import ClassList from './screen/classroom/ClassListScreen';
import StudentList from './screen/classroom/studentList';
import Attendance from './screen/classroom/a';

// Interface definitions
interface AttendanceRecord {
  id: string;
  userId: string;
  userEmail: string;
  timestamp: Date;
  status: string;
}

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Protected Route Component
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
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

  if (!user) {
    return <Navigate to="/signin" replace />;
  }
  


  return <>{children}</>;
};

// Public Route Component (for signup page)
const PublicRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
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

  return <>{children}</>;
};

export default function App(): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  console.log(attendanceRecords);

  // Function toggle menu
  const toggleMenu = (): void => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Function đóng menu khi click vào link
  const closeMenu = (): void => {
    setIsMenuOpen(false);
  };

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch attendance records from Firestore
  const fetchAttendance = async (): Promise<void> => {
    try {
      const q = query(collection(db, 'attendance'), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      const records: AttendanceRecord[] = [];
      querySnapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() } as AttendanceRecord);
      });
      setAttendanceRecords(records);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };
  // Logout function
  const handleLogout = async (): Promise<void> => {
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
    <div className='min-h-full h-screen flex flex-col justify-between bg-[#F5F5F5]'>
      <div>
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
                <button onClick={handleLogout} className="logout-btn">
                  Đăng xuất
                </button>
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
                    <Home />
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
      </div>
    </div>
  );
}