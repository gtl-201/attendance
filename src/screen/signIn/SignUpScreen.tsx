import React, { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { useNavigate, Link } from 'react-router-dom';
import './SignUp.css';

interface FormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const SignUp: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showPassword2, setShowPassword2] = useState<boolean>(false);

  const [emailSent, setEmailSent] = useState<boolean>(false);
  const [verificationMessage, setVerificationMessage] = useState<string>('');
  const navigate = useNavigate();

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Full name validation
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Họ và tên là bắt buộc';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Họ và tên phải có ít nhất 2 ký tự';
    }

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email là bắt buộc';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email không hợp lệ';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Mật khẩu là bắt buộc';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Xác nhận mật khẩu là bắt buộc';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const user = userCredential.user;

      // Update user profile with display name
      await updateProfile(user, {
        displayName: formData.fullName
      });

      // Save additional user data to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        fullName: formData.fullName,
        email: formData.email,
        createdAt: new Date(),
        role: 'user',
        emailVerified: false
      });

      // Send email verification
      await sendEmailVerification(user);

      setEmailSent(true);
      setVerificationMessage(`Email xác thực đã được gửi đến ${formData.email}. Vui lòng kiểm tra hộp thư và nhấp vào liên kết xác thực để kích hoạt tài khoản.`);

      console.log('User registered successfully, verification email sent');

      // Don't navigate immediately, wait for email verification

    } catch (error: any) {
      console.error('Registration error:', error);

      // Handle specific Firebase errors
      if (error.code === 'auth/email-already-in-use') {
        setErrors({ email: 'Email này đã được sử dụng' });
      } else if (error.code === 'auth/weak-password') {
        setErrors({ password: 'Mật khẩu quá yếu' });
      } else if (error.code === 'auth/invalid-email') {
        setErrors({ email: 'Email không hợp lệ' });
      } else {
        setErrors({ email: 'Đã xảy ra lỗi. Vui lòng thử lại.' });
      }
    } finally {
      setLoading(false);
    }
  };

  // Resend verification email
  const resendVerificationEmail = async (): Promise<void> => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      await sendEmailVerification(auth.currentUser);
      setVerificationMessage('Email xác thực đã được gửi lại. Vui lòng kiểm tra hộp thư của bạn.');
    } catch (error) {
      console.error('Error resending verification email:', error);
      setVerificationMessage('Có lỗi xảy ra khi gửi lại email. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  // Check email verification status
  const checkVerificationStatus = (): void => {
    if (auth.currentUser) {
      auth.currentUser.reload().then(() => {
        if (auth.currentUser?.emailVerified) {
          // Update Firestore when email is verified
          setDoc(doc(db, 'users', auth.currentUser!.uid), {
            emailVerified: true
          }, { merge: true });

          setVerificationMessage('Email đã được xác thực thành công!');
          setTimeout(() => {
            navigate('/classList');
          }, 500);
        } else {
          setVerificationMessage('Email chưa được xác thực. Vui lòng kiểm tra hộp thư và nhấp vào liên kết xác thực.');
        }
      });
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-card">
        {!emailSent ? (
          <>
            <div className="signup-header">
              <h2>Đăng Ký Tài Khoản</h2>
              <p>Có tài khoản đi rồi cho dùng</p>
            </div>

            <form onSubmit={handleSubmit} className="signup-form">
              <div className="form-group">
                <label htmlFor="fullName">Họ và Tên</label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className={errors.fullName ? 'error' : ''}
                  placeholder="Nhập họ và tên của bạn"
                />
                {errors.fullName && <span className="error-message">{errors.fullName}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={errors.email ? 'error' : ''}
                  placeholder="example@email.com"
                />
                {errors.email && <span className="error-message">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="password">Mật khẩu</label>
                <div className="password-input">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={errors.password ? 'error' : ''}
                    placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? '👁️' : '🙈'}
                  </button>
                </div>
                {errors.password && <span className="error-message">{errors.password}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
                <div className="password-input">
                  <input
                    type={showPassword2 ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={errors.confirmPassword ? 'error' : ''}
                    placeholder="Nhập lại mật khẩu"
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword2(!showPassword2)}
                  >
                    {showPassword2 ? '👁️' : '🙈'}
                  </button>
                </div>
                {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
              </div>

              <button
                type="submit"
                className="signup-button"
                disabled={loading}
              >
                {loading ? 'Đang đăng ký...' : 'Đăng Ký'}
              </button>
            </form>

            <div className="signup-footer">
              <p>
                Đã có tài khoản?{' '}
                <Link to="/signin" className="login-link">
                  Đăng nhập ngay
                </Link>
              </p>
            </div>
          </>
        ) : (
          <div className="email-verification">
            <div className="verification-icon">
              📧
            </div>
            <h2>Xác Thực Email</h2>
            <p className="verification-message">
              {verificationMessage}
            </p>

            <div className="verification-actions">
              <button
                type="button"
                className="check-button"
                onClick={checkVerificationStatus}
                disabled={loading}
              >
                {loading ? 'Đang kiểm tra...' : 'Tôi đã xác thực'}
              </button>

              <button
                type="button"
                className="resend-button"
                onClick={resendVerificationEmail}
                disabled={loading}
              >
                {loading ? 'Đang gửi...' : 'Gửi lại email'}
              </button>
            </div>

            <div className="verification-footer">
              <p>Không nhận được email? Kiểm tra thư mục spam hoặc</p>
              <Link to="/login" className="login-link">
                Quay lại đăng nhập
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignUp;