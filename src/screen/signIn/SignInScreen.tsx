import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase';
import { Link } from 'react-router-dom';
import './SignIn.css';

interface SignInProps {
  onSignIn?: () => void;
}

const SignIn: React.FC<SignInProps> = ({ onSignIn }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);

      // Check if email is verified
      if (!userCredential.user.emailVerified) {
        setErrors({ general: 'Vui lòng xác thực email trước khi đăng nhập' });
        setLoading(false);
        return;
      }

      console.log('Đăng nhập thành công:', userCredential.user);
      if (onSignIn) onSignIn();

    } catch (error: any) {
      console.error('Lỗi đăng nhập:', error);

      let errorMessage = 'Đã xảy ra lỗi. Vui lòng thử lại.';

      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'Không tìm thấy tài khoản với email này';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Mật khẩu không chính xác';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Email không hợp lệ';
          break;
        case 'auth/user-disabled':
          errorMessage = 'Tài khoản đã bị vô hiệu hóa';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Quá nhiều lần thử. Vui lòng thử lại sau.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Lỗi kết nối mạng. Vui lòng kiểm tra internet.';
          break;
      }

      setErrors({ general: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  // Handle password reset
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email) {
      setErrors({ email: 'Vui lòng nhập email để reset mật khẩu' });
      return;
    }

    try {
      await sendPasswordResetEmail(auth, formData.email);
      setResetEmailSent(true);
      setShowResetPassword(false);
      setErrors({});
    } catch (error: any) {
      console.error('Lỗi reset password:', error);

      let errorMessage = 'Không thể gửi email reset mật khẩu';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Không tìm thấy tài khoản với email này';
      }

      setErrors({ general: errorMessage });
    }
  };

  return (
    <div className="signin-container">
      <div className="signin-form-container">
        <div className="signin-header">
          <h1>Đăng Nhập</h1>
          <p>Chào mừng trở lại! còn nhớ tài khoản chứ -.- ?</p>
        </div>

        {resetEmailSent && (
          <div className="success-message">
            <p>Email reset mật khẩu đã được gửi! Vui lòng kiểm tra hộp thư của bạn.</p>
          </div>
        )}

        {!showResetPassword ? (
          <form onSubmit={handleSubmit} className="signin-form">
            {errors.general && (
              <div className="error-message general-error">
                {errors.general}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Nhập email của bạn"
                className={errors.email ? 'error' : ''}
                disabled={loading}
              />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="password">Mật khẩu *</label>
              <div className="password-input">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Nhập mật khẩu của bạn"
                  className={errors.password ? 'error' : ''}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '🙈'}
                </button>
              </div>
              {errors.password && <span className="error-text">{errors.password}</span>}
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="forgot-password-btn"
                onClick={() => setShowResetPassword(true)}
                disabled={loading}
              >
                Quên mật khẩu?
              </button>
            </div>

            <button
              type="submit"
              className="signin-btn"
              disabled={loading}
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng Nhập'}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePasswordReset} className="reset-password-form">
            <h3>Reset Mật Khẩu</h3>
            <p>Có thế cũng quên, nhập email đi</p>

            {errors.general && (
              <div className="error-message general-error">
                {errors.general}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="resetEmail">Email *</label>
              <input
                type="email"
                id="resetEmail"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Nhập email của bạn"
                className={errors.email ? 'error' : ''}
              />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>

            <div className="reset-actions">
              <button type="submit" className="reset-btn">
                Gửi Email Reset
              </button>
              <button
                type="button"
                className="cancel-btn"
                onClick={() => {
                  setShowResetPassword(false);
                  setErrors({});
                }}
              >
                Hủy
              </button>
            </div>
          </form>
        )}

        <div className="signin-footer">
          <p>
            Chưa có tài khoản?
            <Link to="/signup" className="signup-link">
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignIn;