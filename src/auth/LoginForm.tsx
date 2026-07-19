import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { useAuth } from "../context/AuthContext";

type FormData = {
  email: string;
  password: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LABEL_TO_ID: Record<string, string> = {
  "Email address": "email",
  Password: "password",
};

function validate(data: FormData): FormErrors {
  const errors: FormErrors = {};

  if (!data.email.trim()) {
    errors.email = "Email is required";
  } else if (!EMAIL_REGEX.test(data.email.trim())) {
    errors.email = "Enter a valid email address";
  }

  if (!data.password) {
    errors.password = "Password is required";
  } else if (data.password.length < 6) {
    errors.password = "Must be at least 6 characters";
  }

  return errors;
}

export default function LoginForm() {
  const navigate = useNavigate();
  const user = useSelector((s: RootState) => s.userAuth.user);
  const { loading, login } = useAuth();
  const [data, setData] = useState<FormData>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<
    Partial<Record<keyof FormData, boolean>>
  >({});
  const [submitError, setSubmitError] = useState("");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/home" replace />;
  }

  const hasAnyValue = Object.values(data).some((v) => v.length > 0);

  function handleChange(field: keyof FormData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function handleBlur(field: keyof FormData) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    const validationErrors = validate(data);
    setErrors(validationErrors);
    setTouched({ email: true, password: true });

    if (Object.keys(validationErrors).length > 0) return;

    try {
      await login(data.email, data.password);
      navigate("/home");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="relative flex h-dvh items-center justify-center overflow-y-auto overflow-x-hidden bg-[#09090b] px-4 py-8">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-[128px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-500/10 blur-[128px]" />

      <div className="w-full max-w-md animate-message-in">
        <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 sm:p-8 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all duration-300 hover:border-white/[0.1]">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center">
              <img
                src="/CONVO_FLOW_LOGO.png"
                alt="ConvoFlow"
                className="h-full w-full object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-slate-400">
              Sign in to your account
            </p>
          </div>

          {submitError && (
            <div className="mb-4 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Field
              label="Email address"
              error={errors.email}
              touched={touched.email}
            >
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors peer-focus:text-blue-400" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={data.email}
                onBlur={() => handleBlur("email")}
                onChange={(e) => handleChange("email", e.target.value)}
                className={`peer w-full rounded-xl border bg-white/[0.04] py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 caret-blue-400 outline-none transition-all duration-200 focus:bg-white/[0.06] focus:ring-2 focus:ring-blue-500/15 ${
                  touched.email && errors.email
                    ? "border-red-500/60 focus:border-red-500/60 focus:ring-red-500/15"
                    : "border-white/[0.06] focus:border-blue-500/50"
                }`}
              />
            </Field>

            <Field
              label="Password"
              error={errors.password}
              touched={touched.password}
            >
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors peer-focus:text-blue-400" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={data.password}
                onBlur={() => handleBlur("password")}
                onChange={(e) => handleChange("password", e.target.value)}
                className={`peer w-full rounded-xl border bg-white/[0.04] py-3 pl-10 pr-10 text-sm text-white placeholder-slate-500 caret-blue-400 outline-none transition-all duration-200 focus:bg-white/[0.06] focus:ring-2 focus:ring-blue-500/15 ${
                  touched.password && errors.password
                    ? "border-red-500/60 focus:border-red-500/60 focus:ring-red-500/15"
                    : "border-white/[0.06] focus:border-blue-500/50"
                }`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-0.5 text-slate-600 transition-colors hover:text-slate-300"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </Field>

            <button
              type="submit"
              disabled={!hasAnyValue}
              className="group relative w-full cursor-pointer overflow-hidden rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                Sign in
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </span>
              <div className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-600">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="font-medium text-blue-400 underline-offset-2 transition-colors hover:text-blue-300 hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  touched,
  children,
}: {
  label: string;
  error?: string;
  touched?: boolean;
  children: React.ReactNode;
}) {
  const showError = touched && error;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={LABEL_TO_ID[label] ?? label.toLowerCase()}
        className="block text-sm font-medium text-slate-400 transition-colors peer-focus:text-blue-400"
      >
        {label}
      </label>
      <div className="relative">{children}</div>
      <div className="h-4">
        {showError && (
          <p className="animate-message-in text-xs text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
