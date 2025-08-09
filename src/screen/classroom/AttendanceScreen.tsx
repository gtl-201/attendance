import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    collection,
    getDocs,
    query,
    where,
    orderBy,
    doc,
    getDoc
} from 'firebase/firestore';
import { db } from '../../firebase';

// Interfaces
interface AttendanceData {
    id: string;
    studentId: string;
    classId: string;
    date: string;
    status: 'present' | 'absent' | 'excused' | 'late';
    note?: string;
    createdAt: any;
}

interface StudentData {
    id: string;
    studentId: string;
    studentName: string;
    studentEmail: string;
    classId: string;
    enrolledAt: any;
    status: 'active' | 'inactive';
}

interface ClassData {
    id: string;
    className: string;
    teacherId: string;
    teacherName: string;
    subject: string;
    feePerSession: number;
    description?: string;
    totalStudents: number;
}

interface ToastMessage {
    id: string;
    type: 'success' | 'error';
    text: string;
    timestamp: number;
}

interface AttendanceProps {
    user: any;
}

const Attendance: React.FC<AttendanceProps> = ({ user }) => {
    const navigate = useNavigate();

    // State management
    const [loading, setLoading] = useState(true);
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [students, setStudents] = useState<StudentData[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceData[]>([]);
    const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);

    // Filter states
    const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
    const [selectedClass, setSelectedClass] = useState<string>('all');
    const [selectedStudent, setSelectedStudent] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // View states
    const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'stats'>('list');
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Modal states for calendar day details
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [showDateModal, setShowDateModal] = useState(false);

    // Toast message functions
    const addMessage = (type: 'success' | 'error', text: string) => {
        const newMessage: ToastMessage = {
            id: `${Date.now()}-${Math.random()}`,
            type,
            text,
            timestamp: Date.now()
        };

        setToastMessages(prev => [...prev, newMessage]);

        setTimeout(() => {
            removeMessage(newMessage.id);
        }, 10000);
    };

    const removeMessage = (id: string) => {
        setToastMessages(prev => prev.filter(msg => msg.id !== id));
    };

    // Fetch user's classes
    const fetchClasses = async () => {
        if (!user?.uid) return;

        try {
            const q = query(
                collection(db, 'classes'),
                where('teacherId', '==', user.uid)
            );

            const querySnapshot = await getDocs(q);
            const classList: ClassData[] = [];

            querySnapshot.forEach((doc) => {
                classList.push({ id: doc.id, ...doc.data() } as ClassData);
            });

            setClasses(classList);
        } catch (error) {
            console.error('Lỗi khi tải danh sách lớp:', error);
            addMessage('error', 'Không thể tải danh sách lớp học');
        }
    };

    // Fetch students for selected classes
    const fetchStudents = async () => {
        if (classes.length === 0) {
            setStudents([]);
            return;
        }

        try {
            const classIds = classes.map(cls => cls.id);
            const studentList: StudentData[] = [];

            // Fetch students for each class
            for (const classId of classIds) {
                const q = query(
                    collection(db, 'enrollments'),
                    where('classId', '==', classId)
                );

                const querySnapshot = await getDocs(q);
                querySnapshot.forEach((doc) => {
                    studentList.push({ id: doc.id, ...doc.data() } as StudentData);
                });
            }

            setStudents(studentList);
        } catch (error) {
            console.error('Lỗi khi tải danh sách học sinh:', error);
            addMessage('error', 'Không thể tải danh sách học sinh');
        }
    };

    // Fixed: Fetch attendance records only for teacher's classes
    const fetchAttendanceRecords = async () => {
        if (classes.length === 0) {
            setAttendanceRecords([]);
            return;
        }

        try {
            // Get list of class IDs that belong to this teacher
            const teacherClassIds = classes.map(cls => cls.id);

            if (teacherClassIds.length === 0) {
                setAttendanceRecords([]);
                return;
            }

            const attendanceList: AttendanceData[] = [];

            // Method 1: Query attendance for each class individually (recommended for better performance)
            for (const classId of teacherClassIds) {
                const q = query(
                    collection(db, 'attendance'),
                    where('classId', '==', classId),
                    // orderBy('date', 'desc')
                );

                const querySnapshot = await getDocs(q);
                querySnapshot.forEach((doc) => {
                    attendanceList.push({ id: doc.id, ...doc.data() } as AttendanceData);
                });
            }

            // Alternative Method 2: If you prefer to get all attendance records and filter
            // Note: This method fetches all records first, which may be less efficient
            /*
            const allAttendanceQuery = query(
                collection(db, 'attendance'),
                orderBy('date', 'desc')
            );
            
            const allAttendanceSnapshot = await getDocs(allAttendanceQuery);
            allAttendanceSnapshot.forEach((doc) => {
                const attendanceData = { id: doc.id, ...doc.data() } as AttendanceData;
                // Only include attendance records for classes managed by this teacher
                if (teacherClassIds.includes(attendanceData.classId)) {
                    attendanceList.push(attendanceData);
                }
            });
            */

            setAttendanceRecords(attendanceList);
        } catch (error) {
            console.error('Lỗi khi tải dữ liệu điểm danh:', error);
            addMessage('error', 'Không thể tải dữ liệu điểm danh');
        }
    };

    // Load data on component mount
    useEffect(() => {
        if (user?.uid) {
            fetchClasses();
        }
    }, [user]);

    useEffect(() => {
        // Only fetch students and attendance after classes are loaded
        if (classes.length > 0) {
            fetchStudents();
            fetchAttendanceRecords();
        } else {
            // Clear data if no classes
            setStudents([]);
            setAttendanceRecords([]);
        }
    }, [classes]);

    // Set loading to false when data fetching is complete
    useEffect(() => {
        // Set loading to false after classes are fetched (whether empty or not)
        if (classes.length >= 0) {
            setLoading(false);
        }
    }, [classes, attendanceRecords]);

    // Filter attendance records
    const filteredRecords = attendanceRecords.filter(record => {
        // Filter by class
        if (selectedClass !== 'all' && record.classId !== selectedClass) return false;

        // Filter by student
        if (selectedStudent !== 'all' && record.studentId !== selectedStudent) return false;

        // Filter by date range
        if (dateFrom && record.date < dateFrom) return false;
        if (dateTo && record.date > dateTo) return false;

        // Filter by status
        if (statusFilter !== 'all' && record.status !== statusFilter) return false;

        return true;
    });

    // Get filtered students based on selected class
    const filteredStudents = selectedClass === 'all'
        ? students
        : students.filter(student => student.classId === selectedClass);

    // Helper functions
    const getClassName = (classId: string) => {
        const cls = classes.find(c => c.id === classId);
        return cls ? cls.className : 'Unknown Class';
    };

    const getStudentName = (studentId: string) => {
        const student = students.find(s => s.id === studentId);
        return student ? student.studentName : 'Unknown Student';
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'present': return '✅';
            case 'absent': return '❌';
            case 'late': return '⏰';
            default: return '⚪';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'present': return 'text-green-600 bg-green-50';
            case 'absent': return 'text-red-600 bg-red-50';
            case 'late': return 'text-yellow-600 bg-yellow-50';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    // Statistics
    const getStatistics = () => {
        const stats = {
            totalRecords: filteredRecords.length,
            present: filteredRecords.filter(r => r.status === 'present').length,
            absent: filteredRecords.filter(r => r.status === 'absent').length,
            excused: filteredRecords.filter(r => r.status === 'excused').length,
            late: filteredRecords.filter(r => r.status === 'late').length,
        };

        return stats;
    };

    // Get attendance by date for calendar view
    const getAttendanceByDate = () => {
        const attendanceByDate: { [date: string]: AttendanceData[] } = {};

        filteredRecords.forEach(record => {
            // Ensure we use the exact date string from the record
            const dateKey = record.date; // record.date is already in YYYY-MM-DD format
            if (!attendanceByDate[dateKey]) {
                attendanceByDate[dateKey] = [];
            }
            attendanceByDate[dateKey].push(record);
        });

        return attendanceByDate;
    };

    // Get attendance records for a specific date
    const getAttendanceForDate = (dateString: string) => {
        return filteredRecords.filter(record => record.date === dateString);
    };

    // Handle date click in calendar
    const handleDateClick = (dateString: string) => {
        const dayAttendance = getAttendanceForDate(dateString);
        if (dayAttendance.length > 0) {
            setSelectedDate(dateString);
            setShowDateModal(true);
        }
    };

    // Close modal
    const closeModal = () => {
        setShowDateModal(false);
        setSelectedDate('');
    };

    // Calendar helpers
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const days = [];

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null);
        }

        // Add days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i));
        }

        return days;
    };

    if (!user?.uid) {
        return (
            <div className="text-center py-12">
                <p className="text-red-500">Vui lòng đăng nhập để xem dữ liệu điểm danh</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                <p className="ml-4">Đang tải dữ liệu điểm danh...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* Toast Messages */}
            <div className="fixed top-20 right-4 z-1000 space-y-2 max-w-sm">
                {toastMessages.map((message) => (
                    <div
                        key={message.id}
                        className={`transform transition-all duration-300 ease-out p-4 rounded-lg shadow-lg border-l-4 ${message.type === 'success'
                            ? 'bg-white border-green-500 text-green-800'
                            : 'bg-white border-red-500 text-red-800'
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <span className="text-lg">
                                    {message.type === 'success' ? '✅' : '❌'}
                                </span>
                                <span className="font-medium text-sm">{message.text}</span>
                            </div>
                            <button
                                onClick={() => removeMessage(message.id)}
                                className="ml-4 text-gray-400 hover:text-gray-600 text-lg font-bold leading-none"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Header */}
            <div className="mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0 mb-4 sm:mb-6">
                    <div className="flex-1 text-center sm:text-left">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1">
                            Lịch Sử Điểm Danh
                        </h1>
                        <p className="text-sm sm:text-base text-gray-600 mb-2 sm:mb-0">
                            Xem và thống kê điểm danh của các lớp học
                        </p>
                        {classes.length === 0 && (
                            <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                <p className="text-orange-700 text-sm font-medium flex items-start gap-2">
                                    <span className="text-orange-500 flex-shrink-0 mt-0.5">⚠️</span>
                                    <span>
                                        Bạn chưa có lớp học nào.
                                        <span className="hidden sm:inline"> Hãy tạo lớp học để bắt đầu điểm danh.</span>
                                        <span className="sm:hidden block mt-1">Tạo lớp học để bắt đầu.</span>
                                    </span>
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Navigation Button */}
                    <div className="flex justify-end sm:flex-shrink-0">
                        <button
                            onClick={() => navigate('/classList')}
                            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 font-medium text-sm sm:text-base transition-colors touch-manipulation shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            <span className="sm:hidden">Về Danh Sách Lớp</span>
                            <span className="hidden sm:inline">Quay lại danh sách lớp</span>
                        </button>
                    </div>
                </div>

                {/* Statistics Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 mb-6">
                    {(() => {
                        const stats = getStatistics();
                        return (
                            <>
                                <div className="bg-white p-3 sm:p-4 rounded-lg shadow-md border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs sm:text-sm text-gray-600 truncate">Tổng bản ghi</p>
                                            <p className="text-lg sm:text-2xl font-bold text-gray-800">{stats.totalRecords}</p>
                                        </div>
                                        <span className="text-lg sm:text-2xl flex-shrink-0 ml-2">📊</span>
                                    </div>
                                </div>

                                <div className="bg-white p-3 sm:p-4 rounded-lg shadow-md border-l-4 border-green-500 hover:shadow-lg transition-shadow">
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs sm:text-sm text-gray-600 truncate">Có mặt</p>
                                            <p className="text-lg sm:text-2xl font-bold text-green-600">{stats.present}</p>
                                        </div>
                                        <span className="text-lg sm:text-2xl flex-shrink-0 ml-2">✅</span>
                                    </div>
                                </div>

                                <div className="bg-white p-3 sm:p-4 rounded-lg shadow-md border-l-4 border-yellow-500 hover:shadow-lg transition-shadow">
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs sm:text-sm text-gray-600 truncate">Muộn</p>
                                            <p className="text-lg sm:text-2xl font-bold text-yellow-600">{stats.late}</p>
                                        </div>
                                        <span className="text-lg sm:text-2xl flex-shrink-0 ml-2">⏰</span>
                                    </div>
                                </div>

                                <div className="bg-white p-3 sm:p-4 rounded-lg shadow-md border-l-4 border-red-500 hover:shadow-lg transition-shadow">
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs sm:text-sm text-gray-600 truncate">Vắng mặt</p>
                                            <p className="text-lg sm:text-2xl font-bold text-red-600">{stats.absent}</p>
                                        </div>
                                        <span className="text-lg sm:text-2xl flex-shrink-0 ml-2">❌</span>
                                    </div>
                                </div>

                                <div className="bg-white p-3 sm:p-4 rounded-lg shadow-md border-l-4 border-purple-500 hover:shadow-lg transition-shadow">
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs sm:text-sm text-gray-600 truncate">Xin nghỉ</p>
                                            <p className="text-lg sm:text-2xl font-bold text-purple-600">{stats.excused}</p>
                                        </div>
                                        <span className="text-lg sm:text-2xl flex-shrink-0 ml-2">📝</span>
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </div>

                {/* Show filters only if there are classes */}
                {classes.length > 0 && (
                    <>
                        {(() => {
                            // Helper functions - defined inside the JSX scope
                            const getActiveFiltersCount = () => {
                                let count = 0;
                                if (selectedClass !== 'all') count++;
                                if (selectedStudent !== 'all') count++;
                                if (dateFrom) count++;
                                if (dateTo) count++;
                                if (statusFilter !== 'all') count++;
                                return count;
                            };

                            const getActiveFilterTags = () => {
                                const tags = [];
                                if (selectedClass !== 'all') {
                                    const classInfo = classes.find(c => c.id === selectedClass);
                                    tags.push(`Lớp: ${classInfo?.className || 'Unknown'}`);
                                }
                                if (selectedStudent !== 'all') {
                                    const studentInfo = filteredStudents.find(s => s.id === selectedStudent);
                                    tags.push(`HS: ${studentInfo?.studentName || 'Unknown'}`);
                                }
                                if (dateFrom) tags.push(`Từ: ${dateFrom}`);
                                if (dateTo) tags.push(`Đến: ${dateTo}`);
                                if (statusFilter !== 'all') {
                                    const statusMap: { [key: string]: string } = {
                                        'present': 'Có mặt',
                                        'late': 'Muộn',
                                        'absent': 'Vắng',
                                        'excused': '📝 Xin nghỉ'
                                    };
                                    tags.push(statusMap[statusFilter] || statusFilter);
                                }
                                return tags.slice(0, 3); // Limit to 3 tags for mobile
                            };

                            return (
                                <>
                                    {/* Filters */}
                                    <div className="bg-white rounded-lg shadow-md mb-6 overflow-hidden">
                                        {/* Mobile Filter Header - Always visible */}
                                        <div className="p-4 sm:pb-4 sm:mb-0">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-semibold">Bộ lọc</h3>

                                                {/* Mobile Toggle Button */}
                                                <button
                                                    onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                                                    className="sm:hidden px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2 text-sm font-medium text-gray-700 transition-colors"
                                                    aria-label={isFiltersExpanded ? "Thu gọn bộ lọc" : "Mở rộng bộ lọc"}
                                                >
                                                    <span>{isFiltersExpanded ? "Thu gọn" : "Mở rộng"}</span>
                                                    <svg
                                                        className={`w-4 h-4 transition-transform duration-200 ${isFiltersExpanded ? 'rotate-180' : ''}`}
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>

                                                {/* Desktop - Show active filter count */}
                                                <div className="hidden sm:block">
                                                    {getActiveFiltersCount() > 0 && (
                                                        <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded-full text-xs font-medium">
                                                            {getActiveFiltersCount()} bộ lọc đang áp dụng
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Mobile - Quick filter summary when collapsed */}
                                            {!isFiltersExpanded && (
                                                <div className="mt-2 sm:hidden">
                                                    {getActiveFiltersCount() > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {getActiveFilterTags().map((tag, index) => (
                                                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-600 rounded-full text-xs font-medium">
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-gray-500">Chưa áp dụng bộ lọc nào</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Filter Content - Collapsible on mobile */}
                                        <div className={`transition-all duration-300 ease-in-out sm:block ${isFiltersExpanded ? 'block' : 'hidden'
                                            } sm:pb-4 sm:px-4`}>
                                            <div className="px-4 pb-4 sm:px-0 sm:pb-0">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                                                    {/* Class Filter */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Lớp học</label>
                                                        <select
                                                            value={selectedClass}
                                                            onChange={(e) => {
                                                                setSelectedClass(e.target.value);
                                                                setSelectedStudent('all'); // Reset student filter
                                                            }}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm touch-manipulation"
                                                        >
                                                            <option value="all">Tất cả lớp</option>
                                                            {classes.map(cls => (
                                                                <option key={cls.id} value={cls.id}>
                                                                    {cls.className} - {cls.subject}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Student Filter */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Học sinh</label>
                                                        <select
                                                            value={selectedStudent}
                                                            onChange={(e) => setSelectedStudent(e.target.value)}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm touch-manipulation"
                                                        >
                                                            <option value="all">Tất cả học sinh</option>
                                                            {filteredStudents.map(student => (
                                                                <option key={student.id} value={student.id}>
                                                                    {student.studentName}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Date From */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Từ ngày</label>
                                                        <input
                                                            type="date"
                                                            value={dateFrom}
                                                            onChange={(e) => setDateFrom(e.target.value)}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm touch-manipulation"
                                                        />
                                                    </div>

                                                    {/* Date To */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Đến ngày</label>
                                                        <input
                                                            type="date"
                                                            value={dateTo}
                                                            onChange={(e) => setDateTo(e.target.value)}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm touch-manipulation"
                                                        />
                                                    </div>

                                                    {/* Status Filter - Đã thêm trạng thái "Xin nghỉ" */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                                                        <select
                                                            value={statusFilter}
                                                            onChange={(e) => setStatusFilter(e.target.value)}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm touch-manipulation"
                                                        >
                                                            <option value="all">Tất cả</option>
                                                            <option value="present">✅ Có mặt</option>
                                                            <option value="late">⏰ Muộn</option>
                                                            <option value="absent">❌ Vắng</option>
                                                            <option value="excused">📝 Xin nghỉ</option>
                                                        </select>
                                                    </div>

                                                    {/* Clear Filters */}
                                                    <div className="flex items-end">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedClass('all');
                                                                setSelectedStudent('all');
                                                                setDateFrom('');
                                                                setDateTo('');
                                                                setStatusFilter('all');
                                                            }}
                                                            className="w-full px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 active:bg-gray-400 text-sm touch-manipulation font-medium transition-colors"
                                                        >
                                                            Xóa bộ lọc
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Mobile - Quick action buttons when expanded */}
                                                <div className="mt-4 pt-3 border-t border-gray-200 sm:hidden">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedClass('all');
                                                                setSelectedStudent('all');
                                                                setDateFrom('');
                                                                setDateTo('');
                                                                setStatusFilter('all');
                                                                setIsFiltersExpanded(false);
                                                            }}
                                                            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 active:bg-blue-800 text-sm font-medium transition-colors touch-manipulation"
                                                        >
                                                            🗑️ Xóa tất cả
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* View Mode Selector - Enhanced for mobile */}
                                    <div className="flex gap-1 sm:gap-2 mb-6 overflow-x-auto pb-2 sm:pb-0">
                                        <button
                                            onClick={() => setViewMode('list')}
                                            className={`flex-shrink-0 px-3 sm:px-4 py-2 rounded-md font-medium text-sm sm:text-base transition-colors touch-manipulation ${viewMode === 'list'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400'
                                                }`}
                                        >
                                            📋 <span className="hidden sm:inline">Danh sách</span><span className="sm:hidden">DS</span>
                                        </button>
                                        <button
                                            onClick={() => setViewMode('calendar')}
                                            className={`flex-shrink-0 px-3 sm:px-4 py-2 rounded-md font-medium text-sm sm:text-base transition-colors touch-manipulation ${viewMode === 'calendar'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400'
                                                }`}
                                        >
                                            📅 <span className="hidden sm:inline">Lịch theo lớp</span><span className="sm:hidden">Lịch</span>
                                        </button>
                                        <button
                                            onClick={() => setViewMode('stats')}
                                            className={`flex-shrink-0 px-3 sm:px-4 py-2 rounded-md font-medium text-sm sm:text-base transition-colors touch-manipulation ${viewMode === 'stats'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400'
                                                }`}
                                        >
                                            📊 <span className="hidden sm:inline">Thống kê</span><span className="sm:hidden">TK</span>
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                    </>
                )}
            </div>

            {/* Content based on view mode */}
            {classes.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-8 text-center">
                    <div className="text-gray-400 text-6xl mb-4">📚</div>
                    <h3 className="text-xl font-semibold text-gray-600 mb-2">Chưa có lớp học</h3>
                    <p className="text-gray-500 mb-4">
                        Bạn cần tạo lớp học trước khi có thể xem dữ liệu điểm danh.
                    </p>
                    <button
                        onClick={() => navigate('/classList')}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Đi đến danh sách lớp
                    </button>
                </div>
            ) : (
                <>
                    {viewMode === 'list' && (
                        <div className="bg-white rounded-lg shadow-md">
                            {filteredRecords.length === 0 ? (
                                <div className="p-4 sm:p-8 text-center text-gray-500">
                                    <div className="text-4xl sm:text-6xl mb-2 sm:mb-4">📋</div>
                                    <h3 className="text-sm sm:text-lg font-medium text-gray-700 mb-1 sm:mb-2">
                                        {attendanceRecords.length === 0
                                            ? "Chưa có dữ liệu điểm danh nào. Hãy bắt đầu điểm danh cho học sinh trong các lớp học."
                                            : "Không tìm thấy dữ liệu điểm danh phù hợp với bộ lọc"
                                        }
                                    </h3>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    {(() => {
                                        // Group records by class
                                        const groupedByClass = filteredRecords.reduce((acc, record) => {
                                            const classId = record.classId;
                                            if (!acc[classId]) {
                                                acc[classId] = [];
                                            }
                                            acc[classId].push(record);
                                            return acc;
                                        }, {} as Record<string, typeof filteredRecords>);

                                        return Object.entries(groupedByClass).map(([classId, classRecords]) => {
                                            const classInfo = classes.find(c => c.id === classId);
                                            const className = getClassName(classId);
                                            const feePerSession = classInfo?.feePerSession || 0;

                                            // Group by student within this class
                                            const studentStats = classRecords.reduce((acc, record) => {
                                                const studentId = record.studentId;
                                                if (!acc[studentId]) {
                                                    acc[studentId] = {
                                                        name: getStudentName(studentId),
                                                        present: 0,
                                                        late: 0,
                                                        excused: 0,
                                                        absent: 0,
                                                        totalFee: 0
                                                    };
                                                }

                                                // Count attendance types
                                                switch (record.status) {
                                                    case 'present':
                                                        acc[studentId].present++;
                                                        acc[studentId].totalFee += feePerSession;
                                                        break;
                                                    case 'late':
                                                        acc[studentId].late++;
                                                        acc[studentId].totalFee += feePerSession;
                                                        break;
                                                    case 'excused':
                                                        acc[studentId].excused++;
                                                        break;
                                                    case 'absent':
                                                        acc[studentId].absent++;
                                                        break;
                                                }

                                                return acc;
                                            }, {} as Record<string, {
                                                name: string;
                                                present: number;
                                                late: number;
                                                excused: number;
                                                absent: number;
                                                totalFee: number;
                                            }>);

                                            return (
                                                <div key={classId} className="mb-4 sm:mb-8">
                                                    {/* Class Header */}
                                                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 sm:px-6 py-3 sm:py-4 rounded-t-lg">
                                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                                                            <div className="min-w-0 flex-1">
                                                                <h3 className="text-base sm:text-lg font-bold truncate">{className}</h3>
                                                                <p className="text-blue-100 text-xs sm:text-sm truncate">{classInfo?.subject}</p>
                                                            </div>
                                                            <div className="mt-2 sm:mt-0 text-right flex-shrink-0">
                                                                <div className="text-xs sm:text-sm text-blue-100">Học phí/buổi</div>
                                                                <div className="text-lg sm:text-xl font-bold">
                                                                    <span className="hidden sm:inline">{feePerSession.toLocaleString('vi-VN')}₫</span>
                                                                    <span className="sm:hidden">{(feePerSession / 1000).toFixed(0)}k₫</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Student Statistics Table */}
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full min-w-[500px]">
                                                            <thead className="bg-gray-50">
                                                                <tr>
                                                                    <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                        <span className="block sm:hidden">Tên HS</span>
                                                                        <span className="hidden sm:block">Tên học sinh</span>
                                                                    </th>
                                                                    <th className="px-1 sm:px-3 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                        <div className="flex flex-col">
                                                                            <span className="block sm:hidden">Có mặt</span>
                                                                            <span className="hidden sm:block">Tham gia</span>
                                                                            <span className="text-green-600">✓</span>
                                                                        </div>
                                                                    </th>
                                                                    <th className="px-1 sm:px-3 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                        <div className="flex flex-col">
                                                                            <span>Muộn</span>
                                                                            <span className="text-yellow-600">⚠</span>
                                                                        </div>
                                                                    </th>
                                                                    <th className="px-1 sm:px-3 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                                                                        <div className="flex flex-col">
                                                                            <span>Xin nghỉ</span>
                                                                            <span className="text-blue-600">📋</span>
                                                                        </div>
                                                                    </th>
                                                                    <th className="px-1 sm:px-3 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                        <div className="flex flex-col">
                                                                            <span>Vắng</span>
                                                                            <span className="text-red-600">✗</span>
                                                                        </div>
                                                                    </th>
                                                                    <th className="px-2 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                        <span className="block sm:hidden">Tiền</span>
                                                                        <span className="hidden sm:block">Tổng tiền</span>
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="bg-white divide-y divide-gray-200">
                                                                {Object.entries(studentStats).map(([studentId, stats], index) => (
                                                                    <tr
                                                                        key={studentId}
                                                                        className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
                                                                    >
                                                                        <td className="px-2 sm:px-6 py-2 sm:py-4">
                                                                            <div className="font-medium text-gray-900 text-xs sm:text-sm leading-tight">
                                                                                {stats.name}
                                                                            </div>
                                                                            {/* Mobile: Show excused count under name */}
                                                                            <div className="sm:hidden text-xs text-gray-500 mt-1">
                                                                                Xin nghỉ: {stats.excused}
                                                                            </div>
                                                                        </td>

                                                                        <td className="px-1 sm:px-3 py-2 sm:py-4 text-center">
                                                                            <span className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-green-100 text-green-800 font-bold text-xs sm:text-sm">
                                                                                {stats.present}
                                                                            </span>
                                                                        </td>

                                                                        <td className="px-1 sm:px-3 py-2 sm:py-4 text-center">
                                                                            <span className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-yellow-100 text-yellow-800 font-bold text-xs sm:text-sm">
                                                                                {stats.late}
                                                                            </span>
                                                                        </td>

                                                                        <td className="px-1 sm:px-3 py-2 sm:py-4 text-center hidden sm:table-cell">
                                                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold text-sm">
                                                                                {stats.excused}
                                                                            </span>
                                                                        </td>

                                                                        <td className="px-1 sm:px-3 py-2 sm:py-4 text-center">
                                                                            <span className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-red-100 text-red-800 font-bold text-xs sm:text-sm">
                                                                                {stats.absent}
                                                                            </span>
                                                                        </td>

                                                                        <td className="px-2 sm:px-6 py-2 sm:py-4 text-right">
                                                                            <div className="font-bold text-sm sm:text-lg text-green-600">
                                                                                <span className="hidden sm:inline">{stats.totalFee.toLocaleString('vi-VN')}₫</span>
                                                                                <span className="sm:hidden">{(stats.totalFee / 1000).toFixed(0)}k₫</span>
                                                                            </div>
                                                                            <div className="text-xs text-gray-500">
                                                                                {stats.present + stats.late} buổi
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>

                                                            {/* Class Summary */}
                                                            <tfoot className="bg-blue-50 border-t-2 border-blue-200">
                                                                <tr>
                                                                    <td className="px-2 sm:px-6 py-2 sm:py-4 font-bold text-gray-700 text-xs sm:text-sm">
                                                                        <span className="block sm:hidden">Tổng ({Object.keys(studentStats).length} HS)</span>
                                                                        <span className="hidden sm:block">Tổng lớp ({Object.keys(studentStats).length} học sinh)</span>
                                                                    </td>
                                                                    <td className="px-1 sm:px-3 py-2 sm:py-4 text-center font-bold text-green-600 text-xs sm:text-sm">
                                                                        {Object.values(studentStats).reduce((sum, s) => sum + s.present, 0)}
                                                                    </td>
                                                                    <td className="px-1 sm:px-3 py-2 sm:py-4 text-center font-bold text-yellow-600 text-xs sm:text-sm">
                                                                        {Object.values(studentStats).reduce((sum, s) => sum + s.late, 0)}
                                                                    </td>
                                                                    <td className="px-1 sm:px-3 py-2 sm:py-4 text-center font-bold text-blue-600 hidden sm:table-cell">
                                                                        {Object.values(studentStats).reduce((sum, s) => sum + s.excused, 0)}
                                                                    </td>
                                                                    <td className="px-1 sm:px-3 py-2 sm:py-4 text-center font-bold text-red-600 text-xs sm:text-sm">
                                                                        {Object.values(studentStats).reduce((sum, s) => sum + s.absent, 0)}
                                                                    </td>
                                                                    <td className="px-2 sm:px-6 py-2 sm:py-4 text-right">
                                                                        <div className="font-bold text-base sm:text-xl text-green-600">
                                                                            {(() => {
                                                                                const classTotal = Object.values(studentStats).reduce((sum, s) => sum + s.totalFee, 0);
                                                                                return (
                                                                                    <>
                                                                                        <span className="hidden sm:inline">{classTotal.toLocaleString('vi-VN')}₫</span>
                                                                                        <span className="sm:hidden">{(classTotal / 1000).toFixed(0)}k₫</span>
                                                                                    </>
                                                                                );
                                                                            })()}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            </tfoot>
                                                        </table>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}

                                    {/* Global Summary */}
                                    {filteredRecords.length > 0 && (
                                        <div className="mt-4 sm:mt-6 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4 sm:p-6">
                                            <h4 className="font-bold text-gray-700 mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                                                <span className="text-green-600">💰</span>
                                                Tổng kết toàn bộ
                                            </h4>

                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                                                <div className="text-center bg-white rounded-lg p-2 sm:p-3 shadow-sm">
                                                    <div className="text-lg sm:text-2xl font-bold text-blue-600">
                                                        {filteredRecords.filter(r => r.status === 'present').length +
                                                            filteredRecords.filter(r => r.status === 'late').length +
                                                            filteredRecords.filter(r => r.status === 'absent').length}
                                                    </div>
                                                    <div className="text-xs text-gray-600 leading-tight">
                                                        <span className="block sm:hidden">Buổi tính phí</span>
                                                        <span className="hidden sm:block">Tổng buổi tính phí</span>
                                                    </div>
                                                </div>

                                                <div className="text-center bg-white rounded-lg p-2 sm:p-3 shadow-sm">
                                                    <div className="text-lg sm:text-2xl font-bold text-green-600">
                                                        {filteredRecords.filter(r => r.status === 'present').length}
                                                    </div>
                                                    <div className="text-xs text-gray-600 leading-tight">
                                                        <span className="flex items-center justify-center gap-1">
                                                            <span className="text-green-500">✅</span>
                                                            <span>Có mặt</span>
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="text-center bg-white rounded-lg p-2 sm:p-3 shadow-sm">
                                                    <div className="text-lg sm:text-2xl font-bold text-yellow-600">
                                                        {filteredRecords.filter(r => r.status === 'late').length}
                                                    </div>
                                                    <div className="text-xs text-gray-600 leading-tight">
                                                        <span className="flex items-center justify-center gap-1">
                                                            <span className="text-yellow-500">⏰</span>
                                                            <span>Muộn</span>
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="text-center bg-white rounded-lg p-2 sm:p-3 shadow-sm">
                                                    <div className="text-lg sm:text-2xl font-bold text-red-600">
                                                        {filteredRecords.filter(r => r.status === 'absent').length}
                                                    </div>
                                                    <div className="text-xs text-gray-600 leading-tight">
                                                        <span className="flex items-center justify-center gap-1">
                                                            <span className="text-red-500">❌</span>
                                                            <span>Vắng</span>
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="text-center bg-white rounded-lg p-2 sm:p-3 shadow-sm">
                                                    <div className="text-lg sm:text-2xl font-bold text-purple-600">
                                                        {filteredRecords.filter(r => r.status === 'excused').length}
                                                    </div>
                                                    <div className="text-xs text-gray-600 leading-tight">
                                                        <span className="flex items-center justify-center gap-1">
                                                            <span className="text-purple-500">📝</span>
                                                            <span>Xin nghỉ</span>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Thêm một hàng mới cho tổng doanh thu */}
                                            <div className="mt-4 pt-4 border-t border-gray-200">
                                                <div className="text-center bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg p-3 sm:p-4">
                                                    <div className="text-xl sm:text-3xl font-bold text-emerald-600">
                                                        {(() => {
                                                            const totalFee = filteredRecords.reduce((sum, record) => {
                                                                const classInfo = classes.find(c => c.id === record.classId);
                                                                const sessionFee = classInfo?.feePerSession || 0;
                                                                // Tính phí cho tất cả trạng thái trừ "excused" (xin nghỉ)
                                                                const shouldCharge = record.status !== 'excused';
                                                                return sum + (shouldCharge ? sessionFee : 0);
                                                            }, 0);
                                                            return (
                                                                <>
                                                                    <span className="hidden sm:inline">{totalFee.toLocaleString('vi-VN')}₫</span>
                                                                    <span className="sm:hidden">{(totalFee / 1000).toFixed(0)}k₫</span>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="text-sm sm:text-base text-emerald-700 font-semibold mt-1 flex items-center justify-center gap-2">
                                                        <span className="text-green-500">💰</span>
                                                        <span className="block sm:hidden">Tổng doanh thu</span>
                                                        <span className="hidden sm:block">Tổng doanh thu (trừ Xin nghỉ)</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Empty state */}
                                    {filteredRecords.length === 0 && (
                                        <div className="text-center py-8 sm:py-12">
                                            <div className="text-gray-400 text-4xl sm:text-6xl mb-2 sm:mb-4">📋</div>
                                            <h3 className="text-base sm:text-lg font-medium text-gray-700 mb-1 sm:mb-2">Không có dữ liệu</h3>
                                            <p className="text-gray-500 text-xs sm:text-sm">
                                                Không tìm thấy bản ghi điểm danh nào với bộ lọc hiện tại.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {viewMode === 'calendar' && (
                        <div className="bg-white rounded-lg shadow-md p-3 sm:p-6">
                            {/* Calendar Header and Navigation */}
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate">
                                    {currentMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
                                </h3>
                                <div className="flex gap-1 sm:gap-2">
                                    <button
                                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                                        className="px-2 py-2 sm:px-3 sm:py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 active:bg-gray-400 touch-manipulation text-sm sm:text-base min-w-[40px] sm:min-w-auto flex items-center justify-center"
                                        aria-label="Tháng trước"
                                    >
                                        <span className="hidden sm:inline">← Tháng trước</span>
                                        <span className="sm:hidden">←</span>
                                    </button>
                                    <button
                                        onClick={() => setCurrentMonth(new Date())}
                                        className="px-2 py-2 sm:px-3 sm:py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 active:bg-blue-800 touch-manipulation text-sm sm:text-base min-w-[50px] sm:min-w-auto"
                                    >
                                        <span className="hidden sm:inline">Hôm nay</span>
                                        <span className="sm:hidden">Nay</span>
                                    </button>
                                    <button
                                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                                        className="px-2 py-2 sm:px-3 sm:py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 active:bg-gray-400 touch-manipulation text-sm sm:text-base min-w-[40px] sm:min-w-auto flex items-center justify-center"
                                        aria-label="Tháng sau"
                                    >
                                        <span className="hidden sm:inline">Tháng sau →</span>
                                        <span className="sm:hidden">→</span>
                                    </button>
                                </div>
                            </div>

                            {/* Legend - Responsive */}
                            <div className="mb-4 p-2 sm:p-3 bg-gray-50 rounded-lg">
                                <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Chú thích:</h4>
                                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-4 text-xs text-gray-600">
                                    <div className="flex items-center gap-1">
                                        <span className="text-green-600">✅</span>
                                        <span>Có mặt</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-yellow-600">⏰</span>
                                        <span>Muộn</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-blue-600">📋</span>
                                        <span>Xin nghỉ</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-red-600">❌</span>
                                        <span>Vắng mặt</span>
                                    </div>
                                    <div className="flex items-center gap-1 col-span-2 sm:col-span-1">
                                        <span className="text-blue-600">👁️</span>
                                        <span>Click để xem chi tiết</span>
                                    </div>
                                </div>
                            </div>

                            {/* Days of week header - Sticky on mobile */}
                            <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1 sm:mb-2 sticky top-0 z-20 bg-white">
                                {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(day => (
                                    <div key={day} className="p-1 sm:p-2 text-center text-xs sm:text-sm font-medium text-gray-500 bg-gray-50 rounded">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Grid - Mobile optimized */}
                            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                                {getDaysInMonth(currentMonth).map((day, index) => {
                                    if (!day) {
                                        return <div key={index} className="p-1 h-20 sm:h-36 bg-gray-50 rounded"></div>;
                                    }

                                    // Format date to match the format stored in Firebase (YYYY-MM-DD)
                                    const year = day.getFullYear();
                                    const month = String(day.getMonth() + 1).padStart(2, '0');
                                    const dayNum = String(day.getDate()).padStart(2, '0');
                                    const dateString = `${year}-${month}-${dayNum}`;

                                    const attendanceByDate = getAttendanceByDate();
                                    const dayAttendance = attendanceByDate[dateString] || [];

                                    // Group attendance by class
                                    const attendanceByClass: { [classId: string]: { present: number; absent: number; excused: number; late: number } } = {};
                                    dayAttendance.forEach(record => {
                                        if (!attendanceByClass[record.classId]) {
                                            attendanceByClass[record.classId] = { present: 0, absent: 0, excused: 0, late: 0 };
                                        }
                                        attendanceByClass[record.classId][record.status]++;
                                    });

                                    const isToday = day.toDateString() === new Date().toDateString();
                                    const hasData = dayAttendance.length > 0;
                                    const classCount = Object.keys(attendanceByClass).length;

                                    return (
                                        <div
                                            key={index}
                                            className={`p-1 h-20 sm:h-36 border border-gray-200 rounded cursor-pointer touch-manipulation transition-all duration-200 ${isToday ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-white'
                                                } ${hasData ? 'hover:shadow-md hover:scale-[1.02] active:scale-[0.98]' : 'hover:bg-gray-50'} relative overflow-hidden`}
                                            onClick={() => handleDateClick(dateString)}
                                        >
                                            {/* Date number with class count */}
                                            <div className="flex items-center justify-between mb-1 sticky top-0 bg-inherit z-10 border-b border-gray-100 pb-0.5">
                                                <span className="text-sm font-bold text-gray-900">
                                                    {day.getDate()}
                                                </span>
                                                {hasData && (
                                                    <span className="text-xs bg-blue-100 text-blue-600 px-1 rounded-full font-medium">
                                                        {classCount}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Attendance data - Mobile optimized */}
                                            {hasData && (
                                                <div className="space-y-0.5 text-xs overflow-y-auto" style={{ maxHeight: 'calc(100% - 30px)' }}>
                                                    {Object.entries(attendanceByClass).slice(0, 2).map(([classId, stats], idx) => {
                                                        const classInfo = classes.find(c => c.id === classId);
                                                        const className = classInfo ? classInfo.className : 'Unknown';
                                                        const total = stats.present + stats.absent + stats.late + stats.excused;

                                                        return (
                                                            <div key={classId} className="bg-white rounded border border-gray-200 p-1 shadow-sm hover:shadow-md transition-shadow">
                                                                {/* Class name - Mobile friendly */}
                                                                <div className="font-medium text-gray-800 truncate text-xs mb-0.5" title={className}>
                                                                    📚 <span className="hidden sm:inline">{className}</span>
                                                                    <span className="sm:hidden">{className.length > 8 ? className.substring(0, 8) + '...' : className}</span>
                                                                </div>

                                                                {/* Stats - Compact mobile layout */}
                                                                <div className="flex items-center justify-between text-xs">
                                                                    <div className="flex items-center gap-1 flex-wrap">
                                                                        {stats.present > 0 && (
                                                                            <div className="flex items-center gap-0.5">
                                                                                <span className="text-green-600">✅</span>
                                                                                <span className="font-medium text-green-600">{stats.present}</span>
                                                                            </div>
                                                                        )}
                                                                        {stats.late > 0 && (
                                                                            <div className="flex items-center gap-0.5">
                                                                                <span className="text-yellow-600">⏰</span>
                                                                                <span className="font-medium text-yellow-600">{stats.late}</span>
                                                                            </div>
                                                                        )}
                                                                        {stats.excused > 0 && (
                                                                            <div className="flex items-center gap-0.5">
                                                                                <span className="text-blue-600">📋</span>
                                                                                <span className="font-medium text-blue-600">{stats.excused}</span>
                                                                            </div>
                                                                        )}
                                                                        {stats.absent > 0 && (
                                                                            <div className="flex items-center gap-0.5">
                                                                                <span className="text-red-600">❌</span>
                                                                                <span className="font-medium text-red-600">{stats.absent}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}

                                                    {/* Show more indicator for mobile */}
                                                    {classCount > 2 && (
                                                        <div className="text-center py-0.5">
                                                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                                                +{classCount - 2} lớp
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Touch indicator for mobile */}
                                            {hasData && (
                                                <div className="absolute bottom-1 right-1 opacity-50 sm:opacity-0 sm:group-hover:opacity-50">
                                                    <span className="text-xs text-blue-500">👆</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Mobile-specific help text */}
                            <div className="mt-4 p-2 bg-blue-50 rounded-lg sm:hidden">
                                <p className="text-xs text-blue-700 text-center">
                                    💡 Nhấn vào ngày có dữ liệu để xem chi tiết đầy đủ
                                </p>
                            </div>
                        </div>
                    )}

                    {viewMode === 'stats' && (
                        <div className="space-y-6">
                            {/* Attendance by Class */}
                            <div className="bg-white rounded-lg shadow-md p-6">
                                <h3 className="text-lg font-semibold mb-4">Thống kê theo lớp học</h3>
                                <div className="grid gap-4">
                                    {classes.map(cls => {
                                        const classRecords = filteredRecords.filter(r => r.classId === cls.id);
                                        const present = classRecords.filter(r => r.status === 'present').length;
                                        const absent = classRecords.filter(r => r.status === 'absent').length;
                                        const late = classRecords.filter(r => r.status === 'late').length;
                                        const total = present + absent + late;

                                        if (total === 0) return null;

                                        return (
                                            <div key={cls.id} className="border border-gray-200 rounded-lg p-4">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h4 className="font-medium text-gray-800">{cls.className} - {cls.subject}</h4>
                                                    <span className="text-sm text-gray-600">Tổng: {total} buổi</span>
                                                </div>
                                                <div className="grid grid-cols-3 gap-4 text-sm">
                                                    <div className="text-green-600">
                                                        <span className="font-medium">Có mặt: {present}</span>
                                                        <div className="text-xs text-gray-500">
                                                            ({total > 0 ? ((present / total) * 100).toFixed(1) : 0}%)
                                                        </div>
                                                    </div>
                                                    <div className="text-yellow-600">
                                                        <span className="font-medium">Muộn: {late}</span>
                                                        <div className="text-xs text-gray-500">
                                                            ({total > 0 ? ((late / total) * 100).toFixed(1) : 0}%)
                                                        </div>
                                                    </div>
                                                    <div className="text-red-600">
                                                        <span className="font-medium">Vắng: {absent}</span>
                                                        <div className="text-xs text-gray-500">
                                                            ({total > 0 ? ((absent / total) * 100).toFixed(1) : 0}%)
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Progress bar */}
                                                <div className="mt-3 bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 h-2 rounded-full"
                                                        style={{
                                                            width: '100%',
                                                            background: `linear-gradient(to right, 
                                                                #10b981 0%, 
                                                                #10b981 ${(present / total) * 100}%, 
                                                                #f59e0b ${(present / total) * 100}%, 
                                                                #f59e0b ${((present + late) / total) * 100}%, 
                                                                #ef4444 ${((present + late) / total) * 100}%, 
                                                                #ef4444 100%)`
                                                        }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Attendance by Student */}
                            <div className="bg-white rounded-lg shadow-md p-6">
                                <h3 className="text-lg font-semibold mb-4">Thống kê theo học sinh</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Học sinh
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Lớp học
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Tổng buổi
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Có mặt
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Muộn
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Vắng
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Tỷ lệ có mặt
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {filteredStudents.map((student, index) => {
                                                const studentRecords = filteredRecords.filter(r => r.studentId === student.id);
                                                const present = studentRecords.filter(r => r.status === 'present').length;
                                                const absent = studentRecords.filter(r => r.status === 'absent').length;
                                                const late = studentRecords.filter(r => r.status === 'late').length;
                                                const total = present + absent + late;
                                                const attendanceRate = total > 0 ? ((present / total) * 100).toFixed(1) : "0";

                                                if (total === 0) return null;

                                                return (
                                                    <tr key={student.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div>
                                                                <div className="text-sm font-medium text-gray-900">
                                                                    {student.studentName}
                                                                </div>
                                                                <div className="text-sm text-gray-500">
                                                                    {student.studentEmail}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                            {getClassName(student.classId)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                                                            {total}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                                            <span className="text-sm font-medium text-green-600">
                                                                {present}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                                            <span className="text-sm font-medium text-yellow-600">
                                                                {late}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                                            <span className="text-sm font-medium text-red-600">
                                                                {absent}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                                            <div className="flex items-center justify-center">
                                                                <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-20 mr-2">
                                                                    <div
                                                                        className={`h-2 rounded-full ${parseFloat(attendanceRate) >= 80 ? 'bg-green-500' :
                                                                            parseFloat(attendanceRate) >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                                                            }`}
                                                                        style={{
                                                                            width: `${attendanceRate}%`
                                                                        }}
                                                                    ></div>
                                                                </div>
                                                                <span className={`text-sm font-medium ${parseFloat(attendanceRate) >= 80 ? 'text-green-600' :
                                                                    parseFloat(attendanceRate) >= 60 ? 'text-yellow-600' : 'text-red-600'
                                                                    }`}>
                                                                    {attendanceRate}%
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Monthly Attendance Trends */}
                            <div className="bg-white rounded-lg shadow-md p-6">
                                <h3 className="text-lg font-semibold mb-4">Xu hướng điểm danh theo tháng</h3>
                                <div className="grid gap-4">
                                    {(() => {
                                        // Group records by month
                                        const monthlyData: { [key: string]: { present: number; absent: number; excused: number; late: number } } = {};

                                        filteredRecords.forEach(record => {
                                            const month = record.date.substring(0, 7); // YYYY-MM format
                                            if (!monthlyData[month]) {
                                                monthlyData[month] = { present: 0, absent: 0, excused: 0, late: 0 };
                                            }
                                            monthlyData[month][record.status]++;
                                        });

                                        // Sort months
                                        const sortedMonths = Object.keys(monthlyData).sort().reverse().slice(0, 6);

                                        return sortedMonths.map(month => {
                                            const data = monthlyData[month];
                                            const total = data.present + data.absent + data.late;

                                            return (
                                                <div key={month} className="border border-gray-200 rounded-lg p-4">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <h4 className="font-medium text-gray-800">
                                                            {new Date(month + '-01').toLocaleDateString('vi-VN', {
                                                                month: 'long',
                                                                year: 'numeric'
                                                            })}
                                                        </h4>
                                                        <span className="text-sm text-gray-600">Tổng: {total} lượt</span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                                                        <div className="text-center p-2 bg-green-50 rounded">
                                                            <div className="text-green-600 font-medium">✅ {data.present}</div>
                                                            <div className="text-xs text-gray-500">Có mặt</div>
                                                        </div>
                                                        <div className="text-center p-2 bg-yellow-50 rounded">
                                                            <div className="text-yellow-600 font-medium">⏰ {data.late}</div>
                                                            <div className="text-xs text-gray-500">Muộn</div>
                                                        </div>
                                                        <div className="text-center p-2 bg-red-50 rounded">
                                                            <div className="text-red-600 font-medium">❌ {data.absent}</div>
                                                            <div className="text-xs text-gray-500">Vắng</div>
                                                        </div>
                                                    </div>
                                                    {/* Chart bar */}
                                                    <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                                                        <div className="h-full flex">
                                                            <div
                                                                className="bg-green-500"
                                                                style={{ width: `${(data.present / total) * 100}%` }}
                                                            ></div>
                                                            <div
                                                                className="bg-yellow-500"
                                                                style={{ width: `${(data.late / total) * 100}%` }}
                                                            ></div>
                                                            <div
                                                                className="bg-red-500"
                                                                style={{ width: `${(data.absent / total) * 100}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Date Details Modal */}
            {showDateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-gray-800">
                                    Chi tiết điểm danh - {formatDate(selectedDate)}
                                </h2>
                                <button
                                    onClick={closeModal}
                                    className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            {(() => {
                                const dayAttendance = getAttendanceForDate(selectedDate);

                                if (dayAttendance.length === 0) {
                                    return (
                                        <div className="text-center py-8 text-gray-500">
                                            Không có dữ liệu điểm danh cho ngày này
                                        </div>
                                    );
                                }

                                // Group attendance by class
                                const attendanceByClass: { [classId: string]: AttendanceData[] } = {};
                                dayAttendance.forEach(record => {
                                    if (!attendanceByClass[record.classId]) {
                                        attendanceByClass[record.classId] = [];
                                    }
                                    attendanceByClass[record.classId].push(record);
                                });

                                return (
                                    <div className="space-y-6">
                                        {/* Summary Statistics - Đã thêm card Xin nghỉ */}
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                            <div className="bg-gray-50 p-4 rounded-lg text-center">
                                                <div className="text-2xl font-bold text-gray-700">{dayAttendance.length}</div>
                                                <div className="text-sm text-gray-600">Tổng lượt điểm danh</div>
                                            </div>
                                            <div className="bg-green-50 p-4 rounded-lg text-center">
                                                <div className="text-2xl font-bold text-green-600">
                                                    {dayAttendance.filter(r => r.status === 'present').length}
                                                </div>
                                                <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                                                    <span className="text-green-500">✅</span>
                                                    <span>Có mặt</span>
                                                </div>
                                            </div>
                                            <div className="bg-yellow-50 p-4 rounded-lg text-center">
                                                <div className="text-2xl font-bold text-yellow-600">
                                                    {dayAttendance.filter(r => r.status === 'late').length}
                                                </div>
                                                <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                                                    <span className="text-yellow-500">⏰</span>
                                                    <span>Muộn</span>
                                                </div>
                                            </div>
                                            <div className="bg-red-50 p-4 rounded-lg text-center">
                                                <div className="text-2xl font-bold text-red-600">
                                                    {dayAttendance.filter(r => r.status === 'absent').length}
                                                </div>
                                                <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                                                    <span className="text-red-500">❌</span>
                                                    <span>Vắng mặt</span>
                                                </div>
                                            </div>
                                            <div className="bg-purple-50 p-4 rounded-lg text-center">
                                                <div className="text-2xl font-bold text-purple-600">
                                                    {dayAttendance.filter(r => r.status === 'excused').length}
                                                </div>
                                                <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                                                    <span className="text-purple-500">📝</span>
                                                    <span>Xin nghỉ</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Attendance by Class */}
                                        <div className="space-y-4">
                                            {Object.entries(attendanceByClass).map(([classId, classAttendance]) => {
                                                const classInfo = classes.find(c => c.id === classId);
                                                const presentCount = classAttendance.filter(r => r.status === 'present').length;
                                                const lateCount = classAttendance.filter(r => r.status === 'late').length;
                                                const absentCount = classAttendance.filter(r => r.status === 'absent').length;
                                                const excusedCount = classAttendance.filter(r => r.status === 'excused').length;

                                                return (
                                                    <div key={classId} className="border border-gray-200 rounded-lg overflow-hidden">
                                                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                                            <div className="flex items-center justify-between">
                                                                <h3 className="text-lg font-semibold text-gray-800">
                                                                    📚 {classInfo ? `${classInfo.className} - ${classInfo.subject}` : 'Lớp không xác định'}
                                                                </h3>
                                                                <div className="flex items-center space-x-4 text-sm flex-wrap">
                                                                    <span className="text-green-600 font-medium">
                                                                        ✅ {presentCount}
                                                                    </span>
                                                                    <span className="text-yellow-600 font-medium">
                                                                        ⏰ {lateCount}
                                                                    </span>
                                                                    <span className="text-red-600 font-medium">
                                                                        ❌ {absentCount}
                                                                    </span>
                                                                    <span className="text-purple-600 font-medium">
                                                                        📝 {excusedCount}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="p-4">
                                                            <div className="grid gap-3">
                                                                {classAttendance.map(record => (
                                                                    <div key={record.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg hover:shadow-sm">
                                                                        <div className="flex items-center space-x-3">
                                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${record.status === 'present' ? 'bg-green-500' :
                                                                                    record.status === 'late' ? 'bg-yellow-500' :
                                                                                        record.status === 'absent' ? 'bg-red-500' : 'bg-purple-500'
                                                                                }`}>
                                                                                {getStatusIcon(record.status)}
                                                                            </div>
                                                                            <div>
                                                                                <div className="font-medium text-gray-800">
                                                                                    {getStudentName(record.studentId)}
                                                                                </div>
                                                                                <div className="text-sm text-gray-500">
                                                                                    {students.find(s => s.id === record.studentId)?.studentEmail || 'Email không xác định'}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-center space-x-4">
                                                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                                                                                {record.status === 'present' ? 'Có mặt' :
                                                                                    record.status === 'late' ? 'Muộn' :
                                                                                        record.status === 'absent' ? 'Vắng mặt' : 'Xin nghỉ'}
                                                                            </span>
                                                                            {record.note && (
                                                                                <div className="text-sm text-gray-600 max-w-xs">
                                                                                    <span className="font-medium">Ghi chú:</span> {record.note}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200">
                            <div className="flex justify-end">
                                <button
                                    onClick={closeModal}
                                    className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


export default Attendance;