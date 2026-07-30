const Buttons = ({ onReset }: { onReset: () => void }) => {
  return (
    <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-2xl p-4 shadow-xl">
      <div className="flex justify-around items-center">
        <button
          onClick={() => onReset()}
          className="bg-linear-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white px-5 py-3 rounded-lg shadow-lg hover:shadow-red-500/50 transition-all duration-300 transform hover:scale-105 ring-2 ring-red-400/50"
        >
          Reset Game 🔄
        </button>
      </div>
    </div>
  );
};

export default Buttons;
