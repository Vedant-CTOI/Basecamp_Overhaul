// A picture, painted.
//
// Pictures arrive as printed fact. There is no develop-in: no
// grayscale ghost, no filter chemistry, no per-engagement curve to
// retune. A picture that lands mid-session simply appears, the same
// way one that was already there does — so the two cannot drift, and
// a reskin has nothing here to configure.
//
// Kept as a component because it is the one place a picture is
// painted: the object-fit and drag contract holds identically on the
// card mat, the expanded card, the contact sheet and the Stage. The
// name is the editorial skin's word (IMAGE_VOCAB's base register says
// Image); it predates the base register and is kept because the
// research and plan records on file cite it by name.

export default function PrintReveal({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={`block w-full h-full object-cover ${className}`}
      draggable={false}
    />
  );
}
