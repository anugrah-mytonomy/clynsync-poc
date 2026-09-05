import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { AppDispatch } from '@/app/store';
import { loginSchema, type LoginFormValues } from '@/schemas/loginSchema';
import { setToken } from '@/feature/auth/authSlice';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import PageLoader from '@/components/ui/PageLoader';
import logo from '@/assets/mytonomy_logo.png';

const LoginPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [isLoading, setIsLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    dispatch(setToken('mock-token'));
    navigate('/dashboard', { replace: true });
  };

  return (
    <>
      {isLoading && <PageLoader />}
      <div className="flex flex-col items-center gap-lg">
      <img src={logo} alt="Mytonomy" className="h-8 w-auto" />
      <div className="text-center">
        <h1 className="text-xl font-semibold text-slate-900">Welcome back</h1>
        <p className="mt-xs text-sm text-muted">Sign in to access the Clinical AI portal</p>
      </div>
      <form
        noValidate
        className="flex w-full flex-col gap-lg"
        onSubmit={handleSubmit(onSubmit)}
      >
        <Input
          label="Email"
          type="email"
          placeholder="clinic-lead@mytonomy.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" fullWidth isLoading={isLoading} disabled={isLoading}>
          Sign In
        </Button>
      </form>
      <p className="text-center text-sm text-muted">
        Need help accessing your account?
        <br />
        <a href="mailto:medops-admin@mytonomy.com" className="text-sky-500 hover:underline">
          Contact Medical Operations Admin
        </a>
      </p>
      </div>
    </>
  );
};

export default LoginPage;
