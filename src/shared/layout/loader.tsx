const Loader = ({ show }: { show: boolean }) => {
  return (
    show && (
      <div className="flex items-center justify-center h-screen absolute inset-0 bg-black/40 z-10">
        <div className="h-14 w-14 rounded-full border-8 border-gray-200 border-t-blue-500 animate-spin"></div>
      </div>
    )
  );
};

export default Loader;