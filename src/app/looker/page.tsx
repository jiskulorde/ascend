"use client";

export default function LookerPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-6 py-10">
      {/* Page Header */}
      <div className="w-full max-w-6xl text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Analytics Dashboard</h1>
        <p className="text-gray-500 mt-2">
          View real-time insights and property performance powered by Looker Studio
        </p>
      </div>

      {/* Looker Embed */}
      <div className="w-full max-w-6xl bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200">
        <iframe
          title="Looker Studio Report"
          width="100%"
          height="1000" // creates a longer scroll space
          src="https://lookerstudio.google.com/embed/reporting/3ed86a87-726d-47b3-84ce-3eb22a965511/page/page_12345" 
          frameBorder="0"
          allowFullScreen
          className="rounded-2xl"
        ></iframe>
      </div>
    </div>
  );
}
