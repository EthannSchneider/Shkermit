import img1 from "../assets/img/1 ShkermitRTX.png";
import img2 from "../assets/img/2 Shkermit RTX PDP.png";
import img3 from "../assets/img/3 TeteShkermit RTX.png";
import img4 from "../assets/img/4 ShkermitMLG.png";
import img5 from "../assets/img/5 ShkermitMLG RTX.png";
import img6 from "../assets/img/6 ShkermitTHUG.png";
import img7 from "../assets/img/7 ShkermitTHUG RTX.png";
import img8 from "../assets/img/8 Shkermlette.png";
import img9 from "../assets/img/9 ShkermitDrinkIceTea.png";
import img10 from "../assets/img/10 ShkermitAlcoolique.jpg";
import img11 from "../assets/img/11 Shkermit MLG Thug Life WallPaper Modile.png";

const images = [
  img1,
  img2,
  img3,
  img4,
  img5,
  img6,
  img7,
  img8,
  img9,
  img10,
  img11,
];

export default function Picture() {
  return (
    <div className="flex flex-col items-center p-4 gap-4">
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={`image-${i}`}
          className="mx-auto my-2 max-h-64 object-contain"
        />
      ))}
    </div>
  );
}
