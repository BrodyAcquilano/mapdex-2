//ProjectTitle.jsx

import "./ProjectTitle.css";
export default function ProjectTitle({projectName = "" }) {
  return (
    <div className="project-title" aria-label="Project Title">
      {projectName}
    </div>
  );
}
