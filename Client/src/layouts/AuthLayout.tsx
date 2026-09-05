import type { ReactNode } from 'react';
import leftImage from '@/assets/left_image.png';

interface AuthLayoutProps {
  children: ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="hidden flex-col justify-center bg-primary px-xl py-xl lg:flex lg:w-1/2 lg:px-16 lg:py-16">
        <div className="max-w-lg">
          <h1 className="text-3xl font-bold leading-tight text-white lg:text-4xl">
            Clinical Content Governance, automated with trust.
          </h1>
          <p className="mt-md text-[#E2E8F0] text-base">
            Enforce safety and peer alignment across your clinic&#39;s landing portals, patient
            logins, and EMR communication workflows.
          </p>
          <img
            src={leftImage}
            alt=""
            className="mt-xl w-full h-[260px] rounded-lg object-cover shadow-sm"
          />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center bg-background px-md py-xl">
        <div className="w-full max-w-[420px]">{children}</div>
      </div>
    </div>
  );
};

export default AuthLayout;
