import shkermitImage from "../../../assets/img/1 ShkermitRTX.png";

const Shkermit = ({ score, handleMainClick }: { score: number; handleMainClick: () => void }) => {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-2xl w-full flex flex-col h-[500px]">
      <div className="text-6xl mb-4">🖱️</div>
      <button
        type="button"
        onClick={handleMainClick}
        aria-label="Click Shkermit to earn shkermites"
        className="cursor-pointer rounded-lg hover:scale-110 transition-transform duration-200"
      >
        <img src={shkermitImage} alt="Shkermit" className="h-64 w-full object-contain" />
      </button>
      <div className="text-4xl font-bold text-center mt-6 text-yellow-400 drop-shadow-lg whitespace-nowrap">
        {score.toLocaleString()}
      </div>
      <div className="text-center text-sm text-gray-300 mt-2">
        shkermites
      </div>
    </div>
  );
};

export default Shkermit;
