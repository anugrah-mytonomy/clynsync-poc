import Spinner from '@/components/ui/Spinner';

const PageLoader = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <Spinner className="h-10 w-10 text-primary" />
    </div>
  );
};

export default PageLoader;
