import { InlineMath } from "react-katex";

export const RenderMathText = ({ text, courseId }) => {
  if (typeof text !== "string") return text;

  // Only render math for math/physics courses
  if (
    typeof courseId !== "string" ||
    (!courseId.toUpperCase().startsWith("MTH") &&
      !courseId.toUpperCase().startsWith("PHY") &&
      !courseId.toUpperCase().startsWith("COS") &&
      !courseId.toUpperCase().startsWith("CSM") &&
      !courseId.toUpperCase().startsWith("CSC") &&
      !courseId.toUpperCase().startsWith("CHM") &&
      !courseId.toUpperCase().startsWith("MAT") &&
      !courseId.toUpperCase().startsWith("BED122") &&
      !courseId.toUpperCase().startsWith("AMS102") &&
      !courseId.toUpperCase().startsWith("ECO"))
  ) {
    return <span>{text}</span>;
  }

  // Split by $ but keep math in between
  const parts = text.split(/(\$.*?\$)/g); // split and keep delimiters

  return (
    <>
      {parts.map((part, i) => {
        // If it starts and ends with $ it's math
        if (part.startsWith("$") && part.endsWith("$")) {
          const mathContent = part.slice(1, -1); // remove $ symbols
          return <InlineMath key={i} math={mathContent} />;
        }
        // Otherwise normal text
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};