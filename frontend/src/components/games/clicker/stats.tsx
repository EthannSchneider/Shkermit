const Stats = ({ clicksPerSecond, shkermitesPerClick }: { clicksPerSecond: number; shkermitesPerClick: number }) => {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl w-full">
      <h3 className="text-xl font-bold mb-3 text-purple-300">Stats</h3>
      <p className="text-2xl">
        Per second:
        <span className="text-green-400 font-bold">{clicksPerSecond.toLocaleString()}</span>
      </p>
      <p className="text-2xl">
        Per click:
        <span className="text-green-400 font-bold">{shkermitesPerClick.toLocaleString()}</span>
      </p>
      <p className="text-sm text-gray-400 mt-1">
        Shkermites per second = Clicks per second
      </p>
    </div>
  );
};

export default Stats;
