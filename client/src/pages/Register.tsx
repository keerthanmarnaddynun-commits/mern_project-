import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Mail, Lock, User, AlertCircle, CheckCircle, Eye, EyeOff, Sparkles, Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const criteria = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };

  const isComplexityMet =
    criteria.minLength &&
    criteria.hasUpper &&
    criteria.hasLower &&
    criteria.hasNumber &&
    criteria.hasSpecial;

  const getStrength = () => {
    if (!password) return { score: 0, label: '', color: 'bg-gray-200', text: 'text-gray-400' };
    const passedCount = Object.values(criteria).filter(Boolean).length;
    const commonWeak = ['password', '123456', 'qwerty', 'admin', 'welcome', 'college'];
    const hasCommon = commonWeak.some((w) => password.toLowerCase().includes(w));

    if (hasCommon || passedCount <= 2) {
      return { score: 1, label: 'Weak', color: 'bg-red-500', text: 'text-red-600' };
    }
    if (passedCount <= 4) {
      return { score: 2, label: 'Fair', color: 'bg-amber-500', text: 'text-amber-600' };
    }
    if (passedCount === 5 && password.length >= 12) {
      return { score: 4, label: 'Very Strong', color: 'bg-emerald-600', text: 'text-emerald-700' };
    }
    return { score: 3, label: 'Good', color: 'bg-emerald-500', text: 'text-emerald-600' };
  };

  const strength = getStrength();

  const handleGeneratePassword = () => {
    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowers = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const specials = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const all = uppers + lowers + numbers + specials;

    const chars = [
      uppers[Math.floor(Math.random() * uppers.length)],
      lowers[Math.floor(Math.random() * lowers.length)],
      numbers[Math.floor(Math.random() * numbers.length)],
      specials[Math.floor(Math.random() * specials.length)],
    ];

    for (let i = 4; i < 16; i++) {
      chars.push(all[Math.floor(Math.random() * all.length)]);
    }

    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    const generated = chars.join('');
    setPassword(generated);
    setConfirmPassword(generated);
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!isComplexityMet) {
      setError(
        'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.'
      );
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, fullName);
      setSuccess('Account created! Signing you in...');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-11 h-11 bg-blue-600 rounded-2xl flex items-center justify-center shadow-md">
              <Search className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">
              Lost and <span className="text-blue-600">Found</span>
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Create an account</h1>
          <p className="text-gray-500 text-sm">Join the community to report and find lost items</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {error && (
            <div className="mb-5 flex items-center gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="mb-5 flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Jane Smith"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@campus.edu"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                  Auto-Generate Strong Password
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Real-Time Password Strength Meter */}
              {password && (
                <div className="mt-2.5 p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Password Strength:</span>
                    <span className={`font-semibold ${strength.text}`}>{strength.label}</span>
                  </div>
                  {/* Segmented Progress Bar */}
                  <div className="grid grid-cols-4 gap-1.5 h-1.5">
                    {[1, 2, 3, 4].map((seg) => (
                      <div
                        key={seg}
                        className={`rounded-full h-full transition-all duration-300 ${
                          strength.score >= seg ? strength.color : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Complexity Criteria Checklist */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1 pt-1.5 text-xs text-gray-600">
                    <div className="flex items-center gap-1.5">
                      {criteria.minLength ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      )}
                      <span className={criteria.minLength ? 'text-emerald-700 font-medium' : ''}>
                        8+ characters
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {criteria.hasUpper ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      )}
                      <span className={criteria.hasUpper ? 'text-emerald-700 font-medium' : ''}>
                        Uppercase (A-Z)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {criteria.hasLower ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      )}
                      <span className={criteria.hasLower ? 'text-emerald-700 font-medium' : ''}>
                        Lowercase (a-z)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {criteria.hasNumber ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      )}
                      <span className={criteria.hasNumber ? 'text-emerald-700 font-medium' : ''}>
                        Number (0-9)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:col-span-2">
                      {criteria.hasSpecial ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      )}
                      <span className={criteria.hasSpecial ? 'text-emerald-700 font-medium' : ''}>
                        Special character (!@#$%...)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm mt-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

