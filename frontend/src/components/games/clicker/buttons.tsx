const Buttons = ({ onReset }: { onReset: () => void }) => {
  return (
    <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-2xl p-4 shadow-xl">
      <div className="flex justify-between items-center">
        <button
          onClick={() => onReset()}
          className="bg-linear-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white px-5 py-3 rounded-lg shadow-lg hover:shadow-red-500/50 transition-all duration-300 transform hover:scale-105 ring-2 ring-red-400/50"
        >
          Reset Game 🔄
        </button>
        <button className="bg-linear-to-br from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-6 py-3 rounded-lg shadow-lg hover:shadow-blue-500/50 transition-all duration-300 transform hover:scale-105 ring-2 ring-blue-400/50 active:scale-95">
          ✨ Open a Crate ✨
        </button>
      </div>
    </div>
  );
};

export default Buttons;
