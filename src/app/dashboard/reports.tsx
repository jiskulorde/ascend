// src/app/dashboard/reports.tsx
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

const data = [
  { month: "Jan", leads: 120, conversions: 45 },
  { month: "Feb", leads: 98, conversions: 38 },
  { month: "Mar", leads: 150, conversions: 70 },
  { month: "Apr", leads: 130, conversions: 65 },
];

export default function ReportsSection() {
  return (
    <Card className="rounded-2xl shadow-md border border-gray-200 bg-white">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-blue-700">Reports</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="leads" fill="#60A5FA" radius={[8, 8, 0, 0]} />
            <Bar dataKey="conversions" fill="#2563EB" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
