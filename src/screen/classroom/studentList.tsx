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
    phoneNumber?: string;
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

// Interface cho dữ liệu điểm danh - Đã cập nhật để bao gồm trạng thái 'excused'
interface AttendanceData {
    id: string;
    studentId: string;
    classId: string;
    date: string;
    status: 'present' | 'absent' | 'late' | 'excused' | 'makeup';
    note?: string;
    fee?: number;
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
    const [editingStudent, setEditingStudent] = useState<string | null>(null);
    const [editStudentName, setEditStudentName] = useState('');
    const [editStudentPhone, setEditStudentPhone] = useState('');

    // New toast message system
    const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);

    const [showAddStudent, setShowAddStudent] = useState(false);
    const [newStudentEmail, setNewStudentEmail] = useState('');
    const [newStudentPhoneNumber, setNewStudentPhoneNumber] = useState('');

    // States cho điểm danh - Đã cập nhật type để bao gồm 'excused'
    const [showAttendance, setShowAttendance] = useState(false);
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendanceData, setAttendanceData] = useState<{ [key: string]: 'present' | 'absent' | 'late' | 'excused' | 'makeup' }>({});
    const [attendanceNotes, setAttendanceNotes] = useState<{ [key: string]: string }>({});
    const [todayAttendance, setTodayAttendance] = useState<AttendanceData[]>([]);
    const [makeupFees, setMakeupFees] = useState<{ [key: string]: number }>({});

    // Thêm state cho allClasses và studentsByClass
    const [allClasses, setAllClasses] = useState<ClassData[]>([]);
    const [studentsByClass, setStudentsByClass] = useState<{ [classId: string]: StudentData[] }>({});

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

            // Cập nhật attendance data từ database - Thêm xử lý fee
            const existingAttendance: { [key: string]: 'present' | 'absent' | 'late' | 'excused' | 'makeup' } = {};
            const existingNotes: { [key: string]: string } = {};
            const existingFees: { [key: string]: number } = {}; // Thêm dòng này

            attendanceList.forEach(record => {
                existingAttendance[record.studentId] = record.status;
                if (record.note) existingNotes[record.studentId] = record.note;
                if (record.fee) existingFees[record.studentId] = record.fee; // Thêm dòng này
            });

            setAttendanceData(existingAttendance);
            setAttendanceNotes(existingNotes);
            setMakeupFees(existingFees); // Thêm dòng này
        } catch (error) {
            console.error('Lỗi khi tải điểm danh:', error);
        }
    };

    // Fetch tất cả lớp và học sinh nếu không có classId
    const fetchAllClassesAndStudents = async () => {
        if (!user?.uid) return;
        setLoading(true);
        try {
            // Lấy tất cả lớp của giáo viên
            const q = query(collection(db, 'classes'), where('teacherId', '==', user.uid));
            const classSnapshot = await getDocs(q);
            const classes: ClassData[] = [];
            for (const docSnap of classSnapshot.docs) {
                classes.push({ id: docSnap.id, ...docSnap.data() } as ClassData);
            }
            setAllClasses(classes);

            // Lấy học sinh của từng lớp
            const studentsMap: { [classId: string]: StudentData[] } = {};
            for (const classItem of classes) {
                const sq = query(collection(db, 'enrollments'), where('classId', '==', classItem.id));
                const studentSnapshot = await getDocs(sq);
                studentsMap[classItem.id] = studentSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as StudentData));
            }
            setStudentsByClass(studentsMap);
        } catch (error) {
            addMessage('error', 'Không thể tải danh sách lớp và học sinh');
        } finally {
            setLoading(false);
        }
    };

    // Load dữ liệu khi component mount
    useEffect(() => {
        if (classId) {
            fetchClassInfo();
            fetchStudents();
        } else if (user?.uid) {
            fetchAllClassesAndStudents();
        }
    }, [classId, user?.uid]);

    // Fetch điểm danh khi thay đổi ngày
    useEffect(() => {
        if (classId && showAttendance) {
            fetchTodayAttendance();
        }
    }, [attendanceDate, showAttendance]);

    // Lọc học sinh theo từ khóa
    const filteredStudents = students.filter(student =>
        student.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.phoneNumber && student.phoneNumber.includes(searchTerm))
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

            const enrollmentData = {
                studentId: 'pending',
                studentName: newStudentEmail.split('@')[0],
                studentEmail: newStudentEmail.trim(),
                classId: classId,
                enrolledAt: new Date(),
                status: 'active',
                phoneNumber: newStudentPhoneNumber.trim() // Thay description thành phoneNumber
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
            setNewStudentPhoneNumber('');
        } catch (error) {
            console.error('Lỗi khi thêm học sinh:', error);
            addMessage('error', 'Không thể thêm học sinh');
        }
    };

    // Function để bắt đầu chỉnh sửa thông tin học sinh
    const startEditStudent = (student: StudentData) => {
        setEditingStudent(student.id);
        setEditStudentName(student.studentName);
        setEditStudentPhone(student.phoneNumber || '');
    };

    // Function để hủy chỉnh sửa
    const cancelEditStudent = () => {
        setEditingStudent(null);
        setEditStudentName('');
        setEditStudentPhone('');
    };

    // Function để lưu thông tin chỉnh sửa
    const saveEditStudent = async (studentId: string) => {
        if (!editStudentName.trim()) {
            addMessage('error', 'Tên học sinh không được để trống');
            return;
        }

        try {
            await updateDoc(doc(db, 'enrollments', studentId), {
                studentName: editStudentName.trim(),
                phoneNumber: editStudentPhone.trim(),
                updatedAt: new Date()
            });

            addMessage('success', 'Cập nhật thông tin học sinh thành công');
            setEditingStudent(null);
            setEditStudentName('');
            setEditStudentPhone('');

            if (classId) {
                fetchStudents();
            } else {
                fetchAllClassesAndStudents();
            }
        } catch (error) {
            console.error('Lỗi khi cập nhật thông tin học sinh:', error);
            addMessage('error', 'Không thể cập nhật thông tin học sinh');
        }
    };

    // Xóa học sinh khỏi lớp
    const removeStudent = async (studentId: string, studentName: string, classIdArg?: string) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa học sinh "${studentName}" khỏi lớp?`)) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'enrollments', studentId));

            // Cập nhật tổng số học sinh
            const updateClassId = classIdArg || classId;
            if (updateClassId) {
                const classRef = doc(db, 'classes', updateClassId);
                // Không cần students.length, chỉ giảm đi 1
                await updateDoc(classRef, {
                    totalStudents: Math.max(0, (classInfo?.totalStudents || 1) - 1),
                    updatedAt: new Date()
                });
            }

            addMessage('success', 'Xóa học sinh thành công');
            if (classId) fetchStudents();
            else fetchAllClassesAndStudents();
        } catch (error) {
            console.error('Lỗi khi xóa học sinh:', error);
            addMessage('error', 'Không thể xóa học sinh');
        }
    };

    // Cập nhật trạng thái điểm danh với toggle - Đã cập nhật để bao gồm 'excused'
    const updateAttendanceStatus = (studentId: string, status: 'present' | 'absent' | 'late' | 'excused' | 'makeup') => {
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

        // Nếu bỏ chọn thì cũng xóa ghi chú và fee
        if (attendanceData[studentId] === status) {
            setAttendanceNotes(prev => {
                const newNotes = { ...prev };
                delete newNotes[studentId];
                return newNotes;
            });

            // Thêm xóa fee khi bỏ chọn
            if (status === 'makeup') {
                setMakeupFees(prev => {
                    const newFees = { ...prev };
                    delete newFees[studentId];
                    return newFees;
                });
            }
        }
    };

    // Thêm function mới sau updateAttendanceNote
    // Cập nhật phí bổ sung
    const updateMakeupFee = (studentId: string, fee: number) => {
        setMakeupFees(prev => ({
            ...prev,
            [studentId]: fee
        }));
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

            // Thêm điểm danh mới - Cập nhật để bao gồm fee
            const promises = Object.entries(attendanceData).map(async ([studentId, status]) => {
                const attendanceRecord = {
                    studentId,
                    classId,
                    date: attendanceDate,
                    status,
                    note: attendanceNotes[studentId] || '',
                    ...(status === 'makeup' && makeupFees[studentId] && { fee: makeupFees[studentId] }), // Thêm fee cho trạng thái makeup
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
        const allStudentsPresent = filteredStudents.every(student =>
            attendanceData[student.id] === 'present'
        );

        const allStudentsMarked = filteredStudents.every(student =>
            attendanceData[student.id] !== undefined
        );

        if (allStudentsPresent) {
            // Tất cả đã "present" -> Xóa hết
            setAttendanceData({});
            console.log('Đã bỏ chọn tất cả học sinh');
        } else if (allStudentsMarked) {
            // Tất cả đã có trạng thái nhưng không phải "present" -> Set all present
            const newAttendanceData = { ...attendanceData };
            filteredStudents.forEach(student => {
                newAttendanceData[student.id] = 'present';
            });
            setAttendanceData(newAttendanceData);
            console.log('Đã đánh dấu tất cả học sinh có mặt');
        } else {
            // Một số chưa có trạng thái -> Set all present
            const allPresent: { [key: string]: 'present' } = {};
            filteredStudents.forEach(student => {
                allPresent[student.id] = 'present';
            });
            setAttendanceData(allPresent);
            console.log('Đã đánh dấu tất cả học sinh có mặt');
        }
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

    // Đếm số lượng theo trạng thái điểm danh - Đã cập nhật để bao gồm 'excused'
    const getAttendanceCount = () => {
        const present = Object.values(attendanceData).filter(status => status === 'present').length;
        const absent = Object.values(attendanceData).filter(status => status === 'absent').length;
        const late = Object.values(attendanceData).filter(status => status === 'late').length;
        const excused = Object.values(attendanceData).filter(status => status === 'excused').length;
        const makeup = Object.values(attendanceData).filter(status => status === 'makeup').length; // Thêm dòng này
        return { present, absent, late, excused, makeup }; // Thêm makeup vào return
    };

    //Thay đổi trạng thái của học sinh
    const toggleStudentStatus = async (student: StudentData, classIdArg?: string) => {
        try {
            const newStatus = student.status === 'active' ? 'inactive' : 'active';
            await updateDoc(doc(db, 'enrollments', student.id), { status: newStatus });
            addMessage('success', `Đã chuyển trạng thái học sinh "${student.studentName}"`);
            if (classId) fetchStudents();
            else fetchAllClassesAndStudents();
        } catch (error) {
            addMessage('error', 'Không thể thay đổi trạng thái học sinh');
        }
    };

    if (!classId) {
        if (loading) {
            return (
                <div className="flex justify-center items-center min-h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    <p className="ml-4">Đang tải danh sách lớp và học sinh...</p>
                </div>
            );
        }
        if (allClasses.length === 0) {
            return (
                <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">Bạn chưa sở hữu lớp học nào.</p>
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
                <h1 className="text-3xl font-bold mb-6 text-gray-800">Tất cả học sinh của bạn</h1>
                <div className="space-y-8">
                    {allClasses.map((cls) => (
                        <div key={cls.id}>
                            <h2 className="text-xl font-bold mb-2 text-blue-700">{cls.className}</h2>
                            <div className="grid gap-4">
                                {(studentsByClass[cls.id] || []).length === 0 ? (
                                    <div className="text-gray-400 italic">Không có học sinh nào trong lớp này.</div>
                                ) : (
                                    studentsByClass[cls.id].map((student, index) => (
                                        <div
                                            key={student.id}
                                            className={`bg-white rounded-lg shadow-md p-4 border-l-4 transition-all hover:shadow-lg ${student.status === 'active' ? 'border-green-500' : 'border-red-500'
                                                }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                {/* Form chỉnh sửa hoặc hiển thị thông tin */}
                                                {editingStudent === student.id ? (
                                                    <div className="space-y-2">
                                                        <input
                                                            type="text"
                                                            value={editStudentName}
                                                            onChange={(e) => setEditStudentName(e.target.value)}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            placeholder="Tên học sinh"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={editStudentPhone}
                                                            onChange={(e) => setEditStudentPhone(e.target.value)}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            placeholder="Số điện thoại"
                                                        />
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => saveEditStudent(student.id)}
                                                                className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                                                            >
                                                                Lưu
                                                            </button>
                                                            <button
                                                                onClick={cancelEditStudent}
                                                                className="px-3 py-1 bg-gray-400 text-white rounded-md hover:bg-gray-500 text-sm"
                                                            >
                                                                Hủy
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <h3 className="text-lg font-semibold text-gray-800">
                                                            {student.studentName}
                                                        </h3>
                                                        <p className="text-sm text-gray-600 mb-1">
                                                            SĐT: {student.phoneNumber || 'Chưa có'}
                                                        </p>
                                                        <p className="text-xs text-blue-600">{classInfo?.className || ''}</p>
                                                        <p className="text-xs text-gray-500">
                                                            Ngày tham gia: {formatDate(student.enrolledAt)}
                                                        </p>
                                                    </div>
                                                )}
                                                {/* Nút thao tác */}
                                                <div className="flex gap-2 mt-3">
                                                    <button
                                                        onClick={() => startEditStudent(student)}
                                                        className="w-full border-blue-200 border px-2 py-2 text-xs rounded-md font-medium bg-blue-100 text-blue-800 hover:bg-blue-200"
                                                    >
                                                        Sửa
                                                    </button>
                                                    <button
                                                        onClick={() => toggleStudentStatus(student, cls.id)}
                                                        className={`px-3 py-1 text-xs rounded-md font-medium border transition-colors ${student.status === 'active'
                                                            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                                            : 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
                                                            }`}
                                                    >
                                                        {student.status === 'active' ? 'Đang học' : 'Ngưng học'}
                                                    </button>
                                                    {/* <button
                                                        onClick={() => removeStudent(student.id, student.studentName, cls.id)}
                                                        className="px-3 py-1 text-xs rounded-md font-medium bg-red-100 text-red-800 hover:bg-red-200"
                                                    >
                                                        Xóa
                                                    </button> */}
                                                </div>
                                            </div>

                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>
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
                        className={`transform transition-all duration-300 ease-out p-4 rounded-lg shadow-lg border-l-4 ${message.type === 'success'
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

                {/* Panel điểm danh - Đã cập nhật thống kê để bao gồm 'excused' */}
                {showAttendance && classInfo && user && user.uid === classInfo.teacherId && (
                    <div className="mb-6 p-3 md:p-4 bg-blue-50 rounded-lg border border-blue-200">
                        {/* Header Section */}
                        <div className="mb-4">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                                <h3 className="text-lg font-semibold text-blue-800">
                                    Điểm danh lớp học
                                </h3>

                                {/* Controls - Stack on mobile, inline on desktop */}
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                                    {/* Date picker */}
                                    <input
                                        type="date"
                                        value={attendanceDate}
                                        onChange={(e) => setAttendanceDate(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-md text-sm w-full sm:w-auto"
                                    />

                                    {/* Action buttons */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={markAllPresent}
                                            className="flex-1 sm:flex-none px-3 py-2 text-sm bg-green-100 text-green-800 rounded-md hover:bg-green-200 transition-colors whitespace-nowrap"
                                        >
                                            <span className="sm:hidden">Tất cả có mặt</span>
                                            <span className="hidden sm:inline">Tất cả có mặt</span>
                                        </button>

                                        <button
                                            onClick={saveAttendance}
                                            className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
                                        >
                                            <span className="sm:hidden">💾 Lưu</span>
                                            <span className="hidden sm:inline">💾 Lưu điểm danh</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Statistics Section */}
                        {Object.keys(attendanceData).length > 0 && (
                            <div className="mb-4 p-3 bg-white rounded-md border border-gray-100">
                                {/* Mobile: Grid layout for better space usage */}
                                <div className="grid grid-cols-2 sm:hidden gap-2 text-sm">
                                    <div className="flex items-center gap-1">
                                        <span className="text-green-600">✅</span>
                                        <span className="text-gray-700">Có mặt:</span>
                                        <span className="font-medium">{getAttendanceCount().present}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-red-600">❌</span>
                                        <span className="text-gray-700">Vắng:</span>
                                        <span className="font-medium">{getAttendanceCount().absent}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-yellow-600">⏰</span>
                                        <span className="text-gray-700">Muộn:</span>
                                        <span className="font-medium">{getAttendanceCount().late}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-blue-600">📝</span>
                                        <span className="text-gray-700">Xin nghỉ:</span>
                                        <span className="font-medium">{getAttendanceCount().excused}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-purple-600">🔄</span>
                                        <span className="text-gray-700">Bổ sung:</span>
                                        <span className="font-medium">{getAttendanceCount().makeup}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-gray-500">⚪</span>
                                        <span className="text-gray-700">Chưa điểm danh:</span>
                                        <span className="font-medium">{filteredStudents.length - Object.keys(attendanceData).length}</span>
                                    </div>
                                </div>

                                {/* Desktop: Horizontal layout */}
                                <div className="hidden sm:flex flex-wrap gap-4 lg:gap-6 text-sm">
                                    <span className="text-green-600 flex items-center gap-1">
                                        ✅ Có mặt: <span className="font-medium">{getAttendanceCount().present}</span>
                                    </span>
                                    <span className="text-red-600 flex items-center gap-1">
                                        ❌ Vắng: <span className="font-medium">{getAttendanceCount().absent}</span>
                                    </span>
                                    <span className="text-yellow-600 flex items-center gap-1">
                                        ⏰ Muộn: <span className="font-medium">{getAttendanceCount().late}</span>
                                    </span>
                                    <span className="text-blue-600 flex items-center gap-1">
                                        📝 Xin nghỉ: <span className="font-medium">{getAttendanceCount().excused}</span>
                                    </span>
                                    <span className="text-purple-600 flex items-center gap-1">
                                        🔄 Bổ sung: <span className="font-medium">{getAttendanceCount().makeup}</span>
                                    </span>
                                    <span className="text-gray-500 flex items-center gap-1">
                                        ⚪ Chưa điểm danh: <span className="font-medium">{filteredStudents.length - Object.keys(attendanceData).length}</span>
                                    </span>
                                </div>

                                {/* Summary bar for mobile */}
                                <div className="sm:hidden mt-3 pt-3 border-t border-gray-200">
                                    <div className="text-center text-sm text-gray-600">
                                        <span className="font-medium">Tổng cộng:</span> {filteredStudents.length} học sinh
                                    </div>
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
                            <input
                                type="text"
                                placeholder="Số điện thoại (tuỳ chọn)"
                                value={newStudentPhoneNumber}
                                onChange={(e) => setNewStudentPhoneNumber(e.target.value)}
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
                                    setNewStudentPhoneNumber('');
                                }}
                                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                            >
                                Hủy
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Danh sách học sinh - Đã thêm nút 'Xin nghỉ' */}
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
                            className={`bg-white rounded-lg shadow-md p-4 border-l-4 transition-all hover:shadow-lg ${student.status === 'active' ? 'border-green-500' : 'border-red-500'
                                }`}
                        >
                            {/* Mobile Layout: Stack vertically */}
                            <div className="lg:hidden">
                                {/* Student Info Section - Top */}
                                <div className="mb-4">
                                    <div className="flex items-start gap-3 mb-3">
                                        {/* Form chỉnh sửa hoặc hiển thị thông tin */}
                                        {editingStudent === student.id ? (
                                            <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    value={editStudentName}
                                                    onChange={(e) => setEditStudentName(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Tên học sinh"
                                                />
                                                <input
                                                    type="text"
                                                    value={editStudentPhone}
                                                    onChange={(e) => setEditStudentPhone(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Số điện thoại"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => saveEditStudent(student.id)}
                                                        className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                                                    >
                                                        Lưu
                                                    </button>
                                                    <button
                                                        onClick={cancelEditStudent}
                                                        className="px-3 py-1 bg-gray-400 text-white rounded-md hover:bg-gray-500 text-sm"
                                                    >
                                                        Hủy
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-800">
                                                    {student.studentName}
                                                </h3>
                                                <p className="text-sm text-gray-600 mb-1">
                                                    SĐT: {student.phoneNumber || 'Chưa có'}
                                                </p>
                                                <p className="text-xs text-blue-600">{classInfo?.className || ''}</p>
                                                <p className="text-xs text-gray-500">
                                                    Ngày tham gia: {formatDate(student.enrolledAt)}
                                                </p>
                                            </div>
                                        )}
                                        {/* Status Badge */}
                                        {showAttendance && attendanceData[student.id] && (
                                            <div className="ml-2">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${attendanceData[student.id] === 'present' ? 'bg-green-500 text-white' :
                                                    attendanceData[student.id] === 'late' ? 'bg-yellow-500 text-white' :
                                                        attendanceData[student.id] === 'absent' ? 'bg-red-500 text-white' :
                                                            attendanceData[student.id] === 'excused' ? 'bg-blue-500 text-white' :
                                                                attendanceData[student.id] === 'makeup' ? 'bg-purple-500 text-white' :
                                                                    'bg-gray-300 text-gray-700'
                                                    }`}>
                                                    {attendanceData[student.id] === 'present' ? '✅' :
                                                        attendanceData[student.id] === 'late' ? '⏰' :
                                                            attendanceData[student.id] === 'absent' ? '❌' :
                                                                attendanceData[student.id] === 'excused' ? '📝' :
                                                                    attendanceData[student.id] === 'makeup' ? '🔄' : '⚪'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Controls Section - Bottom */}
                                {showAttendance && classInfo && user && user.uid === classInfo.teacherId && (
                                    <div className="space-y-3">
                                        {/* Primary attendance buttons */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => updateAttendanceStatus(student.id, 'present')}
                                                className={`p-3 text-sm rounded-lg font-medium transition-all ${attendanceData[student.id] === 'present'
                                                    ? 'bg-green-500 text-white shadow-md'
                                                    : ' text-green-700 hover:bg-green-100 border border-green-200'
                                                    }`}
                                            >
                                                ✅ Có mặt
                                            </button>
                                            <button
                                                onClick={() => updateAttendanceStatus(student.id, 'absent')}
                                                className={`p-3 text-sm rounded-lg font-medium transition-all ${attendanceData[student.id] === 'absent'
                                                    ? 'bg-red-500 text-white shadow-md'
                                                    : ' text-red-700 hover:bg-red-100 border border-red-200'
                                                    }`}
                                            >
                                                ❌ Vắng
                                            </button>
                                        </div>

                                        {/* Secondary attendance buttons */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <button
                                                onClick={() => updateAttendanceStatus(student.id, 'late')}
                                                className={`p-2 text-xs rounded-lg font-medium transition-all ${attendanceData[student.id] === 'late'
                                                    ? 'bg-yellow-500 text-white shadow-md'
                                                    : ' text-yellow-700 hover:bg-yellow-100 border border-yellow-200'
                                                    }`}
                                            >
                                                ⏰ Muộn
                                            </button>
                                            <button
                                                onClick={() => updateAttendanceStatus(student.id, 'excused')}
                                                className={`p-2 text-xs rounded-lg font-medium transition-all ${attendanceData[student.id] === 'excused'
                                                    ? 'bg-blue-500 text-white shadow-md'
                                                    : ' text-blue-700 hover:bg-blue-100 border border-blue-200'
                                                    }`}
                                            >
                                                📝 Xin nghỉ
                                            </button>
                                            <button
                                                onClick={() => updateAttendanceStatus(student.id, 'makeup')}
                                                className={`p-2 text-xs rounded-lg font-medium transition-all ${attendanceData[student.id] === 'makeup'
                                                    ? 'bg-purple-500 text-white shadow-md'
                                                    : ' text-purple-700 hover:bg-purple-100 border border-purple-200'
                                                    }`}
                                            >
                                                🔄 Bổ sung
                                            </button>
                                        </div>

                                        {/* Makeup fee input - conditional */}
                                        {attendanceData[student.id] === 'makeup' && (
                                            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                                                <label className="block text-xs font-medium text-purple-700 mb-2">
                                                    Phí bổ sung (VNĐ)
                                                </label>
                                                <input
                                                    type="number"
                                                    placeholder="Nhập phí bổ sung..."
                                                    value={makeupFees[student.id] || ''}
                                                    onChange={(e) => updateMakeupFee(student.id, Number(e.target.value))}
                                                    className="w-full px-3 py-2 text-sm border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                                    min="0"
                                                    step="1000"
                                                />
                                            </div>
                                        )}

                                        {/* Notes input */}
                                        <div>
                                            <textarea
                                                placeholder="Ghi chú..."
                                                value={attendanceNotes[student.id] || ''}
                                                onChange={(e) => updateAttendanceNote(student.id, e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                                rows={2}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Remove button for non-attendance mode */}
                                {!showAttendance && classInfo && user && user.uid === classInfo.teacherId && (
                                    <div className="mt-3 pt-3 border-t border-gray-200 text-end">
                                        <button
                                            onClick={() => removeStudent(student.id, student.studentName)}
                                            className="px-4 py-2 mt-2 mb-2 text-sm rounded-lg font-medium bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors"
                                        >
                                            🗑️ Xóa học sinh
                                        </button>
                                        <button
                                            onClick={() => startEditStudent(student)}
                                            className="w-full border-blue-200 border px-2 py-2 text-xs rounded-md font-medium bg-blue-100 text-blue-800 hover:bg-blue-200"
                                        >
                                            Sửa
                                        </button>
                                        <button
                                            onClick={() => toggleStudentStatus(student)}
                                            className={`w-full mt-2 px-4 py-2 text-sm rounded-lg font-medium border transition-colors ${student.status === 'active'
                                                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                                : 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
                                                }`}
                                        >
                                            {student.status === 'active' ? 'Đang học' : 'Ngưng học'}
                                        </button>


                                    </div>
                                )}
                            </div>

                            {/* Desktop Layout: Horizontal */}
                            <div className="hidden lg:flex justify-between items-center">
                                <div className="flex-1">
                                    <div className="flex items-center gap-4">
                                        {/* Form chỉnh sửa hoặc hiển thị thông tin */}
                                        {editingStudent === student.id ? (
                                            <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    value={editStudentName}
                                                    onChange={(e) => setEditStudentName(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Tên học sinh"
                                                />
                                                <input
                                                    type="text"
                                                    value={editStudentPhone}
                                                    onChange={(e) => setEditStudentPhone(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Số điện thoại"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => saveEditStudent(student.id)}
                                                        className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                                                    >
                                                        Lưu
                                                    </button>
                                                    <button
                                                        onClick={cancelEditStudent}
                                                        className="px-3 py-1 bg-gray-400 text-white rounded-md hover:bg-gray-500 text-sm"
                                                    >
                                                        Hủy
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-800">
                                                    {student.studentName}
                                                </h3>
                                                <p className="text-sm text-gray-600 mb-1">
                                                    SĐT: {student.phoneNumber || 'Chưa có'}
                                                </p>
                                                <p className="text-xs text-blue-600">{classInfo?.className || ''}</p>
                                                <p className="text-xs text-gray-500">
                                                    Ngày tham gia: {formatDate(student.enrolledAt)}
                                                </p>
                                            </div>
                                        )}

                                        {/* Desktop Attendance controls */}
                                        {showAttendance && classInfo && user && user.uid === classInfo.teacherId && (
                                            <div className="flex flex-col gap-2 min-w-96">
                                                <div className="grid grid-cols-3 gap-2">
                                                    <button
                                                        onClick={() => updateAttendanceStatus(student.id, 'present')}
                                                        className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${attendanceData[student.id] === 'present'
                                                            ? 'bg-green-500 text-white shadow-md'
                                                            : 'border border-green-300 text-green-800 hover:bg-green-200'
                                                            }`}
                                                    >
                                                        ✅ Có mặt
                                                    </button>
                                                    <button
                                                        onClick={() => updateAttendanceStatus(student.id, 'late')}
                                                        className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${attendanceData[student.id] === 'late'
                                                            ? 'bg-yellow-500 text-white shadow-md'
                                                            : 'border border-yellow-300 text-yellow-800 hover:bg-yellow-200'
                                                            }`}
                                                    >
                                                        ⏰ Muộn
                                                    </button>
                                                    <button
                                                        onClick={() => updateAttendanceStatus(student.id, 'absent')}
                                                        className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${attendanceData[student.id] === 'absent'
                                                            ? 'bg-red-500 text-white shadow-md'
                                                            : 'border border-red-300 text-red-800 hover:bg-red-200'
                                                            }`}
                                                    >
                                                        ❌ Vắng
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        onClick={() => updateAttendanceStatus(student.id, 'excused')}
                                                        className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${attendanceData[student.id] === 'excused'
                                                            ? 'bg-blue-500 text-white shadow-md'
                                                            : 'border border-blue-300 text-blue-800 hover:bg-blue-200'
                                                            }`}
                                                    >
                                                        📝 Xin nghỉ
                                                    </button>
                                                    <button
                                                        onClick={() => updateAttendanceStatus(student.id, 'makeup')}
                                                        className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${attendanceData[student.id] === 'makeup'
                                                            ? 'bg-purple-500 text-white shadow-md'
                                                            : 'border border-purple-300 text-purple-800 hover:bg-purple-200'
                                                            }`}
                                                    >
                                                        🔄 Bổ sung
                                                    </button>
                                                </div>

                                                {/* Desktop Makeup fee input */}
                                                {attendanceData[student.id] === 'makeup' && (
                                                    <input
                                                        type="number"
                                                        placeholder="Nhập phí bổ sung..."
                                                        value={makeupFees[student.id] || ''}
                                                        onChange={(e) => updateMakeupFee(student.id, Number(e.target.value))}
                                                        className="px-2 py-1 text-xs border border-purple-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                        min="0"
                                                        step="1000"
                                                    />
                                                )}

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

                                {/* Desktop Remove button */}
                                {!showAttendance && classInfo && user && user.uid === classInfo.teacherId && (
                                    <div className="flex items-center gap-3">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => startEditStudent(student)}
                                                className="w-full border-blue-200 border px-2 py-2 text-xs rounded-md font-medium bg-blue-100 text-blue-800 hover:bg-blue-200"
                                            >
                                                Sửa
                                            </button>
                                            <button
                                                onClick={() => toggleStudentStatus(student)}
                                                className={`px-3 py-1 text-xs rounded-md font-medium border transition-colors ${student.status === 'active'
                                                    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                                    : 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
                                                    }`}
                                            >
                                                {student.status === 'active' ? 'Đang học' : 'Ngưng học'}
                                            </button>
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