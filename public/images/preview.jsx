import React from "react";

export default function ProjectDetails({ project }) {
  if (!project) return <div>Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-12">

      {/* 🔝 HERO SECTION */}
      <section className="space-y-4">
        <h1 className="text-4xl font-bold">{project.title}</h1>
        <p className="text-gray-600 text-lg">{project.subtitle}</p>

        {/* Buttons */}
        <div className="flex gap-4">
          {project.github && (
            <a
              href={project.github}
              target="_blank"
              className="px-4 py-2 bg-black text-white rounded-xl"
            >
              GitHub
            </a>
          )}
          {project.dashboard && (
            <a
              href={project.dashboard}
              target="_blank"
              className="px-4 py-2 border rounded-xl"
            >
              Live Dashboard
            </a>
          )}
        </div>

        {/* Hero Image / Dashboard Preview */}
        <div className="mt-6">
          <img
            src={project.image}
            alt="dashboard preview"
            className="rounded-2xl shadow-lg w-full"
          />
        </div>
      </section>

      {/* ❗ PROBLEM */}
      <section>
        <h2 className="text-2xl font-semibold mb-2">The Problem</h2>
        <ul className="list-disc ml-6 text-gray-700 space-y-2">
          {project.problems.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </section>

      {/* 📊 REQUIREMENTS */}
      <section>
        <h2 className="text-2xl font-semibold mb-2">Business Requirements</h2>
        <ul className="list-disc ml-6 text-gray-700 space-y-2">
          {project.requirements.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </section>

      {/* 🚀 SOLUTION */}
      <section>
        <h2 className="text-2xl font-semibold mb-2">Solution</h2>
        <p className="text-gray-700">{project.solution}</p>
      </section>

      {/* 🧠 ARCHITECTURE */}
      <section>
        <h2 className="text-2xl font-semibold mb-2">Data Architecture</h2>
        <p className="text-gray-700">{project.architecture}</p>

        {project.architectureImage && (
          <img
            src={project.architectureImage}
            alt="architecture"
            className="mt-4 rounded-xl shadow"
          />
        )}
      </section>

      {/* 📊 DASHBOARD */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Dashboard</h2>

        {/* Option 1: iframe */}
        {project.dashboardEmbed && (
          <iframe
            src={project.dashboardEmbed}
            className="w-full h-[500px] rounded-xl border"
          />
        )}

        {/* Option 2: custom charts */}
        {project.customCharts && (
          <div>
            {/* כאן תכניס קומפוננטות גרפים שלך */}
            {project.customCharts}
          </div>
        )}
      </section>

      {/* 💡 INSIGHTS */}
      <section>
        <h2 className="text-2xl font-semibold mb-2">Key Insights</h2>
        <ul className="list-disc ml-6 text-gray-700 space-y-2">
          {project.insights.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </section>

      {/* 📈 METRICS */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Key Metrics</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {project.metrics.map((metric, idx) => (
            <div
              key={idx}
              className="p-4 border rounded-xl shadow-sm text-center"
            >
              <p className="text-gray-500 text-sm">{metric.label}</p>
              <p className="text-xl font-bold">{metric.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 🎯 IMPACT */}
      <section>
        <h2 className="text-2xl font-semibold mb-2">Business Impact</h2>
        <ul className="list-disc ml-6 text-gray-700 space-y-2">
          {project.impact.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </section>

    </div>
  );
}