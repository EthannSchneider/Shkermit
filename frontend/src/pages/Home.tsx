import Shkermit3D from "../components/shkermit3d";

export default function Home() {
  return (
    <>
      <Shkermit3D />
      <div className="flex flex-col items-center justify-center h-[95vh] text-white z-10 relative">
        <h1>Welcome to Shkermit.ch</h1>
      </div>
    </>
  );
}
