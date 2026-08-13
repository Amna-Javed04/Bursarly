"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScholarshipDetail, getPendingScholarships, updateScholarshipAdmin, ApiError } from "@/app/lib/api";

export default function AdminDashboard() {
  const [scholarships, setScholarships] = useState<ScholarshipDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchScholarships();
  }, []);

  const fetchScholarships = async () => {
    try {
      setLoading(true);
      const data = await getPendingScholarships();
      setScholarships(data);
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setError("You do not have permission to view this page. Admin access required.");
      } else {
        setError(err.message || "Failed to load pending scholarships.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await updateScholarshipAdmin(id, { status: newStatus });
      // Remove it from the list after successful update
      setScholarships((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert("Failed to update status: " + (err.message || "Unknown error"));
    }
  };

  const handleEditName = async (scholarship: ScholarshipDetail) => {
    const newName = prompt("Edit scholarship name:", scholarship.name);
    if (!newName || newName === scholarship.name) return;
    try {
      await updateScholarshipAdmin(scholarship.id, { name: newName });
      setScholarships((prev) =>
        prev.map((s) => (s.id === scholarship.id ? { ...s, name: newName } : s))
      );
    } catch (err: any) {
      alert("Failed to update name: " + (err.message || "Unknown error"));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 animate-pulse">Loading Admin Dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-red-100 max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">Review scraped and pending scholarships</p>
          </div>
          <button
            onClick={fetchScholarships}
            className="text-sm font-medium text-teal-700 hover:text-teal-800"
          >
            Refresh List
          </button>
        </header>

        {scholarships.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No scholarships currently require review.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100/50 text-gray-600">
                  <tr>
                    <th className="py-4 px-6 font-medium">Name</th>
                    <th className="py-4 px-6 font-medium">Country</th>
                    <th className="py-4 px-6 font-medium">Status</th>
                    <th className="py-4 px-6 font-medium">Source</th>
                    <th className="py-4 px-6 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {scholarships.map((scholarship) => (
                    <tr key={scholarship.id} className="hover:bg-gray-50/50 transition">
                      <td className="py-4 px-6">
                        <p className="font-medium text-slate-900">{scholarship.name}</p>
                        <p className="text-xs text-gray-500 mt-1 truncate max-w-xs">
                          {scholarship.degree_level} • {scholarship.funding_type}
                        </p>
                      </td>
                      <td className="py-4 px-6 text-gray-700">{scholarship.country}</td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            scholarship.status === "needs_fix"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {scholarship.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-500">
                        {scholarship.source_type}
                        {scholarship.official_url && (
                          <a
                            href={scholarship.official_url}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-xs text-teal-600 hover:underline mt-1"
                          >
                            View Source
                          </a>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right space-x-3">
                        <button
                          onClick={() => handleEditName(scholarship)}
                          className="text-indigo-600 hover:text-indigo-700 font-medium transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(scholarship.id, "approved")}
                          className="text-emerald-600 hover:text-emerald-700 font-medium transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(scholarship.id, "rejected")}
                          className="text-red-600 hover:text-red-700 font-medium transition"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
