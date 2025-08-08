import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    collection,
    getDocs,
    query,
    where,
    doc,
    getDoc,
    addDoc,
    deleteDoc,
    updateDoc
} from 'firebase/firestore';
import { db } from '../../firebase';

// Interface cho dữ liệu học sinh
interface StudentData {
    id: string;
    studentId: string; // ID của user
    studentName: string;
    studentEmail: string;
    classId: string;
    enrolledAt: any;
    status: 'active' | 'inactive';
}

// Interface cho dữ liệu lớp học
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

// Interface cho dữ liệu điểm danh
interface AttendanceData {
    id: string;
    studentId: string;
    classId: string;
    date: string;
    status: 'present' | 'absent' | 'late';
    note?: string;
    createdAt: any;
}

// Interface cho Toast Message
interface ToastMessage {
    id: string;
    type: 'success' | 'error';
    text: string;
    timestamp: number;
}

interface StudentListProps {
    user: any;
}

const StudentList: React.FC<StudentListProps> = ({ user }) => {
    const { classId } = useParams<{ classId: string }>();
    const navigate = useNavigate();

    const [students, setStudents] = useState<StudentData[]>([]);
    const [classInfo, setClassInfo] = useState<ClassData | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // New toast message system
    const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
    
    const [showAddStudent, setShowAddStudent] = useState(false);
    const [newStudentEmail, setNewStudentEmail] = useState('');

    // States cho điểm danh
    const [showAttendance, setShowAttendance] = useState(false);
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendanceData, setAttendanceData] = useState<{ [key: string]: 'present' | 'absent' | 'late' }>({});
    const [attendanceNotes, setAttendanceNotes] = useState<{ [key: string]: string }>({});
    const [todayAttendance, setTodayAttendance] = useState<AttendanceData[]>([]);

    // Function to add toast message
    const addMessage = (type: 'success' | 'error', text: string) => {
        const newMessage: ToastMessage = {
            id: `${Date.now()}-${Math.random()}`,
            type,
            text,
            timestamp: Date.now()
        };
        
        setToastMessages(prev => [...prev, newMessage]);
        
        // Auto remove after 10 seconds
        setTimeout(() => {
            removeMessage(newMessage.id);
        }, 10000);
    };

    // Function to remove toast message
    const removeMessage = (id: string) => {
        setToastMessages(prev => prev.filter(msg => msg.id !== id));
    };

    // Fetch thông tin lớp học
    const fetchClassInfo = async () => {
        if (!classId) return;

        try {
            const classDoc = await getDoc(doc(db, 'classes', classId));
            if (classDoc.exists()) {
                setClassInfo({ id: classDoc.id, ...classDoc.data() } as ClassData);
            } else {
                addMessage('error', 'Không tìm thấy lớp học');
            }
        } catch (error) {
            console.error('Lỗi khi tải thông tin lớp học:', error);
            addMessage('error', 'Không thể tải thông tin lớp học');
        }
    };

    // Fetch danh sách học sinh
    const fetchStudents = async () => {
        if (!classId) return;

        setLoading(true);
        try {
            const q = query(
                collection(db, 'enrollments'),
                where('classId', '==', classId)
            );

            const querySnapshot = await getDocs(q);
            const studentList: StudentData[] = [];

            querySnapshot.forEach((doc) => {
                studentList.push({ id: doc.id, ...doc.data() } as StudentData);
            });

            setStudents(studentList);
        } catch (error) {
            console.error('Lỗi khi tải danh sách học sinh:', error);
            addMessage('error', 'Không thể tải danh sách học sinh');
        } finally {
            setLoading(false);
        }
    };

    // Fetch điểm danh hôm nay
    const fetchTodayAttendance = async () => {
        if (!classId) return;

        try {
            const q = query(
                collection(db, 'attendance'),
                where('classId', '==', classId),
                where('date', '==', attendanceDate)
            );

            const querySnapshot = await getDocs(q);
            const attendanceList: AttendanceData[] = [];

            querySnapshot.forEach((doc) => {
                attendanceList.push({ id: doc.id, ...doc.data() } as AttendanceData);
            });

            setTodayAttendance(attendanceList);

            // Cập nhật attendance data từ database
            const existingAttendance: { [key: string]: 'present' | 'absent' | 'late' } = {};
            const existingNotes: { [key: string]: string } = {};

            attendanceList.forEach(record => {
                existingAttendance[record.studentId] = record.status;
                if (record.note) existingNotes[record.studentId] = record.note;
            });

            setAttendanceData(existingAttendance);
            setAttendanceNotes(existingNotes);
        } catch (error) {
            console.error('Lỗi khi tải điểm danh:', error);
        }
    };

    // Load dữ liệu khi component mount
    useEffect(() => {
        if (classId) {
            fetchClassInfo();
            fetchStudents();
        }
    }, [classId]);

    // Fetch điểm danh khi thay đổi ngày
    useEffect(() => {
        if (classId && showAttendance) {
            fetchTodayAttendance();
        }
    }, [attendanceDate, showAttendance]);

    // Lọc học sinh theo từ khóa
    const filteredStudents = students.filter(student =>
        student.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentEmail.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Thêm học sinh vào lớp
    const addStudent = async () => {
        if (!newStudentEmail.trim() || !classId) return;

        try {
            // Kiểm tra xem học sinh đã có trong lớp chưa
            const existingStudent = students.find(s => s.studentEmail === newStudentEmail.trim());
            if (existingStudent) {
                addMessage('error', 'Học sinh đã có trong lớp');
                return;
            }

            // Thêm enrollment mới
            const enrollmentData = {
                studentId: 'pending', // Sẽ được cập nhật khi học sinh đăng ký
                studentName: newStudentEmail.split('@')[0], // Tạm thời dùng phần trước @ làm tên
                studentEmail: newStudentEmail.trim(),
                classId: classId,
                enrolledAt: new Date(),
                status: 'active'
            };

            await addDoc(collection(db, 'enrollments'), enrollmentData);

            // Cập nhật tổng số học sinh trong lớp
            if (classInfo) {
                const classRef = doc(db, 'classes', classId);
                await updateDoc(classRef, {
                    totalStudents: students.length + 1,
                    updatedAt: new Date()
                });
            }

            addMessage('success', 'Thêm học sinh thành công');
            setNewStudentEmail('');
            setShowAddStudent(false);
            fetchStudents();
        } catch (error) {
            console.error('Lỗi khi thêm học sinh:', error);
            addMessage('error', 'Không thể thêm học sinh');
        }
    };

    // Xóa học sinh khỏi lớp
    const removeStudent = async (studentId: string, studentName: string) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa học sinh "${studentName}" khỏi lớp?`)) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'enrollments', studentId));

            // Cập nhật tổng số học sinh
            if (classInfo && classId) {
                const classRef = doc(db, 'classes', classId);
                await updateDoc(classRef, {
                    totalStudents: Math.max(0, students.length - 1),
                    updatedAt: new Date()
                });
            }

            addMessage('success', 'Xóa học sinh thành công');
            fetchStudents();
        } catch (error) {
            console.error('Lỗi khi xóa học sinh:', error);
            addMessage('error', 'Không thể xóa học sinh');
        }
    };

    // Cập nhật trạng thái điểm danh với toggle
    const updateAttendanceStatus = (studentId: string, status: 'present' | 'absent' | 'late') => {
        setAttendanceData(prev => {
            const currentStatus = prev[studentId];

            // Nếu click vào nút đang được kích hoạt, thì bỏ chọn (xóa khỏi object)
            if (currentStatus === status) {
                const newData = { ...prev };
                delete newData[studentId];
                return newData;
            }

            // Nếu không thì set trạng thái mới
            return {
                ...prev,
                [studentId]: status
            };
        });

        // Nếu bỏ chọn thì cũng xóa ghi chú
        if (attendanceData[studentId] === status) {
            setAttendanceNotes(prev => {
                const newNotes = { ...prev };
                delete newNotes[studentId];
                return newNotes;
            });
        }
    };

    // Cập nhật ghi chú điểm danh
    const updateAttendanceNote = (studentId: string, note: string) => {
        setAttendanceNotes(prev => ({
            ...prev,
            [studentId]: note
        }));
    };

    // Lưu điểm danh
    const saveAttendance = async () => {
        if (!classId) return;

        try {
            // Xóa điểm danh cũ cho ngày này
            const existingAttendance = todayAttendance;
            for (const record of existingAttendance) {
                await deleteDoc(doc(db, 'attendance', record.id));
            }

            // Thêm điểm danh mới
            const promises = Object.entries(attendanceData).map(async ([studentId, status]) => {
                const attendanceRecord = {
                    studentId,
                    classId,
                    date: attendanceDate,
                    status,
                    note: attendanceNotes[studentId] || '',
                    createdAt: new Date()
                };

                return addDoc(collection(db, 'attendance'), attendanceRecord);
            });

            await Promise.all(promises);

            addMessage('success', 'Lưu điểm danh thành công');
            fetchTodayAttendance();
        } catch (error) {
            console.error('Lỗi khi lưu điểm danh:', error);
            addMessage('error', 'Không thể lưu điểm danh');
        }
    };

    // Điểm danh tất cả có mặt
    const markAllPresent = () => {
        const allPresent: { [key: string]: 'present' } = {};
        filteredStudents.forEach(student => {
            allPresent[student.id] = 'present';
        });
        setAttendanceData(allPresent);
    };

    // Format ngày tháng
    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'N/A';

        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (error) {
            return 'N/A';
        }
    };

    // Đếm số lượng theo trạng thái điểm danh
    const getAttendanceCount = () => {
        const present = Object.values(attendanceData).filter(status => status === 'present').length;
        const absent = Object.values(attendanceData).filter(status => status === 'absent').length;
        const late = Object.values(attendanceData).filter(status => status === 'late').length;
        return { present, absent, late };
    };

    if (!classId) {
        return (
            <div className="text-center py-12">
                <p className="text-red-500">Không tìm thấy ID lớp học</p>
                <button
                    onClick={() => navigate('/classList')}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    Quay lại danh sách lớp
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                <p className="ml-4">Đang tải danh sách học sinh...</p>
            </div>
        );
    }

    // Kiểm tra quyền truy cập (chỉ giáo viên của lớp mới được xem)
    if (classInfo && user && user.uid !== classInfo.teacherId) {
        return (
            <div className="text-center py-12">
                <p className="text-red-500">Bạn không có quyền xem danh sách học sinh của lớp này</p>
                <button
                    onClick={() => navigate('/classList')}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    Quay lại danh sách lớp
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* Toast Notification Container */}
            <div className="fixed top-20 right-4 z-1000 space-y-2 max-w-sm">
                {toastMessages.map((message) => (
                    <div
                        key={message.id}
                        className={`transform transition-all duration-300 ease-out p-4 rounded-lg shadow-lg border-l-4 ${
                            message.type === 'success'
                                ? 'bg-white border-green-500 text-green-800'
                                : 'bg-white border-red-500 text-red-800'
                        }`}
                        style={{
                            animation: 'slideInRight 0.3s ease-out',
                            animationFillMode: 'both'
                        }}
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

            {/* Add CSS animation keyframes */}
            <style dangerouslySetInnerHTML={{
                __html: `
                    @keyframes slideInRight {
                        from {
                            transform: translateX(100%);
                            opacity: 0;
                        }
                        to {
                            transform: translateX(0);
                            opacity: 1;
                        }
                    }
                `
            }} />

            {/* Header với thông tin lớp học */}
            <div className="mb-6">
                <div className="flex items-center mb-4">
                    <button
                        onClick={() => navigate('/classList')}
                        className="mr-4 px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                        ← Quay lại
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">
                            Danh Sách Học Sinh
                        </h1>
                        {classInfo && (
                            <p className="text-lg text-gray-600">
                                Lớp: <span className="font-semibold">{classInfo.className}</span> |
                                Môn: <span className="font-semibold">{classInfo.subject}</span>
                            </p>
                        )}
                    </div>
                </div>

                {/* Search và Actions */}
                <div className="flex flex-col md:flex-row gap-4 items-center mb-6">
                    <div className="flex-1 max-w-md">
                        <input
                            type="text"
                            placeholder="Tìm kiếm học sinh..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">
                            Tổng: {filteredStudents.length} học sinh
                        </span>

                        {classInfo && user && user.uid === classInfo.teacherId && (
                            <>
                                <button
                                    onClick={() => setShowAttendance(!showAttendance)}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                                >
                                    {showAttendance ? 'Ẩn điểm danh' : '📋 Điểm danh'}
                                </button>
                                <button
                                    onClick={() => setShowAddStudent(true)}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                                >
                                    + Thêm học sinh
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Panel điểm danh */}
                {showAttendance && classInfo && user && user.uid === classInfo.teacherId && (
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-blue-800">Điểm danh lớp học</h3>
                            <div className="flex items-center gap-4">
                                <input
                                    type="date"
                                    value={attendanceDate}
                                    onChange={(e) => setAttendanceDate(e.target.value)}
                                    className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                                />
                                <button
                                    onClick={markAllPresent}
                                    className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-md hover:bg-green-200"
                                >
                                    Tất cả có mặt
                                </button>
                                <button
                                    onClick={saveAttendance}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    💾 Lưu điểm danh
                                </button>
                            </div>
                        </div>

                        {/* Thống kê điểm danh */}
                        {Object.keys(attendanceData).length > 0 && (
                            <div className="mb-4 p-3 bg-white rounded-md">
                                <div className="flex gap-6 text-sm">
                                    <span className="text-green-600">✅ Có mặt: {getAttendanceCount().present}</span>
                                    <span className="text-red-600">❌ Vắng: {getAttendanceCount().absent}</span>
                                    <span className="text-yellow-600">⏰ Muộn: {getAttendanceCount().late}</span>
                                    <span className="text-gray-500">⚪ Chưa điểm danh: {filteredStudents.length - Object.keys(attendanceData).length}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Form thêm học sinh */}
                {showAddStudent && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-md">
                        <h3 className="text-lg font-semibold mb-3">Thêm học sinh mới</h3>
                        <div className="flex gap-3">
                            <input
                                type="email"
                                placeholder="Email học sinh"
                                value={newStudentEmail}
                                onChange={(e) => setNewStudentEmail(e.target.value)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={addStudent}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                Thêm
                            </button>
                            <button
                                onClick={() => {
                                    setShowAddStudent(false);
                                    setNewStudentEmail('');
                                }}
                                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                            >
                                Hủy
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Danh sách học sinh */}
            {filteredStudents.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">
                        {searchTerm ? 'Không tìm thấy học sinh nào phù hợp' : 'Lớp học chưa có học sinh nào'}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredStudents.map((student, index) => (
                        <div
                            key={student.id}
                            className={`bg-white rounded-lg shadow-md p-4 border-l-4 ${student.status === 'active' ? 'border-green-500' : 'border-red-500'
                                }`}
                        >
                            <div className="flex justify-between items-center">
                                <div className="flex-1">
                                    <div className="flex items-center gap-4">
                                        <span className="text-lg font-medium text-gray-800">
                                            #{index + 1}
                                        </span>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold text-gray-800">
                                                {student.studentName}
                                            </h3>
                                            <p className="text-sm text-gray-600">{student.studentEmail}</p>
                                            <p className="text-xs text-gray-500">
                                                Ngày tham gia: {formatDate(student.enrolledAt)}
                                            </p>
                                        </div>

                                        {/* Điểm danh controls */}
                                        {showAttendance && classInfo && user && user.uid === classInfo.teacherId && (
                                            <div className="flex flex-col gap-2 min-w-64">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => updateAttendanceStatus(student.id, 'present')}
                                                        className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${attendanceData[student.id] === 'present'
                                                            ? 'bg-green-500 text-white shadow-md'
                                                            : 'bg-green-100 text-green-800 hover:bg-green-200'
                                                            }`}
                                                    >
                                                        ✅ Có mặt
                                                    </button>
                                                    <button
                                                        onClick={() => updateAttendanceStatus(student.id, 'late')}
                                                        className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${attendanceData[student.id] === 'late'
                                                            ? 'bg-yellow-500 text-white shadow-md'
                                                            : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                                            }`}
                                                    >
                                                        ⏰ Muộn
                                                    </button>
                                                    <button
                                                        onClick={() => updateAttendanceStatus(student.id, 'absent')}
                                                        className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${attendanceData[student.id] === 'absent'
                                                            ? 'bg-red-500 text-white shadow-md'
                                                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                                                            }`}
                                                    >
                                                        ❌ Vắng
                                                    </button>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Ghi chú..."
                                                    value={attendanceNotes[student.id] || ''}
                                                    onChange={(e) => updateAttendanceNote(student.id, e.target.value)}
                                                    className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {!showAttendance && classInfo && user && user.uid === classInfo.teacherId && (
                                    <div className="flex items-center gap-3">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => removeStudent(student.id, student.studentName)}
                                                className="px-3 py-1 text-xs rounded-md font-medium bg-red-100 text-red-800 hover:bg-red-200"
                                            >
                                                Xóa
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StudentList;